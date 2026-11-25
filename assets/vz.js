/* ==========================================================================
 * CMU 11-768 笔记 · 可视化引擎 vz.js（取自机器学习笔记那一份：带 VZ.eq 公式排版、虚线路径可逐段画出）
 *
 *  - 所有动画由一个「虚拟时钟」驱动：可暂停、可调速（0.5× / 1× / 2×）。
 *    不使用 CSS transition / animation，每帧用 requestAnimationFrame 计算属性值。
 *  - 每一步的终态在编译期累计算好（step._state），跳到第 i 步时画面瞬间摆好，接着播不穿帮。
 *  - 舞台常驻：一个场景里的对象只创建一次，步骤只改变它们的属性。
 *  - 数据流三件套：对象沿 path 飞（along + trail 拖影）、path 上的流动虚线（flow）、
 *    一串粒子沿 path 依次出发（fx: stream）。
 *  - prefers-reduced-motion：补间时长归零、关闭特效与拖影，仍可逐步查看。
 *
 *  用法（assets/viz/mN-*.js）：
 *    VZ.register({
 *      id:'m2-lora', title:'...', sources:[{t:'第 7 集', u:'https://...'}], note:'数字标「示意」的不是官方数',
 *      scenes:[{
 *        name:'场景名', desc:'一句话',
 *        code:{lang:'py', title:'示意代码', src:'...'}, dataTitle:'变量', data:{loss:2.31}, dataFmt:{loss:'fixed2'},
 *        dataMeter:{loss:[0,3,VZ.C.warn]},
 *        bg(d){ d.rect(...); d.text(...); },
 *        objects:{ tok:{type:'box', x:100, y:80, w:60, h:26, fill:VZ.C.dataW, text:'Bring', opacity:0},
 *                  wire:{type:'path', d:'M100,80 L400,80', flow:0, stroke:VZ.C.data} },
 *        steps:[{ say:'一句话', set:{tok:{x:{to:400,dur:700,delay:100,ease:'out'}, opacity:1}, wire:{flow:1}},
 *                 fx:[{type:'stream', path:'wire', n:5, at:0}, {type:'ripple', obj:'tok', at:800}],
 *                 log:'>>> loss.item()', data:{loss:{v:1.87, at:500}}, hl:[3,4] }]
 *      }]
 *    });
 * ========================================================================== */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DEFS = [];
  var UID = 0;

  /* 语义色（本站）：消息/数据/token=蓝，结果/正确/奖励=绿，动作/工具调用/更新=橙，模型/策略/计算=紫，错误/风险/瓶颈=红，未参与/已过去=灰 */
  var C = {
    data: 'var(--data)', ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)', neutral: 'var(--neutral)',
    fg: 'var(--fg)', fg2: 'var(--fg-2)', fg3: 'var(--fg-3)',
    bg: 'var(--bg-2)', bg2: 'var(--bg)', bg3: 'var(--bg-3)', line: 'var(--line-2)', line1: 'var(--line)',
    accent: 'var(--accent)',
    dataW: 'var(--data-weak)', okW: 'var(--ok-weak)', warnW: 'var(--warn-weak)', badW: 'var(--bad-weak)',
    infoW: 'var(--info-weak)', neutralW: 'var(--neutral-weak)'
  };

  /* ---------------- 小工具 ---------------- */
  function h(tag, attrs, parent, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function s(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function clone(o) { var r = {}; for (var k in o) { r[k] = {}; for (var p in o[k]) r[k][p] = o[k][p]; } return r; }

  /* ---------------- 缓动 ---------------- */
  var EASE = {
    linear: function (p) { return p; },
    in: function (p) { return p * p * p; },
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    back: function (p) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    bounce: function (p) {
      var n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
      return n * (p -= 2.625 / d) * p + 0.984375;
    }
  };

  /* ---------------- 颜色（解析 CSS 变量 → RGB，主题切换时失效重算） ---------------- */
  var colorCache = {};
  function parseColor(str) {
    str = (str || '').trim();
    var m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(str))) {
      return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    }
    if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(str))) {
      return [parseInt(m[1].substr(0, 2), 16), parseInt(m[1].substr(2, 2), 16), parseInt(m[1].substr(4, 2), 16),
        m[2] ? parseInt(m[2], 16) / 255 : 1];
    }
    if ((m = /^rgba?\(([^)]+)\)$/i.exec(str))) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    if (str === 'none' || str === 'transparent') return [0, 0, 0, 0];
    return null;
  }
  function rgb(c) {
    if (c in colorCache) return colorCache[c];
    var str = c, m = /^var\((--[\w-]+)\)$/.exec(c);
    if (m) str = getComputedStyle(document.documentElement).getPropertyValue(m[1]);
    return (colorCache[c] = parseColor(str));
  }
  function mixColor(a, b, p) {
    var A = rgb(a), B = rgb(b);
    if (!A || !B) return p < 0.5 ? a : b;
    var r = Math.round(A[0] + (B[0] - A[0]) * p), g = Math.round(A[1] + (B[1] - A[1]) * p),
      bl = Math.round(A[2] + (B[2] - A[2]) * p), al = A[3] + (B[3] - A[3]) * p;
    return 'rgba(' + r + ',' + g + ',' + bl + ',' + r2(al) + ')';
  }
  try {
    new MutationObserver(function () { colorCache = {}; VZ._all.forEach(function (v) { v.dirtyAll(); v.render(); }); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* 老浏览器 */ }

  /* ---------------- 数字格式 ---------------- */
  var FMT = {
    int: function (v) { return String(Math.round(v)); },
    hex: function (v) { return '0x' + (Math.round(v) >>> 0).toString(16); },
    hex8: function (v) { return '0x' + (Math.round(v) >>> 0).toString(16).padStart(8, '0'); },
    hex2: function (v) { return (Math.round(v) & 255).toString(16).padStart(2, '0'); },
    fixed1: function (v) { return v.toFixed(1); },
    fixed2: function (v) { return v.toFixed(2); },
    pct: function (v) { return Math.round(v) + '%'; },
    pct1: function (v) { return v.toFixed(1) + '%'; },
    fixed3: function (v) { return v.toFixed(3); },
    fixed4: function (v) { return v.toFixed(4); },
    fixed5: function (v) { return v.toFixed(5); },
    fixed6: function (v) { return v.toFixed(6); },
    sci: function (v) { return v === 0 ? '0' : v.toExponential(2); },
    signed1: function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1); },
    signed2: function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); },
    signed0: function (v) { v = Math.round(v); return (v >= 0 ? '+' : '−') + Math.abs(v); },
    comma: function (v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  };
  function fmtNum(f, v) { return typeof f === 'function' ? f(v) : (FMT[f] || FMT.int)(v); }

  /* ---------------- 代码高亮（够用即可的轻量分词） ---------------- */
  var KW = {
    c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while size_t uint8_t uint16_t uint32_t int8_t int32_t NULL bool true false',
    js: 'var let const function return if else for while new this class await async try catch throw typeof of in true false null undefined',
    sql: 'SELECT FROM WHERE AND OR INSERT INTO VALUES UPDATE SET DELETE DROP TABLE UNION ALL LIKE ORDER BY LIMIT NOT NULL CREATE select from where and or insert into values update set delete drop table union like',
    py: 'def return if elif else for while in import from as class with try except raise None True False and or not lambda pass yield assert is',
    json: 'true false null', yaml: 'true false null',
    go: 'func return if else for range var const type struct package import nil true false err',
    asm: 'push pop mov movl call ret leave add sub lea jmp cmp je jne nop xor int pushl popl addl subl',
    sh: 'echo export if then fi for do done in sudo',
    http: 'GET POST HTTP Host Cookie Set-Cookie Origin Referer Content-Type Location',
    text: ''
  };
  var KWSET = {};
  Object.keys(KW).forEach(function (k) { KWSET[k] = {}; KW[k].split(' ').forEach(function (w) { if (w) KWSET[k][w] = 1; }); });
  function hilite(lang, line) {
    if (lang === 'html') {
      return esc(line)
        .replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, '$1<b class="k">$2</b>')
        .replace(/([\w-]+)=(&quot;|")/g, '<i class="a">$1</i>=$2')
        .replace(/("[^"]*")/g, '<i class="s">$1</i>');
    }
    var cmt = lang === 'py' || lang === 'sh' || lang === 'yaml' ? '#' : lang === 'sql' ? '--' : lang === 'asm' ? ';' : '//';
    var set = KWSET[lang] || {};
    var out = '', i = 0, n = line.length;
    while (i < n) {
      var ch = line[i], rest = line.slice(i);
      if (rest.indexOf(cmt) === 0 || (lang !== 'asm' && rest.indexOf('/*') === 0)) { out += '<i class="c">' + esc(rest) + '</i>'; break; }
      if (ch === '"' || ch === "'") {
        var j = i + 1;
        while (j < n && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
        out += '<i class="s">' + esc(line.slice(i, j + 1)) + '</i>'; i = j + 1; continue;
      }
      var m = /^(0x[0-9a-fA-F]+|\d+(\.\d+)?)/.exec(rest);
      if (m && !/[\w]/.test(line[i - 1] || '')) { out += '<i class="n">' + m[0] + '</i>'; i += m[0].length; continue; }
      m = /^%?[A-Za-z_][\w]*/.exec(rest);
      if (m) {
        var w = m[0];
        if (set[w]) out += '<b class="k">' + w + '</b>';
        else if (w[0] === '%') out += '<i class="r">' + w + '</i>';
        else if (line[i + w.length] === '(') out += '<i class="f">' + w + '</i>';
        else out += esc(w);
        i += w.length; continue;
      }
      out += esc(ch); i++;
    }
    return out;
  }

  /* ---------------- 对象默认属性 ---------------- */
  var NUMP = { x: 1, y: 1, s: 1, rot: 1, opacity: 1, w: 1, h: 1, r: 1, dash: 1, t: 1, num: 1, x1: 1, y1: 1, x2: 1, y2: 1, sw: 1, size: 1, flow: 1 };
  var COLP = { fill: 1, stroke: 1, color: 1 };
  function defaults(sp) {
    var d = { x: sp.x || 0, y: sp.y || 0, s: sp.s == null ? 1 : sp.s, rot: sp.rot || 0, opacity: sp.opacity == null ? 1 : sp.opacity };
    var t = sp.type || 'box';
    if (t === 'box') {
      d.w = sp.w == null ? 80 : sp.w; d.h = sp.h == null ? 30 : sp.h; d.fill = sp.fill || C.bg; d.stroke = sp.stroke || C.line;
      d.sw = sp.sw == null ? 1.5 : sp.sw; d.text = sp.text == null ? '' : sp.text; d.color = sp.color || C.fg;
      if (sp.num != null) d.num = sp.num;
      if (sp.sub != null) d.sub = sp.sub;
    } else if (t === 'circle') {
      d.r = sp.r == null ? 14 : sp.r; d.fill = sp.fill || C.bg; d.stroke = sp.stroke || C.line; d.sw = sp.sw == null ? 1.5 : sp.sw;
      d.text = sp.text == null ? '' : sp.text; d.color = sp.color || C.fg;
    } else if (t === 'text') {
      d.text = sp.text == null ? '' : sp.text; d.color = sp.color || C.fg; d.size = sp.size || 14;
      if (sp.num != null) d.num = sp.num;
    } else if (t === 'path') {
      d.dash = sp.dash == null ? 1 : sp.dash; d.stroke = sp.stroke || C.line; d.sw = sp.sw || 2;
      if (sp.flow != null) d.flow = sp.flow;
    } else if (t === 'line') {
      d.x1 = sp.x1 || 0; d.y1 = sp.y1 || 0; d.x2 = sp.x2 || 0; d.y2 = sp.y2 || 0;
      d.stroke = sp.stroke || C.line; d.sw = sp.sw || 2; d.dash = sp.dash == null ? 1 : sp.dash;
    }
    if (sp.along) d.t = sp.t == null ? 0 : sp.t;
    return d;
  }

  /* ---------------- 编译场景：累计每一步的终态 ---------------- */
  var FXDUR = { ripple: 700, pulse: 650, burst: 700, shake: 450, float: 950, flash: 550, stream: 700 };
  function fxLen(f) {
    if (f.type === 'stream') return (f.dur || 700) + ((f.n || 5) - 1) * (f.gap || 110);
    return f.dur || FXDUR[f.type] || 600;
  }
  function compile(sc) {
    if (sc._ok) return;
    var objs = typeof sc.objects === 'function' ? sc.objects() : (sc.objects || {});
    sc._objs = objs;
    var cur = {};
    Object.keys(objs).forEach(function (id) { cur[id] = defaults(objs[id]); });
    sc._init = clone(cur);
    var data = {}; var dk = [];
    Object.keys(sc.data || {}).forEach(function (k) { data[k] = sc.data[k]; dk.push(k); });
    sc._data0 = Object.assign({}, data);
    var hlPrev = null, cum = 0;
    sc.steps.forEach(function (st, i) {
      var tracks = [], end = 0;
      Object.keys(st.set || {}).forEach(function (id) {
        if (!cur[id]) throw new Error('[vz] 场景「' + sc.name + '」第 ' + (i + 1) + ' 步引用了不存在的对象 ' + id);
        var props = st.set[id];
        Object.keys(props).forEach(function (p) {
          var v = props[p];
          var spec = (v !== null && typeof v === 'object' && !Array.isArray(v)) ? v : { to: v };
          var from = spec.from !== undefined ? spec.from : cur[id][p];
          var to = spec.to !== undefined ? spec.to : from;
          var dur = spec.dur != null ? spec.dur : (st.tdur != null ? st.tdur : 650);
          var delay = spec.delay || 0;
          if (p === 'text') dur = 0;
          if (RM) { dur = 0; delay = 0; }
          tracks.push({ id: id, p: p, from: from, to: to, dur: dur, delay: delay,
            ease: EASE[spec.ease || st.ease || 'inOut'] || EASE.inOut,
            kind: NUMP[p] ? 'n' : COLP[p] ? 'c' : 's' });
          cur[id][p] = to;
          end = Math.max(end, delay + dur);
        });
      });
      var fxEnd = 0;
      (st.fx || []).forEach(function (f) { fxEnd = Math.max(fxEnd, (f.at || 0) + fxLen(f)); });
      // 数据面板
      var dch = [];
      Object.keys(st.data || {}).forEach(function (k) {
        var v = st.data[k], at = 0;
        if (v !== null && typeof v === 'object') { at = v.at || 0; v = v.v; }
        if (RM) at = 0;
        dch.push({ k: k, from: data[k], to: v, at: at });
        if (dk.indexOf(k) < 0) dk.push(k);
        end = Math.max(end, at + (!RM && typeof v === 'number' && typeof data[k] === 'number' ? 500 : 0));
        data[k] = v;
      });
      // 控制台
      var logs = [];
      var L = st.log == null ? [] : Array.isArray(st.log) ? st.log : [st.log];
      L.forEach(function (l) {
        if (typeof l === 'string') l = { s: l };
        var at = RM ? 0 : (l.at || 0);
        logs.push({ s: l.s, cls: l.cls || (/^(\$|>>>) /.test(l.s) ? 'in' : 'out'), at: at });
        end = Math.max(end, at + (RM ? 0 : l.s.length * 16));
      });
      st._tracks = tracks;
      st._dch = dch;
      st._data = Object.assign({}, data);
      st._logs = logs;
      st._hl = st.hl != null ? st.hl : hlPrev;
      st._hlPrev = hlPrev;
      hlPrev = st._hl;
      st._anim = Math.max(end, st.dur || 0);
      st._stop = Math.max(st._anim, RM ? 0 : fxEnd);
      st._len = st._stop + (st.hold != null ? st.hold : 2200);
      st._state = clone(cur);
      st._cum = cum;
      cum += st._len;
    });
    sc._total = cum;
    sc._dkeys = dk;
    sc._ok = true;
  }

  /* ---------------- 播放器 ---------------- */
  var ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l12-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>'
  };

  function swatch(c, t) { return '<span><i style="background:' + c + '"></i>' + t + '</span>'; }
  var LEGEND0 = [[C.data, '消息 / 数据 / token'], [C.ok, '结果 / 正确 / 奖励'], [C.warn, '动作 / 工具调用 / 更新'],
    [C.info, '模型 / 策略 / 计算'], [C.bad, '错误 / 风险 / 瓶颈'], [C.neutral, '未参与 / 已过去']];
  function legendHtml(def) {
    return '<div class="vz-lg-h">颜色含义</div><div class="vz-lg-g">' +
      (def.legend || LEGEND0).map(function (x) { return swatch(x[0], x[1]); }).join('') +
      '</div><div class="vz-lg-h">快捷键（先点一下演示）</div>' +
      '<div class="vz-lg-k"><kbd>空格</kbd> 播放/暂停　<kbd>→</kbd> 单步　<kbd>←</kbd> 回退　点进度条圆点可跳到任意步</div>';
  }

  function Viz(host, def) {
    this.def = def; this.uid = ++UID;
    this.speed = 1; this.playing = false; this.idle = true; this.ended = false;
    this.vt = 0; this.k = 0; this.t = 0; this.prevT = -1; this.stopAt = null; this.jumped = false;
    this.fx = []; this.raf = 0; this.last = 0; this.visible = true;
    this.build(host);
    this.load(0);
    VZ._all.push(this);
  }

  Viz.prototype.build = function (host) {
    var self = this, def = this.def;
    var root = this.root = h('figure', { class: 'vz', tabindex: '0', contenteditable: 'false', 'data-gen': '',
      'aria-label': '可视化演示：' + def.title }, null);
    host.setAttribute('contenteditable', 'false');
    host.appendChild(root);
    var head = h('header', { class: 'vz-h' }, root);
    h('div', { class: 'vz-ttl' }, head, '<span class="vz-badge">可视化</span>' + esc(def.title));
    this.tabs = h('nav', { class: 'vz-tabs', role: 'tablist' }, head);
    def.scenes.forEach(function (sc, i) {
      var b = h('button', { class: 'vz-tab', role: 'tab', type: 'button' }, self.tabs,
        '<span>' + (i + 1) + '</span>' + esc(sc.name));
      b.onclick = function () { self.load(i); self.play(); };
    });
    this.helpBtn = h('button', { class: 'vz-help', type: 'button', title: '图例与快捷键', 'aria-label': '图例与快捷键' }, head, 'ⓘ 图例');
    var main = this.mainEl = h('div', { class: 'vz-main' }, root);
    var sb = h('div', { class: 'vz-stagebox' }, main);
    this.legend = h('div', { class: 'vz-legend' }, sb);
    this.legend.innerHTML = legendHtml(def);
    this.helpBtn.onclick = function () { self.legend.classList.toggle('show'); };
    this.zoomBtn = h('button', { class: 'vz-help', type: 'button', title: '放大到整个窗口 / 还原（Esc）', 'aria-label': '放大或还原' }, head, '⤢ 放大');
    this.zoomBtn.onclick = function () { self.setZoom(!root.classList.contains('vz-zoom')); };
    this.legend.onclick = function () { self.legend.classList.remove('show'); };
    this.svg = s('svg', { class: 'vz-svg', viewBox: '0 0 860 560', role: 'img' }, sb);
    this.big = h('button', { class: 'vz-big', type: 'button', 'aria-label': '播放' }, sb, ICON.play);
    this.big.onclick = function () { self.play(); };
    this.say = h('div', { class: 'vz-say', 'aria-live': 'polite' }, sb);
    var side = this.side = h('aside', { class: 'vz-side' }, main);
    this.codeBox = h('section', { class: 'vz-code' }, side);
    this.codeHead = h('div', { class: 'vz-ph' }, this.codeBox);
    this.codeView = h('div', { class: 'vz-cv' }, this.codeBox);
    this.hlBar = h('div', { class: 'vz-hl' }, this.codeView);
    this.codePre = h('div', { class: 'vz-pre' }, this.codeView);
    this.dataBox = h('section', { class: 'vz-data' }, side);
    this.dataHead = h('div', { class: 'vz-ph' }, this.dataBox);
    this.dataTbl = h('table', null, this.dataBox);
    this.conBox = h('section', { class: 'vz-con' }, side);
    h('div', { class: 'vz-ph' }, this.conBox, '控制台');
    this.conView = h('div', { class: 'vz-cl' }, this.conBox);

    var pl = h('div', { class: 'vz-player' }, root);
    this.bBack = h('button', { class: 'vz-b', type: 'button', title: '上一步（←）', 'aria-label': '上一步' }, pl, ICON.back);
    this.bPlay = h('button', { class: 'vz-b vz-pp', type: 'button', title: '播放 / 暂停（空格）', 'aria-label': '播放' }, pl, ICON.play);
    this.bNext = h('button', { class: 'vz-b', type: 'button', title: '单步（→）', 'aria-label': '单步' }, pl, ICON.next);
    this.track = h('div', { class: 'vz-track' }, pl);
    this.fill = h('div', { class: 'vz-fill' }, this.track);
    this.dots = h('div', { class: 'vz-dots' }, this.track);
    this.cnt = h('span', { class: 'vz-cnt' }, pl);
    var sp = h('div', { class: 'vz-speed', role: 'group', 'aria-label': '速度' }, pl);
    this.spBtns = [0.5, 1, 2].map(function (v) {
      var b = h('button', { type: 'button', class: v === 1 ? 'on' : '' }, sp, v + '×');
      b.onclick = function () { self.setSpeed(v); };
      return b;
    });
    this.bBack.onclick = function () { self.back(); };
    this.bNext.onclick = function () { self.next(); };
    this.bPlay.onclick = function () { self.toggle(); };

    if (def.sources && def.sources.length) {
      var cap = h('figcaption', { class: 'vz-src' }, root, '<b>出处</b>');
      def.sources.forEach(function (x) {
        var a = x.u ? h('a', { href: x.u, target: '_blank', rel: 'noopener' }, cap) : h('span', { class: 'vz-src-t' }, cap); a.textContent = x.t;
      });
      if (def.note) h('div', { class: 'vz-note' }, cap).textContent = def.note;
    }

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('vz-zoom')) { e.preventDefault(); self.setZoom(false); return; }
      if (e.target !== root && e.target.tagName !== 'BUTTON') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); self.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); self.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.back(); }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          self.visible = en.isIntersecting;
          if (!self.visible && self.playing) self.pause();
        });
      }, { threshold: 0.05 }).observe(root);
    }
    if (RM) root.classList.add('vz-rm');
  };

  /* ---- 场景装载：建 SVG 图层、静态背景、对象、代码、数据 ---- */
  Viz.prototype.load = function (i) {
    var self = this, sc = this.def.scenes[i];
    try { compile(sc); } catch (e) { console.error(e); this.say.textContent = String(e.message); return; }
    this.si = i; this.sc = sc;
    [].forEach.call(this.tabs.children, function (b, j) {
      b.classList.toggle('on', j === i); b.setAttribute('aria-selected', j === i);
    });
    if (this.def.scenes.length < 2) this.tabs.style.display = 'none';
    var svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (sc.viewBox) svg.setAttribute('viewBox', sc.viewBox);
    var defs = s('defs', null, svg);
    var pre = 'vz' + this.uid + '-';
    this.pre = pre;
    ['data', 'ok', 'warn', 'bad', 'info', 'neutral', 'fg', 'fg3'].forEach(function (k) {
      var m = s('marker', { id: pre + 'a-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7,
        orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }, defs);
      var col = k === 'fg3' ? 'var(--fg-3)' : k === 'fg' ? 'var(--fg)' : 'var(--' + k + ')';
      s('path', { d: 'M0,1 L10,5 L0,9 z', style: 'fill:' + col }, m);
    });
    this.Lbg = s('g', { class: 'vz-bg' }, svg);
    this.Ltrail = s('g', { class: 'vz-trail' }, svg);
    this.Lobj = s('g', { class: 'vz-obj' }, svg);
    this.Lfx = s('g', { class: 'vz-fx' }, svg);
    if (sc.bg) sc.bg(this.drawer(this.Lbg));
    // 对象
    this.O = {};
    var objs = sc._objs;
    Object.keys(objs).forEach(function (id) { self.mkObj(id, objs[id]); });
    // 代码
    if (sc.code) {
      this.codeBox.style.display = '';
      this.codeHead.innerHTML = '代码 <em>' + esc(sc.code.title || sc.code.lang || '') + '</em>';
      var lines = sc.code.src.replace(/\n$/, '').split('\n');
      this.codePre.innerHTML = lines.map(function (l, n) {
        return '<div class="vz-ln"><span class="vz-no">' + (n + 1) + '</span><span class="vz-tx">' +
          (hilite(sc.code.lang || 'text', l) || ' ') + '</span></div>';
      }).join('');
      this.lineEls = this.codePre.children;
    } else { this.codeBox.style.display = 'none'; this.lineEls = null; }
    // 数据
    if (sc._dkeys.length) {
      this.dataBox.style.display = '';
      this.dataHead.innerHTML = esc(sc.dataTitle || '数据');
      this.dataTbl.innerHTML = '';
      this.dRows = {};
      sc._dkeys.forEach(function (k) {
        var tr = h('tr', null, self.dataTbl);
        h('th', null, tr).textContent = k;
        var td = h('td', null, tr), val = h('span', null, td), R = { td: val, last: null, chg: false };
        var mt = (sc.dataMeter || {})[k];
        if (mt) { var bar = h('span', { class: 'vz-meter' }, td); R.meter = h('i', null, bar); R.mt = mt; if (mt[2]) R.meter.style.background = mt[2]; }
        self.dRows[k] = R;
      });
    } else { this.dataBox.style.display = 'none'; this.dRows = null; }
    // 控制台
    var hasLog = sc.steps.some(function (st) { return st._logs.length; });
    this.conBox.style.display = hasLog ? '' : 'none';
    this.conView.innerHTML = ''; this.conSig = '';
    var hasSide = !!(sc.code || sc._dkeys.length || hasLog);
    this.mainEl.classList.toggle('noside', !hasSide);
    // 圆点
    this.dots.innerHTML = '';
    sc.steps.forEach(function (st, j) {
      var d = h('button', { class: 'vz-dot', type: 'button', title: '第 ' + (j + 1) + ' 步：' + (st.say || ''),
        'aria-label': '跳到第 ' + (j + 1) + ' 步' }, self.dots);
      d.style.left = (100 * (st._cum + st._len) / sc._total) + '%';
      d.onclick = function (e) { e.stopPropagation(); self.seek(j); };
    });
    this.track.onclick = function (e) {
      var r = self.track.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * sc._total;
      for (var j = 0; j < sc.steps.length; j++) if (x < sc.steps[j]._cum + sc.steps[j]._len) { self.seek(j); return; }
    };
    this.reset();
  };

  /* 放大：把演示铺满窗口（舞台按比例变大，代码也更好读），再点一次或按 Esc 还原 */
  Viz.prototype.setZoom = function (on) {
    this.root.classList.toggle('vz-zoom', on);
    document.documentElement.classList.toggle('vz-noscroll', on);
    this.zoomBtn.textContent = on ? '⤡ 还原' : '⤢ 放大';
    if (on) this.root.focus();
    this.dirtyAll(); this.render();
  };

  Viz.prototype.reset = function () {
    this.playing = false; this.idle = true; this.ended = false;
    this.k = 0; this.t = 0; this.prevT = -1; this.stopAt = null; this.jumped = false;
    this.clearFx();
    this.render();
    this.syncUI();
  };

  /* 静态背景绘制 API */
  Viz.prototype.drawer = function (layer) {
    var pre = this.pre;
    function st(o) {
      var css = '';
      if (o.fill !== undefined) css += 'fill:' + o.fill + ';';
      if (o.stroke !== undefined) css += 'stroke:' + o.stroke + ';';
      if (o.color !== undefined) css += 'fill:' + o.color + ';';
      if (o.opacity != null) css += 'opacity:' + o.opacity + ';';
      return css;
    }
    var D = {
      g: function (attrs) { return s('g', attrs || {}, layer); },
      rect: function (x, y, w, hh, o) {
        o = o || {};
        return s('rect', { x: x, y: y, width: w, height: hh, rx: o.rx == null ? 6 : o.rx,
          'stroke-width': o.sw == null ? 1 : o.sw, 'stroke-dasharray': o.dash,
          style: st({ fill: o.fill == null ? 'none' : o.fill, stroke: o.stroke == null ? 'none' : o.stroke, opacity: o.opacity }) },
        o.parent || layer);
      },
      text: function (x, y, str, o) {
        o = o || {};
        var e = s('text', { x: x, y: y, 'text-anchor': o.anchor || 'start', 'dominant-baseline': o.base || 'central',
          'font-size': o.size || 13, 'font-weight': o.weight, class: o.mono ? 'mono' : null,
          style: st({ color: o.color || C.fg2, opacity: o.opacity }) }, o.parent || layer);
        e.textContent = str;
        return e;
      },
      line: function (x1, y1, x2, y2, o) {
        o = o || {};
        return s('line', { x1: x1, y1: y1, x2: x2, y2: y2, 'stroke-width': o.sw || 1.5, 'stroke-dasharray': o.dash,
          'marker-end': o.arrow ? 'url(#' + pre + 'a-' + o.arrow + ')' : null,
          style: st({ stroke: o.stroke || C.line, opacity: o.opacity }) }, o.parent || layer);
      },
      path: function (d, o) {
        o = o || {};
        return s('path', { d: d, 'stroke-width': o.sw || 1.5, 'stroke-dasharray': o.dash,
          'marker-end': o.arrow ? 'url(#' + pre + 'a-' + o.arrow + ')' : null,
          style: st({ fill: o.fill || 'none', stroke: o.stroke || C.line, opacity: o.opacity }) }, o.parent || layer);
      },
      circle: function (x, y, r, o) {
        o = o || {};
        return s('circle', { cx: x, cy: y, r: r, 'stroke-width': o.sw || 1.5,
          style: st({ fill: o.fill || 'none', stroke: o.stroke || 'none', opacity: o.opacity }) }, o.parent || layer);
      },
      /* 节点：圆角框 + 标题 + 副标题，常用于主机/服务器 */
      node: function (x, y, w, hh, title, sub, o) {
        o = o || {};
        D.rect(x, y, w, hh, { fill: o.fill || C.bg, stroke: o.stroke || C.line, sw: 1.5, rx: o.rx == null ? 10 : o.rx });
        D.text(x + w / 2, y + (sub ? hh / 2 - 9 : hh / 2), title, { anchor: 'middle', size: o.size || 15, weight: 650, color: o.color || C.fg });
        if (sub) D.text(x + w / 2, y + hh / 2 + 11, sub, { anchor: 'middle', size: 11.5, color: C.fg3, mono: o.mono });
      },
      raw: function (markup) { var g = s('g', null, layer); g.innerHTML = markup; return g; }
    };
    return D;
  };

  Viz.prototype.mkObj = function (id, sp) {
    var t = sp.type || 'box';
    var parent = sp.parent ? this.O[sp.parent].g : this.Lobj;
    var g = s('g', { class: 'vo vo-' + t + (sp.cls ? ' ' + sp.cls : ''), id: this.pre + 'o-' + id }, parent);
    var o = { id: id, sp: sp, g: g, c: {}, shx: 0, shy: 0, px: 0, py: 0, t: t };
    if (t === 'box') {
      o.shape = s('rect', { rx: sp.rx == null ? 6 : sp.rx, 'stroke-dasharray': sp.dasharray }, g);
      o.txt = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': sp.size || 13,
        'font-weight': sp.weight || 600, class: sp.mono ? 'mono' : null }, g);
      if (sp.sub != null) o.subEl = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': sp.subSize || 11.5,
        class: sp.subMono === false ? null : 'mono', style: 'fill:var(--fg-3)' }, g);
    } else if (t === 'circle') {
      o.shape = s('circle', { 'stroke-dasharray': sp.dasharray }, g);
      o.txt = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': sp.size || 12,
        'font-weight': sp.weight || 650, class: sp.mono ? 'mono' : null }, g);
    } else if (t === 'text') {
      o.txt = s('text', { 'text-anchor': sp.anchor || 'middle', 'dominant-baseline': 'central',
        'font-weight': sp.weight || null, class: sp.mono ? 'mono' : null }, g);
    } else if (t === 'path') {
      o.shape = s('path', { d: sp.d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      if (sp.dasharray) o.shape.setAttribute('stroke-dasharray', sp.dasharray);
      if (sp.flow != null) o.flowEl = s('path', { d: sp.d, fill: 'none', 'stroke-linecap': 'round', 'stroke-dasharray': '1 13',
        'stroke-width': sp.flowW || 5 }, g);
    } else if (t === 'line') {
      o.shape = s('line', { 'stroke-linecap': 'round', 'stroke-dasharray': sp.dasharray }, g);
    } else if (t === 'svg') {
      g.innerHTML = sp.html || '';
    }
    if (o.shape && sp.arrow) o.marker = 'url(#' + this.pre + 'a-' + sp.arrow + ')';
    if (sp.trail && !RM) {
      o.trail = { n: sp.trail.n || 5, gap: sp.trail.gap || 45, samples: [], ghosts: [] };
      for (var i = 0; i < o.trail.n; i++) {
        var u = s('use', { href: '#' + this.pre + 'o-' + id }, this.Ltrail);
        u.style.display = 'none';
        o.trail.ghosts.push(u);
      }
    }
    this.O[id] = o;
  };

  /* ---- 计算 (k, t) 时刻每个对象的属性值并写入 DOM ---- */
  Viz.prototype.valsAt = function (k, t) {
    var sc = this.sc;
    if (this.idle) {   // 封面：没播放时显示某一步的终态（默认最后一步；场景里写 poster: 步号 可指定，poster: false 关闭）
      var pi = sc.poster === false ? -1 : (sc.poster == null ? sc.steps.length - 1 : sc.poster);
      return pi >= 0 && sc.steps[pi] ? sc.steps[pi]._state : sc._init;
    }
    var base = k === 0 ? sc._init : sc.steps[k - 1]._state;
    var tr = sc.steps[k]._tracks, ov = null;
    for (var i = 0; i < tr.length; i++) {
      var q = tr[i], p, v;
      if (q.dur <= 0) p = t >= q.delay ? 1 : 0;
      else p = clamp((t - q.delay) / q.dur, 0, 1);
      if (p <= 0) v = q.from;
      else if (p >= 1) v = q.to;
      else {
        var e = q.ease(p);
        if (q.kind === 'n') v = q.from + (q.to - q.from) * e;
        else if (q.kind === 'c') v = mixColor(q.from, q.to, e);
        else v = q.to;
      }
      if (!ov) ov = {};
      (ov[q.id] || (ov[q.id] = {}))[q.p] = v;
    }
    if (!ov) return base;
    var out = {};
    for (var id in base) {
      if (ov[id]) { var m = {}, b = base[id], o = ov[id]; for (var key in b) m[key] = key in o ? o[key] : b[key]; out[id] = m; }
      else out[id] = base[id];
    }
    return out;
  };

  Viz.prototype.dirtyAll = function () { for (var id in this.O) this.O[id].c = {}; };

  var KID = 0;
  function ck(el, name) { return (el._k || (el._k = 'e' + (++KID))) + name; }   // 缓存键 = 元素 + 属性名
  function setA(o, el, name, v) { var key = ck(el, ':' + name); if (o.c[key] !== v) { el.setAttribute(name, v); o.c[key] = v; } }
  function setS(o, el, name, v) { var key = ck(el, '.' + name); if (o.c[key] !== v) { el.style[name] = v; o.c[key] = v; } }

  Viz.prototype.applyObj = function (o, v) {
    var sp = o.sp, x = v.x, y = v.y;
    if (sp.along && v.t != null) {
      var P = this.O[sp.along];
      if (P && P.shape) {
        if (!P.len) P.len = P.shape.getTotalLength();
        var pt = P.shape.getPointAtLength(clamp(v.t, 0, 1) * P.len);
        x = pt.x + P.px; y = pt.y + P.py;
      }
    }
    o.px = x; o.py = y;
    var tf = 'translate(' + r2(x + o.shx) + ',' + r2(y + o.shy) + ')';
    if (v.rot) tf += ' rotate(' + r2(v.rot) + ')';
    if (v.s !== 1) tf += ' scale(' + r2(v.s) + ')';
    setA(o, o.g, 'transform', tf);
    setS(o, o.g, 'opacity', String(r2(clamp(v.opacity, 0, 1))));
    o.vis = v.opacity > 0.01;
    if (o.t === 'box') {
      /* 锚点：默认中心；tl 左上；bl 左下（柱子向上长）；bc 底边中点；l 左边中点（条形向右长） */
      var an = sp.anchor, bx = -v.w / 2, by = -v.h / 2;
      if (an === 'tl') { bx = 0; by = 0; } else if (an === 'bl') { bx = 0; by = -v.h; }
      else if (an === 'bc') { by = -v.h; } else if (an === 'l') { bx = 0; }
      var tcx = bx + v.w / 2, tcy = by + v.h / 2;
      setA(o, o.shape, 'x', r2(bx)); setA(o, o.shape, 'y', r2(by));
      setA(o, o.shape, 'width', r2(Math.max(0, v.w))); setA(o, o.shape, 'height', r2(Math.max(0, v.h)));
      setA(o, o.shape, 'stroke-width', v.sw);
      setS(o, o.shape, 'fill', v.fill); setS(o, o.shape, 'stroke', v.stroke);
      var hasSub = o.subEl && v.sub !== '';
      setA(o, o.txt, 'x', r2(tcx)); setA(o, o.txt, 'y', r2(hasSub ? tcy - 7 : tcy));
      setS(o, o.txt, 'fill', v.color);
      var str = v.num != null ? (sp.pre || '') + fmtNum(sp.fmt, v.num) + (sp.post || '') : v.text;
      if (o.c.tx !== str) { o.txt.textContent = str; o.c.tx = str; }
      if (o.subEl) {
        setA(o, o.subEl, 'x', r2(tcx)); setA(o, o.subEl, 'y', r2(tcy + 9));
        if (o.c.sb !== v.sub) { o.subEl.textContent = v.sub; o.c.sb = v.sub; }
      }
      o.bw = v.w; o.bh = v.h; o.ox = tcx; o.oy = tcy;
    } else if (o.t === 'circle') {
      setA(o, o.shape, 'r', r2(Math.max(0, v.r))); setA(o, o.shape, 'stroke-width', v.sw);
      setS(o, o.shape, 'fill', v.fill); setS(o, o.shape, 'stroke', v.stroke);
      setS(o, o.txt, 'fill', v.color);
      if (o.c.tx !== v.text) { o.txt.textContent = v.text; o.c.tx = v.text; }
      o.bw = o.bh = v.r * 2;
    } else if (o.t === 'text') {
      setS(o, o.txt, 'fill', v.color); setA(o, o.txt, 'font-size', r2(v.size));
      var st2 = v.num != null ? (sp.pre || '') + fmtNum(sp.fmt, v.num) + (sp.post || '') : v.text;
      if (o.c.tx !== st2) { o.txt.textContent = st2; o.c.tx = st2; }
    } else if (o.t === 'path' || o.t === 'line') {
      if (o.t === 'line') {
        setA(o, o.shape, 'x1', r2(v.x1)); setA(o, o.shape, 'y1', r2(v.y1));
        setA(o, o.shape, 'x2', r2(v.x2)); setA(o, o.shape, 'y2', r2(v.y2));
      }
      setS(o, o.shape, 'stroke', v.stroke); setA(o, o.shape, 'stroke-width', v.sw);
      var len = o.t === 'path' ? (o.len || (o.len = o.shape.getTotalLength())) :
        Math.hypot(v.x2 - v.x1, v.y2 - v.y1);
      if (!sp.dasharray) {
        if (v.dash >= 0.999) { setA(o, o.shape, 'stroke-dasharray', 'none'); setA(o, o.shape, 'stroke-dashoffset', 0); }
        else { setA(o, o.shape, 'stroke-dasharray', r2(len) + ' ' + r2(len + 1)); setA(o, o.shape, 'stroke-dashoffset', r2(len * (1 - v.dash))); }
      } else if (v.dash >= 0.999) {
        setA(o, o.shape, 'stroke-dasharray', sp.dasharray); setA(o, o.shape, 'stroke-dashoffset', 0);
      } else if (len * v.dash < 0.5) {   // 还没开始画：整段挪到起点之前（长度为 0 的虚线段配圆头会留下一个点）
        setA(o, o.shape, 'stroke-dasharray', r2(len) + ' ' + r2(len + 1)); setA(o, o.shape, 'stroke-dashoffset', r2(len));
      } else {
        /* 虚线也要能"画出来"：把虚线花样铺到已画出的长度为止，后面接一段很长的空白 */
        var pat = String(sp.dasharray).split(/[\s,]+/).map(Number), L = len * Math.max(0, v.dash), acc = 0, out = [], i = 0;
        while (acc < L && out.length < 4000) {
          var seg = pat[i % pat.length];
          if (i % 2 === 0) { var dd = Math.min(seg, L - acc); out.push(dd); acc += dd; } else { out.push(seg); acc += seg; }
          i++;
        }
        if (out.length % 2 === 1) out.push(len + 1); else out.push(0, len + 1);
        setA(o, o.shape, 'stroke-dasharray', out.map(r2).join(' ')); setA(o, o.shape, 'stroke-dashoffset', 0);
      }
      if (o.marker) setA(o, o.shape, 'marker-end', v.dash >= 0.97 ? o.marker : 'none');
      if (o.flowEl) {
        var fo = String(r2(clamp(v.flow || 0, 0, 1)));
        if (o.c.fo !== fo) { o.flowEl.style.opacity = fo; o.c.fo = fo; }
        if (+fo > 0.01) {
          var fc = sp.flowColor || v.stroke;
          if (o.c.fc !== fc) { o.flowEl.style.stroke = fc; o.c.fc = fc; }
          o.flowEl.setAttribute('stroke-dashoffset', r2(-((this.vt * 0.045 * (sp.flowSpeed || 1)) % 14)));
        }
      }
    }
  };

  Viz.prototype.render = function () {
    var sc = this.sc; if (!sc) return;
    var k = this.k, t = this.t;
    var V = this.valsAt(k, t);
    for (var id in this.O) this.applyObj(this.O[id], V[id]);
    this.renderTrails();
    this.renderSide(k, t);
    var dim = this.idle && sc.poster !== false ? 0.34 : 1;          // 封面调淡，和正在播放的画面区分开
    if (this.Lobj._dim !== dim) { this.Lobj.setAttribute('opacity', dim); this.Lobj._dim = dim; }   // 记在图层上：换场景时图层是新建的
    // 说明文字
    var say = this.idle ? (sc.desc || '点击 ▶ 开始演示') : (sc.steps[k].say || '');
    if (this.sayStr !== say) { this.say.textContent = say; this.sayStr = say; }
    var op = this.idle || RM || this.jumped ? 1 : clamp(t / 260, 0, 1);
    this.say.style.opacity = r2(0.25 + 0.75 * op);
    // 进度
    var prog = this.idle ? 0 : (sc.steps[k]._cum + Math.min(t, sc.steps[k]._len)) / sc._total;
    if (this.ended) prog = 1;
    this.fill.style.width = (prog * 100).toFixed(2) + '%';
    var c = this.idle ? '0 / ' + sc.steps.length : (k + 1) + ' / ' + sc.steps.length;
    if (this.cntStr !== c) { this.cnt.textContent = c; this.cntStr = c; }
    var dots = this.dots.children;
    for (var j = 0; j < dots.length; j++) {
      var on = !this.idle && (j < k || (j === k && t >= sc.steps[k]._anim));
      if (dots[j]._on !== on) { dots[j].classList.toggle('on', on); dots[j]._on = on; }
      var cur = !this.idle && j === k;
      if (dots[j]._cur !== cur) { dots[j].classList.toggle('cur', cur); dots[j]._cur = cur; }
    }
  };

  /* 代码高亮条、数据面板、控制台 —— 同样由 (k,t) 决定 */
  Viz.prototype.renderSide = function (k, t) {
    var sc = this.sc, st = this.idle ? null : sc.steps[k];
    // 代码
    if (this.lineEls && this.lineEls.length) {
      var LE = this.lineEls;
      var tgt = st ? st._hl : null, prv = st ? st._hlPrev : null;
      var box = function (hl) {
        if (!hl || !hl.length) return null;
        var a = Math.min.apply(null, hl), b = Math.max.apply(null, hl);
        a = clamp(a, 1, LE.length); b = clamp(b, 1, LE.length);
        var ea = LE[a - 1], eb = LE[b - 1];
        return [ea.offsetTop, eb.offsetTop + eb.offsetHeight - ea.offsetTop];
      };
      var B = box(tgt), A = box(prv);
      var p = (this.jumped || RM || !A) ? 1 : EASE.inOut(clamp(t / 320, 0, 1));
      if (B) {
        var top = A ? A[0] + (B[0] - A[0]) * p : B[0], hh = A ? A[1] + (B[1] - A[1]) * p : B[1];
        this.hlBar.style.display = 'block';
        this.hlBar.style.transform = 'translateY(' + r2(top) + 'px)';
        this.hlBar.style.height = r2(hh) + 'px';
        this.hlBar.style.opacity = A ? 1 : r2(p);
        var cv = this.codeView, want = clamp(top - cv.clientHeight * 0.3, 0, cv.scrollHeight - cv.clientHeight);
        if (Math.abs(cv.scrollTop - want) > 1) cv.scrollTop = want;
      } else this.hlBar.style.display = 'none';
      var set = {};
      if (tgt && p >= 0.5) tgt.forEach(function (n) { set[n] = 1; });
      for (var i = 0; i < LE.length; i++) {
        var on = !!set[i + 1];
        if (LE[i]._on !== on) { LE[i].classList.toggle('on', on); LE[i]._on = on; }
      }
    }
    // 数据
    if (this.dRows) {
      var base = this.idle ? sc._data0 : (k === 0 ? sc._data0 : sc.steps[k - 1]._data);
      var shown = {}, chg = {};
      for (var key in this.dRows) shown[key] = base[key];
      if (st) st._dch.forEach(function (d) {
        if (t >= d.at) {
          var dt = t - d.at;
          if (typeof d.to === 'number' && typeof d.from === 'number' && dt < 500 && !RM) {
            shown[d.k] = d.from + (d.to - d.from) * EASE.out(dt / 500);
          } else shown[d.k] = d.to;
          if (dt < 1100 && d.from !== d.to) chg[d.k] = 1;
        }
      });
      var fm = sc.dataFmt || {};
      for (var key2 in this.dRows) {
        var R = this.dRows[key2], v = shown[key2];
        var str = v == null ? '—' : typeof v === 'number' ? fmtNum(fm[key2] || 'int', v) : String(v);
        if (R.last !== str) { R.td.textContent = str; R.last = str; }
        var c = !!chg[key2] && !this.jumped;
        if (R.chg !== c) { R.td.parentNode.parentNode.classList.toggle('chg', c); R.chg = c; }
        if (R.meter) {
          var mw = typeof v === 'number' ? clamp((v - R.mt[0]) / (R.mt[1] - R.mt[0]), 0, 1) * 100 : 0;
          mw = mw.toFixed(1) + '%';
          if (R.mw !== mw) { R.meter.style.width = mw; R.mw = mw; }
        }
      }
    }
    // 控制台
    if (this.conBox.style.display !== 'none') {
      var lines = [];
      if (!this.idle) {
        for (var j = 0; j < k; j++) sc.steps[j]._logs.forEach(function (l) { lines.push([l, l.s.length]); });
        var jm = this.jumped;
        st._logs.forEach(function (l) {
          if (t >= l.at) lines.push([l, jm || RM ? l.s.length : Math.min(l.s.length, Math.floor((t - l.at) / 16) + 1)]);
        });
      }
      var sig = lines.map(function (x) { return x[1]; }).join(',') + '|' + lines.length + '|' + k;
      if (sig !== this.conSig) {
        this.conSig = sig;
        this.conView.innerHTML = lines.map(function (x) {
          var l = x[0], str = l.s.slice(0, x[1]);
          return '<div class="vz-l ' + l.cls + '">' + esc(str) + (x[1] < l.s.length ? '<span class="vz-caret"></span>' : '') + '</div>';
        }).join('') || '<div class="vz-l dim">（运行后在此显示输出）</div>';
        this.conView.scrollTop = this.conView.scrollHeight;
      }
    }
  };

  /* ---- 拖影：用 <use> 复制对象当前外观，放到过去的位置 ---- */
  Viz.prototype.renderTrails = function () {
    for (var id in this.O) {
      var o = this.O[id], T = o.trail;
      if (!T) continue;
      if (this.playing && o.vis) {
        var lastS = T.samples[T.samples.length - 1];
        if (!lastS || lastS.vt !== this.vt) T.samples.push({ x: o.px, y: o.py, vt: this.vt });
        var life = T.gap * (T.n + 1);
        while (T.samples.length && this.vt - T.samples[0].vt > life) T.samples.shift();
      }
      for (var i = 0; i < T.n; i++) {
        var ghost = T.ghosts[i], age = (i + 1) * T.gap, smp = null;
        for (var j = T.samples.length - 1; j >= 0; j--) if (this.vt - T.samples[j].vt >= age) { smp = T.samples[j]; break; }
        if (!smp || !o.vis || Math.hypot(smp.x - o.px, smp.y - o.py) < 3) { if (ghost._d !== 'none') { ghost.style.display = 'none'; ghost._d = 'none'; } continue; }
        if (ghost._d !== '') { ghost.style.display = ''; ghost._d = ''; }
        ghost.setAttribute('transform', 'translate(' + r2(smp.x - o.px) + ',' + r2(smp.y - o.py) + ')');
        ghost.style.opacity = r2(0.32 * (1 - i / T.n));
      }
    }
  };
  Viz.prototype.clearTrails = function () {
    for (var id in this.O) { var T = this.O[id].trail; if (T) T.samples = []; }
  };

  /* ---- 一次性特效（涟漪/脉冲/迸射/抖动/飘字/闪光），同样走虚拟时钟 ---- */
  Viz.prototype.spawnFx = function (f) {
    if (RM) return;
    var o = f.obj ? this.O[f.obj] : null;
    var x = (f.x != null ? f.x : o ? o.px : 0) + (f.dx || 0);
    var y = (f.y != null ? f.y : o ? o.py : 0) + (f.dy || 0);
    if (o && f.x == null) { x += o.ox || 0; y += o.oy || 0; }
    var col = f.color || C.accent, dur = f.dur || FXDUR[f.type] || 600;
    var fx = { type: f.type, t0: this.vt, dur: dur, els: [], o: o, x: x, y: y, f: f };
    var L = this.Lfx;
    if (f.type === 'ripple') {
      fx.els.push(s('circle', { cx: x, cy: y, r: 4, fill: 'none', 'stroke-width': 2.5, style: 'stroke:' + col }, L));
      fx.els.push(s('circle', { cx: x, cy: y, r: 4, fill: 'none', 'stroke-width': 1.5, style: 'stroke:' + col }, L));
    } else if (f.type === 'pulse' || f.type === 'flash') {
      var w = (o ? o.bw : 40) || 40, hh = (o ? o.bh : 40) || 40;
      var e = s('rect', { x: x - w / 2, y: y - hh / 2, width: w, height: hh, rx: 8, 'stroke-width': 2.5,
        style: f.type === 'flash' ? 'fill:' + col + ';stroke:none' : 'fill:none;stroke:' + col }, L);
      fx.w = w; fx.h = hh; fx.els.push(e);
    } else if (f.type === 'burst') {
      var n = f.n || 9;
      for (var i = 0; i < n; i++) {
        var c = s('circle', { cx: x, cy: y, r: 3, style: 'fill:' + col }, L);
        c._a = (Math.PI * 2 * i) / n + (i % 2) * 0.3; fx.els.push(c);
      }
    } else if (f.type === 'float') {
      var tx = s('text', { x: x, y: y, 'text-anchor': 'middle', 'font-size': f.size || 15, 'font-weight': 700,
        style: 'fill:' + col }, L);
      tx.textContent = f.text || ''; fx.els.push(tx);
    } else if (f.type === 'shake') {
      fx.amp = f.amp || 6;
    } else if (f.type === 'stream') {
      /* 一串粒子沿 path 对象依次出发：看得出数据从哪流到哪 */
      var P = this.O[f.path];
      if (!P || !P.shape) return;
      fx.P = P; fx.len = P.len || (P.len = P.shape.getTotalLength());
      fx.n = f.n || 5; fx.gap = f.gap || 110; fx.one = f.dur || 700; fx.dur = fx.one + (fx.n - 1) * fx.gap;
      for (var q = 0; q < fx.n; q++) fx.els.push(s('circle', { r: f.r || 4, style: 'fill:' + col + ';opacity:0' }, L));
    }
    this.fx.push(fx);
  };
  Viz.prototype.updateFx = function () {
    var keep = [];
    for (var i = 0; i < this.fx.length; i++) {
      var F = this.fx[i], p = clamp((this.vt - F.t0) / F.dur, 0, 1), e = EASE.out(p);
      if (F.type === 'ripple') {
        var R = F.f.r || 46;
        F.els[0].setAttribute('r', r2(4 + R * e)); F.els[0].style.opacity = r2(0.9 * (1 - p));
        var p2 = clamp(p * 1.35 - 0.2, 0, 1);
        F.els[1].setAttribute('r', r2(4 + R * 0.65 * EASE.out(p2))); F.els[1].style.opacity = r2(0.7 * (1 - p2));
      } else if (F.type === 'pulse') {
        var g = 14 * e;
        F.els[0].setAttribute('x', r2(F.x - F.w / 2 - g)); F.els[0].setAttribute('y', r2(F.y - F.h / 2 - g));
        F.els[0].setAttribute('width', r2(F.w + 2 * g)); F.els[0].setAttribute('height', r2(F.h + 2 * g));
        F.els[0].style.opacity = r2(1 - p);
      } else if (F.type === 'flash') {
        if (F.o) { F.els[0].setAttribute('x', r2(F.o.px + (F.o.ox || 0) - F.w / 2)); F.els[0].setAttribute('y', r2(F.o.py + (F.o.oy || 0) - F.h / 2)); }
        F.els[0].style.opacity = r2(0.55 * (1 - p));
      } else if (F.type === 'burst') {
        var D = (F.f.r || 34) * e;
        F.els.forEach(function (c) {
          c.setAttribute('cx', r2(F.x + Math.cos(c._a) * D)); c.setAttribute('cy', r2(F.y + Math.sin(c._a) * D));
          c.setAttribute('r', r2(3 * (1 - p) + 0.5)); c.style.opacity = r2(1 - p);
        });
      } else if (F.type === 'float') {
        F.els[0].setAttribute('y', r2(F.y - 30 * e)); F.els[0].style.opacity = r2(p < 0.7 ? 1 : (1 - p) / 0.3);
      } else if (F.type === 'shake' && F.o) {
        F.o.shx = p >= 1 ? 0 : F.amp * Math.sin(p * Math.PI * 7) * (1 - p);
      } else if (F.type === 'stream') {
        for (var q = 0; q < F.els.length; q++) {
          var lp = clamp((this.vt - F.t0 - q * F.gap) / F.one, 0, 1), c2 = F.els[q];
          if (lp <= 0 || lp >= 1) { c2.style.opacity = 0; continue; }
          var d2 = EASE.inOut(lp); if (F.f.reverse) d2 = 1 - d2;
          var pt2 = F.P.shape.getPointAtLength(d2 * F.len);
          c2.setAttribute('cx', r2(pt2.x + (F.P.sp.along ? 0 : F.P.px))); c2.setAttribute('cy', r2(pt2.y + (F.P.sp.along ? 0 : F.P.py)));
          c2.style.opacity = r2(Math.min(1, lp * 6, (1 - lp) * 6));
        }
      }
      if (p >= 1) {
        F.els.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
        if (F.type === 'shake' && F.o) F.o.shx = 0;
      } else keep.push(F);
    }
    this.fx = keep;
  };
  Viz.prototype.clearFx = function () {
    this.fx.forEach(function (F) {
      F.els.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
      if (F.o) F.o.shx = 0;
    });
    this.fx = [];
    this.clearTrails();
  };

  /* ---- 虚拟时钟主循环 ---- */
  Viz.prototype.kick = function () {
    if (this.raf) return;
    var self = this;
    this.last = performance.now();
    this.raf = requestAnimationFrame(function loop(now) {
      self.raf = 0;
      var dt = Math.min(100, now - self.last); self.last = now;
      if (self.playing) self.advance(dt * self.speed);
      self.updateFx();
      self.render();
      if (self.playing || self.fx.length) { self.last = now; self.raf = requestAnimationFrame(loop); }
      else self.syncUI();
    });
  };

  Viz.prototype.fireEvents = function (from, to) {
    var st = this.sc.steps[this.k], self = this;
    (st.fx || []).forEach(function (f) {
      var at = f.at || 0;
      if ((from < at && at <= to) || (at === 0 && from < 0)) self.spawnFx(f);
    });
  };

  Viz.prototype.advance = function (adv) {
    var sc = this.sc;
    this.vt += adv;
    var from = this.prevT, to = this.t + adv;
    this.fireEvents(from, to);
    this.t = to; this.prevT = to;
    if (this.stopAt != null && this.t >= this.stopAt) {
      this.t = this.stopAt; this.prevT = this.t; this.stopAt = null; this.playing = false; return;
    }
    while (this.t >= sc.steps[this.k]._len) {
      if (this.k < sc.steps.length - 1) {
        this.t -= sc.steps[this.k]._len;
        this.k++; this.jumped = false; this.prevT = -1;
        this.fireEvents(-1, this.t); this.prevT = this.t;
      } else {
        this.t = sc.steps[this.k]._stop; this.prevT = this.t;
        this.playing = false; this.ended = true; break;
      }
    }
    if (this.k === sc.steps.length - 1 && this.t >= sc.steps[this.k]._stop && !this.ended) {
      this.playing = false; this.ended = true; this.t = sc.steps[this.k]._stop;
    }
  };

  Viz.prototype.play = function () {
    if (this.ended) { this.reset(); }
    if (this.idle) { this.idle = false; this.k = 0; this.t = 0; this.prevT = -1; this.jumped = false; }
    this.stopAt = null;
    this.playing = true;
    this.syncUI(); this.kick();
  };
  Viz.prototype.pause = function () { this.playing = false; this.syncUI(); this.render(); };
  Viz.prototype.toggle = function () { if (this.playing) this.pause(); else this.play(); };

  /* 单步：把当前这一步播完（含特效）就停；若已播完则进入下一步 */
  Viz.prototype.next = function () {
    var sc = this.sc;
    if (this.ended) { this.reset(); }
    if (this.idle) { this.idle = false; this.k = 0; this.t = 0; this.prevT = -1; this.jumped = false; }
    else if (this.t >= sc.steps[this.k]._stop) {
      if (this.k >= sc.steps.length - 1) { this.ended = true; this.syncUI(); this.render(); return; }
      this.k++; this.t = 0; this.prevT = -1; this.jumped = false;
    }
    this.stopAt = sc.steps[this.k]._stop;
    this.playing = true; this.syncUI(); this.kick();
  };

  /* 回退：瞬间摆到上一步的终态（暂停） */
  Viz.prototype.back = function () {
    this.playing = false; this.ended = false; this.clearFx();
    if (this.idle) { this.render(); return; }
    if (this.k === 0) { this.reset(); return; }
    this.k--; this.t = this.sc.steps[this.k]._stop; this.prevT = this.t; this.jumped = true;
    this.render(); this.syncUI();
  };

  /* 跳到第 j 步：暂停时摆到该步终态；播放中则从该步开头接着播 */
  Viz.prototype.seek = function (j) {
    var wasPlaying = this.playing;
    this.clearFx(); this.idle = false; this.ended = false; this.k = j; this.stopAt = null;
    if (wasPlaying) { this.t = 0; this.prevT = -1; this.jumped = false; this.kick(); }
    else { this.t = this.sc.steps[j]._stop; this.prevT = this.t; this.jumped = true; this.render(); }
    this.syncUI();
  };

  Viz.prototype.setSpeed = function (v) {
    this.speed = v;
    this.spBtns.forEach(function (b) { b.classList.toggle('on', b.textContent === v + '×'); });
  };

  Viz.prototype.syncUI = function () {
    this.bPlay.innerHTML = this.playing ? ICON.pause : this.ended ? ICON.replay : ICON.play;
    this.bPlay.setAttribute('aria-label', this.playing ? '暂停' : '播放');
    this.big.style.display = this.idle && !this.playing ? '' : 'none';
    this.root.classList.toggle('playing', this.playing);
  };

  /* ---------------- 注册 / 挂载 ---------------- */
  function findAnchor(doc, re) {
    var hs = doc.querySelectorAll('h2, h3');
    for (var i = 0; i < hs.length; i++) if (re.test(hs[i].textContent)) return hs[i];
    return null;
  }
  /* 占位上的 data-sc="0,2" / "1-3"（场景号从 0 数）：这个位置只挂这几个场景，演示就能拆开放到各自的知识点下面。
   * 返回一个只含这些场景的 def 副本；_idx 记着本地第 j 个场景是原来的第几个（?vz=…&sc= 用原来的号）。 */
  function pickScenes(def, ph) {
    var spec = ph.getAttribute('data-sc'), ttl = ph.getAttribute('data-title');
    if (!spec && !ttl) return def;
    var d = {}, k; for (k in def) d[k] = def[k];
    if (spec) {
      var idx = [];
      spec.split(',').forEach(function (p) {
        var m = /^\s*(\d+)(?:-(\d+))?\s*$/.exec(p); if (!m) return;
        for (var i = +m[1]; i <= +(m[2] || m[1]); i++) if (def.scenes[i]) idx.push(i);
      });
      d.scenes = idx.map(function (i) { return def.scenes[i]; }); d._idx = idx;
      d.title = idx.map(function (i) { return def.scenes[i].name; }).join(' · ');
    }
    if (ttl) d.title = ttl;
    return d;
  }
  function mountAll() {
    var doc = document.querySelector('.doc');
    DEFS.forEach(function (def) {
      if (def._mounted) return;
      var phs = document.querySelectorAll('[data-vz="' + def.id + '"]');
      if (phs.length > 1 || (phs.length && phs[0].hasAttribute('data-sc'))) {
        Array.prototype.forEach.call(phs, function (p) {
          try { new Viz(p, pickScenes(def, p)); } catch (e) { console.error('[vz] 挂载失败', def.id, p.getAttribute('data-sc'), e); }
          document.dispatchEvent(new CustomEvent('vz:mounted', { detail: { id: def.id, title: def.title, host: p, heading: null } }));
        });
        def._mounted = true;
        return;
      }
      var ph = phs[0] || null;
      if (!ph && doc) {
        var hd = def.anchor ? findAnchor(doc, def.anchor) : null;
        ph = h('div', { 'data-vz': def.id });
        if (!hd) { doc.appendChild(ph); }
        else if (def.place === 'start') { hd.parentNode.insertBefore(ph, hd.nextSibling); }
        else {
          var lv = +hd.tagName[1], n = hd.nextElementSibling, last = hd;
          while (n && !(/^H[1-6]$/.test(n.tagName) && +n.tagName[1] <= lv)) { last = n; n = n.nextElementSibling; }
          last.parentNode.insertBefore(ph, last.nextSibling);
        }
        if (hd) ph._heading = hd;
      }
      if (!ph) return;
      var hd2 = ph._heading;
      try { new Viz(ph, def); def._mounted = true; } catch (e) { console.error('[vz] 挂载失败', def.id, e); }
      document.dispatchEvent(new CustomEvent('vz:mounted', { detail: { id: def.id, title: def.title, host: ph, heading: hd2 ? hd2.id : null } }));
    });
  }

  var VZ = window.VZ = {
    C: C, EASE: EASE, FMT: FMT, RM: RM, _all: [],
    register: function (def) { DEFS.push(def); if (document.readyState !== 'loading') mountAll(); },
    mountAll: mountAll,
    /* 供 node 统计场景表用：编译并返回每个场景的步数 / 时长 / 动的对象 */
    stats: function () {
      return DEFS.map(function (d) {
        return { id: d.id, title: d.title, scenes: d.scenes.map(function (sc) {
          compile(sc);
          var moving = {};
          sc.steps.forEach(function (st) { st._tracks.forEach(function (q) { if (q.from !== q.to) moving[q.id] = 1; }); });
          return { name: sc.name, steps: sc.steps.length, ms: sc._total, moving: Object.keys(moving) };
        }) };
      });
    },
    _defs: DEFS,
    /* 估算文字宽度（中文按 1em，西文按 0.58em / 等宽 0.6em） */
    tw: function (str, size, mono) {
      var w = 0; str = String(str);
      for (var i = 0; i < str.length; i++) w += str.charCodeAt(i) > 255 ? size : size * (mono ? 0.6 : 0.58);
      return w;
    },
    /* 一排 token 小方块：返回 {objs, xs, ws, x0, x1}；words 里每项是字符串或 {t, w} */
    chips: function (pre, words, cx, y, o) {
      o = o || {};
      var size = o.size || 13, gap = o.gap == null ? 8 : o.gap, h = o.h || 28, ws = [], tot = 0, objs = {}, xs = [];
      words.forEach(function (wd) { var w = (wd && wd.w) || Math.max(o.minW || 34, VZ.tw(wd.t || wd, size, o.mono !== false) + 20); ws.push(w); tot += w; });
      tot += gap * (words.length - 1);
      var x = (o.left != null ? o.left : cx - tot / 2);
      words.forEach(function (wd, i) {
        xs.push(x + ws[i] / 2);
        objs[pre + i] = { type: 'box', x: x + ws[i] / 2, y: y, w: ws[i], h: h, rx: 6, text: wd.t || wd, size: size, mono: o.mono !== false,
          fill: o.fill || C.dataW, stroke: o.stroke || C.data, color: o.color || C.fg, weight: o.weight || 600, opacity: o.opacity == null ? 0 : o.opacity };
        x += ws[i] + gap;
      });
      return { objs: objs, xs: xs, ws: ws, x0: xs[0] - ws[0] / 2, x1: x - gap, n: words.length };
    },
    /* 一行公式：parts 里每项是
     *   字符串      —— 运算符或静态文字（'=', '+', '×', '(', 'Σ' …），画成 text；
     *   {t, k}      —— 带底色的项（k = data / ok / warn / info / bad / neutral）；
     *   {slot: 1}   —— 虚线空位，等着别处的数字飞进来（再把它的 text / num 设上去）；
     *   {num, fmt}  —— 会滚动的数字项。
     * 每项都可以带 w（宽）、size、mono:false。返回 {objs, xs, ws, x0, x1, n}，对象名是 pre + 序号，默认 opacity 0。 */
    eq: function (pre, parts, cx, y, o) {
      o = o || {};
      var size = o.size || 15, gap = o.gap == null ? 6 : o.gap, h = o.h || 30, ws = [], tot = 0, objs = {}, xs = [];
      parts.forEach(function (p) {
        var w;
        if (typeof p === 'string') w = VZ.tw(p, size, true) + 6;
        else w = p.w || Math.max(o.minW || 38, VZ.tw(p.t != null ? p.t : (p.num != null ? '0.0000' : ''), p.size || size, p.mono !== false) + 18);
        ws.push(w); tot += w;
      });
      tot += gap * (parts.length - 1);
      var x = o.left != null ? o.left : cx - tot / 2, op = o.opacity == null ? 0 : o.opacity;
      parts.forEach(function (p, i) {
        var c = x + ws[i] / 2; xs.push(c);
        if (typeof p === 'string') {
          objs[pre + i] = { type: 'text', x: c, y: y, text: p, size: size, mono: true, weight: 600, color: o.color || C.fg2, anchor: 'middle', opacity: op };
        } else {
          var k = p.k || (p.slot ? 'neutral' : 'data');
          var b = { type: 'box', x: c, y: y, w: ws[i], h: p.h || h, rx: 6, size: p.size || size, mono: p.mono !== false, weight: 700,
            fill: p.slot ? C.bg : C[k + 'W'], stroke: C[k], sw: 1.4, color: p.color || C.fg, opacity: op };
          if (p.slot) b.dasharray = '4 3';
          if (p.num != null) { b.num = p.num; if (p.fmt) b.fmt = p.fmt; if (p.pre) b.pre = p.pre; if (p.post) b.post = p.post; }
          else b.text = p.t == null ? '' : p.t;
          objs[pre + i] = b;
        }
        x += ws[i] + gap;
      });
      return { objs: objs, xs: xs, ws: ws, x0: xs[0] - ws[0] / 2, x1: x - gap, n: parts.length };
    },
    /* 让一组对象一起出现：show(eqResult, delay, step) → { 名: pop(...) } */
    show: function (r, delay, step) {
      var o = {}, i = 0; for (var k in r.objs) { o[k] = VZ.pop((delay || 0) + (step == null ? 70 : step) * i); i++; } return o;
    },
    /* 写步骤时常用的几种补间：合并 / 淡入 / 弹出 / 飞到某处 */
    mix: function () { var o = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) o[k] = arguments[i][k]; return o; },
    /* join：和 mix 一样合并多组 set，但同名对象的属性会并到一起（mix 是后者整个覆盖前者） */
    join: function () {
      var o = {};
      for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) {
        if (!o[k]) o[k] = {};
        for (var p in arguments[i][k]) o[k][p] = arguments[i][k][p];
      }
      return o;
    },
    fade: function (delay, dur, to) { return { opacity: { to: to == null ? 1 : to, dur: dur || 350, delay: delay || 0 } }; },
    pop: function (delay) { return { opacity: { to: 1, dur: 220, delay: delay || 0 }, s: { from: 0.4, to: 1, dur: 460, delay: delay || 0, ease: 'back' } }; },
    fly: function (x, y, delay, dur) {
      return { opacity: { to: 1, dur: 180, delay: delay || 0 }, x: { to: x, dur: dur || 800, delay: delay || 0, ease: 'inOut' }, y: { to: y, dur: dur || 800, delay: delay || 0, ease: 'inOut' } };
    },
    /* 把演示定格在第 sc 个场景、第 st 步；p 省略 = 该步终态，p∈[0,1] = 该步补间进行到 p */
    /* sc 用演示里原来的场景号；拆开挂的演示会找到挂着这个场景的那一处。返回那个播放器（找不到返回 null） */
    pose: function (id, sc, st, p) {
      var v = null, li = 0; sc = sc || 0;
      VZ._all.forEach(function (x) {
        if (v || x.def.id !== id) return;
        var j = x.def._idx ? x.def._idx.indexOf(sc) : sc;
        if (j >= 0) { v = x; li = j; }
      });
      if (!v) return null;
      v.load(li);
      if (st == null || st < 0) return v;
      v.idle = false; v.playing = false; v.k = Math.min(st, v.sc.steps.length - 1);
      var S = v.sc.steps[v.k];
      if (p == null) { v.t = S._stop; v.jumped = true; } else { v.t = p * S._anim; v.jumped = false; }
      v.prevT = v.t; v.render(); v.syncUI();
      return v;
    }
  };
  function autoPose() {
    var m = /[?&]vz=([\w-]+)/.exec(location.search); if (!m) return;
    var q = function (k) { var r = new RegExp('[?&]' + k + '=([0-9.]+)').exec(location.search); return r ? parseFloat(r[1]) : null; };
    var v = VZ.pose(m[1], q('sc') || 0, q('st'), q('p')); if (!v) return;
    if (/[?&]solo=1/.test(location.search)) {
      document.body.innerHTML = ''; document.body.appendChild(v.root); document.body.style.padding = '12px';
      v.root.style.margin = '0'; v.root.style.maxWidth = (q('w') || 1180) + 'px';
      requestAnimationFrame(function () { v.dirtyAll(); v.render(); });
    } else v.root.scrollIntoView();
  }
  function boot() { mountAll(); autoPose(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(autoPose, 0);
})();

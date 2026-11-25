/* viz.js —— 四个视图的排版。它只负责算出"这一幕每个元素该在哪、什么颜色"，交给 stage.js 去补间。
 * 元素的 id 在四个视图之间是通用的：
 *   file:<路径>            一个文件        （结构图里是方块；另外三个视图里缩成顶部的小标签）
 *   fn:<路径>::<函数名>    一个函数        （API 流程、调用图里是方块；代码视图里放大成代码面板的外框）
 * 所以切换视图时，同一个文件、同一个函数是从原来的位置移动过去的，不是消失再出现。
 */
(function (global) {
  'use strict';
  var N = global.NOTES, App = global.App, h = App.h;
  var C = { ink: '#1b1f25', sub: '#79818d', line: '#c9d0da', faint: '#e3e7ed', card: '#ffffff', soft: '#f3f5f8',
    blue: '#2563eb', blueW: '#e6eeff', green: '#178a57', greenW: '#e2f4ea', orange: '#c26a00', orangeW: '#fdf0dc',
    purple: '#6d44d6', purpleW: '#efeafd', red: '#cf3046', redW: '#fde8ec', teal: '#0f766e', tealW: '#e6f6f4', gray: '#eceff3' };
  var COLORS = [[C.orange, C.orangeW], [C.purple, C.purpleW], [C.blue, C.blueW], [C.teal, C.tealW], [C.green, C.greenW]];
  var KINDS = {};                                            // 结构图的几列：每次作业在 tools/kinds.py 的 cols 里登记（路径前缀 → 列）
  (N.meta.kinds || []).forEach(function (k) { KINDS[k.id] = k; });
  var PKG = [];
  var FILES = N.code.files, ALL = Object.keys(FILES).sort();
  var HW = 'a1', PATHS = ALL;                               // 当前画哪一次作业；PATHS、PKG 跟着 setHW 变
  function setHW(hw) {
    if (hw && /^a\d$/.test(hw)) HW = hw;
    PATHS = ALL.filter(function (p) { return p.indexOf(HW + '/') === 0; });
    var cols = (KINDS[HW] && KINDS[HW].cols) || [{ id: 'all', zh: '全部文件', pre: [''] }];
    var wsum = 940 / cols.length;
    PKG = cols.map(function (c, i) { return { id: c.id, zh: c.zh, pre: c.pre, w: Math.round(wsum - 14), color: COLORS[i % COLORS.length][0], weak: COLORS[i % COLORS.length][1] }; });
    return HW;
  }
  function hwOf(path) { return String(path || '').split('/')[0]; }
  setHW('a1');
  function pkgOf(path) {
    var rest = path.split('/').slice(1).join('/');
    for (var i = 0; i < PKG.length; i++) for (var j = 0; j < PKG[i].pre.length; j++) if (rest.indexOf(PKG[i].pre[j]) === 0) return PKG[i].id;
    return PKG[PKG.length - 1].id;
  }
  function pkg(path) { var id = pkgOf(path); return PKG.filter(function (p) { return p.id === id; })[0] || PKG[0]; }
  function base(path) { return path.split('/').pop(); }
  function fnShort(ref) { return ref.split('::')[1]; }
  function fnPath(ref) { return ref.split('::')[0]; }
  var FN = {};                                               // "路径::限定名" → 函数信息
  ALL.forEach(function (p) { FILES[p].funcs.forEach(function (f) { FN[p + '::' + f.qual] = { path: p, f: f }; }); });
  var CALLS = {};                                            // 调用关系：谁 → [被调用的]
  N.code.calls.forEach(function (c) { (CALLS[c.from] = CALLS[c.from] || []).push(c.to); });
  var BORN = {};                                             // 文件 → 新建它的步骤
  Object.keys((N.stepCode || {}).born || {}).forEach(function (p) { BORN[p] = N.stepCode.born[p]; });   // 复制起始代码那一步也算新建

  /* ================= 视图 1：结构图 ================= */
  function structureLayout(W) {
    var total = PKG.reduce(function (a, p) { return a + p.w; }, 0), gap = (W - 40 - total) / (PKG.length - 1), x = 20, pos = {}, cols = {};
    PKG.forEach(function (p) { cols[p.id] = { x: x, y: 62 }; x += p.w + gap; });
    PATHS.forEach(function (path) {
      if (base(path) === '__init__.py') return;              // 空的包标记文件不画
      var col = cols[pkgOf(path)], p = pkg(path);
      pos['file:' + path] = { x: col.x, y: col.y, w: p.w, h: 23 };
      col.y += 27;
      FILES[path].classes.forEach(function (c) {
        pos['cls:' + path + '::' + c.name] = { x: col.x + 10, y: col.y - 2, w: p.w - 10, h: 17 };
        col.y += 20;
      });
    });
    return { pos: pos, cols: cols };
  }
  function sceneStructure(o) {
    var W = 1000, L = structureLayout(W), sc = {}, sel = o.sel && o.sel.indexOf('file:') === 0 ? o.sel.slice(5) : null;
    var out = sel ? FILES[sel].imports : [], inn = sel ? PATHS.filter(function (p) { return FILES[p].imports.indexOf(sel) >= 0; }) : [];
    PKG.forEach(function (p) {
      sc['hdr:' + p.id] = { kind: 'text', x: L.cols[p.id].x, y: 44, text: p.zh, fs: 12, color: p.color, bold: true };
    });
    Object.keys(L.pos).forEach(function (id) {
      var b = L.pos[id], isFile = id.indexOf('file:') === 0, path = id.slice(isFile ? 5 : 4).split('::')[0], p = pkg(path);
      var role = !sel ? 0 : path === sel ? 3 : out.indexOf(path) >= 0 ? 1 : inn.indexOf(path) >= 0 ? 2 : -1;
      if (isFile) {
        sc[id] = { kind: 'box', x: b.x, y: b.y, w: b.w, h: b.h, rx: 6, fs: 10.5, mono: true, label: base(path), pad: 6,
          fill: role === 3 ? p.color : role === 1 ? C.blueW : role === 2 ? C.orangeW : p.weak,
          stroke: role === 3 ? p.color : role === 1 ? C.blue : role === 2 ? C.orange : p.color,
          color: role === 3 ? '#ffffff' : C.ink, sw: role > 0 ? 1.6 : 0.8, op: role === -1 ? 0.3 : 1, bold: role === 3 };
      } else {
        sc[id] = { kind: 'box', x: b.x, y: b.y, w: b.w, h: b.h, rx: 4, fs: 9.5, mono: true, label: '└ ' + id.split('::')[1], pad: 4, align: 'l',
          fill: C.card, stroke: C.faint, color: p.color, sw: 0.8, op: role === -1 ? 0.25 : 1, click: false };
      }
    });
    PATHS.forEach(function (a) {
      if (!L.pos['file:' + a]) return;
      FILES[a].imports.forEach(function (b) {
        if (!L.pos['file:' + b]) return;
        var hot = sel && (a === sel || b === sel);
        sc['imp:' + a + '>' + b] = { kind: 'edge', from: 'file:' + a, to: 'file:' + b, sw: hot ? 1.6 : 0.8,
          color: hot ? (a === sel ? C.blue : C.orange) : C.line, op: sel ? (hot ? 1 : 0.05) : 0.4 };
      });
    });
    sc['title'] = { kind: 'text', x: 20, y: 18, fs: 13.5, bold: true, color: C.ink,
      text: sel ? sel + '：蓝线 = 它 import 谁，橙线 = 谁 import 它' : '模块和类的关系：每个方块是一个文件，连线是 import。点一个文件看它的上下游' };
    return sc;
  }
  function captionStructure(o) {
    if (!o.sel) return { tit: '结构图', say: PATHS.length + ' 个代码文件、' + PATHS.reduce(function (a, p) { return a + FILES[p].classes.length; }, 0) + ' 个类。点任意一个文件，高亮它依赖的文件（蓝）和依赖它的文件（橙）。', dat: '' };
    var path = o.sel.slice(5), f = FILES[path], born = BORN[path];
    var inn = PATHS.filter(function (p) { return FILES[p].imports.indexOf(path) >= 0; });
    return { tit: path, say: (f.doc || '') + (o.step ? '（步骤 ' + o.step + ' 涉及这个文件）' : ''),
      dat: (born ? '在步骤 ' + born + ' 新建 · ' : '') + f.loc + ' 行 · 它 import：' + (f.imports.join('、') || '无') + '\n谁 import 它：' + (inn.join('、') || '无') +
        (f.classes.length ? '\n类：' + f.classes.map(function (c) { return c.name + (c.bases.length ? '(' + c.bases.join(', ') + ')' : ''); }).join('、') : ''),
      link: born ? { href: 'stages.html#' + born, text: '看 ' + born + ' 的走读' } : null };
  }

  /* 顶部那一排文件小标签：只留和当前画面有关的文件 */
  function fileChips(sc, paths, hot, W) {
    var x = 20, y = 34;
    paths.forEach(function (path) {
      var p = pkg(path), w = Math.min(190, Stage.textWidth(path, 10, true) + 16);
      if (x + w > W - 16) { x = 20; y += 24; }
      sc['file:' + path] = { kind: 'box', x: x, y: y, w: w, h: 19, rx: 9, fs: 10, mono: true, label: path, pad: 7,
        fill: path === hot ? p.color : p.weak, stroke: p.color, color: path === hot ? '#ffffff' : C.ink, sw: 0.8 };
      x += w + 6;
    });
    return y + 19;
  }

  /* ================= 视图 2：API 流程 ================= */
  function sceneApi(o) {
    var api = o.api, i = o.idx, W = 1000, sc = {}, hops = api.hops, per = 4, bw = 204, bh = 52, gx = 36, gy = 40;
    var paths = [];
    hops.forEach(function (hp) { if (hp.fn && paths.indexOf(fnPath(hp.fn)) < 0) paths.push(fnPath(hp.fn)); });
    var cur = hops[i], top = fileChips(sc, paths, cur.fn ? fnPath(cur.fn) : null, W) + 30;
    var seen = {};
    hops.forEach(function (hp, k) {
      var row = Math.floor(k / per), col = k % per;
      if (row % 2) col = per - 1 - col;                       // 蛇形：偶数行从左到右，奇数行从右到左
      var id = hp.fn ? 'fn:' + hp.fn : 'io:' + api.id + ':' + k;
      if (seen[id]) id += '#' + k;
      seen[id] = 1; hp._id = id;
      var st = k < i ? 1 : k === i ? 2 : 0;
      sc[id] = { kind: 'box', x: 22 + col * (bw + gx), y: top + row * (bh + gy), w: bw, h: bh, rx: 9, fs: hp.fn && fnShort(hp.fn).length > 20 ? 10.5 : 12, mono: !!hp.fn,
        label: (k + 1) + '. ' + (hp.depth >= 2 ? '↳ ' : '') + (hp.fn ? fnShort(hp.fn) : hp.label), sub: hp.fn ? fnPath(hp.fn) : (hp.note || ''), click: false,   // ↳：由前面某一站调用的
        fill: st === 2 ? C.blueW : st === 1 ? C.greenW : C.card, stroke: st === 2 ? C.blue : st === 1 ? C.green : C.line,
        color: C.ink, sw: st === 2 ? 2 : 1, bold: st === 2 };
      if (k > 0) sc['flow:' + api.id + ':' + k] = { kind: 'edge', from: hops[k - 1]._id, to: id, color: k <= i ? C.green : C.line, sw: k <= i ? 1.8 : 1.1 };
    });
    var cb = sc[cur._id];
    sc['packet'] = { kind: 'dot', x: cb.x + cb.w - 14, y: cb.y + 13, r: 6, fill: C.blue };
    sc['title'] = { kind: 'text', x: 20, y: 18, fs: 13.5, bold: true, color: C.ink, text: api.title + '：从输入到输出经过哪些函数' };
    return sc;
  }
  function captionApi(o) {
    var hp = o.api.hops[o.idx];
    return { tit: (o.idx + 1) + ' / ' + o.api.hops.length, say: hp.say || '', dat: hp.data ? '数据此刻的样子：' + hp.data : '',
      link: hp.fn && BORN[fnPath(hp.fn)] ? { href: 'stages.html#' + BORN[fnPath(hp.fn)], text: '这个函数在 ' + BORN[fnPath(hp.fn)] + ' 写的' } : null };
  }

  /* ================= 视图 3：函数调用图 ================= */
  function callTree(entry) {                                  // 从入口出发按调用关系往下走，每个函数只出现一次
    var order = [], depth = {}, parent = {}, MAXN = 26, MAXD = 3, more = 0;
    (function walk(ref, d, from) {
      if (ref in depth) return;
      if (order.length >= MAXN) { more++; return; }
      depth[ref] = d; parent[ref] = from; order.push(ref);
      if (d < MAXD) (CALLS[ref] || []).forEach(function (to) { walk(to, d + 1, ref); });
    })(entry, 0, null);
    return { order: order, depth: depth, parent: parent, more: more };
  }
  function sceneCalls(o) {
    var t = callTree(o.api.entry), W = 1000, sc = {}, paths = [];
    t.order.forEach(function (ref) { if (paths.indexOf(fnPath(ref)) < 0) paths.push(fnPath(ref)); });
    var cur = t.order[o.idx], top = fileChips(sc, paths, fnPath(cur), W) + 22;
    var bw = 226, bh = 34, kids = {}, rowOf = {}, next = 0;
    t.order.forEach(function (ref) { if (t.parent[ref]) (kids[t.parent[ref]] = kids[t.parent[ref]] || []).push(ref); });
    (function place(ref) {                                    // 排成一棵树：叶子依次往下排，父节点放在它的孩子们中间
      var ch = kids[ref] || [];
      if (!ch.length) { rowOf[ref] = next++; return; }
      ch.forEach(place);
      rowOf[ref] = (rowOf[ch[0]] + rowOf[ch[ch.length - 1]]) / 2;
    })(o.api.entry);
    t.order.forEach(function (ref, k) {
      var d = t.depth[ref];
      var st = k < o.idx ? 1 : k === o.idx ? 2 : 0;
      sc['fn:' + ref] = { kind: 'box', x: 22 + d * (bw + 22), y: top + rowOf[ref] * (bh + 7), w: bw, h: bh, rx: 8, fs: 11, mono: true,
        label: fnShort(ref), sub: fnPath(ref), click: false,
        fill: st === 2 ? C.blueW : st === 1 ? C.greenW : C.card, stroke: st === 2 ? C.blue : st === 1 ? C.green : C.line,
        color: C.ink, sw: st === 2 ? 2 : 1, bold: st === 2 };
    });
    N.code.calls.forEach(function (c) {
      if (!(c.from in t.depth) || !(c.to in t.depth) || t.depth[c.to] <= t.depth[c.from]) return;
      var done = t.order.indexOf(c.to) <= o.idx && t.parent[c.to] === c.from;
      sc['call:' + c.from + '>' + c.to] = { kind: 'edge', from: 'fn:' + c.from, to: 'fn:' + c.to, side: 'h', color: done ? C.green : C.line,
        sw: done ? 1.7 : 0.9, op: t.parent[c.to] === c.from ? 1 : 0.35 };
    });
    sc['title'] = { kind: 'text', x: 20, y: 18, fs: 13.5, bold: true, color: C.ink,
      text: fnShort(o.api.entry) + ' 往下调用了谁（最多画 3 层' + (t.more ? '，另有 ' + t.more + ' 个没画' : '') + '）' };
    return sc;
  }
  function captionCalls(o) {
    var t = callTree(o.api.entry), ref = t.order[o.idx], info = FN[ref];
    return { tit: (o.idx + 1) + ' / ' + t.order.length, say: info ? (info.f.doc || '（这个函数没有写说明）') : '',
      dat: ref + '(' + (info ? info.f.args.join(', ') : '') + ')' + (t.parent[ref] ? '\n由 ' + fnShort(t.parent[ref]) + ' 调用' : '\n入口'),
      link: info && BORN[info.path] ? { href: 'stages.html#' + BORN[info.path], text: '在 ' + BORN[info.path] + ' 写的' } : null };
  }

  /* ================= 视图 4：逐行执行 ================= */
  function fmtVal(v) {
    if (!v) return '';
    if (v.t === 'str') return JSON.stringify(v.v);
    if (v.t === 'dict') return '{' + v.v.map(function (kv) { return kv[0] + ': ' + kv[1]; }).join(', ') + (v.n > v.v.length ? ', …' : '') + '}';
    if (v.t === 'cells') return '[' + v.v.join(', ') + (v.n > v.v.length ? ', …共 ' + v.n + ' 项' : '') + ']';
    if (v.t === 'grid') return '形状 ' + JSON.stringify(v.shape);
    return String(v.v);
  }
  function traceState(tr, idx) {                              // 把第 0..idx 帧的变化叠起来，得到这一刻全部变量
    var vars = {}, order = [], changed = {}, ret = null;
    for (var k = 0; k <= idx; k++) {
      var fr = tr.frames[k];
      changed = {};
      for (var name in fr.set) { if (!(name in vars)) order.push(name); vars[name] = fr.set[name]; changed[name] = 1; }
      if (fr.ret) ret = fr.ret;
    }
    return { vars: vars, order: order, changed: changed, ret: idx === tr.frames.length - 1 ? ret : null };
  }
  function dedented(tr) {                                     // 嵌套函数的源码整体带着缩进，显示时去掉公共的那一段
    if (!tr._ded) {
      var pad = Infinity;
      tr.src.forEach(function (s) { if (s.trim()) pad = Math.min(pad, s.length - s.replace(/^ +/, '').length); });
      tr._ded = tr.src.map(function (s) { return s.slice(pad === Infinity ? 0 : pad); });
    }
    return tr._ded;
  }
  function varHeight(v) { return v.t === 'grid' ? 30 + v.v.length * 17 : v.t === 'cells' ? 52 : 40; }
  function sceneTrace(o, geo) {
    var tr = o.trace, fr = tr.frames[o.idx], sc = {}, g = geo || { W: 1000, codeW: 566, top: 56, rows: 31, lh: 17.6, fs: 10.6, bottom: 626 };
    var src = dedented(tr), n = src.length, curRow = fr.ln - tr.line0, first = 0;
    if (n > g.rows) first = Math.max(0, Math.min(n - g.rows, curRow - Math.floor(g.rows / 2)));   // 代码太长：让当前行留在窗口中间
    var shown = Math.min(n, g.rows), panelH = shown * g.lh + 16;
    sc['fn:' + tr.path + '::' + tr.func] = { kind: 'box', x: 14, y: g.top, w: g.codeW, h: panelH, rx: 10, fill: C.card, stroke: C.line, sw: 1, label: '', click: false };
    sc['hl'] = { kind: 'box', x: 18, y: g.top + 8 + (curRow - first) * g.lh, w: g.codeW - 8, h: g.lh, rx: 4, fill: fr.ret ? C.greenW : C.blueW,
      stroke: fr.ret ? C.green : C.blue, sw: 0.8, label: '', click: false };
    for (var r = first; r < first + shown; r++) {
      var text = src[r], ln = String(tr.line0 + r);
      sc['ln:' + tr.id + ':' + r] = { kind: 'text', x: 24, y: g.top + 8 + (r - first) * g.lh + g.lh / 2, fs: g.fs, mono: true,
        text: Stage.fit((ln.length < 3 ? ' ' : '') + ln + '  ' + text, g.codeW - 22, g.fs, true),     // 按像素宽度截断：中文字符比英文宽
        color: r === curRow ? C.ink : '#5b6470', bold: r === curRow };
    }
    /* 右边：变量 */
    var st = traceState(tr, o.idx), vx = g.codeW + 28, vw = g.W - vx - 14, y = g.top, maxY = g.bottom, names = st.order.slice();
    var heights = names.map(function (nm) { return varHeight(st.vars[nm]); });
    var need = heights.reduce(function (a, b) { return a + b + 6; }, 0) + (st.ret ? 50 : 0);
    while (need > maxY - g.top && names.length > 1) {         // 放不下：把最早出现、这一步又没变的变量先收起来
      var drop = -1;
      for (var q = 0; q < names.length; q++) if (!st.changed[names[q]]) { drop = q; break; }
      if (drop < 0) drop = 0;
      need -= heights[drop] + 6; names.splice(drop, 1); heights.splice(drop, 1);
    }
    names.forEach(function (nm, q) {
      var v = st.vars[nm], hot = st.changed[nm], hh = heights[q], id = 'var:' + tr.id + ':' + nm;
      sc[id] = { kind: 'box', x: vx, y: y, w: vw, h: hh, rx: 7, fill: hot ? C.orangeW : C.soft, stroke: hot ? C.orange : C.faint, sw: hot ? 1.5 : 0.8, label: '', click: false };
      sc[id + ':n'] = { kind: 'text', x: vx + 9, y: y + 11, fs: 10, mono: true, bold: true, color: hot ? C.orange : C.sub,
        text: nm + (v.shape ? '  形状 ' + JSON.stringify(v.shape) : v.t === 'cells' && v.n > v.v.length ? '  共 ' + v.n + ' 项' : v.t === 'str' ? '  字符串，长 ' + v.n : '') };
      if (v.t === 'cells' || v.t === 'grid') {
        var rows = v.t === 'grid' ? v.v : [v.v];
        rows.forEach(function (row, ri) {
          var cw = Math.min(46, (vw - 16) / Math.max(1, row.length));
          row.forEach(function (cell, ci) {
            var s = String(cell);
            sc[id + ':c' + ri + '_' + ci] = { kind: 'box', x: vx + 8 + ci * cw, y: y + 22 + ri * 17 + (v.t === 'cells' ? 2 : 0), w: cw - 2, h: v.t === 'cells' ? 22 : 15, rx: 3,
              fs: cw < 30 ? 8.5 : 9.5, mono: true, label: s, pad: 1, fill: cell === -100 ? C.gray : C.card, stroke: hot ? C.orange : C.line, sw: 0.7,
              color: cell === -100 ? C.sub : C.ink, click: false };
          });
        });
      } else {
        sc[id + ':v'] = { kind: 'text', x: vx + 9, y: y + 27, fs: 10.8, mono: true, color: C.ink,
          text: Stage.fit(fmtVal(v), vw - 18, 10.8, true) };
      }
      y += hh + 6;
    });
    if (st.ret) {
      sc['ret:' + tr.id] = { kind: 'box', x: vx, y: y + 4, w: vw, h: 40, rx: 7, fill: C.greenW, stroke: C.green, sw: 1.6, label: '', click: false };
      sc['ret:' + tr.id + ':n'] = { kind: 'text', x: vx + 9, y: y + 15, fs: 10, mono: true, bold: true, color: C.green, text: '返回值' };
      sc['ret:' + tr.id + ':v'] = { kind: 'text', x: vx + 9, y: y + 31, fs: 10.8, mono: true, color: C.ink, text: Stage.fit(fmtVal(st.ret), vw - 18, 10.8, true) };
    }
    sc['title'] = { kind: 'text', x: 16, y: 18, fs: 13.5, bold: true, color: C.ink, text: tr.title };
    sc['sub'] = { kind: 'text', x: 16, y: 38, fs: 10.5, mono: true, color: C.sub, text: tr.path + ' · ' + tr.func + '   输入：' + Stage.fit(tr.input || '', g.W - 420, 10.5, true) };
    return sc;
  }
  function captionTrace(o) {
    var tr = o.trace, fr = tr.frames[o.idx], line = tr.src[fr.ln - tr.line0] || '', say = '';
    (tr.notes || []).forEach(function (nt) { if (line.indexOf(nt.match) >= 0) say = nt.say; });
    var st = traceState(tr, o.idx), names = Object.keys(st.changed);
    var dat = fr.ret ? '返回 ' + fmtVal(fr.ret) : '接下来要执行第 ' + fr.ln + ' 行：' + line.trim();
    if (names.length && o.idx > 0) dat += '\n上一行执行完，变了的变量：' + names.map(function (nm) { return nm + ' = ' + Stage.fit(fmtVal(st.vars[nm]), 520, 12, true); }).join('，');
    return { tit: (o.idx + 1) + ' / ' + tr.frames.length, say: say || (fr.ret ? '函数返回。' : o.idx === 0 ? '进入函数，参数已经就位。' : ''), dat: dat };
  }
  function traceHeight(tr, g) {                               // 嵌在正文里的小舞台：高度取"代码面板"和"变量最多时要占的高度"里较大的，封顶 560
    var most = 0;
    for (var k = 0; k < tr.frames.length; k++) {
      var st = traceState(tr, k), need = st.ret ? 50 : 0;
      st.order.forEach(function (nm) { need += varHeight(st.vars[nm]) + 6; });
      most = Math.max(most, need);
    }
    var body = Math.max(Math.min(tr.src.length, g.rows) * g.lh + 16, Math.min(most, 560 - g.top - 14));
    g.bottom = g.top + body;
    return g.bottom + 14;
  }

  /* ================= 播放器：一个舞台 + 一排控件 + 一块说明 ================= */
  function Player(root, opt) {
    var self = this;
    this.opt = opt;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'stage');
    this.svg.setAttribute('viewBox', '0 0 ' + opt.W + ' ' + opt.H);
    this.svg.setAttribute('role', 'img');
    this.bar = h('div', { class: 'stagebar' });
    this.cap = h('div', { class: 'cap' });
    root.appendChild(h('div', { class: 'stagebox' }, [this.bar, this.svg, this.cap]));
    this.stage = new Stage(this.svg, { onClick: opt.onClick });
    this.timer = 0; this.speed = 1; this.playing = false;
    this.bPrev = h('button', { class: 'btn', type: 'button', text: '◀ 上一步', onclick: function () { self.pause(); opt.step(-1); } });
    this.bPlay = h('button', { class: 'btn', type: 'button', text: '▶ 播放', onclick: function () { self.playing ? self.pause() : self.play(); } });
    this.bNext = h('button', { class: 'btn', type: 'button', text: '下一步 ▶', onclick: function () { self.pause(); opt.step(1); } });
    this.cnt = h('span', { class: 'cnt' });
    this.bSpeed = h('button', { class: 'btn', type: 'button', text: '1×', title: '播放速度', onclick: function () {
      self.speed = self.speed === 1 ? 2 : self.speed === 2 ? 0.5 : 1; self.bSpeed.textContent = self.speed + '×';
      if (self.playing) { self.pause(); self.play(); }
    } });
  }
  Player.prototype.play = function () {
    var self = this;
    if (this.opt.atEnd()) this.opt.reset();
    this.playing = true; this.bPlay.textContent = '❚❚ 暂停'; this.bPlay.classList.add('on');
    this.timer = setInterval(function () { if (self.opt.atEnd()) self.pause(); else self.opt.step(1); }, 1500 / this.speed);
  };
  Player.prototype.pause = function () {
    this.playing = false; clearInterval(this.timer); this.bPlay.textContent = '▶ 播放'; this.bPlay.classList.remove('on');
  };
  Player.prototype.caption = function (c) {
    this.cap.innerHTML = '';
    this.cap.appendChild(h('div', { class: 'say' }, [h('span', { class: 'tit', text: c.tit || '' }), c.say || '', c.link ? ' ' : null,
      c.link ? h('a', { href: c.link.href, text: c.link.text + ' →' }) : null]));
    if (c.dat) this.cap.appendChild(h('div', { class: 'dat', text: c.dat }));
  };

  /* ================= 页面 5 的主舞台 ================= */
  function mountMain(root) {
    var VIEWS = [['struct', '结构图'], ['api', 'API 流程'], ['calls', '函数调用图'], ['code', '逐行执行']];
    var saved = App.state.viz || {};
    var s = { view: saved.view || 'struct', api: saved.api || N.viz.apis[0].id, trace: saved.trace || Object.keys(N.viz.traces)[0],
      idx: saved.idx || {}, sel: saved.sel || null, step: null, hw: saved.hw || 'a1' };
    var hash = {};
    location.hash.slice(1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) hash[p[0]] = decodeURIComponent(p[1] || ''); });
    if (hash.focus) { s.view = 'struct'; s.sel = hash.focus; s.step = hash.step || null; s.hw = hwOf(hash.focus.replace(/^file:/, '')) || s.hw; }
    if (hash.trace && N.viz.traces[hash.trace]) { s.view = 'code'; s.trace = hash.trace; }
    if (hash.api) { s.view = hash.view === 'calls' ? 'calls' : 'api'; s.api = hash.api; }
    var apiById = {}; N.viz.apis.forEach(function (a) { apiById[a.id] = a; });
    if (!apiById[s.api]) s.api = N.viz.apis[0].id;
    if (!N.viz.traces[s.trace]) s.trace = Object.keys(N.viz.traces)[0];
    if (hash.i) s.idx[s.view + ':' + (s.view === 'code' ? s.trace : s.api)] = parseInt(hash.i, 10) || 0;   // 链接里可以带"第几步"

    function key() { return s.view + ':' + (s.view === 'code' ? s.trace : s.api); }
    function total() {
      if (s.view === 'api') return apiById[s.api].hops.length;
      if (s.view === 'calls') return callTree(apiById[s.api].entry).order.length;
      if (s.view === 'code') return N.viz.traces[s.trace].frames.length;
      return 1;
    }
    function idx() { return Math.min(total() - 1, s.idx[key()] || 0); }
    function ctx() { return { api: apiById[s.api], trace: N.viz.traces[s.trace], idx: idx(), sel: s.sel, step: s.step }; }
    var player = new Player(root, {
      W: 1000, H: 640,
      onClick: function (id) { if (s.view === 'struct' && id.indexOf('file:') === 0) { s.sel = s.sel === id ? null : id; s.step = null; render(500); player.stage.pulse(id); } },
      step: function (d) { s.idx[key()] = Math.max(0, Math.min(total() - 1, idx() + d)); render(520); },
      atEnd: function () { return idx() >= total() - 1; },
      reset: function () { s.idx[key()] = 0; render(520); }
    });
    var tabs = VIEWS.map(function (v) {
      return h('button', { class: 'btn', type: 'button', text: v[1], 'data-view': v[0], onclick: function () { player.pause(); s.view = v[0]; render(850); } });
    });
    var selApi = h('select', { class: 'sel', 'aria-label': '选择 API', onchange: function () { player.pause(); s.api = selApi.value; render(750); } },
      N.viz.apis.map(function (a) { return h('option', { value: a.id, text: a.lab + ' · ' + a.title }); }));
    var selTrace = h('select', { class: 'sel', 'aria-label': '选择函数', onchange: function () { player.pause(); s.trace = selTrace.value; render(750); } },
      Object.keys(N.viz.traces).map(function (id) { var t = N.viz.traces[id]; return h('option', { value: id, text: t.func + ' · ' + t.title }); }));
    var selHw = h('select', { class: 'sel', 'aria-label': '选择作业', onchange: function () { s.hw = selHw.value; s.sel = null; render(750); } },
      (N.meta.kinds || []).map(function (k, i) { return h('option', { value: k.id, text: '作业 ' + (i + 1) }); }));
    tabs.forEach(function (t) { player.bar.appendChild(t); });
    [selHw, selApi, selTrace, h('span', { class: 'spacer' }), player.bPrev, player.bPlay, player.bNext, player.cnt, player.bSpeed].forEach(function (e) { player.bar.appendChild(e); });

    function render(dur) {
      var c = ctx(), scene, cap;
      setHW(s.view === 'struct' ? s.hw : hwOf(s.view === 'code' ? N.viz.traces[s.trace].path : apiById[s.api].entry));
      if (s.view === 'struct') { scene = sceneStructure(c); cap = captionStructure(c); }
      else if (s.view === 'api') { scene = sceneApi(c); cap = captionApi(c); }
      else if (s.view === 'calls') { scene = sceneCalls(c); cap = captionCalls(c); }
      else { scene = sceneTrace(c); cap = captionTrace(c); }
      player.stage.apply(scene, { dur: dur });
      player.caption(cap);
      tabs.forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-view') === s.view); });
      selApi.value = s.api; selTrace.value = s.trace; selHw.value = s.hw;
      selHw.style.display = s.view === 'struct' ? '' : 'none';
      selApi.style.display = s.view === 'api' || s.view === 'calls' ? '' : 'none';
      selTrace.style.display = s.view === 'code' ? '' : 'none';
      var stepping = s.view !== 'struct';
      [player.bPrev, player.bPlay, player.bNext, player.bSpeed].forEach(function (b) { b.disabled = !stepping; });
      player.cnt.textContent = stepping ? (idx() + 1) + ' / ' + total() : '';
      App.saveState({ viz: { view: s.view, api: s.api, trace: s.trace, idx: s.idx, sel: s.sel, hw: s.hw } });
    }
    render(0);
    if (hash.focus) setTimeout(function () { player.stage.pulse(hash.focus); }, 250);
    return player;
  }

  /* ================= 嵌在分阶段笔记里的小演示 ================= */
  function mountInline(box) {
    var spec = box.getAttribute('data-viz'), kind = spec.split(':')[0], ref = spec.slice(kind.length + 1);
    if (kind === 'trace') {
      var tr = N.viz.traces[ref];
      if (!tr) return;
      var g = { W: 860, codeW: 500, top: 50, rows: 24, lh: 17.2, fs: 10.2 }, i = 0;
      var player = new Player(box, { W: g.W, H: traceHeight(tr, g),
        step: function (d) { i = Math.max(0, Math.min(tr.frames.length - 1, i + d)); draw(480); },
        atEnd: function () { return i >= tr.frames.length - 1; }, reset: function () { i = 0; draw(480); } });
      [player.bPrev, player.bPlay, player.bNext, player.cnt, player.bSpeed, h('span', { class: 'spacer' }),
        h('a', { class: 'btn', href: 'viz.html#trace=' + ref, text: '在可视化页打开' })].forEach(function (e) { player.bar.appendChild(e); });
      var draw = function (dur) {
        var c = { trace: tr, idx: i };
        player.stage.apply(sceneTrace(c, g), { dur: dur });
        player.caption(captionTrace(c));
        player.cnt.textContent = (i + 1) + ' / ' + tr.frames.length;
      };
      draw(0);
    } else if (kind === 'deps') {
      mountDeps(box, ref.split(',').map(function (p) { return p.trim(); }));
    }
  }
  function mountDeps(box, mine) {                             // 这一步的文件放中间，左边是它们 import 的，右边是 import 它们的
    var left = [], right = [];
    mine.forEach(function (m) {
      FILES[m].imports.forEach(function (p) { if (mine.indexOf(p) < 0 && left.indexOf(p) < 0) left.push(p); });
      PATHS.forEach(function (p) { if (FILES[p].imports.indexOf(m) >= 0 && mine.indexOf(p) < 0 && right.indexOf(p) < 0) right.push(p); });
    });
    var rows = Math.max(left.length, mine.length, right.length, 1), W = 860, H = 62 + rows * 30, sc = {}, bw = 232;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'stage'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    box.appendChild(h('div', { class: 'stagebox' }, [svg]));
    var stage = new Stage(svg, { onClick: function (id) { location.href = 'viz.html#focus=' + encodeURIComponent(id); } });
    function column(list, x, kind) {
      var y0 = 46 + (rows - list.length) * 15;
      list.forEach(function (path, k) {
        var p = pkg(path);
        sc['file:' + path] = { kind: 'box', x: x, y: y0 + k * 30, w: bw, h: 24, rx: 6, fs: 10.5, mono: true, label: path, pad: 7, delay: k * 60 + (kind === 1 ? 0 : 180),
          fill: kind === 1 ? p.color : p.weak, stroke: p.color, color: kind === 1 ? '#ffffff' : C.ink, bold: kind === 1 };
      });
    }
    column(left, 16, 0); column(mine, (W - bw) / 2, 1); column(right, W - bw - 16, 2);
    mine.forEach(function (m) {
      left.forEach(function (p) { if (FILES[m].imports.indexOf(p) >= 0) sc['imp:' + m + '>' + p] = { kind: 'edge', from: 'file:' + m, to: 'file:' + p, color: C.blue, sw: 1.2, delay: 300 }; });
      right.forEach(function (p) { if (FILES[p].imports.indexOf(m) >= 0) sc['imp:' + p + '>' + m] = { kind: 'edge', from: 'file:' + p, to: 'file:' + m, color: C.orange, sw: 1.2, delay: 300 }; });
    });
    sc['h0'] = { kind: 'text', x: 16, y: 22, fs: 11.5, bold: true, color: C.blue, text: '它用到的（已经写好）' + (left.length ? '' : '：无') };
    sc['h1'] = { kind: 'text', x: W / 2, y: 22, fs: 11.5, bold: true, color: C.ink, anchor: 'middle', text: '这一步写的文件' };
    sc['h2'] = { kind: 'text', x: W - 16, y: 22, fs: 11.5, bold: true, color: C.orange, anchor: 'end', text: (right.length ? '' : '无：') + '以后谁会用到它' };
    var shown = false;
    function show() { if (!shown) { shown = true; stage.apply(sc, { dur: 650 }); } }
    if ('IntersectionObserver' in global) {                   // 滚到眼前再淡入
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { show(); io.disconnect(); } }, { threshold: 0.3 });
      io.observe(box);
    } else show();
  }

  /* ================= 逐步走读「总览」那一格（walk.js 用）：结构图上标出这个阶段动了哪些文件 =================
   * o：{ title, stage: 阶段 id, fresh: [这个阶段新建的文件], mod: [这个阶段改过的文件], hot: [要格外标出来的文件] }
   * 这个阶段之前就有的文件照常显示，之后才建的文件画成很淡的虚框。 */
  function sceneStage(o) {
    var st0 = N.stages.filter(function (x) { return x.id === o.stage; })[0];
    if (st0) setHW(st0.kind);
    var W = 1000, L = structureLayout(W), sc = {}, order = {};
    N.stages.forEach(function (st, k) { order[st.id] = k; });
    var here = order[o.stage];
    function role(path) {
      if ((o.hot || []).indexOf(path) >= 0) return 4;
      if (o.fresh.indexOf(path) >= 0) return 3;
      if (o.mod.indexOf(path) >= 0) return 2;
      var b = BORN[path];
      return b && order[b.split('-')[0]] > here ? 0 : 1;
    }
    PKG.forEach(function (p) { sc['hdr:' + p.id] = { kind: 'text', x: L.cols[p.id].x, y: 44, text: p.zh, fs: 12, color: p.color, bold: true }; });
    Object.keys(L.pos).forEach(function (id) {
      var b = L.pos[id], isFile = id.indexOf('file:') === 0, path = id.slice(isFile ? 5 : 4).split('::')[0], p = pkg(path), r = role(path);
      if (isFile) {
        sc[id] = { kind: 'box', x: b.x, y: b.y, w: b.w, h: b.h, rx: 6, fs: 10.5, mono: true, label: base(path), pad: 6, click: false,
          fill: r >= 3 ? p.color : r === 2 ? C.orangeW : r === 1 ? p.weak : C.card,
          stroke: r === 4 ? C.ink : r >= 3 ? p.color : r === 2 ? C.orange : p.color, sw: r === 4 ? 2.2 : r >= 2 ? 1.6 : 0.8,
          color: r >= 3 ? '#ffffff' : C.ink, bold: r >= 3, op: r === 0 ? 0.28 : 1, dash: r === 0 ? '3 3' : null };
      } else {
        sc[id] = { kind: 'box', x: b.x, y: b.y, w: b.w, h: b.h, rx: 4, fs: 9.5, mono: true, label: '└ ' + id.split('::')[1], pad: 4, align: 'l',
          fill: C.card, stroke: C.faint, color: p.color, sw: 0.8, op: r === 0 ? 0.2 : 1, click: false };
      }
    });
    PATHS.forEach(function (a) {
      if (!L.pos['file:' + a] || role(a) === 0) return;
      FILES[a].imports.forEach(function (b) {
        if (!L.pos['file:' + b] || role(b) === 0) return;
        var hot = role(a) >= 3;
        sc['imp:' + a + '>' + b] = { kind: 'edge', from: 'file:' + a, to: 'file:' + b, sw: hot ? 1.4 : 0.8, color: hot ? C.blue : C.line, op: hot ? 0.9 : 0.35 };
      });
    });
    sc['title'] = { kind: 'text', x: 20, y: 18, fs: 13.5, bold: true, color: C.ink, text: o.title };
    sc['legend'] = { kind: 'text', x: 980, y: 18, fs: 10.5, anchor: 'end', color: C.sub, text: '实心 = 这个阶段新建　橙框 = 这个阶段改过　虚框 = 以后才有　蓝线 = 新文件 import 谁' };
    return sc;
  }

  /* ================= 逐步走读「✎ 写」那一格（walk.js 用） =================
   * 左边是这一步做完时的文件，要敲的行涂绿、行首一个 +；右边是这一步写了什么、写完以后实测能不能导入。
   * 每一行的 id 用它在最终文件里的行号：前面插进新行时，旧行是往下挪，不是消失再出现。
   * o：{ sid, path, lines: [[最终行号, 文字, 是不是这一步写的], …], action, names, state, k, nFiles, next, empty } */
  var WG = { W: 1000, codeW: 566, top: 56, rows: 31, lh: 17.6, fs: 10.6, bottom: 626 };
  function sceneWrite(o) {
    var g = WG, sc = {}, L = o.lines, n = L.length, rows = g.rows;
    var nNew = L.filter(function (x) { return x[2]; }).length;
    /* 要显示哪些行：新文件（全绿）或者整个文件放得下，就从头显示一屏；
     * 改文件只留绿色的行和上下各 2 行，中间跳过的写成「⋯ 省略 N 行」，几处改动都看得见（像 diff） */
    var show = [];                                             // 每一项：行下标，或 { gap: 跳过几行 }
    if (nNew === n || n <= rows) {
      var firstNew = 0;
      for (var q = 0; q < n; q++) if (L[q][2]) { firstNew = q; break; }
      var s0 = Math.max(0, Math.min(firstNew - 3, n - rows));
      if (s0 > 0) show.push({ gap: s0, top: true });
      for (q = s0; q < n; q++) show.push(q);
    } else {
      var keep = [];
      for (q = 0; q < n; q++) if (L[q][2]) for (var d = -2; d <= 2; d++) if (q + d >= 0 && q + d < n) keep[q + d] = true;
      var gap = 0;
      for (q = 0; q < n; q++) {
        if (keep[q]) { if (gap) { show.push({ gap: gap }); gap = 0; } show.push(q); }
        else gap++;
      }
      if (gap) show.push({ gap: gap });
    }
    var hiddenNew = 0;
    if (show.length > rows) {                                  // 还是放不下：截到一屏，最后一行说明下面还有多少
      var cut = show.slice(rows - 1), rest = 0;
      cut.forEach(function (x) { if (typeof x === 'number') { rest++; if (L[x][2]) hiddenNew++; } else rest += x.gap; });
      show = show.slice(0, rows - 1).concat([{ gap: rest, tail: true }]);
    }
    var shown = show.length;
    sc['title'] = { kind: 'text', x: 16, y: 18, fs: 13.5, bold: true, color: C.ink, text: '✎ 写 ' + o.sid + '：' + o.path };
    sc['sub'] = { kind: 'text', x: 16, y: 38, fs: 10.5, mono: true, color: C.sub,
      text: (o.action === 'new' ? '新建 · 共 ' + n + ' 行，全部要敲' : '修改 · 加 ' + nNew + ' 行（绿色 +），做完这一步共 ' + n + ' 行') +
        (o.nFiles > 1 ? '   ·   这一步的第 ' + (o.k + 1) + ' / ' + o.nFiles + ' 个文件' : '') };
    sc['wpanel'] = { kind: 'box', x: 14, y: g.top, w: g.codeW, h: Math.max(1, shown) * g.lh + 16, rx: 10, fill: C.card, stroke: C.line, sw: 1, label: '', click: false };
    if (!n) sc['wempty'] = { kind: 'text', x: 30, y: g.top + 26, fs: 11, color: C.sub, text: '空文件：建出来就行（有了它 Python 才把这个目录当成包）' };
    var y0 = g.top + 8, band = null, bands = [];
    show.forEach(function (x, k) {                             // 屏幕上连续的绿色行合成一块底色
      if (typeof x === 'number' && L[x][2]) { if (band && band[1] === k - 1) band[1] = k; else { band = [k, k]; bands.push(band); } }
    });
    bands.forEach(function (bd, j) {
      sc['wband:' + j] = { kind: 'box', x: 18, y: y0 + bd[0] * g.lh, w: g.codeW - 8, h: (bd[1] - bd[0] + 1) * g.lh, rx: 4,
        fill: C.greenW, stroke: C.green, sw: 0.8, label: '', click: false };
    });
    var gapNo = 0;
    show.forEach(function (x, k) {
      var yy = y0 + k * g.lh + g.lh / 2;
      if (typeof x !== 'number') {
        sc['wgap:' + (gapNo++)] = { kind: 'text', x: 32, y: yy, fs: g.fs, color: C.sub,
          text: x.tail ? '⋯ 下面还有 ' + x.gap + ' 行' + (hiddenNew ? '（其中 ' + hiddenNew + ' 行绿色）' : '') + '，完整代码在面板「要敲的代码」里'
            : '⋯ ' + (x.top ? '上面' : '') + '省略 ' + x.gap + ' 行没变的' };
        return;
      }
      var mine = L[x][2], ln = String(x + 1);
      if (mine) sc['wplus:' + o.path + ':' + L[x][0]] = { kind: 'text', x: 21, y: yy, fs: g.fs, mono: true, bold: true, color: C.green, text: '+' };
      sc['wl:' + o.path + ':' + L[x][0]] = { kind: 'text', x: 32, y: yy, fs: g.fs, mono: true, color: mine ? '#0f5132' : '#5b6470',
        text: Stage.fit((ln.length < 3 ? ' ' : '') + ln + '  ' + L[x][1].replace(/\t/g, '    '), g.codeW - 40, g.fs, true) };
    });
    /* 右边 */
    var X = g.codeW + 28, Wd = g.W - X - 14, y = g.top;
    function card(id, title, rowsKV, tone) {
      var col = tone === 'bad' ? C.red : tone === 'warn' ? C.orange : tone === 'note' ? C.sub : C.green;
      var weak = tone === 'bad' ? C.redW : tone === 'warn' ? C.orangeW : tone === 'note' ? C.soft : C.greenW;
      var hh = 30 + rowsKV.length * 19 + 6;
      sc[id] = { kind: 'box', x: X, y: y, w: Wd, h: hh, rx: 8, fill: weak, stroke: col, sw: 1.2, label: '', click: false };
      sc[id + ':t'] = { kind: 'text', x: X + 10, y: y + 15, fs: 11.5, bold: true, color: col, text: title };
      rowsKV.forEach(function (kv, j) {
        sc[id + ':k' + j] = { kind: 'text', x: X + 10, y: y + 36 + j * 19, fs: 10.5, color: C.sub, text: kv[0] };
        sc[id + ':v' + j] = { kind: 'text', x: X + 64, y: y + 36 + j * 19, fs: 10.5, mono: !!kv[2], color: C.ink, text: Stage.fit(kv[1], Wd - 74, 10.5, !!kv[2]) };
      });
      y += hh + 10;
    }
    var rowsA = [['文件', o.path, true], ['改动', o.action === 'new' ? '新建，' + n + ' 行' : '加 ' + nNew + ' 行，在第 ' + o.bandText + ' 行']];
    var names = (o.names || []).slice(), line = '', lines = [];
    names.forEach(function (nm) {
      if (line && Stage.textWidth(line + '  ' + nm, 10.5, true) > Wd - 80) { lines.push(line); line = nm; } else line = line ? line + '  ' + nm : nm;
    });
    if (line) lines.push(line);
    lines.slice(0, 6).forEach(function (l, j) { rowsA.push([j ? '' : '定义', l, true]); });
    card('w_this', '这一步写了什么', rowsA, 'ok');
    var st = o.state;
    if (st) {
      var miss = 0, later = [];
      Object.keys(st.miss || {}).forEach(function (p) { st.miss[p].forEach(function (m) { miss++; if (m[2] && later.indexOf(m[2]) < 0) later.push(m[2]); }); });
      var rowsB = [['语法', st.syn && st.syn.length ? '✗ 有语法错误' : '✓ 每个 .py 都能编译'],
        ['导入', st.b ? '✓ 能导入' + (st.mods && st.mods.length ? '（' + st.mods.length + ' 个模块）' : '') : '✗ 不能导入'],
        ['缺名', miss ? '✗ ' + miss + ' 个名字还没写（到 ' + later.join('、') + '）' : '✓ 函数里用到的名字都已经有了'],
        ['测试', { pass: '✓ pytest 通过' + (st.tsec ? '（' + st.tsec + ' 秒）' : ''), fail: '✗ pytest 失败', none: '这一步还没有测试' }[st.t] || '无']];
      card('w_state', '写完以后（实测：真的 import 了一遍）', rowsB, !st.b ? 'bad' : miss || st.t === 'fail' ? 'warn' : 'ok');
      var errs = (st.syn || []).concat(st.imp || []).slice(0, 3);
      if (errs.length) {
        errs.forEach(function (e, j) { sc['w_err' + j] = { kind: 'text', x: X + 4, y: y + j * 16, fs: 10, mono: true, color: C.red, text: Stage.fit(e, Wd - 8, 10, true) }; });
        y += errs.length * 16 + 8;
      }
    }
    sc['w_tip'] = { kind: 'box', x: X, y: Math.max(y, 470), w: Wd, h: 54, rx: 8, fill: '#fffdf5', stroke: '#d9cfae', sw: 1, dash: '4 3', align: 'l', fs: 10.5,
      label: o.next || '', sub: o.next2 || '', click: false };
    return sc;
  }

  global.Viz = { mountMain: mountMain, mountInline: mountInline, callTree: callTree,
    sceneTrace: sceneTrace, captionTrace: captionTrace, sceneApi: sceneApi, captionApi: captionApi, sceneWrite: sceneWrite, sceneStage: sceneStage, traceState: traceState, fmtVal: fmtVal };
})(window);

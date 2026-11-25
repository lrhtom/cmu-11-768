// 「核心原理」翻页图解的排版核心（从 go_learn 笔记的 trace-core.js 搬过来，改成认 Python）。纯函数，不碰 DOM：
//   states(tr)            把一节图解的各页操作依次累积，得到每一页的「状态」：调用栈 + 对象 + 终端输出
//   scene(tr, i, src)     把第 i 页的状态排成舞台图元：左边源码（要看的几行高亮），右边画图；每个图元有稳定 id，
//                         舞台（tween.js）据此只做补间（位置 / 颜色 / 透明度），新增淡入、移除淡出
//   audit(tr, src)        逐页校验：引用的对象在不在、对象之间有没有重叠、有没有出界（tools/concept-audit.js 用 node 调它）
// 写法见 content/concepts/README.md。浏览器里挂在 window.TraceCore，node 里是 module.exports。
// 布局两种：有源码的（左源码、右画图）；layout: 'full' 的整幅（没有源码栏，整张画布都画图）。
(function (G) {
  'use strict';

  // ---------------- 舞台分区（SVG 坐标，画布 1000×560） ----------------
  const CODE = { x: 8, y: 8, w: 428, h: 544, top: 50, lh: 18.4, rows: 27 };
  const DATA = { x0: 444, x1: 994, y0: 8, y1: 552 };
  const FRAME = { x: 448, y: 28, w: 156, gap: 8 };
  const CONSOLE = { x: 448, y: 478, w: 544, h: 70, lines: 3 };
  const FULL = { x0: 8, x1: 992, y0: 8, y1: 552 };
  // 这一条演示用哪种布局：数据区范围、调用栈那一列的 x、终端框的位置
  const geo = tr => tr.layout === 'full'
    ? { full: true, R: FULL, fx: 12, con: { x: 12, y: 478, w: 980, h: 70, lines: 3 } }
    : { full: false, R: DATA, fx: FRAME.x, con: CONSOLE };
  const ROW = 18, HEAD = 22;
  const NODE = { w: 74, h: 40, gap: 26 };
  const CELL = { w: 54, h: 26 };

  const TONE = {
    heap: ['#ffffff', '#2563eb'], map: ['#ffffff', '#0f8b6c'], frame: ['#f6f5f1', '#8b919a'],
    go: ['#f5f3ff', '#7c3aed'], ext: ['#f3f2ee', '#8b919a'], warn: ['#fef2f2', '#dc2626'],
    chan: ['#fffbeb', '#b7791f'], ok: ['#ecfdf5', '#0f8b6c'], note: ['#fffdf5', '#c9c0a8'],
    key: ['#fff1f0', '#e0452b'], virt: ['#eef4ff', '#93b4f5']
  };
  const COL = {
    ink: '#1f2328', muted: '#6b7280', faint: '#a3aab3', link: '#6b7280', hot: '#d97706',
    flash: '#fff1bf', hlStroke: '#d97706', codeBg: '#fbfaf6', codeLine: '#e7e2d6',
    cur: '#fde9b0', prev: '#f1eee6', panel: '#e3ded2', add: '#dcf5e8', addLine: '#0f8b6c'
  };

  const KINDS = ['box', 'map', 'node', 'list', 'slice', 'ring', 'tree', 'text', 'seq', 'table', 'arrow', 'tag'];
  // push 往哪个数组字段里追加
  const ARR = { list: 'items', slice: 'items', ring: 'items', tree: 'nodes', seq: 'msgs', table: 'rows' };
  const clone = x => JSON.parse(JSON.stringify(x));
  const isPtr = v => typeof v === 'string' && v.charAt(0) === '→';
  const ptrId = v => v.slice(1).trim();
  const isNil = id => id === 'nil' || id === 'None';
  // 估算文字宽度（11px 等宽字体）：中文和全角符号按两个字宽
  const tw = (s, size) => { let n = 0; for (const c of String(s)) n += c.charCodeAt(0) > 0x2e7f ? 2 : 1; return n * (size || 11) * 0.6; };
  // 放不下就截断加「…」。排版一页时 sink 收集被截断的字（源码栏、调用栈、终端那几处截断是常态，排它们时 sink.off）
  let sink = null;
  function fit(s, px, size) {
    s = String(s);
    if (tw(s, size) <= px) return s;
    if (sink && !sink.off) sink.push(s);
    let out = '';
    for (const c of s) { if (tw(out + c + '…', size) > px) break; out += c; }
    return out + '…';
  }
  const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
  // 这一步变了的节点 / 格子 / 环上的点闪黄底。翻页图解里（ctx.soft）带了颜色（tone）的保留本色，只描橙边，免得颜色的含义被盖住
  const flash = (ctx, changed, tone, fill) => changed && !(ctx.soft && tone && tone !== 'heap') ? COL.flash : fill;

  // ---------------- 1. 状态累积 ----------------
  function setRows(rows, patch) {
    for (const k of Object.keys(patch)) {
      const v = patch[k], i = rows.findIndex(r => r[0] === k);
      if (v === null) { if (i >= 0) rows.splice(i, 1); }
      else if (i >= 0) rows[i][1] = String(v);
      else rows.push([k, String(v)]);
    }
  }

  function applyStep(st, s, errs, tag) {
    if (s.frames) st.frames = clone(s.frames).map(f => ({ fn: f.fn, vars: f.vars || [] }));
    if (s.ret) {
      const n = s.ret === true ? 1 : +s.ret;
      if (st.frames.length < n) errs.push(`${tag}：ret 要弹出 ${n} 层，可调用栈只有 ${st.frames.length} 层`);
      st.frames.splice(Math.max(0, st.frames.length - n), n);
    }
    if (s.call) for (const c of [].concat(s.call)) {
      if (!c || !c.fn) { errs.push(`${tag}：call 缺 fn`); continue; }
      st.frames.push({ fn: c.fn, vars: clone(c.vars || []).map(r => [r[0], String(r[1])]) });
    }
    if (s.vars) {
      const f = st.frames[st.frames.length - 1];
      if (!f) errs.push(`${tag}：写了 vars，可调用栈是空的（先 call）`); else setRows(f.vars, s.vars);
    }
    if (s.obj) for (const o of [].concat(s.obj)) {
      if (!o || !o.id) { errs.push(`${tag}：obj 里有对象缺 id`); continue; }
      if (/[.\s]/.test(o.id)) errs.push(`${tag}：对象 id「${o.id}」里不能有点号或空格`);
      const old = st.objs[o.id];
      if (old) Object.assign(old, clone(o));
      else {
        if (!KINDS.includes(o.kind)) { errs.push(`${tag}：新对象 ${o.id} 的 kind「${o.kind}」不认识（可选：${KINDS.join(' / ')}）`); continue; }
        st.objs[o.id] = clone(o); st.order.push(o.id);
      }
      const ob = st.objs[o.id];
      if (ob.rows) ob.rows = ob.kind === 'table' ? ob.rows.map(r => [].concat(r).map(String)) : ob.rows.map(r => [String(r[0]), String(r[1])]);
    }
    if (s.set) for (const path of Object.keys(s.set)) {
      const dot = path.indexOf('.'), id = dot < 0 ? path : path.slice(0, dot), key = dot < 0 ? '' : path.slice(dot + 1);
      const o = st.objs[id], v = s.set[path];
      if (!o || !key) { errs.push(`${tag}：set「${path}」——${o ? '要写成 对象id.字段' : '没有对象 ' + id}`); continue; }
      if ((o.kind === 'box' || o.kind === 'map') && key !== 'title' && key !== 'tone') { o.rows = o.rows || []; setRows(o.rows, { [key]: v }); }
      else if (o.kind === 'table' && /^\d+\.\d+$/.test(key)) {
        const [r, c] = key.split('.').map(Number), row = (o.rows || [])[r];
        if (!row) errs.push(`${tag}：set「${path}」——表格没有第 ${r} 行（从 0 数）`); else row[c] = String(v);
      } else if (o.kind === 'slice' && /^\d+$/.test(key)) {
        const it = (o.items || [])[+key];
        if (it === undefined) errs.push(`${tag}：set「${path}」越界`);
        else if (typeof it === 'object') it.v = String(v); else o.items[+key] = String(v);
      } else if (['label', 'sub', 'tone', 'title', 'text', 'note', 'on', 'side', 'from', 'to'].includes(key)) { if (v === null) delete o[key]; else o[key] = String(v); }
      else errs.push(`${tag}：set「${path}」——${o.kind} 没有可改的字段 ${key}`);
    }
    if (s.push) for (const path of Object.keys(s.push)) {
      const dot = path.indexOf('.'), id = dot < 0 ? path : path.slice(0, dot), o = st.objs[id], add = s.push[path];
      if (!o) { errs.push(`${tag}：push「${path}」——没有对象 ${id}`); continue; }
      const field = dot < 0 ? ARR[o.kind] : path.slice(dot + 1);
      if (!field || ARR[o.kind] !== field) { errs.push(`${tag}：push「${path}」——${o.kind} 只能往 ${ARR[o.kind] || '（没有可追加的字段）'} 里追加`); continue; }
      if (!Array.isArray(add)) { errs.push(`${tag}：push「${path}」的值要写成数组（一次追加几项就写几项）`); continue; }
      o[field] = (o[field] || []).concat(clone(add));
    }
    if (s.del) for (const path of [].concat(s.del)) {
      const dot = path.indexOf('.');
      if (dot < 0) {
        if (!st.objs[path]) { errs.push(`${tag}：del 的对象 ${path} 不存在`); continue; }
        delete st.objs[path]; st.order = st.order.filter(x => x !== path);
        for (const o of Object.values(st.objs)) if (o.kind === 'list' && o.items) o.items = o.items.filter(x => x !== path);
      } else {
        const o = st.objs[path.slice(0, dot)], key = path.slice(dot + 1);
        if (!o || !o.rows || !o.rows.some(r => r[0] === key)) { errs.push(`${tag}：del 的字段 ${path} 不存在`); continue; }
        o.rows = o.rows.filter(r => r[0] !== key);
      }
    }
    if (s.out !== undefined) for (const l of [].concat(s.out)) st.out.push(String(l));
    st.hl = [].concat(s.hl || []);
  }

  const cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function states(tr) {
    if (cache && cache.has(tr)) return cache.get(tr);
    const errs = [], res = [];
    let st = { objs: {}, order: [], frames: [], out: [], hl: [] };
    if (tr.init) applyStep(st, tr.init, errs, 'init');
    (tr.steps || []).forEach((s, i) => { st = clone(st); applyStep(st, s, errs, `第 ${i + 1} 步`); res.push(st); });
    const out = { list: res, errs };
    if (cache) cache.set(tr, out);
    return out;
  }

  // ---------------- 2. 排版 ----------------
  const PY_KW = /^(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|self)$/;
  // 一行 Python 代码切成带颜色的小段：[文字, 类名]。三引号字符串跨行时只能按单行近似着色
  function spans(line) {
    const out = [];
    const re = /(#.*$)|((?:[rRfFbBuU]{1,2})?(?:"""[^]*?(?:"""|$)|'''[^]*?(?:'''|$)|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?))|(@[\w.]+)|(\b\d[\w.]*\b)|([A-Za-z_]\w*)|(\s+)|([^\w\s"'#@]+)/g;
    let m;
    while ((m = re.exec(line))) {
      if (m[1]) out.push([m[1], 'com']);
      else if (m[2]) out.push([m[2], 'str']);
      else if (m[3]) out.push([m[3], 'typ']);
      else if (m[4]) out.push([m[4], 'num']);
      else if (m[5]) out.push([m[5], PY_KW.test(m[5]) ? 'kw' : /^[A-Z][a-z]/.test(m[5]) ? 'typ' : '']);
      else out.push([m[0], '']);
    }
    // 合并同类，减少节点
    const merged = [];
    for (const p of out) { const l = merged[merged.length - 1]; if (l && l[1] === p[1]) l[0] += p[0]; else merged.push(p.slice()); }
    return merged;
  }
  const detab = l => l.replace(/\t/g, '  ');
  function clipSpans(sp, px) {
    let used = '', out = [];
    for (const [t, c] of sp) {
      if (tw(used + t) <= px) { out.push([t, c]); used += t; continue; }
      let part = '';
      for (const ch of t) { if (tw(used + part + ch + '…') > px) break; part += ch; }
      out.push([part + '…', c]);
      return { sp: out, cut: true };
    }
    return { sp: out, cut: false };
  }
  const DEF = /^\s*(async\s+def|def|class)\b/;
  const ind = l => l.length - l.replace(/^\s+/, '').length;
  const defText = l => l.trim().replace(/\s*:\s*(#.*)?$/, '');
  function funcOf(lines, ln) {
    let need = Infinity;                       // 要找缩进比这一行浅的 def / class
    for (let n = ln; n >= 1; n--) {
      const l = lines[n - 1] || '';
      if (!l.trim() || /^\s*#/.test(l)) continue;
      if (DEF.test(l) && (n === ln || ind(l) < need)) return { n, t: defText(l) };
      if (n === ln || ind(l) < need) need = Math.min(need, ind(l));
      if (n < ln && ind(l) === 0 && !/^\s*@/.test(l)) break;     // 碰到顶层的普通语句：不在函数里
    }
    return { n: 0, t: '' };
  }
  // 「别名:行号」= 正在执行的那一行；「别名:起-止」或「别名:10-12,20」= 要看的几段（翻页图解用，涂成高亮带，不画 ▶）
  function parseAt(tr, at) {
    const m = /^([^:]+):(\d+)(?:-(\d+))?((?:,\d+(?:-\d+)?)*)$/.exec(String(at || ''));
    if (!m) return null;
    const r = { alias: m[1], ln: +m[2], file: (tr.files || {})[m[1]] };
    if (m[3] || m[4]) {
      r.ranges = [[+m[2], +(m[3] || m[2])]];
      for (const part of m[4].split(',').filter(Boolean)) { const [a, b] = part.split('-').map(Number); r.ranges.push([a, b || a]); }
    }
    return r;
  }
  const srcKey = (tr, file) => file;          // 源码按 hw复原/ 下的相对路径存

  // 左边的源码栏。view：{ key（图元 id 用）, lines, file, ln（正在执行的行，可空）, prevLn, bands（[[a,b]] 要涂绿的行，写代码时用）,
  //                    hi（[[a,b]] 要看的几段，涂成高亮带，翻页图解用） }
  // 每一行的 id 带上内容摘要：同一行内容没变就原地不动，内容变了就交叉淡入淡出
  function codeView(view, P) {
    P.push({ id: 'cp:bg', t: 'rect', p: { x: CODE.x, y: CODE.y, w: CODE.w, h: CODE.h, fill: COL.codeBg, stroke: COL.panel, sw: 1, fo: 1 }, m: { rx: 12 } });
    P.push({ id: 'cp:rule', t: 'rect', p: { x: CODE.x + 1, y: CODE.top - 8, w: CODE.w - 2, h: 1, fill: COL.panel, stroke: COL.panel, sw: 0, fo: 1 }, m: {} });
    P.push({ id: 'dp:rule', t: 'rect', p: { x: DATA.x0 - 4, y: DATA.y0 + 6, w: 1, h: DATA.y1 - DATA.y0 - 12, fill: COL.panel, stroke: COL.panel, sw: 0, fo: 1 }, m: {} });
    if (!view || !view.file) return;
    const { key, lines } = view, bands = view.bands || [], hi = view.hi || [];
    const focus = view.ln || (hi[0] && hi[0][0]) || (bands[0] && bands[0][0]) || 1;
    // 要看的几段里如果有 func 那一行，就用它（段从注释、空行开始时，往上找会找到上一个函数）
    const fnLine = hi.length ? (() => { for (let n = hi[0][0]; n <= hi[0][1]; n++) if (DEF.test(lines[n - 1] || '')) return n; return 0; })() : 0;
    const fn = fnLine ? { n: fnLine, t: defText(lines[fnLine - 1]) }
      : hi.length && /^(import|from|[A-Z_][A-Z0-9_]*\s*[:=])/.test(lines[focus - 1] || '') ? { n: 0, t: '' } : funcOf(lines, focus);
    const short = view.file.split('/').slice(-2).join('/');
    P.push({ id: `cp:file:${key}`, t: 'text', p: { x: CODE.x + 12, y: CODE.y + 17 }, m: { text: short, cls: 'tr-file' } });
    const sub = view.ln || hi.length ? (fn.t || '（模块顶层代码）') : view.sub || '';
    P.push({ id: `cp:fn:${key}:${hash(sub)}`, t: 'text', p: { x: CODE.x + 12, y: CODE.y + 33 }, m: { text: fit(sub, CODE.w - 24, 10), cls: 'tr-fn' } });
    const n = lines.length, rows = CODE.rows;
    // 要看的几段：尽量整段都在可见范围里（段太长就从段首往下显示）
    const span = hi.length ? Math.max(...hi.map(r => r[1])) - focus + 1 : 0;
    const s0 = Math.max(1, Math.min(view.ln ? view.ln - 9 : span ? focus - Math.max(0, Math.min(3, rows - span)) : focus - 3, n - rows + 1));
    const yOf = ln => CODE.top + (ln - s0) * CODE.lh;
    const inView = ln => ln >= s0 && ln < s0 + rows;
    // 写代码：这一步要敲的行涂绿（每一段一块，超出可见范围的部分截掉）
    bands.forEach(([a, b], j) => {
      const lo = Math.max(a, s0), hi = Math.min(b, s0 + rows - 1);
      if (lo > hi) return;
      P.push({ id: `cp:band:${j}`, t: 'rect', p: { x: CODE.x + 4, y: yOf(lo), w: CODE.w - 8, h: (hi - lo + 1) * CODE.lh, fill: COL.add, stroke: COL.addLine, sw: 1, fo: 1 }, m: { rx: 4 } });
    });
    // 翻页图解：这一页要看的几段
    hi.forEach(([a, b], j) => {
      const lo = Math.max(a, s0), top = Math.min(b, s0 + rows - 1);
      if (lo > top) return;
      P.push({ id: `cp:hi:${j}`, t: 'rect', p: { x: CODE.x + 4, y: yOf(lo), w: CODE.w - 8, h: (top - lo + 1) * CODE.lh, fill: COL.cur, stroke: COL.hot, sw: 1, fo: 0.75 }, m: { rx: 4 } });
    });
    const inHi = ln => hi.some(([a, b]) => ln >= a && ln <= b);
    // 执行：上一步执行的那行（同一个文件时）留一道浅色，看得出「从哪来」；当前行橙色
    if (view.prevLn && view.prevLn !== view.ln && inView(view.prevLn)) {
      P.push({ id: 'cp:prev', t: 'rect', p: { x: CODE.x + 4, y: yOf(view.prevLn), w: CODE.w - 8, h: CODE.lh, fill: COL.prev, stroke: COL.prev, sw: 0, fo: 1 }, m: { rx: 4 } });
    }
    if (view.ln) {
      P.push({ id: 'cp:hl', t: 'rect', p: { x: CODE.x + 4, y: yOf(view.ln), w: CODE.w - 8, h: CODE.lh, fill: COL.cur, stroke: COL.hot, sw: 1, fo: 1 }, m: { rx: 4 } });
      P.push({ id: 'cp:arrow', t: 'text', p: { x: CODE.x + 7, y: yOf(view.ln) + 13, fill: COL.hot }, m: { text: '▶', cls: 'tr-arrow' } });
    }
    const isNew = ln => bands.some(([a, b]) => ln >= a && ln <= b);
    for (let ln = s0; ln < Math.min(n + 1, s0 + rows); ln++) {
      const y = yOf(ln) + 13, text = lines[ln - 1] || '', hot = ln === view.ln || inHi(ln), add = isNew(ln);
      P.push({ id: `cn:${key}:${ln}`, t: 'text', p: { x: CODE.x + 44, y, fill: hot ? COL.hot : add ? COL.addLine : COL.faint }, m: { text: String(ln), cls: 'tr-ln', anchor: 'end' } });
      if (add) P.push({ id: `cp:plus:${ln}`, t: 'text', p: { x: CODE.x + 9, y, fill: COL.addLine }, m: { text: '+', cls: 'tr-ln' } });
      const c = clipSpans(spans(detab(text)), CODE.w - 62);
      P.push({ id: `cl:${key}:${ln}:${hash(text)}`, t: 'text', p: { x: CODE.x + 52, y }, m: { spans: c.sp, cls: 'tr-code' + (ln === view.ln ? ' cur' : ''), title: c.cut ? text.trim() : '' } });
    }
  }
  function codePanel(tr, i, SRC, P) {
    const step = tr.steps[i], at = parseAt(tr, step.at);
    if (!at || !at.file) return codeView(null, P);
    const key = srcKey(tr, at.file);
    if (at.ranges) return codeView({ key, lines: SRC[key] || [], file: at.file, hi: at.ranges }, P);
    const pv = i > 0 ? parseAt(tr, tr.steps[i - 1].at) : null;
    codeView({ key, lines: SRC[key] || [], file: at.file, ln: at.ln, prevLn: pv && pv.file === at.file && !pv.ranges ? pv.ln : 0 }, P);
  }

  // 一个「盒子」：标题 + 若干行 键 / 值；值以 → 开头就是指针，画一个点并连一根箭头
  function boxPrims(id, x, y, w, title, rows, tone, ctx, opt) {
    const [fill, stroke] = TONE[tone] || TONE.heap;
    const h = HEAD + rows.length * ROW + 4;
    const hot = ctx.hl.has(id);
    ctx.P.push({ id: `o:${id}`, t: 'rect', p: { x, y, w, h, fill, stroke: hot ? COL.hlStroke : stroke, sw: hot ? 2.4 : 1.3, fo: 1 }, m: { rx: 7, dash: opt && opt.dash } });
    ctx.P.push({ id: `o:${id}:t:${hash(title)}`, t: 'text', p: { x: x + 8, y: y + 15, fill: stroke }, m: { text: fit(title, w - 14, 11), cls: 'tr-title' } });
    const frame = ctx.g && ctx.g.frameIds;                // 调用栈那一列宽度固定，函数名长了截断是常态，不报
    if (!frame && tw(title, 11) > w - 14) ctx.cut.push(`${id} 的标题「${title}」`);
    if (rows.length) ctx.P.push({ id: `o:${id}:sep`, t: 'rect', p: { x: x + 1, y: y + HEAD - 1, w: w - 2, h: 1, fill: stroke, stroke, sw: 0, fo: 0.25 }, m: {} });
    const kw = Math.min(w * 0.55, Math.max(30, ...rows.map(r => tw(r[0], 10.5) + 14)));
    rows.forEach(([k, v], j) => {
      const ry = y + HEAD + j * ROW, rid = `${id}.${k}`, changed = ctx.changed.has(rid) || ctx.hl.has(rid);
      ctx.P.push({ id: `o:${id}:rb:${hash(k)}`, t: 'rect', p: { x: x + 2, y: ry + 1, w: w - 4, h: ROW - 1, fill: COL.flash, stroke: COL.flash, sw: 0, fo: changed ? 1 : 0 }, m: { rx: 3 } });
      ctx.P.push({ id: `o:${id}:k:${hash(k)}`, t: 'text', p: { x: x + 8, y: ry + 13, fill: COL.muted }, m: { text: fit(k, kw - 10, 10.5), cls: 'tr-key' } });
      if (!frame && tw(k, 10.5) > kw - 10) ctx.cut.push(`${id} 的键「${k}」`);
      if (isPtr(v) && !isNil(ptrId(v))) {
        ctx.P.push({ id: `o:${id}:d:${hash(k)}`, t: 'dot', p: { x: x + w - 11, y: ry + 9, r: 3.2, fill: changed ? COL.hot : COL.link } });
        ctx.ptrs.push({ id: `o:${id}:l:${hash(k)}`, x: x + w - 11, y: ry + 9, box: [x, y, w, h], to: ptrId(v), hot: changed, from: rid });
      } else {
        const sv = isPtr(v) ? 'None' : v;
        ctx.P.push({ id: `o:${id}:v:${hash(k)}:${hash(sv)}`, t: 'text', p: { x: x + w - 8, y: ry + 13, fill: changed ? COL.ink : '#374151' }, m: { text: fit(sv, w - kw - 12, 10.5), cls: 'tr-val' + (changed ? ' hot' : ''), anchor: 'end' } });
        if (tw(sv, 10.5) > w - kw - 12) ctx.cut.push(`${id}.${k}`);
      }
      ctx.reg(rid, [x, ry, w, ROW]);          // 一行也能当箭头 / 标签的目标（id.键）
    });
    ctx.reg(id, [x, y, w, h]);
    return h;
  }

  function nodePrims(o, x, y, ctx) {
    const w = o.w || NODE.w, h = NODE.h, [fill, stroke] = TONE[o.tone] || TONE.heap;
    const changed = ctx.changed.has(o.id), hot = ctx.hl.has(o.id);
    ctx.P.push({ id: `o:${o.id}`, t: 'rect', p: { x, y, w, h, fill: flash(ctx, changed, o.tone, fill), stroke: hot || changed ? COL.hlStroke : stroke, sw: hot ? 2.4 : 1.3, fo: 1 }, m: { rx: 7 } });
    ctx.P.push({ id: `o:${o.id}:t:${hash(o.label || '')}`, t: 'text', p: { x: x + w / 2, y: y + (o.sub ? 16 : 24), fill: COL.ink }, m: { text: fit(o.label || '', w - 8, 11), cls: 'tr-node', anchor: 'middle' } });
    if (o.sub) ctx.P.push({ id: `o:${o.id}:s:${hash(o.sub)}`, t: 'text', p: { x: x + w / 2, y: y + 31, fill: COL.muted }, m: { text: fit(o.sub, w - 8, 10), cls: 'tr-sub', anchor: 'middle' } });
    if (o.ptr && isPtr(o.ptr) && !isNil(ptrId(o.ptr))) ctx.ptrs.push({ id: `o:${o.id}:l`, x: x + w / 2, y: y + h, box: [x, y, w, h], to: ptrId(o.ptr), hot: changed, from: o.id, down: true });
    ctx.reg(o.id, [x, y, w, h]);
  }

  function listPrims(o, st, ctx) {
    const [x, y] = o.at, items = (o.items || []).filter(id => st.objs[id]);
    const v = o.dir === 'v', nw = o.nw || NODE.w, gap = o.gap || NODE.gap;
    const hot = ctx.hl.has(o.id);
    ctx.P.push({ id: `o:${o.id}:t:${hash(o.title || '')}`, t: 'text', p: { x, y: y + 12, fill: hot ? COL.hot : TONE.heap[1] }, m: { text: o.title || '', cls: 'tr-title' } });
    const x0 = x, y0 = y + 22;
    const pos = items.map((id, j) => v ? [x0, y0 + j * (NODE.h + gap)] : [x0 + j * (nw + gap), y0 + (o.ends === false ? 0 : 12)]);
    items.forEach((id, j) => nodePrims(Object.assign({ w: nw }, st.objs[id]), pos[j][0], pos[j][1], ctx));
    for (let j = 0; j + 1 < items.length; j++) {
      const [ax, ay] = pos[j], [bx, by] = pos[j + 1];
      if (v) {
        ctx.P.push(link(`o:${o.id}:nx:${items[j]}`, ax + nw / 2 - (o.dbl ? 10 : 0), ay + NODE.h, ax + nw / 2 - (o.dbl ? 10 : 0), by, false, 'v'));
        if (o.dbl) ctx.P.push(link(`o:${o.id}:pv:${items[j + 1]}`, bx + nw / 2 + 10, by, bx + nw / 2 + 10, ay + NODE.h, false, 'v'));
      } else {
        ctx.P.push(link(`o:${o.id}:nx:${items[j]}`, ax + nw, ay + (o.dbl ? 13 : 20), bx, by + (o.dbl ? 13 : 20), false, 'h'));
        if (o.dbl) ctx.P.push(link(`o:${o.id}:pv:${items[j + 1]}`, bx, by + 28, ax + nw, ay + 28, false, 'h'));
      }
    }
    const ends = o.ends === false ? null : o.ends || ['Front', 'Back'];
    if (ends && items.length && !v) {
      ctx.P.push({ id: `o:${o.id}:front`, t: 'text', p: { x: pos[0][0] + nw / 2, y: pos[0][1] - 3, fill: COL.muted }, m: { text: ends[0], cls: 'tr-sub', anchor: 'middle' } });
      if (items.length > 1) ctx.P.push({ id: `o:${o.id}:back`, t: 'text', p: { x: pos[items.length - 1][0] + nw / 2, y: pos[items.length - 1][1] - 3, fill: COL.muted }, m: { text: ends[1], cls: 'tr-sub', anchor: 'middle' } });
    }
    if (!items.length) ctx.P.push({ id: `o:${o.id}:empty`, t: 'text', p: { x: x0 + 4, y: y0 + 24, fill: COL.faint }, m: { text: o.empty || '（空）', cls: 'tr-sub' } });
    const w = Math.max(tw(o.title || '', 11) + 4, items.length ? (v ? nw : items.length * nw + (items.length - 1) * gap) : 60, o.minw || 0);
    const h = 22 + (o.ends === false || v ? 0 : 12) + (items.length ? (v ? items.length * NODE.h + (items.length - 1) * gap : NODE.h) : 30);
    ctx.reg(o.id, [x, y, w, h]);
  }

  // 切片 / 一排格子。格子可以各自定宽（w）、上色（tone）、在下面写小字（sub，代替下标）——字节布局、报文分段也用它画
  function slicePrims(o, ctx) {
    const [x, y] = o.at, cw0 = o.cw || CELL.w, items = (o.items || []).map((it, j) => typeof it === 'object' ? it : { id: `${o.id}#${j}`, v: it });
    const [fill0, stroke0] = TONE[o.tone] || TONE.heap, hot = ctx.hl.has(o.id);
    ctx.P.push({ id: `o:${o.id}:t:${hash(o.title || '')}`, t: 'text', p: { x, y: y + 12, fill: hot ? COL.hot : stroke0 }, m: { text: o.title || '', cls: 'tr-title' } });
    const cy = y + 20;
    let cx = x;
    const under = o.idx !== false || items.some(it => it.sub);
    items.forEach((it, j) => {
      const cw = +it.w || cw0, changed = ctx.changed.has(it.id) || ctx.hl.has(it.id);
      const [fill, stroke] = it.tone ? TONE[it.tone] || TONE.heap : [fill0, stroke0];
      ctx.P.push({ id: `o:${o.id}:c:${it.id}`, t: 'rect', p: { x: cx, y: cy, w: cw, h: CELL.h, fill: flash(ctx, changed, it.tone || o.tone, fill), stroke: changed ? COL.hlStroke : stroke, sw: changed ? 2 : 1.2, fo: 1 }, m: { rx: 3 } });
      if (isPtr(it.v) && !isNil(ptrId(it.v))) {
        ctx.P.push({ id: `o:${o.id}:cd:${it.id}`, t: 'dot', p: { x: cx + cw / 2, y: cy + CELL.h / 2, r: 3.2, fill: changed ? COL.hot : COL.link } });
        ctx.ptrs.push({ id: `o:${o.id}:cl:${it.id}`, x: cx + cw / 2, y: cy + CELL.h / 2, box: [cx, cy, cw, CELL.h], to: ptrId(it.v), hot: changed, from: it.id, down: true });
      } else {
        const sv = isPtr(it.v) ? 'None' : it.v;
        ctx.P.push({ id: `o:${o.id}:cv:${it.id}:${hash(sv)}`, t: 'text', p: { x: cx + cw / 2, y: cy + 17, fill: COL.ink }, m: { text: fit(sv, cw - 6, 10.5), cls: 'tr-val', anchor: 'middle' } });
        if (tw(sv, 10.5) > cw - 6) ctx.cut.push(`${o.id} 的格子 ${it.id}`);
      }
      if (it.sub) ctx.P.push({ id: `o:${o.id}:s:${it.id}:${hash(it.sub)}`, t: 'text', p: { x: cx + cw / 2, y: cy + CELL.h + 11, fill: COL.muted }, m: { text: fit(it.sub, cw + 4, 9.5), cls: 'tr-csub', anchor: 'middle' } });
      else if (o.idx !== false) ctx.P.push({ id: `o:${o.id}:i:${j}`, t: 'text', p: { x: cx + cw / 2, y: cy + CELL.h + 11, fill: COL.faint }, m: { text: String(j), cls: 'tr-idx', anchor: 'middle' } });
      if (under) ctx.idxCells.add(it.id);
      ctx.reg(it.id, [cx, cy, cw, CELL.h]);
      cx += cw;
    });
    if (!items.length) ctx.P.push({ id: `o:${o.id}:empty`, t: 'rect', p: { x, y: cy, w: cw0, h: CELL.h, fill: '#ffffff', stroke: COL.faint, sw: 1, fo: 1 }, m: { rx: 3, dash: '3 3' } });
    const w = Math.max(tw(o.title || '', 11) + 4, items.length ? cx - x : cw0);
    ctx.reg(o.id, [x, y, w, 20 + CELL.h + (under ? 13 : 2)]);
  }

  function ringPrims(o, ctx) {
    const [cx, cy] = o.at, r = o.r || 90, hot = ctx.hl.has(o.id);
    ctx.P.push({ id: `o:${o.id}:ring`, t: 'circle', p: { x: cx, y: cy, r, fill: '#ffffff', stroke: hot ? COL.hlStroke : '#9db3d9', sw: hot ? 2.2 : 1.4, fo: 0 } });
    if (o.title) ctx.P.push({ id: `o:${o.id}:t:${hash(o.title)}`, t: 'text', p: { x: cx, y: cy - r - 24, fill: TONE.heap[1] }, m: { text: o.title, cls: 'tr-title', anchor: 'middle' } });
    for (const it of o.items || []) {
      const a = -Math.PI / 2 + 2 * Math.PI * (+it.pos || 0), px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      const [fill, stroke] = TONE[it.tone] || TONE.heap, changed = ctx.changed.has(it.id) || ctx.hl.has(it.id);
      const rad = it.tone === 'virt' ? 4.5 : 6;
      ctx.P.push({ id: `o:${o.id}:p:${it.id}`, t: 'circle', p: { x: px, y: py, r: changed ? rad + 2 : rad, fill: flash(ctx, changed, it.tone, fill), stroke: changed ? COL.hlStroke : stroke, sw: 1.8, fo: 1 } });
      if (it.label) {
        const lx = cx + Math.cos(a) * (r + 15), ly = cy + Math.sin(a) * (r + 15) + 4;
        ctx.P.push({ id: `o:${o.id}:pl:${it.id}:${hash(it.label)}`, t: 'text', p: { x: lx, y: ly, fill: changed ? COL.ink : stroke }, m: { text: it.label, cls: 'tr-sub', anchor: Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end' } });
      }
      ctx.reg(it.id, [px - rad, py - rad, rad * 2, rad * 2]);
      if (it.to) ctx.ptrs.push({ id: `o:${o.id}:pt:${it.id}`, x: px, y: py, box: [px - rad, py - rad, rad * 2, rad * 2], to: it.to, hot: true, from: it.id, arc: [cx, cy, r, a] });
    }
    ctx.reg(o.id, [cx - r - 40, cy - r - (o.title ? 38 : 20), 2 * r + 80, 2 * r + (o.title ? 58 : 40)]);
  }

  function treePrims(o, ctx) {
    const [x, y] = o.at, nodes = o.nodes || [], nw = o.nw || 78, nh = 34, gx = o.gx || 10, gy = o.gy || 26;
    const kids = {}, roots = [], ids = new Set(nodes.map(n => n.id));
    for (const n of nodes) {
      if (n.parent && !ids.has(n.parent)) ctx.bad.push(`树 ${o.id} 的节点 ${n.id} 的 parent「${n.parent}」不存在`);
      (n.parent && ids.has(n.parent) ? (kids[n.parent] = kids[n.parent] || []) : roots).push(n);
    }
    const pos = {}, depthMax = { v: 0 };
    let leaf = 0;
    function place(n, d) {
      depthMax.v = Math.max(depthMax.v, d);
      const ch = kids[n.id] || [];
      if (!ch.length) { pos[n.id] = [x + leaf * (nw + gx), y + 22 + d * (nh + gy)]; leaf++; return; }
      ch.forEach(c => place(c, d + 1));
      const xs = ch.map(c => pos[c.id][0]);
      pos[n.id] = [(Math.min(...xs) + Math.max(...xs)) / 2, y + 22 + d * (nh + gy)];
    }
    roots.forEach(r => place(r, 0));
    if (o.title) ctx.P.push({ id: `o:${o.id}:t:${hash(o.title)}`, t: 'text', p: { x, y: y + 12, fill: TONE.heap[1] }, m: { text: o.title, cls: 'tr-title' } });
    for (const n of nodes) {
      const [nx, ny] = pos[n.id], changed = ctx.changed.has(n.id) || ctx.hl.has(n.id), [fill, stroke] = TONE[n.tone] || TONE.heap;
      ctx.P.push({ id: `o:${n.id}`, t: 'rect', p: { x: nx, y: ny, w: nw, h: nh, fill: flash(ctx, changed, n.tone, fill), stroke: changed ? COL.hlStroke : stroke, sw: changed ? 2.2 : 1.2, fo: 1 }, m: { rx: 6 } });
      ctx.P.push({ id: `o:${n.id}:t:${hash(n.label || '')}`, t: 'text', p: { x: nx + nw / 2, y: ny + (n.sub ? 14 : 21), fill: COL.ink }, m: { text: fit(n.label || '', nw - 6, 11), cls: 'tr-node', anchor: 'middle' } });
      if (n.sub) ctx.P.push({ id: `o:${n.id}:s:${hash(n.sub)}`, t: 'text', p: { x: nx + nw / 2, y: ny + 28, fill: COL.muted }, m: { text: fit(n.sub, nw - 6, 9.5), cls: 'tr-sub', anchor: 'middle' } });
      if (n.parent && pos[n.parent]) {
        const [px, py] = pos[n.parent];
        ctx.P.push(link(`o:${o.id}:e:${n.id}`, px + nw / 2, py + nh, nx + nw / 2, ny, changed, 'v'));
      }
      ctx.reg(n.id, [nx, ny, nw, nh]);
    }
    const W = Math.max(tw(o.title || '', 11), leaf * (nw + gx) - gx), H = 22 + (depthMax.v + 1) * (nh + gy) - gy;
    ctx.reg(o.id, [x, y, W, H]);
  }

  function textPrims(o, ctx) {
    const [x, y] = o.at, lines = String(o.text || '').split('\n'), [fill, stroke] = TONE[o.tone || 'note'] || TONE.note;
    const w = o.w || Math.max(...lines.map(l => tw(l, 10.5))) + 16, h = lines.length * 15 + 10, hot = ctx.hl.has(o.id) || ctx.changed.has(o.id);
    ctx.P.push({ id: `o:${o.id}`, t: 'rect', p: { x, y, w, h, fill: hot ? COL.flash : fill, stroke: hot ? COL.hlStroke : stroke, sw: 1, fo: 1 }, m: { rx: 6, dash: o.tone ? '' : '4 3' } });
    lines.forEach((l, j) => ctx.P.push({ id: `o:${o.id}:x${j}:${hash(l)}`, t: 'text', p: { x: x + 8, y: y + 17 + j * 15, fill: COL.ink }, m: { text: fit(l, w - 12, 10.5), cls: o.mono ? 'tr-mono' : 'tr-note' } }));
    for (const l of lines) if (tw(l, 10.5) > w - 12) ctx.cut.push(`便签 ${o.id} 的「${l.slice(0, 16)}…」`);
    ctx.reg(o.id, [x, y, w, h]);
  }

  // 时序图：顶上一排泳道（谁：客户端、服务端、某个 goroutine…），往下每一行一条消息。
  // lines 是预留的行数（整张图的高度从头到尾不变，翻页时只是一条条消息淡入）；消息默认一条占一行，row 可以指定（同一行 = 同时发生），
  // from === to 是泳道上的一段活动（span 占几行），sep 是横贯的分隔线（「—— 2 秒后 ——」）。
  const SEQ = { head: 34, rh: 26 };
  function seqPrims(o, ctx) {
    const [x, y] = o.at, w = o.w || 520, lanes = o.lanes || [], n = Math.max(1, lanes.length), rh = o.rh || SEQ.rh, rows = o.lines || 6;
    const lw = w / n, bw = Math.min(lw - 12, 150), top = y + (o.title ? 18 : 0);
    const bodyTop = top + SEQ.head + 6, H = bodyTop - y + rows * rh + 6;
    if (o.title) ctx.P.push({ id: `o:${o.id}:t:${hash(o.title)}`, t: 'text', p: { x, y: y + 12, fill: ctx.hl.has(o.id) ? COL.hot : TONE.heap[1] }, m: { text: o.title, cls: 'tr-title' } });
    const lx = {};
    lanes.forEach((L, i) => {
      const cx = x + lw * (i + 0.5), [fill, stroke] = TONE[L.tone] || TONE.heap, hot = ctx.hl.has(L.id) || ctx.changed.has(L.id);
      lx[L.id] = cx;
      ctx.P.push({ id: `o:${o.id}:ll:${L.id}`, t: 'rect', p: { x: cx - 0.7, y: top + SEQ.head, w: 1.4, h: y + H - top - SEQ.head, fill: '#c9ced6', stroke: '#c9ced6', sw: 0, fo: 1 }, m: {} });
      ctx.P.push({ id: `o:${o.id}:L:${L.id}`, t: 'rect', p: { x: cx - bw / 2, y: top, w: bw, h: SEQ.head, fill: hot ? COL.flash : fill, stroke: hot ? COL.hlStroke : stroke, sw: hot ? 2.2 : 1.3, fo: 1 }, m: { rx: 7 } });
      ctx.P.push({ id: `o:${o.id}:Lt:${L.id}:${hash(L.label || '')}`, t: 'text', p: { x: cx, y: top + (L.sub ? 15 : 21), fill: COL.ink }, m: { text: fit(L.label || L.id, bw - 8, 11), cls: 'tr-node', anchor: 'middle' } });
      if (L.sub) ctx.P.push({ id: `o:${o.id}:Ls:${L.id}:${hash(L.sub)}`, t: 'text', p: { x: cx, y: top + 28, fill: COL.muted }, m: { text: fit(L.sub, bw - 8, 9.5), cls: 'tr-sub', anchor: 'middle' } });
      ctx.reg(L.id, [cx - bw / 2, top, bw, SEQ.head]);
    });
    let row = 0;
    const acts = [], words = [], arrows = [];
    (o.msgs || []).forEach((m, j) => {
      const mid = m.id || `${o.id}_${j}`, r = m.row !== undefined ? +m.row : row, span = Math.max(1, +m.span || 1);
      row = r + span;
      if (r + span > rows) ctx.bad.push(`时序图 ${o.id} 的第 ${j + 1} 条消息排到第 ${r + span} 行，超出预留的 lines=${rows}`);
      const yy = bodyTop + r * rh, hot = ctx.changed.has(mid) || ctx.hl.has(mid);
      const col = hot ? COL.hot : m.tone ? (TONE[m.tone] || TONE.heap)[1] : '#4b5563';
      if (m.sep !== undefined) {
        const t = String(m.sep), tl = tw(t, 10) + 14;
        ctx.P.push({ id: `o:${o.id}:m:${mid}`, t: 'rect', p: { x, y: yy + rh / 2, w, h: 1, fill: '#d6d0c2', stroke: '#d6d0c2', sw: 0, fo: 1 }, m: {} });
        ctx.P.push({ id: `o:${o.id}:mb:${mid}`, t: 'rect', p: { x: x + w / 2 - tl / 2, y: yy + rh / 2 - 8, w: tl, h: 16, fill: '#fffdf8', stroke: '#fffdf8', sw: 0, fo: 1 }, m: { rx: 4 } });
        ctx.P.push({ id: `o:${o.id}:mt:${mid}:${hash(t)}`, t: 'text', p: { x: x + w / 2, y: yy + rh / 2 + 4, fill: hot ? COL.hot : COL.muted }, m: { text: t, cls: 'tr-sub', anchor: 'middle' } });
        ctx.reg(mid, [x, yy, w, rh]);
        return;
      }
      const xa = lx[m.from], xb = lx[m.to];
      if (xa === undefined || xb === undefined) { ctx.bad.push(`时序图 ${o.id} 的消息「${m.label || mid}」：泳道 ${xa === undefined ? m.from : m.to} 不存在`); return; }
      const label = String(m.label || '');
      if (m.from === m.to) {
        const bw2 = Math.min(Math.max(tw(label, 10.5) + 16, 36), lw - 8), bh = span * rh - 6, [fill] = TONE[m.tone || 'note'] || TONE.note;
        ctx.P.push({ id: `o:${o.id}:m:${mid}`, t: 'rect', p: { x: xa - bw2 / 2, y: yy + 3, w: bw2, h: bh, fill: hot ? COL.flash : fill, stroke: col, sw: hot ? 2 : 1.2, fo: 1 }, m: { rx: 5, dash: m.dash ? '4 3' : '' } });
        ctx.P.push({ id: `o:${o.id}:mt:${mid}:${hash(label)}`, t: 'text', p: { x: xa, y: yy + 3 + bh / 2 + 4, fill: COL.ink }, m: { text: fit(label, bw2 - 8, 10.5), cls: 'tr-msg', anchor: 'middle' } });
        if (tw(label, 10.5) > bw2 - 8) ctx.cut.push(`时序图 ${o.id} 的「${label}」`);
        ctx.reg(mid, [xa - bw2 / 2, yy + 3, bw2, bh]);
        acts.push([label, [xa - bw2 / 2, yy + 3, bw2, bh], m.from]);
        return;
      }
      const dirR = xb > xa, ay = yy + rh - 7, room = Math.abs(xb - xa) - 12;
      ctx.P.push(link(`o:${o.id}:m:${mid}`, xa + (dirR ? 2 : -2), ay, xb + (dirR ? -3 : 3), ay, false, 'h', m.dash ? '5 4' : '', col));
      ctx.P.push({ id: `o:${o.id}:mt:${mid}:${hash(label)}`, t: 'text', p: { x: (xa + xb) / 2, y: ay - 5, fill: hot ? COL.hot : '#374151' }, m: { text: fit(label, room, 10.5), cls: 'tr-msg', anchor: 'middle' } });
      if (tw(label, 10.5) > room) ctx.cut.push(`时序图 ${o.id} 的「${label}」`);
      ctx.reg(mid, [Math.min(xa, xb), yy, Math.abs(xb - xa), rh]);
      const lw2 = Math.min(tw(label, 10.5), room);
      words.push([label, [(xa + xb) / 2 - lw2 / 2, ay - 15, lw2, 12]]);
      arrows.push([label, Math.min(xa, xb), Math.max(xa, xb), ay, m.from, m.to]);
    });
    // 活动框会盖住压在它上面的消息文字和从它身上横穿过去的箭头（线在框下面）
    const hit = (A, B) => A[0] < B[0] + B[2] && B[0] < A[0] + A[2] && A[1] < B[1] + B[3] && B[1] < A[1] + A[3];
    for (const [t, A, lane] of acts) {
      for (const [w, B] of words) if (hit(A, B)) ctx.bad.push(`时序图 ${o.id}：消息「${w}」的字压到了活动框「${t}」上（把字改短，或者挪开一行）`);
      for (const [w, x1, x2, ay, f, to] of arrows)
        if (lane !== f && lane !== to && ay > A[1] && ay < A[1] + A[3] && A[0] + A[2] / 2 > x1 && A[0] + A[2] / 2 < x2)
          ctx.bad.push(`时序图 ${o.id}：消息「${w}」的箭头从活动框「${t}」底下横穿过去（被挡住了，换一行）`);
    }
    ctx.reg(o.id, [x, y, w, H]);
  }

  // 表格：cols 表头，rows 每行一个数组；cw 各列宽（不写按内容算）。行可以高亮（hl「表id.行号」，从 0 数）
  function tablePrims(o, ctx) {
    const [x, y] = o.at, cols = o.cols || [], rows = o.rows || [], nc = Math.max(cols.length, ...rows.map(r => r.length), 1);
    const cw = Array.from({ length: nc }, (_, j) => +(o.cw || [])[j] || Math.min(300, Math.max(tw(cols[j] || '', 10.5), ...rows.map(r => tw(r[j] || '', 10.5))) + 16));
    const W = cw.reduce((a, b) => a + b, 0), th = 22, rh = o.rh || 20, [, stroke] = TONE[o.tone] || TONE.heap;
    const t0 = y + (o.title ? 18 : 0), H = th + rows.length * rh;
    if (o.title) ctx.P.push({ id: `o:${o.id}:t:${hash(o.title)}`, t: 'text', p: { x, y: y + 12, fill: ctx.hl.has(o.id) ? COL.hot : stroke }, m: { text: o.title, cls: 'tr-title' } });
    ctx.P.push({ id: `o:${o.id}`, t: 'rect', p: { x, y: t0, w: W, h: H, fill: '#ffffff', stroke, sw: 1.2, fo: 1 }, m: { rx: 6 } });
    ctx.P.push({ id: `o:${o.id}:hd`, t: 'rect', p: { x: x + 1, y: t0 + 1, w: W - 2, h: th - 1, fill: stroke, stroke, sw: 0, fo: 0.1 }, m: { rx: 5 } });
    const xs = [];
    cw.reduce((acc, c) => { xs.push(acc); return acc + c; }, x);
    xs.slice(1).forEach((cx, j) => ctx.P.push({ id: `o:${o.id}:vs:${j}`, t: 'rect', p: { x: cx, y: t0, w: 1, h: H, fill: stroke, stroke, sw: 0, fo: 0.18 }, m: {} }));
    cols.forEach((c, j) => ctx.P.push({ id: `o:${o.id}:h:${j}:${hash(c)}`, t: 'text', p: { x: xs[j] + 8, y: t0 + 15, fill: stroke }, m: { text: fit(c, cw[j] - 12, 10.5), cls: 'tr-th' } }));
    rows.forEach((r, i) => {
      const ry = t0 + th + i * rh, rid = `${o.id}.${i}`, hot = ctx.changed.has(rid) || ctx.hl.has(rid);
      ctx.P.push({ id: `o:${o.id}:rs:${i}`, t: 'rect', p: { x: x + 1, y: ry, w: W - 2, h: 1, fill: stroke, stroke, sw: 0, fo: i ? 0.14 : 0.35 }, m: {} });
      ctx.P.push({ id: `o:${o.id}:rb:${i}`, t: 'rect', p: { x: x + 2, y: ry + 1, w: W - 4, h: rh - 2, fill: COL.flash, stroke: COL.flash, sw: 0, fo: hot ? 1 : 0 }, m: { rx: 3 } });
      for (let j = 0; j < nc; j++) {
        const v = String(r[j] == null ? '' : r[j]);
        ctx.P.push({ id: `o:${o.id}:c:${i}:${j}:${hash(v)}`, t: 'text', p: { x: xs[j] + 8, y: ry + 14, fill: COL.ink }, m: { text: fit(v, cw[j] - 12, 10.5), cls: 'tr-td' + (j ? '' : ' k') } });
        if (tw(v, 10.5) > cw[j] - 12) ctx.cut.push(`表格 ${o.id} 第 ${i} 行「${v}」`);
      }
      ctx.reg(rid, [x, ry, W, rh]);
    });
    ctx.reg(o.id, [x, y, W, t0 - y + H]);
  }

  // 两个东西之间的一根箭头（任何画出来的东西都能连：对象、盒子的一行「id.键」、链表节点、格子、泳道、消息、表格的一行），可带一段字。
  // 两端隔得横向更远就从左右边出，竖向更远就从上下边出；side: "h" / "v" 可以强制
  function arrowPrims(o, regs, ctx) {
    const A = regs[o.from], B = regs[o.to];
    if (!A || !B) { ctx.bad.push(`箭头 ${o.id}：${!A ? 'from' : 'to'} 的「${!A ? o.from : o.to}」不存在`); return; }
    const [ax, ay, aw, ah] = A, [bx, by, bw, bh] = B;
    const gx = Math.max(bx - ax - aw, ax - bx - bw), gy = Math.max(by - ay - ah, ay - by - bh);
    const dir = o.side || (gx >= gy ? 'h' : 'v');
    let x1, y1, x2, y2;
    if (dir === 'h') {
      const r = bx + bw / 2 >= ax + aw / 2;
      x1 = r ? ax + aw : ax; x2 = r ? bx : bx + bw;
      const lo = Math.max(ay, by), up = Math.min(ay + ah, by + bh);
      y1 = up - lo > 10 ? (lo + up) / 2 : ay + ah / 2; y2 = up - lo > 10 ? y1 : by + bh / 2;
    } else {
      const d = by + bh / 2 >= ay + ah / 2;
      y1 = d ? ay + ah : ay; y2 = d ? by : by + bh;
      const lo = Math.max(ax, bx), up = Math.min(ax + aw, bx + bw);
      x1 = up - lo > 10 ? (lo + up) / 2 : ax + aw / 2; x2 = up - lo > 10 ? x1 : bx + bw / 2;
    }
    const hot = ctx.changed.has(o.id) || ctx.hl.has(o.id);
    const L = link(`o:${o.id}`, x1, y1, x2, y2, hot, dir, o.dash ? '5 4' : '', o.tone ? (TONE[o.tone] || TONE.heap)[1] : '#4b5563');
    ctx.P.push(L);
    ctx.lines.push([`箭头 ${o.id}`, L.p, [o.from, o.to]]);
    if (!o.label) return;
    const p = L.p, mx = (p.x1 + 3 * p.c1x + 3 * p.c2x + p.x2) / 8, my = (p.y1 + 3 * p.c1y + 3 * p.c2y + p.y2) / 8;
    const text = String(o.label), lw = Math.min(tw(text, 10) + 12, o.lw || 220), box = [mx - lw / 2, my - 8, lw, 16];
    ctx.P.push({ id: `o:${o.id}:lb`, t: 'rect', p: { x: box[0], y: box[1], w: lw, h: 16, fill: '#fffdf8', stroke: hot ? COL.hot : '#e3ded2', sw: 0.8, fo: 0.95 }, m: { rx: 4 } });
    ctx.P.push({ id: `o:${o.id}:lt:${hash(text)}`, t: 'text', p: { x: mx, y: my + 4, fill: hot ? COL.hot : '#374151' }, m: { text: fit(text, lw - 8, 10), cls: 'tr-albl', anchor: 'middle' } });
    if (tw(text, 10) > lw - 8) ctx.cut.push(`箭头 ${o.id} 的「${text}」`);
    ctx.marks.push([`箭头 ${o.id} 的文字`, box, [o.from, o.to], null]);
  }

  // 贴在某个东西旁边的小标签（指针名、下标、「删它」「← 这里阻塞」……）：on 指向谁，side 放哪边（top / bottom / left / right，默认 top）。
  // 换一页改 on，标签就滑到新的位置——二分查找的 lo / hi、中间件的 index、哈希环上「顺时针找」都用它。
  // 同一个目标同一边有几个标签：上下两边的并排摆、左右两边的竖着叠，各自一根短箭头指过去，互不穿过
  function tagGroup(list, regs, ctx) {
    const o0 = list[0], T = regs[o0.on];
    if (!T) { list.forEach(o => ctx.bad.push(`标签 ${o.id}：on 的「${o.on}」不存在`)); return; }
    const side = o0.side || 'top', h = 18, gap = 12, [tx, ty, tw0, th] = T, n = list.length;
    const ws = list.map(o => tw(String(o.text || o.id), 10) + 14);
    const below = side === 'bottom' && ctx.idxCells.has(o0.on) ? 12 : 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    if (side === 'top' || side === 'bottom') {
      let x = tx + tw0 / 2 - (ws.reduce((a, b) => a + b, 0) + 4 * (n - 1)) / 2;
      list.forEach((o, j) => {
        const w = ws[j], cx = x + w / 2, ex = clamp(cx, tx + 3, tx + tw0 - 3);
        const y = side === 'top' ? ty - gap - h : ty + th + below + gap;
        tagPrims(o, x, y, w, side === 'top' ? [cx, y + h, ex, ty - 1, 'v'] : [cx, y, ex, ty + th + (below ? below + 2 : 1), 'v'], ctx);
        x += w + 4;
      });
    } else {
      let y = ty + th / 2 - (n * h + 4 * (n - 1)) / 2;
      list.forEach((o, j) => {
        const w = ws[j], cy = y + h / 2, ey = clamp(cy, ty + 3, ty + th - 3), x = side === 'left' ? tx - gap - w : tx + tw0 + gap;
        tagPrims(o, x, y, w, side === 'left' ? [x + w, cy, tx - 1, ey, 'h'] : [x, cy, tx + tw0 + 1, ey, 'h'], ctx);
        y += h + 4;
      });
    }
  }
  function tagPrims(o, x, y, w, s, ctx) {
    const h = 18, text = String(o.text || o.id);
    const [fill, stroke] = TONE[o.tone || 'key'] || TONE.key, hot = ctx.changed.has(o.id) || ctx.hl.has(o.id);
    ctx.P.push(link(`o:${o.id}:s`, s[0], s[1], s[2], s[3], false, s[4], '', stroke));
    ctx.P.push({ id: `o:${o.id}`, t: 'rect', p: { x, y, w, h, fill: hot ? COL.flash : fill, stroke: hot ? COL.hlStroke : stroke, sw: hot ? 2 : 1.3, fo: 1 }, m: { rx: 9 } });
    ctx.P.push({ id: `o:${o.id}:t:${hash(text)}`, t: 'text', p: { x: x + w / 2, y: y + 13, fill: stroke }, m: { text, cls: 'tr-tag', anchor: 'middle' } });
    ctx.reg(o.id, [x, y, w, h]);
    ctx.marks.push([`标签 ${o.id}`, [x, y, w, h], [o.on], o.id]);
  }

  // 一根箭头：起点、终点，外加两个控制点（三次贝塞尔）；dir = h 横着出、v 竖着出；color 不写就是灰色
  function link(id, x1, y1, x2, y2, hot, dir, dash, color) {
    let c1x, c1y, c2x, c2y;
    if (dir === 'v') { const d = Math.max(12, Math.abs(y2 - y1) / 2.2) * (y2 >= y1 ? 1 : -1); c1x = x1; c1y = y1 + d; c2x = x2; c2y = y2 - d; }
    else { const d = Math.max(14, Math.abs(x2 - x1) / 2.2) * (x2 >= x1 ? 1 : -1); c1x = x1 + d; c1y = y1; c2x = x2 - d; c2y = y2; }
    return { id, t: 'link', p: { x1, y1, c1x, c1y, c2x, c2y, x2, y2, color: hot ? COL.hot : color || COL.link, width: hot ? 2 : 1.3, opacity: 1 }, m: { dash: dash || '' } };
  }
  // 环上的顺时针弧：半径 r + 9（贴着环外侧），三次贝塞尔分段近似（每段 ≤ 90°），这里只取一段整体近似：
  // 控制点沿切线方向伸出 k = R·4/3·tan(θ/4)，θ ≤ 180° 时足够像圆弧；更大的角度拆成「先到对面」不值当，限制在 359°
  function arcLink(pr, ring) {
    const [cx, cy, r, a1] = pr.arc, it = ring.items.find(x => x.id === pr.to);
    const a2raw = -Math.PI / 2 + 2 * Math.PI * (+it.pos || 0);
    let th = a2raw - a1; while (th <= 0) th += 2 * Math.PI;
    th = Math.min(th, 2 * Math.PI * 0.997);
    const R = r + 9, k = R * 4 / 3 * Math.tan(th / 4), b = a1 + th;
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R, x2 = cx + Math.cos(b) * R, y2 = cy + Math.sin(b) * R;
    const p = { x1, y1, c1x: x1 - Math.sin(a1) * k, c1y: y1 + Math.cos(a1) * k, c2x: x2 + Math.sin(b) * k, c2y: y2 - Math.cos(b) * k, x2, y2, color: COL.hot, width: 2, opacity: 1 };
    return { id: pr.id, t: 'link', p, m: { dash: '' } };
  }
  // 指针：从「点」出发，连到目标框边上离得最近的那一侧
  function ptrLink(pr, box, hot, container) {
    const [bx, by, bw, bh] = box, [sx, sy, sw, sh] = pr.box;
    const tcx = bx + bw / 2, tcy = by + bh / 2;
    let x2, y2, dir;
    // 指向容器（链表 / 切片 / 树）：落在标题左边，不压字
    if (container) {
      if (pr.x < bx - 6 && !pr.down) return link(pr.id, pr.x, pr.y, bx - 3, by + 8, hot, 'h');
      return link(pr.id, pr.x, pr.y, bx + 10, pr.y <= by ? by - 2 : by + bh + 2, hot, 'v');
    }
    const below = by >= sy + sh - 2, above = by + bh <= sy + 2;
    if (pr.down || ((below || above) && Math.abs(tcx - pr.x) < Math.abs(tcy - pr.y) * 1.6)) {
      dir = 'v';
      x2 = Math.max(bx + 8, Math.min(bx + bw - 8, pr.x + (tcx - pr.x) * 0.35));
      y2 = tcy >= pr.y ? by : by + bh;
    } else {
      dir = 'h';
      const right = tcx >= sx + sw / 2;
      x2 = right ? bx : bx + bw;
      y2 = Math.max(by + 6, Math.min(by + bh - 6, pr.y));
    }
    return link(pr.id, pr.x, pr.y, x2, y2, hot, dir);
  }

  function framePrims(st, ctx) {
    let y = FRAME.y;
    const fx = ctx.g.fx;
    if (st.frames.length) ctx.P.push({ id: 'fr:title', t: 'text', p: { x: fx, y: FRAME.y - 8, fill: COL.muted }, m: { text: '调用栈（下面是最新的一层）', cls: 'tr-sub' } });
    st.frames.forEach((f, d) => {
      const id = `fr${d}_${hash(f.fn)}`;
      const top = d === st.frames.length - 1;
      const h = boxPrims(id, fx, y, FRAME.w, (top ? '▶ ' : '') + f.fn, f.vars, top ? 'heap' : 'frame', ctx);
      ctx.frames.push([id, [fx, y, FRAME.w, h]]);
      y += h + FRAME.gap;
    });
  }

  function consolePrims(st, ctx) {
    const c = ctx.g.con;
    ctx.P.push({ id: 'con:bg', t: 'rect', p: { x: c.x, y: c.y, w: c.w, h: c.h, fill: '#1f2328', stroke: '#1f2328', sw: 1, fo: 1 }, m: { rx: 8 } });
    ctx.P.push({ id: 'con:t', t: 'text', p: { x: c.x + c.w - 8, y: c.y + 14, fill: '#8b919a' }, m: { text: '终端输出', cls: 'tr-sub', anchor: 'end' } });
    // 逐行演示：长行截断，悬停看全文。翻页图解（ctx.soft）：长行像真终端一样折成几行显示（续行缩进两格）
    let lines = st.out, nFresh = ctx.newOut;
    if (ctx.soft) {
      lines = []; nFresh = 0;
      st.out.forEach((l, j) => {
        const parts = wrap(l, c.w - 104, 10.5).map((t, k) => k ? '  ' + t : t);
        lines.push(...parts);
        if (j >= st.out.length - ctx.newOut) nFresh += parts.length;
      });
    }
    const n = lines.length, from = Math.max(0, n - c.lines);
    for (let j = from; j < n; j++) {
      const fresh = nFresh > 0 && j >= n - nFresh;
      ctx.P.push({ id: `con:${j}`, t: 'text', p: { x: c.x + 10, y: c.y + 20 + (j - from) * 17, fill: fresh ? '#fde68a' : '#d1d5db' }, m: { text: fit(lines[j], c.w - 90, 10.5), cls: 'tr-con', title: tw(lines[j], 10.5) > c.w - 90 ? lines[j] : '' }, enter: { y: c.y + c.h + 6 } });
    }
    ctx.reg('console', [c.x, c.y, c.w, c.h]);
  }

  // 两个相邻状态的差别：哪些行 / 节点 / 格子变了（舞台上闪一下黄色），以及给说明区用的文字
  function diff(prev, st) {
    const changed = new Set(), words = [];
    const show = v => showV(v, st);
    const P = prev || { objs: {}, frames: [], out: [] };
    for (const id of st.order) {
      const o = st.objs[id], p = P.objs[id];
      if (!p) { changed.add(id); words.push(`新建 <b>${id}</b>${o.title ? '（' + o.title + '）' : o.label ? '（' + o.label + '）' : ''}`); continue; }
      if (o.rows && o.kind !== 'table') for (const [k, v] of o.rows) {
        const old = (p.rows || []).find(r => r[0] === k);
        if (!old || old[1] !== v) { changed.add(`${id}.${k}`); words.push(`${id}.${k}：${old ? show(old[1]) + ' → ' : ''}${show(v)}`); }
      }
      if (p.rows && o.kind !== 'table') for (const [k] of p.rows) if (!(o.rows || []).some(r => r[0] === k)) words.push(`${id}.${k} 删除`);
      if (o.kind === 'node' && (o.label !== p.label || o.sub !== p.sub || o.ptr !== p.ptr)) { changed.add(id); words.push(`${id}：${o.label || ''}${o.sub ? ' / ' + o.sub : ''}`); }
      if (o.kind === 'list' && JSON.stringify(o.items) !== JSON.stringify(p.items)) words.push(`${o.title || id} 顺序：${(o.items || []).map(x => (st.objs[x] || {}).label || x).join(' ⇄ ') || '空'}`);
      if (o.kind === 'slice') {
        const norm = s => (s.items || []).map((it, j) => typeof it === 'object' ? it : { id: `${s.id}#${j}`, v: it });
        const was = Object.fromEntries(norm(p).map(it => [it.id, it.v]));
        for (const it of norm(o)) if (was[it.id] !== it.v) changed.add(it.id);
        if (JSON.stringify(norm(o).map(i => i.v)) !== JSON.stringify(norm(p).map(i => i.v))) words.push(`${o.title || id} = [${norm(o).map(i => show(i.v)).join(', ')}]`);
      }
      if (o.kind === 'ring' || o.kind === 'tree') {
        const list = o.kind === 'ring' ? o.items || [] : o.nodes || [], was = Object.fromEntries((o.kind === 'ring' ? p.items || [] : p.nodes || []).map(it => [it.id, JSON.stringify(it)]));
        for (const it of list) if (was[it.id] !== JSON.stringify(it)) { changed.add(it.id); words.push(`${o.title || id}：${was[it.id] ? '更新' : '新增'} ${it.label || it.id}${it.sub ? '（' + it.sub + '）' : ''}`); }
      }
      if (o.kind === 'text' && o.text !== p.text) changed.add(id);
      if (o.kind === 'seq') {
        const was = Object.fromEntries((p.msgs || []).map((m, j) => [m.id || `${id}_${j}`, JSON.stringify(m)]));
        (o.msgs || []).forEach((m, j) => { const mid = m.id || `${id}_${j}`; if (was[mid] !== JSON.stringify(m)) { changed.add(mid); words.push(`${o.title || id}：${m.label || m.sep || ''}`); } });
        const lw = Object.fromEntries((p.lanes || []).map(L => [L.id, JSON.stringify(L)]));
        for (const L of o.lanes || []) if (lw[L.id] !== undefined && lw[L.id] !== JSON.stringify(L)) changed.add(L.id);
      }
      if (o.kind === 'table') (o.rows || []).forEach((r, j) => { if (JSON.stringify(r) !== JSON.stringify((p.rows || [])[j])) changed.add(`${id}.${j}`); });
      if ((o.kind === 'tag' || o.kind === 'arrow') && JSON.stringify(o) !== JSON.stringify(p)) changed.add(id);
    }
    for (const id of P.order || []) if (!st.objs[id]) words.push(`释放 / 移除 <b>${id}</b>`);
    const df = st.frames.length - P.frames.length;
    st.frames.forEach((f, d) => {
      const pf = P.frames[d];
      const fid = `fr${d}_${hash(f.fn)}`;
      for (const [k, v] of f.vars) {
        const old = pf && pf.fn === f.fn ? pf.vars.find(r => r[0] === k) : null;
        if (!old || old[1] !== v) { changed.add(`${fid}.${k}`); if (d === st.frames.length - 1) words.push(`${k} = ${show(v)}`); }
      }
    });
    if (df > 0) words.unshift(`调用 ${st.frames.slice(-df).map(f => f.fn).join(' → ')}`);
    if (df < 0) words.unshift(`返回到 ${(st.frames[st.frames.length - 1] || { fn: '调用方' }).fn}`);
    const newOut = st.out.length - P.out.length;
    if (newOut > 0) words.push('输出：' + st.out.slice(-newOut).map(l => `<code>${esc(l)}</code>`).join(' '));
    return { changed, words, newOut };
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 指针显示成「→ 目标的名字」：节点用 label，盒子 / 链表 / 切片用标题，找不到就用 id
  function showV(v, st) {
    if (!isPtr(v)) return `<code>${esc(v)}</code>`;
    const id = ptrId(v);
    if (isNil(id)) return 'None';
    const o = st && st.objs[id], name = o ? (o.label || o.title || id) : id;
    return `→ ${esc(String(name).replace(/（.*$/, ''))}`;
  }

  function scene(tr, i, SRC) {
    const S = states(tr), st = S.list[i], prev = i ? S.list[i - 1] : null;
    const d = diff(prev, st);
    const P = [], regs = {}, tops = [], dup = [];
    const ctx = {
      P, ptrs: [], cut: [], frames: [], bad: [], changed: d.changed, newOut: d.newOut, g: geo(tr), idxCells: new Set(), marks: [], lines: [], soft: !!tr.layout,
      hl: new Set(st.hl || []),
      reg: (id, b) => { if (regs[id] && !ctx.g.frameIds) dup.push(id); regs[id] = b; }
    };
    sink = []; sink.off = true;
    if (!ctx.g.full) codePanel(tr, i, SRC, P);
    ctx.g.frameIds = true;                   // 调用栈各层的 id 由层号生成，不会和对象撞名，不查重
    framePrims(st, ctx);
    ctx.g.frameIds = false;
    sink.off = false;
    ctx.frames.forEach(([id, b]) => tops.push([`调用栈 ${id}`, b]));
    for (const id of st.order) {
      const o = st.objs[id];
      if (o.kind === 'node' && !o.at) continue;           // 链表里的节点由链表负责摆
      if (!o.at) continue;                                // 箭头、标签没有 at，等别的都摆好了再画
      if (o.kind === 'box' || o.kind === 'map') boxPrims(o.id, o.at[0], o.at[1], o.w || 170, o.title || o.id, o.rows || [], o.tone || (o.kind === 'map' ? 'map' : 'heap'), ctx, { dash: o.dash });
      else if (o.kind === 'node') nodePrims(o, o.at[0], o.at[1], ctx);
      else if (o.kind === 'list') listPrims(o, st, ctx);
      else if (o.kind === 'slice') slicePrims(o, ctx);
      else if (o.kind === 'ring') ringPrims(o, ctx);
      else if (o.kind === 'tree') treePrims(o, ctx);
      else if (o.kind === 'text') textPrims(o, ctx);
      else if (o.kind === 'seq') seqPrims(o, ctx);
      else if (o.kind === 'table') tablePrims(o, ctx);
      tops.push([o.id, regs[o.id]]);
    }
    if (tr.console || (tr._hasOut)) { sink.off = !ctx.soft; consolePrims(st, ctx); sink.off = false; tops.push(['终端输出', regs.console]); }   // 图解里终端行被截断也要报
    const dangling = [];
    for (const pr of ctx.ptrs) {
      const b = regs[pr.to];
      if (!b) { dangling.push(`${pr.from} → ${pr.to}`); continue; }
      const tgt = st.objs[pr.to];
      // 翻页图解：环上一点指向同一个环上的另一点 = 顺时针沿着环走过去（画在环外侧的一段弧），不横穿圆心
      const ring = pr.arc && ctx.soft && Object.values(st.objs).find(r => r.kind === 'ring' && (r.items || []).some(x => x.id === pr.to) && (r.items || []).some(x => x.id === pr.from));
      if (ring) { P.push(arcLink(pr, ring)); continue; }
      P.push(ptrLink(pr, b, pr.hot, tgt && ['list', 'slice', 'tree', 'ring'].includes(tgt.kind)));
      ctx.lines.push([`指针 ${pr.from} → ${pr.to}`, P[P.length - 1].p, [pr.from, pr.to]]);
    }
    for (const id of st.order) if (st.objs[id].kind === 'arrow') arrowPrims(st.objs[id], regs, ctx);
    const groups = {};
    for (const id of st.order) { const o = st.objs[id]; if (o.kind === 'tag') (groups[o.on + '|' + (o.side || 'top')] = groups[o.on + '|' + (o.side || 'top')] || []).push(o); }
    for (const g of Object.values(groups)) tagGroup(g, regs, ctx);
    // 上面各处没单独报的截断（表头、格子下的小字、节点、树、泳道名……）统一补上
    for (const t of sink) if (!ctx.cut.some(c => c.indexOf(t) >= 0 || t.indexOf(c) >= 0)) ctx.cut.push(`文字「${t}」`);
    sink = null;
    for (const id of dup) ctx.bad.push(`「${id}」这个名字被两个东西用了（对象、格子、泳道、消息、标签的 id 要互不相同）`);
    // 说明区
    const step = tr.steps[i], at = parseAt(tr, step.at);
    const line = at && at.file ? ((SRC[srcKey(tr, at.file)] || [])[at.ln - 1] || '') : '';
    const known = new Set(Object.keys(regs));
    for (const id of st.order) if (st.objs[id].kind === 'arrow') known.add(id);       // 箭头也能 hl（变橙色）
    for (const id of st.order) if (st.objs[id].kind !== 'table') for (const r of st.objs[id].rows || []) known.add(`${id}.${r[0]}`);
    return {
      prims: P, tops, marks: ctx.marks, lines: ctx.lines, regs, geo: ctx.g, dangling, cut: ctx.cut, known, bad: ctx.bad,
      cap: { file: at && at.file, ln: at && at.ln, line: line.trim(), say: step.say || '', words: d.words }
    };
  }

  // 长文字按像素宽度折行（终端框用）
  function wrap(text, px, size) {
    const out = [];
    for (const raw of String(text).split('\n')) {
      let line = '';
      for (const ch of raw) {
        if (tw(line + ch, size) > px) { out.push(line); line = ''; }
        line += ch;
      }
      out.push(line);
    }
    return out;
  }
  // ---------------- 3. 校验 ----------------
  function audit(tr, SRC) {
    const errs = [], warns = [];
    const S = states(tr);
    errs.push(...S.errs);
    const owner = {};
    (tr.steps || []).forEach((s, i) => {
      const tag = `第 ${i + 1} 步`;
      let sc;
      try { sc = scene(tr, i, SRC); } catch (e) { errs.push(`${tag}：排版时出错 ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`); return; }
      const st = S.list[i];
      // 链表成员必须是 node，且同一个 node 不能挂在两个链表里
      for (const id of st.order) {
        const o = st.objs[id];
        if (o.kind === 'list') for (const m of o.items || []) {
          if (!st.objs[m]) errs.push(`${tag}：链表 ${id} 里的 ${m} 不存在`);
          else if (st.objs[m].kind !== 'node') errs.push(`${tag}：链表 ${id} 里的 ${m} 不是 node`);
          else if (owner[m + '@' + i] && owner[m + '@' + i] !== id) errs.push(`${tag}：节点 ${m} 同时在 ${owner[m + '@' + i]} 和 ${id} 里`);
          else owner[m + '@' + i] = id;
        }
        if (o.kind !== 'node' && o.kind !== 'arrow' && o.kind !== 'tag' && !o.at) errs.push(`${tag}：对象 ${id} 缺 at（位置）`);
        if (o.kind === 'arrow' && (!o.from || !o.to)) errs.push(`${tag}：箭头 ${id} 要写 from 和 to`);
        if (o.kind === 'tag' && !o.on) errs.push(`${tag}：标签 ${id} 要写 on（贴在谁旁边）`);
        if (o.kind === 'node' && !o.at && !Object.values(st.objs).some(l => l.kind === 'list' && (l.items || []).includes(id))) errs.push(`${tag}：节点 ${id} 既没有 at 也不在任何链表里，画不出来`);
      }
      for (const d of sc.dangling) errs.push(`${tag}：指针指向不存在的东西 ${d}`);
      for (const b of sc.bad) errs.push(`${tag}：${b}`);
      for (const h of st.hl || []) if (!sc.known.has(h)) warns.push(`${tag}：hl 里的 ${h} 找不到（写对象 id、链表节点 id、格子 id，或「对象id.字段」）`);
      // 出界、重叠（标签、箭头上的字也算：它们和自己贴着 / 连着的东西、以及装着那个东西的容器挨着是正常的）
      const R = sc.geo.R, area = R === DATA ? '数据区' : '画布';
      const all = sc.tops.concat(sc.marks);
      for (const [id, b] of all) {
        if (!b) continue;
        const [x, y, w, h] = b;
        if (x < R.x0 - 1 || y < R.y0 - 1 || x + w > R.x1 + 1 || y + h > R.y1 + 1) errs.push(`${tag}：${id} 出界（x ${Math.round(x)}–${Math.round(x + w)}，y ${Math.round(y)}–${Math.round(y + h)}；${area}是 x ${R.x0}–${R.x1}，y ${R.y0}–${R.y1}）`);
      }
      const inside = (T, B) => T && T[0] >= B[0] - 1 && T[1] >= B[1] - 1 && T[0] + T[2] <= B[0] + B[2] + 1 && T[1] + T[3] <= B[1] + B[3] + 1;
      const related = (M, B) => M[2].some(t => inside(sc.regs[t], B) || inside(B, sc.regs[t] || [0, 0, 0, 0]));
      const hit = (A, B, m) => A[0] < B[0] + B[2] - m && B[0] < A[0] + A[2] - m && A[1] < B[1] + B[3] - m && B[1] < A[1] + A[3] - m;
      // 对象之间
      for (let a = 0; a < sc.tops.length; a++) for (let b = a + 1; b < sc.tops.length; b++) {
        const A = sc.tops[a][1], B = sc.tops[b][1];
        if (A && B && hit(A, B, 4)) errs.push(`${tag}：${sc.tops[a][0]} 和 ${sc.tops[b][0]} 重叠（${box(A)} / ${box(B)}）`);
      }
      // 标签、箭头上的字：和画出来的每一样东西比（包括容器里的格子、节点、泳道、消息、表格的行），
      // 只放过它自己贴着 / 连着的东西，以及装着那个东西的容器
      const markIds = new Set(sc.marks.map(M => M[3]).filter(Boolean));
      sc.marks.forEach((M, a) => {
        for (const rid of Object.keys(sc.regs)) {
          const B = sc.regs[rid];
          if (rid === M[3] || markIds.has(rid) || related(M, B)) continue;
          if (hit(M[1], B, 1)) errs.push(`${tag}：${M[0]} 压住了 ${rid}（${box(M[1])} / ${box(B)}）`);
        }
        for (const N of sc.marks.slice(a + 1)) if (hit(M[1], N[1], 1)) errs.push(`${tag}：${M[0]} 和 ${N[0]} 重叠（${box(M[1])} / ${box(N[1])}）`);
      });
      for (const c of sc.cut) warns.push(`${tag}：${c} 太长被截断了（加宽一点，或者把字改短）`);
    });
    return { errs: uniq(errs), warns: uniq(warns) };
  }
  const box = b => `x ${Math.round(b[0])}–${Math.round(b[0] + b[2])} y ${Math.round(b[1])}–${Math.round(b[1] + b[3])}`;
  // 指针 / 箭头的线有没有从别的对象身上穿过去（沿曲线取点，落在不相干的对象框里超过 2 个点就算）。
  // 只放过线两端的东西、装着它们的容器、以及它们里面的部件。翻页图解的校验用（逐行演示不查）
  function crossings(sc) {
    const out = [];
    const inside = (T, B) => T && T[0] >= B[0] - 1 && T[1] >= B[1] - 1 && T[0] + T[2] <= B[0] + B[2] + 1 && T[1] + T[3] <= B[1] + B[3] + 1;
    for (const [name, p, ends] of sc.lines) {
      const E = ends.map(e => sc.regs[e] || sc.regs[String(e).split('.')[0]]).filter(Boolean);
      for (const [oname, B] of sc.tops.concat(sc.marks)) {
        if (!B || oname === name + ' 的文字' || E.some(T => inside(T, B) || inside(B, T))) continue;      // 箭头自己的字本来就压在线上
        let n = 0;
        for (let k = 1; k < 24; k++) {
          const t = k / 24, u = 1 - t;
          const x = u * u * u * p.x1 + 3 * u * u * t * p.c1x + 3 * u * t * t * p.c2x + t * t * t * p.x2;
          const y = u * u * u * p.y1 + 3 * u * u * t * p.c1y + 3 * u * t * t * p.c2y + t * t * t * p.y2;
          if (x > B[0] + 2 && x < B[0] + B[2] - 2 && y > B[1] + 2 && y < B[1] + B[3] - 2) n++;
        }
        if (n > 2) out.push(`${name} 的线从 ${oname} 身上穿过去了（${box(B)}）`);
      }
    }
    return out;
  }
  function uniq(list) {
    // 同一个问题连续好几步都有，只报第一次出现的步号和次数
    const seen = new Map();
    for (const e of list) {
      const k = e.replace(/^第 \d+ 步：/, '');
      if (!seen.has(k)) seen.set(k, { first: e, n: 0 });
      seen.get(k).n++;
    }
    return [...seen.values()].map(v => v.n > 1 ? `${v.first}（共 ${v.n} 步）` : v.first);
  }

  // 预处理：哪条演示用到了终端输出（有就常驻画出终端框，位置不跳）
  function prep(tr) {
    if (tr._prep) return tr;
    tr._hasOut = !!(tr.init && tr.init.out) || (tr.steps || []).some(s => s.out !== undefined);
    tr._prep = true;
    return tr;
  }

  const API = {
    states, audit: (tr, SRC) => audit(prep(tr), SRC), scene: (tr, i, SRC) => scene(prep(tr), i, SRC),
    crossings, parseAt, srcKey, CODE, DATA, FRAME, CONSOLE, spans
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else G.TraceCore = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* 01 · 第 2 讲 —— 约束解码：schema → 文法树、下推自动机的栈、logits 掩码与 softmax（手推）、长度用完的例外
 * 场景 1：两棵树照讲义 lecture-02 第 30 页；控制台是 本机验算脚本 第 4 部分（jsonschema 实跑）。
 * 场景 2：逐字符的栈是 verify.py 第 3 部分实跑；"有限控制 + 栈"的画法照讲义第 31 页。
 * 场景 3：8 个 logits 和掩码照讲义第 34 页，softmax 的每个数是 verify.py 第 2 部分实算（讲义图上写的是 0.1 / 0.76 / 0.13 / 1e-3）。
 * 场景 4：长度用完的情形出自视频 34:36–35:19；"预算 6 个 token"和 token 切法是示意。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L2 = 'https://www.cmu-agents.com/slides/lecture-02-tool-use.pdf', YT = 'https://youtu.be/jXChFB4JSyw?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function nd(x, y, w, t, k, op, size) {
    return { type: 'box', x: x, y: y, w: w, h: 26, rx: 6, fill: C[(k || 'neutral') + 'W'], stroke: C[k || 'neutral'], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: true, opacity: op == null ? 0 : op };
  }
  function edge(x1, y1, x2, y2) { return { type: 'path', d: 'M' + x1 + ',' + (y1 + 13) + ' L' + x2 + ',' + (y2 - 13), stroke: C.line, sw: 1.3, dash: 0 }; }
  function draw(d0) { return { dash: { to: 1, dur: 400, delay: d0 || 0 } }; }

  /* ---------------- 场景 1：schema 与文法树 ---------------- */
  var SCHEMA = { lang: 'json', title: '讲义第 29 页 · JSON Schema', src:
'{\n' +
'  "type": "object",\n' +
'  "properties": {\n' +
'    "city": {"type": "string"},\n' +
'    "units": {"enum": ["C", "F"]}\n' +
'  },\n' +
'  "required": ["city"],\n' +
'  "additionalProperties": false\n' +
'}\n' };
  /* 一棵树的结点位置（cx 是树的中心） */
  function tree(pre, cx, leaf, bad) {
    var o = {}, P = {
      obj: [cx, 112, 70, 'object', 'info'], lb: [cx - 85, 172, 26, '{'], mem: [cx, 172, 80, 'members', 'info'], rb: [cx + 85, 172, 26, '}'],
      m1: [cx - 75, 232, 70, 'member', 'info'], cm: [cx, 232, 22, ','], m2: [cx + 75, 232, 70, 'member', 'info'],
      k1: [cx - 125, 292, 54, '"city"'], c1: [cx - 82, 292, 18, ':'], s1: [cx - 44, 292, 54, 'string', 'data'],
      k2: [cx + 30, 292, 60, '"units"'], c2: [cx + 74, 292, 18, ':'], u: [cx + 112, 292, 44, 'unit', 'data'],
      v1: [cx - 44, 352, 54, '"Pgh"', 'ok'], v2: [cx + 112, 352, 44, leaf, bad ? 'bad' : 'ok']
    };
    var E = [['obj', 'lb'], ['obj', 'mem'], ['obj', 'rb'], ['mem', 'm1'], ['mem', 'cm'], ['mem', 'm2'], ['m1', 'k1'], ['m1', 'c1'], ['m1', 's1'], ['m2', 'k2'], ['m2', 'c2'], ['m2', 'u'], ['s1', 'v1'], ['u', 'v2']];
    E.forEach(function (e, i) { var a = P[e[0]], b = P[e[1]]; o[pre + 'e' + i] = edge(a[0], a[1], b[0], b[1]); });
    for (var k in P) o[pre + k] = nd(P[k][0], P[k][1], P[k][2], P[k][3], P[k][4]);
    return o;
  }
  function lvl(pres, names, d0, step) {
    var s = {}, i = 0;
    pres.forEach(function (p) { names.forEach(function (n) { s[p + n] = pop(d0 + step * i); i++; }); });
    return s;
  }
  function edges(pres, idx, d0) { var s = {}; pres.forEach(function (p) { idx.forEach(function (i) { s[p + 'e' + i] = draw(d0); }); }); return s; }
  var sc1 = {
    name: 'Schema 与文法树', desc: '两段都是合法 JSON。只有 units = "F" 能从文法 unit → "C" | "F" 推出来（讲义第 30 页）。',
    code: SCHEMA,
    bg: function (d) {
      title(d, '合法 JSON 不等于合法调用：把 schema 当成上下文无关文法');
      d.line(430, 64, 430, 400, { stroke: C.line1, sw: 1, dash: '4 4' });
    },
    objects: function () {
      var o = mix(tree('L', 215, '"F"', false), tree('R', 645, '"K"', true));
      o.js1 = { type: 'text', x: 215, y: 66, text: '{"city":"Pgh","units":"F"}', size: 13.5, weight: 700, mono: true, color: C.fg, anchor: 'middle', opacity: 0 };
      o.js2 = { type: 'text', x: 645, y: 66, text: '{"city":"Pgh","units":"K"}', size: 13.5, weight: 700, mono: true, color: C.fg, anchor: 'middle', opacity: 0 };
      o.rule = { type: 'box', x: 430, y: 450, w: 300, h: 36, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.5, text: 'unit → "C" | "F"', size: 14, weight: 750, mono: true, opacity: 0 };
      o.v = { type: 'text', x: 215, y: 400, text: 'schema 合法', size: 13, weight: 700, color: C.ok, anchor: 'middle', opacity: 0 };
      o.x = { type: 'text', x: 645, y: 400, text: 'schema 不合法', size: 13, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '两段输出都是语法正确的 JSON，单看括号和引号挑不出毛病。', set: { js1: fade(0), js2: fade(300) } },
      { say: '按文法自顶向下建树：根是一个 object。', set: lvl(['L', 'R'], ['obj'], 0, 200) },
      { say: 'object → { members }。', set: join(edges(['L', 'R'], [0, 1, 2], 0), lvl(['L', 'R'], ['lb', 'mem', 'rb'], 300, 90)) },
      { say: 'members → member , member。', set: join(edges(['L', 'R'], [3, 4, 5], 0), lvl(['L', 'R'], ['m1', 'cm', 'm2'], 300, 90)) },
      { say: '每个 member → 键 : 值。city 的值是 string，units 的值是 unit。', set: join(edges(['L', 'R'], [6, 7, 8, 9, 10, 11], 0), lvl(['L', 'R'], ['k1', 'c1', 's1', 'k2', 'c2', 'u'], 300, 70)), hl: [4, 5] },
      { say: '"Pgh" 是一个 string：两边都推得出。', set: join(edges(['L', 'R'], [12], 0), lvl(['L', 'R'], ['v1'], 300, 200)) },
      { say: '左边 unit → "F"：推得出，整棵树建成。', set: join(edges(['L'], [13], 0), { Lv2: pop(300), v: fade(800) }), fx: [{ type: 'burst', obj: 'Lv2', color: C.ok, at: 600 }], hl: [5],
        log: [{ s: '{"city":"Pgh","units":"F"}                    -> schema 合法', at: 800 }] },
      { say: '右边 unit → "K"：文法里没有这条规则，树建不下去。', set: join(edges(['R'], [13], 0), { Rv2: pop(300), x: fade(900) }), fx: [{ type: 'shake', obj: 'Rv2', at: 700 }, { type: 'flash', obj: 'Ru', color: C.bad, at: 700 }], hl: [5],
        log: [{ s: "{\"city\":\"Pgh\",\"units\":\"K\"}                    -> schema 不合法：'K' is not one of ['C', 'F']", at: 900 }] },
      { say: 'schema 里的 enum 就是这条文法规则：unit 只能推出 "C" 或 "F"。', set: { rule: pop(0) }, fx: [{ type: 'pulse', obj: 'rule', color: C.data, at: 500 }], hl: [5] }
    ]
  };

  /* ---------------- 场景 2：下推自动机的栈 ---------------- */
  var S = '{"city":"Pgh","units":"F"}', CX0 = 104, CW = 25;
  function cx(i) { return CX0 + i * CW; }
  var PDA = { lang: 'py', title: '本机实跑 · 第 3 部分（下推自动机的栈）', src:
'stack, in_str = [], False\n' +
'for ch in s:\n' +
'    if in_str:\n' +
'        if ch == \'"\':\n' +
'            in_str = False\n' +
'            stack.pop()\n' +
'        continue\n' +
'    if ch == "{":\n' +
'        stack.append("object")\n' +
'    elif ch in "}]":\n' +
'        stack.pop()\n' +
'    elif ch == \'"\':\n' +
'        in_str = True\n' +
'        stack.append("string")\n' +
'print("accepted:", not stack)\n' };
  var TR = ["{   push object  stack=['object']", "\"   push string  stack=['object', 'string']", "\"   pop string   stack=['object']"];
  var SBX = 640, SBY = 470;   // 栈底
  function sItem(n, depth, label, k) { return { type: 'box', x: SBX, y: SBY - depth * 40, w: 150, h: 34, rx: 7, fill: C[k + 'W'], stroke: C[k], sw: 1.5, text: label, size: 13, weight: 700, mono: true, opacity: 0 }; }
  function push(n, depth, fromI, delay) {
    var s = {}; s[n] = { opacity: { to: 1, dur: 200, delay: delay }, x: { from: cx(fromI), to: SBX, dur: 800, delay: delay, ease: 'inOut' }, y: { from: 150, to: SBY - depth * 40, dur: 800, delay: delay, ease: 'inOut' } };
    return s;
  }
  function popOut(n, delay) { var s = {}; s[n] = { opacity: { to: 0, dur: 400, delay: delay }, x: { to: SBX + 150, dur: 500, delay: delay, ease: 'in' } }; return s; }
  function ptr(i, delay, dur) { return { ptr: { x: { to: cx(i), dur: dur || 500, delay: delay || 0, ease: 'inOut' } } }; }
  function lit(a, b, delay) { var s = {}; for (var i = a; i <= b; i++) s['c' + i] = { fill: { to: C.dataW, dur: 250, delay: (delay || 0) + (i - a) * 60 } }; return s; }
  var sc2 = {
    name: '下推自动机', desc: '有限状态记住"现在在哪条规则里"，栈记住嵌套。{ 和 " 压栈，} 和配对的 " 弹栈。读完栈空才接受。',
    code: PDA, dataTitle: '自动机', data: { '读到第几个字符': 0, '当前字符': '—', '栈深度': 0 },
    bg: function (d) {
      title(d, '下推自动机 = 有限控制 + 栈（讲义第 31 页）');
      d.rect(SBX - 90, 270, 180, 224, { fill: C.bg2, stroke: C.line, rx: 10, sw: 1.4 });
      d.text(SBX, 256, '栈', { anchor: 'middle', size: 13, weight: 700, color: C.fg2 });
      d.text(60, 210, '读入的串', { size: 12, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      for (var i = 0; i < S.length; i++) o['c' + i] = { type: 'box', x: cx(i), y: 150, w: 23, h: 30, rx: 4, fill: C.bg2, stroke: C.line, sw: 1.1, text: S[i], size: 13.5, weight: 700, mono: true, opacity: 0 };
      o.ptr = { type: 'text', x: cx(0), y: 116, text: '▼', size: 16, color: C.warn, anchor: 'middle', opacity: 0 };
      o.so = sItem('so', 0, 'object', 'info');
      o.s1 = sItem('s1', 1, 'string', 'data'); o.s2 = sItem('s2', 1, 'string', 'data'); o.s3 = sItem('s3', 1, 'string', 'data'); o.s4 = sItem('s4', 1, 'string', 'data');
      o.st = { type: 'box', x: 230, y: 330, w: 210, h: 44, rx: 22, fill: C.warnW, stroke: C.warn, sw: 1.6, text: '期待一个值', size: 13.5, weight: 700, opacity: 0 };
      o.stL = { type: 'text', x: 230, y: 296, text: '有限控制（当前状态）', size: 12, weight: 700, color: C.fg3, anchor: 'middle', opacity: 0 };
      o.ok = { type: 'box', x: 230, y: 440, w: 210, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.6, text: '读完，栈空 → 接受', size: 13.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; for (var i = 0; i < S.length; i++) s['c' + i] = pop(i * 35); s.ptr = fade(1000); s.st = pop(1100); s.stL = fade(1100);
        return { say: '要检查的输出：{"city":"Pgh","units":"F"}，指针从第一个字符开始。', set: s, log: [{ s: ">>> s = '{\"city\":\"Pgh\",\"units\":\"F\"}'", at: 300 }] }; })(),
      { say: '读到 {：进入一个 object，压栈。', set: join(push('so', 0, 0, 200), lit(0, 0, 0)), hl: [8, 9], fx: [{ type: 'ripple', x: SBX, y: SBY, color: C.info, at: 1000 }],
        log: [{ s: TR[0], at: 900 }], data: { '读到第几个字符': 1, '当前字符': '{', '栈深度': { v: 1, at: 900 } } },
      { say: '读到 "：进入字符串，压栈。状态变成"在字符串里"。', set: join(ptr(1), push('s1', 1, 1, 400), lit(1, 1, 0), { st: { text: { to: '在字符串里', delay: 300 } } }), hl: [12, 13, 14],
        log: [{ s: TR[1], at: 1100 }], data: { '读到第几个字符': 2, '当前字符': '"', '栈深度': { v: 2, at: 1100 } } },
      { say: 'city 四个字母都在字符串里，栈不动。读到配对的 " 就弹栈。', set: join(ptr(6, 0, 1000), lit(2, 6, 0), popOut('s1', 1100), { st: { text: { to: '期待分隔符', delay: 1200 } } }), hl: [3, 4, 5, 6],
        log: [{ s: TR[2], at: 1300 }], data: { '读到第几个字符': 7, '当前字符': '"', '栈深度': { v: 1, at: 1300 } } },
      { say: '冒号不进栈。接着 "Pgh" 的开引号：压栈。', set: join(ptr(8, 0, 600), lit(7, 8, 0), push('s2', 1, 8, 400), { st: { text: { to: '在字符串里', delay: 500 } } }), hl: [12, 13, 14],
        log: [{ s: TR[1], at: 1100 }], data: { '读到第几个字符': 9, '当前字符': '"', '栈深度': { v: 2, at: 1100 } } },
      { say: 'Pgh 和配对的 "：弹栈。', set: join(ptr(12, 0, 800), lit(9, 12, 0), popOut('s2', 800), { st: { text: { to: '期待分隔符', delay: 900 } } }), hl: [3, 4, 5, 6],
        log: [{ s: TR[2], at: 1100 }], data: { '读到第几个字符': 13, '当前字符': '"', '栈深度': { v: 1, at: 1100 } } },
      { say: '逗号之后，"units" 的开引号：压栈。', set: join(ptr(14, 0, 500), lit(13, 14, 0), push('s3', 1, 14, 400), { st: { text: { to: '在字符串里', delay: 500 } } }), hl: [12, 13, 14],
        log: [{ s: TR[1], at: 1100 }], data: { '读到第几个字符': 15, '当前字符': '"', '栈深度': { v: 2, at: 1100 } } },
      { say: 'units 和配对的 "：弹栈。', set: join(ptr(20, 0, 1000), lit(15, 20, 0), popOut('s3', 1000), { st: { text: { to: '期待分隔符', delay: 1100 } } }), hl: [3, 4, 5, 6],
        log: [{ s: TR[2], at: 1300 }], data: { '读到第几个字符': 21, '当前字符': '"', '栈深度': { v: 1, at: 1300 } } },
      { say: '冒号之后，"F" 的开引号：压栈。', set: join(ptr(22, 0, 500), lit(21, 22, 0), push('s4', 1, 22, 400), { st: { text: { to: '在字符串里', delay: 500 } } }), hl: [12, 13, 14],
        log: [{ s: TR[1], at: 1100 }], data: { '读到第几个字符': 23, '当前字符': '"', '栈深度': { v: 2, at: 1100 } } },
      { say: 'F 和配对的 "：弹栈，又回到只剩 object 一层。', set: join(ptr(24, 0, 500), lit(23, 24, 0), popOut('s4', 600), { st: { text: { to: '期待分隔符', delay: 700 } } }), hl: [3, 4, 5, 6],
        log: [{ s: TR[2], at: 900 }], data: { '读到第几个字符': 25, '当前字符': '"', '栈深度': { v: 1, at: 900 } } },
      { say: '读到 }：object 结束，弹栈。栈空了，串也读完了：接受。', set: join(ptr(25, 0, 400), lit(25, 25, 0), popOut('so', 500), { ok: pop(1100), st: { text: { to: '终止状态', delay: 600 } } }), hl: [10, 11, 15],
        fx: [{ type: 'burst', obj: 'ok', color: C.ok, at: 1300 }], log: [{ s: "}   pop          stack=[]", at: 700 }, { s: 'accepted: True', at: 1200 }], data: { '读到第几个字符': 26, '当前字符': '}', '栈深度': { v: 0, at: 700 } } },
      { say: '嵌套越深，栈越高：比如 {"a":[{"b":1}]} 最深要压 3 层。有限状态自动机没有栈，记不住任意深的嵌套。',
        log: [{ s: 'nested example {"a":[{"b":1}]} max stack depth = 3', at: 300 }], fx: [{ type: 'pulse', x: SBX, y: 380, color: C.info, at: 300 }] }
    ]
  };

  /* ---------------- 场景 3：掩码与 softmax（手推） ---------------- */
  var LOGIT = [3, -2, 4, 5, 1.1, 3.2, -5, -1], MASK = [1, 0, 0, 1, 0, 1, 0, 1];
  var EXP = [20.0855, 0, 0, 148.4132, 0, 24.5325, 0, 0.3679], PR = [0.1039, 0, 0, 0.7674, 0, 0.1268, 0, 0.0019];
  var TX = function (i) { return 170 + i * 76; };
  var R1 = 104, R2 = 152, R3 = 200, R4 = 248, BB = 410;
  var EQ = VZ.eq('q', ['p₃ =', { slot: 1, w: 92 }, '/', { slot: 1, w: 92 }, '=', { num: 0, fmt: 'fixed4', k: 'ok', w: 92 }], 430, 490, { size: 15 });
  var SM = { lang: 'py', title: '本机实跑 · 第 2 部分（掩码 + softmax）', src:
'logits = [3, -2, 4, 5, 1.1, 3.2, -5, -1]\n' +
'mask   = [1, 0, 0, 1, 0, 1, 0, 1]\n' +
'z = [l if m else -inf\n' +
'     for l, m in zip(logits, mask)]\n' +
'ex = [exp(l) for l in z]  # exp(-inf) = 0\n' +
'Z = sum(ex)\n' +
'p = [e / Z for e in ex]\n' };
  var sc3 = {
    name: '掩码与 softmax', desc: '不合法的 token 把 logit 设成 −∞，再归一化：概率只落在合法 token 上（讲义第 34 页的数，本机实算）。',
    code: SM, dataTitle: '实算结果', data: { 'Z': 0, 'p[0]': 0, 'p[3]': 0, 'p[5]': 0, 'p[7]': 0 },
    dataFmt: { 'Z': 'fixed4', 'p[0]': 'fixed4', 'p[3]': 'fixed4', 'p[5]': 'fixed4', 'p[7]': 'fixed4' }, dataMeter: { 'p[3]': [0, 1, C.ok] },
    bg: function (d) {
      title(d, '语法掩码：先算 logits，再遮掉不合法的 token');
      [['logits', R1], ['掩码', R2], ['掩码后', R3], ['exp', R4]].forEach(function (r) { d.text(52, r[1], r[0], { size: 12, weight: 700, color: C.fg3 }); });
      d.text(52, BB - 40, '概率', { size: 12, weight: 700, color: C.fg3 });
      d.line(130, BB, 740, BB, { stroke: C.line, sw: 1.2 });
      for (var i = 0; i < 8; i++) d.text(TX(i), BB + 16, 't' + i, { anchor: 'middle', size: 11, mono: true, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      for (var i = 0; i < 8; i++) {
        o['l' + i] = nd(TX(i), R1, 60, String(LOGIT[i]), 'info');
        o['m' + i] = nd(TX(i), R2, 34, String(MASK[i]), MASK[i] ? 'ok' : 'bad');
        o['z' + i] = nd(TX(i), R3, 60, String(LOGIT[i]), MASK[i] ? 'info' : 'bad');
        o['x' + i] = { type: 'box', x: TX(i), y: R4, w: 68, h: 26, rx: 6, fill: C.dataW, stroke: C.data, sw: 1.3, text: '', num: 0, fmt: MASK[i] ? 'fixed2' : 'int', size: 11.5, weight: 650, mono: true, opacity: 0 };
        o['b' + i] = { type: 'box', x: TX(i), y: BB, w: 34, h: 0, rx: 3, anchor: 'bc', fill: C.okW, stroke: C.ok, sw: 1.3, opacity: 0 };
        o['bt' + i] = { type: 'text', x: TX(i), y: BB - Math.max(PR[i] * 150, 2) - 12, text: '', num: 0, fmt: 'fixed3', size: 11, weight: 700, mono: true, color: C.ok, anchor: 'middle', opacity: 0 };
      }
      o.Z = { type: 'box', x: 790, y: R4, w: 70, h: 30, rx: 7, fill: C.warnW, stroke: C.warn, sw: 1.5, text: '', num: 0, fmt: 'fixed2', pre: 'Z=', size: 11.5, weight: 750, mono: true, opacity: 0 };
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      o.fa = nd(0, 0, 80, '148.41', 'data'); o.fb = nd(0, 0, 80, '193.40', 'warn');
      o.ghost = { type: 'text', x: TX(2), y: BB - 46, text: '不掩码时 21.7%', size: 11.5, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.pick = { type: 'text', x: TX(3) + 70, y: 330, text: '← 采样到 t3', size: 12.5, weight: 750, color: C.ok, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; for (var i = 0; i < 8; i++) s['l' + i] = pop(i * 80); return { say: '模型对候选 token 算出 logits（讲义第 34 页的 8 个数）。', set: s, hl: [1] }; })(),
      (function () { var s = {}; for (var i = 0; i < 8; i++) s['m' + i] = pop(i * 80); return { say: '文法给每个 token 一个掩码：合法 1，不合法 0。依据是结构和已经输出的前缀。', set: s, hl: [2] }; })(),
      (function () {
        var s = {}; for (var i = 0; i < 8; i++) s['z' + i] = mix(pop(i * 90), MASK[i] ? {} : { text: { to: '−∞', delay: i * 90 + 300 } });
        return { say: '掩码为 0 的位置，logit 直接设成 −∞。', set: s, hl: [3, 4], log: [{ s: 'masked logits: [3, -inf, -inf, 5, -inf, 3.2, -inf, -1]', at: 900 }] };
      })(),
      (function () {
        var s = {}; for (var i = 0; i < 8; i++) s['x' + i] = mix(pop(i * 90), { num: { to: EXP[i], dur: 600, delay: i * 90 + 200 } });
        return { say: '取指数：e^(−∞) = 0，合法的四个是 20.09、148.41、24.53、0.37。', set: s, hl: [5], log: [{ s: 'exp: [20.0855, 0.0, 0.0, 148.4132, 0.0, 24.5325, 0.0, 0.3679] sum Z = 193.3991', at: 1000 }] };
      })(),
      { say: '四个非零的指数加起来，得到归一化常数 Z = 193.40。', set: { Z: mix(pop(0), { num: { to: 193.3991, dur: 900, delay: 300 } }) },
        fx: [{ type: 'pulse', obj: 'x0', color: C.warn, at: 0 }, { type: 'pulse', obj: 'x3', color: C.warn, at: 150 }, { type: 'pulse', obj: 'x5', color: C.warn, at: 300 }, { type: 'pulse', obj: 'x7', color: C.warn, at: 450 }, { type: 'ripple', obj: 'Z', color: C.warn, at: 900 }],
        hl: [6], data: { 'Z': { v: 193.3991, at: 900 } } },
      (function () {
        var s = {}; for (var i = 0; i < 8; i++) { s['b' + i] = { opacity: { to: 1, dur: 200, delay: i * 80 }, h: { to: Math.max(PR[i] * 150, MASK[i] ? 2 : 0), dur: 700, delay: i * 80, ease: 'out' } }; if (MASK[i]) s['bt' + i] = mix(fade(i * 80 + 300), { num: { to: PR[i], dur: 600, delay: i * 80 + 300 } }); }
        return { say: '每个指数除以 Z 得到概率：不合法的 token 概率正好是 0。', set: s, hl: [7],
          log: [{ s: 'probs: [0.1039, 0.0, 0.0, 0.7674, 0.0, 0.1268, 0.0, 0.0019]', at: 900 }],
          data: { 'p[0]': { v: 0.1039, at: 900 }, 'p[3]': { v: 0.7674, at: 900 }, 'p[5]': { v: 0.1268, at: 900 }, 'p[7]': { v: 0.0019, at: 900 } } };
      })(),
      { say: '手推 t3 的概率：分子是它的指数。', set: join(VZ.show(EQ, 0, 70), { fa: { opacity: { from: 1, to: 0, dur: 150, delay: 1300 }, x: { from: TX(3), to: EQ.xs[1], dur: 800, delay: 500, ease: 'inOut' }, y: { from: R4, to: 490, dur: 800, delay: 500, ease: 'inOut' } }, q1: { text: { to: '148.41', delay: 1300 } } }),
        fx: [{ type: 'ripple', x: EQ.xs[1], y: 490, color: C.data, at: 1300 }] },
      { say: '分母是 Z。相除得到 0.7674（讲义图上写作 0.76）。', set: { fb: { opacity: { from: 1, to: 0, dur: 150, delay: 800 }, x: { from: 790, to: EQ.xs[3], dur: 800, delay: 0, ease: 'inOut' }, y: { from: R4, to: 490, dur: 800, delay: 0, ease: 'inOut' } }, q3: { text: { to: '193.40', delay: 800 } }, q5: { num: { to: 0.7674, dur: 700, delay: 1000 } } },
        fx: [{ type: 'ripple', x: EQ.xs[3], y: 490, color: C.warn, at: 800 }, { type: 'burst', obj: 'q5', color: C.ok, at: 1600 }] },
      { say: '对比：要是不加掩码，不合法的 t2（logit 4）会分到 21.7% 的概率。它很可能被采样出来，输出就坏了。', set: { ghost: fade(200) },
        fx: [{ type: 'flash', obj: 'm2', color: C.bad, at: 100 }, { type: 'shake', obj: 'z2', at: 300 }],
        log: [{ s: 'unmasked probs: [0.08, 0.0005, 0.2174, 0.5909, 0.012, 0.0977, 0.0, 0.0015]', at: 300 }] },
      { say: '从掩码后的分布里采样：这里最可能的是 t3（讲义第 34 页采到的也是 3）。然后推进文法状态，继续下一个 token。', set: { pick: pop(200) },
        fx: [{ type: 'burst', obj: 'b3', color: C.ok, at: 300 }], log: [{ s: 'argmax token index = 3', at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：长度用完 ---------------- */
  var GT = ['{"', 'city', '":"', 'Pitts', 'burgh', '"}'];
  var sc4 = {
    name: '长度用完', desc: '唯一的例外是生成长度用完了。这时还在合法路径上，只是没走到终止状态。于是输出半截 JSON（视频 34:36）。',
    bg: function (d) { title(d, '约束解码也救不了的情况：token 用完了'); d.text(60, 170, '已生成', { size: 12, weight: 700, color: C.fg3 }); },
    objects: function () {
      var ch = VZ.chips('g', GT, 0, 170, { left: 130, gap: 6, size: 13, h: 34, opacity: 0, fill: C.infoW, stroke: C.info });
      var o = ch.objs;
      o.g4.fill = C.neutralW; o.g4.stroke = C.neutral; o.g5.fill = C.neutralW; o.g5.stroke = C.neutral;
      o.bud = { type: 'box', x: 720, y: 100, w: 190, h: 36, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.5, text: '', num: 6, fmt: 'int', pre: '剩余 token 预算：', size: 13, weight: 750, opacity: 0 };
      o.so = { type: 'box', x: 300, y: 380, w: 150, h: 34, rx: 7, fill: C.infoW, stroke: C.info, sw: 1.5, text: 'object', size: 13, weight: 700, mono: true, opacity: 0 };
      o.ss = { type: 'box', x: 300, y: 340, w: 150, h: 34, rx: 7, fill: C.dataW, stroke: C.data, sw: 1.5, text: 'string', size: 13, weight: 700, mono: true, opacity: 0 };
      o.stk = { type: 'text', x: 300, y: 430, text: '栈里还有 2 层：没到终止状态', size: 12.5, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.out = { type: 'box', x: 620, y: 360, w: 280, h: 44, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.6, text: '{"city":"Pitts', size: 15, weight: 750, mono: true, opacity: 0 };
      o.outL = { type: 'text', x: 620, y: 410, text: '外壳拿到半截 JSON，解析失败', size: 12.5, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.fix = { type: 'box', x: 430, y: 490, w: 520, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, dasharray: '5 4', text: '思路：数着剩下的 token，提前把 "} 补上收尾（讲师说还没人实现）', size: 12.5, weight: 650, opacity: 0 };
      return o;
    },
    steps: [
      { say: '假设这次生成最多只剩 6 个 token（示意）。模型正在写一个 get_weather 的参数。', set: { bud: pop(0) } },
      { say: '每生成一个 token，文法状态往前推一步，预算减一。{" 和 city 出来了，栈里压进了 object。', set: { g0: pop(0), g1: pop(500), bud: { num: { to: 4, dur: 800, delay: 200 } }, so: pop(400) },
        fx: [{ type: 'ripple', obj: 'so', color: C.info, at: 600 }] },
      { say: '":" 和 Pitts：又进了一个字符串，栈里两层。', set: { g2: pop(0), g3: pop(500), bud: { num: { to: 2, dur: 800, delay: 200 } }, ss: pop(300) },
        fx: [{ type: 'ripple', obj: 'ss', color: C.data, at: 500 }] },
      { say: '可是还差 burgh 和 "}。两个 token 正好把预算用光。而且 "Pittsburgh" 其实要不止这几个 token（示意）。', set: { g4: fade(0, 300, 0.5), g5: fade(150, 300, 0.5), bud: { num: { to: 0, dur: 600, delay: 300 }, fill: { to: C.badW, dur: 300, delay: 600 }, stroke: { to: C.bad, dur: 300, delay: 600 } } },
        fx: [{ type: 'shake', obj: 'bud', at: 900 }] },
      { say: '生成在中途被截断。每一步都在合法路径上，可是没走到终止状态。栈里还有 2 层。', set: { g4: fade(0, 300, 0.12), g5: fade(0, 300, 0.12), stk: fade(300) },
        fx: [{ type: 'flash', obj: 'ss', color: C.bad, at: 200 }, { type: 'flash', obj: 'so', color: C.bad, at: 400 }] },
      { say: '外壳拿到的是半截 JSON：{"city":"Pitts。它解析不了。', set: { out: pop(0), outL: fade(500) }, fx: [{ type: 'shake', obj: 'out', at: 600 }] },
      { say: '理论上可以数着剩余 token 提前收尾。讲师说还没人这么做，开玩笑说欢迎当加分作业。', set: { fix: pop(0) } }
    ]
  };

  VZ.register({
    id: 'c1-grammar', title: '约束解码：文法、下推自动机与 token 掩码',
    sources: [{ t: '第 2 讲 27:09–35:19（约束解码）', u: YT + '1629' }, { t: '讲义 lecture-02 第 27–35 页', u: L2 },
      { t: 'JSON Schema 2020-12（校验规范）', u: 'https://json-schema.org/draft/2020-12/json-schema-validation.html' }],
    note: '场景 1 的两棵树照讲义第 30 页，schema 照第 29 页。控制台是本机用 jsonschema 实跑的结果。场景 2 的逐字符栈和控制台是本机实跑的。嵌套例子的最大深度 3 也是实算。场景 3 的 logits 和掩码照讲义第 34 页。每个指数、Z、概率都是本机实算的。讲义图上的 0.1 / 0.76 / 0.13 / 1e-3 是四舍五入后的近似。场景 4 的现象出自视频 34:36–35:19，token 预算和切法是示意。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

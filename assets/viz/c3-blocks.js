/* 03 · 第 5 讲 —— 经典规划：积木世界（讲义 lecture-05 第 13 页）
 * 场景 1：状态 = 谓词集合；场景 2：前提与效果（pick-up 照讲义原样，另外三个动作按同样写法补全）；
 * 场景 3：宽度优先搜索（BFS）找计划，树的形状、每层个数、展开数都是 本机验算脚本 第 1 部分实跑；
 * 场景 4：把搜到的 4 步计划执行一遍，每步的增删谓词是 verify.py 实跑输出。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = 'https://www.cmu-agents.com/slides/lecture-05-planning.pdf', YT = 'https://youtu.be/S8v-dR4s29M?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }

  /* ---------- 积木桌面 ---------- */
  var TY = 440, BW = 84, BH = 52, SX = [110, 215, 320, 425], HY = 120;
  var ONT = TY - BH / 2, ON2 = ONT - BH, HOLD = HY + 15 + BH / 2;
  var YEL = '#d4a017', YELW = 'rgba(212,160,23,0.16)';
  var BC = { blue: [C.dataW, C.data], orange: [C.warnW, C.warn], red: [C.badW, C.bad], yellow: [YELW, YEL] };
  function block(n, x, y, op) {
    return { type: 'box', x: x, y: y, w: BW, h: BH, rx: 6, fill: BC[n][0], stroke: BC[n][1], sw: 2, text: n, size: 13.5, weight: 700, mono: true, opacity: op == null ? 0 : op, trail: { n: 4, gap: 40 } };
  }
  function tableBg(d) {
    d.line(50, TY, 480, TY, { stroke: C.fg3, sw: 3 });
    d.text(265, TY + 22, '桌面', { anchor: 'middle', size: 12, color: C.fg3, weight: 700 });
  }
  function blocks(op) {
    return { bOrange: block('orange', SX[0], ONT, op), bBlue: block('blue', SX[0], ON2, op), bRed: block('red', SX[1], ONT, op), bYellow: block('yellow', SX[2], ONT, op),
      cable: { type: 'line', x1: SX[2], y1: 90, x2: SX[2], y2: HY - 15, stroke: C.fg3, sw: 2, opacity: op == null ? 0 : op },
      hand: { type: 'box', x: SX[2], y: HY, w: 100, h: 30, rx: 6, fill: C.bg3, stroke: C.fg3, sw: 1.6, text: '手（夹爪）', size: 12, weight: 700, opacity: op == null ? 0 : op } };
  }
  function handTo(x, delay, dur) {
    var d = delay || 0, u = dur || 700;
    return { hand: { x: { to: x, dur: u, delay: d, ease: 'inOut' } }, cable: { x1: { to: x, dur: u, delay: d, ease: 'inOut' }, x2: { to: x, dur: u, delay: d, ease: 'inOut' } } };
  }
  function mv(n, x, y, delay, dur) { var s = {}; s[n] = {}; if (x != null) s[n].x = { to: x, dur: dur || 700, delay: delay || 0, ease: 'inOut' }; if (y != null) s[n].y = { to: y, dur: dur || 700, delay: delay || 0, ease: 'inOut' }; return s; }

  /* ---------- 右边的谓词表：固定 13 行 ---------- */
  var PR = ['on(blue,orange)', 'on-table(orange)', 'on-table(red)', 'on-table(yellow)', 'clear(blue)', 'clear(red)', 'clear(yellow)', 'hand-empty',
    'holding(blue)', 'clear(orange)', 'on-table(blue)', 'holding(orange)', 'on(orange,blue)'];
  var PX = 690, RW = 236;
  function ry(i) { return 86 + i * 27; }
  function rows(initOp) {
    var o = {};
    PR.forEach(function (t, i) { o['r' + i] = { type: 'box', x: PX, y: ry(i), w: RW, h: 22, rx: 5, fill: C.dataW, stroke: C.data, sw: 1.2, text: t, size: 12, weight: 650, mono: true, opacity: i < 8 ? initOp : 0, trail: { n: 3, gap: 40 } }; });
    o.goal = { type: 'box', x: PX, y: 470, w: RW, h: 34, rx: 8, fill: C.bg, stroke: C.ok, sw: 1.6, dasharray: '5 4', text: '目标：on(orange,blue)', size: 13, weight: 700, mono: true, opacity: initOp };
    return o;
  }
  function rowsBg(d) { d.text(PX, 62, '状态 = 当前为真的谓词', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 }); }
  function on(i, delay) { var s = {}; s['r' + i] = { opacity: { to: 1, dur: 250, delay: delay || 0 }, fill: { from: C.okW, to: C.dataW, dur: 900, delay: (delay || 0) + 500 }, stroke: { from: C.ok, to: C.data, dur: 900, delay: (delay || 0) + 500 } }; return s; }
  function off(i, delay) { var s = {}; s['r' + i] = { fill: { to: C.badW, dur: 250, delay: delay || 0 }, stroke: { to: C.bad, dur: 250, delay: delay || 0 }, opacity: { to: 0.18, dur: 500, delay: (delay || 0) + 600 } }; return s; }
  function back(i, delay) { var s = {}; s['r' + i] = { opacity: { to: 1, dur: 250, delay: delay || 0 }, fill: { from: C.okW, to: C.dataW, dur: 900, delay: (delay || 0) + 500 }, stroke: { from: C.ok, to: C.data, dur: 900, delay: (delay || 0) + 500 } }; return s; }
  function chk(i, at, good) { return { type: good ? 'pulse' : 'flash', obj: 'r' + i, color: good ? C.ok : C.bad, at: at }; }

  /* ---------------- 场景 1：状态是谓词集合 ---------------- */
  var CODE1 = { lang: 'py', title: '本机实跑的代码（初始状态与目标）', src:
'# 讲义第 13 页：on(blue, orange)\n' +
'#   clear(red, blue, yellow)\n' +
'INIT = {("on", "blue", "orange"),\n' +
'        ("on-table", "orange"),\n' +
'        ("on-table", "red"),\n' +
'        ("on-table", "yellow"),\n' +
'        ("clear", "red"), ("clear", "blue"),\n' +
'        ("clear", "yellow"),\n' +
'        ("hand-empty",)}\n' +
'GOAL = {("on", "orange", "blue")}\n' +
'done = GOAL <= state    # 目标是子集\n' };
  function flyIn(i, fx, fy, delay) { var s = {}; s['r' + i] = { opacity: { to: 1, dur: 200, delay: delay }, x: { from: fx, to: PX, dur: 850, delay: delay, ease: 'inOut' }, y: { from: fy, to: ry(i), dur: 850, delay: delay, ease: 'inOut' } }; return s; }
  var sc1 = {
    name: '状态与谓词', desc: '经典规划把世界写成一组谓词。哪块在哪块上、哪块在桌上、哪块顶上空着、手里有没有东西。',
    code: CODE1, dataTitle: '状态', data: { '为真的谓词': 0, '目标满足': '无' },
    bg: function (d) { title(d, '状态 = 谓词的集合（讲义第 13 页）'); tableBg(d); rowsBg(d); },
    objects: function () { return mix(blocks(0), rows(0)); },
    steps: [
      { say: '桌上四块积木：blue 叠在 orange 上，red 和 yellow 各自放在桌上。上面一只夹爪，现在空着。',
        set: { bOrange: pop(0), bBlue: pop(150), bRed: pop(300), bYellow: pop(450), cable: fade(600), hand: pop(650) } },
      { say: 'on(x, y)：x 压在 y 上。只有一条：on(blue, orange)。',
        set: flyIn(0, SX[0], ONT - BH / 2, 0), hl: [3], fx: [{ type: 'ripple', x: SX[0], y: ONT - BH / 2, color: C.data, at: 0 }],
        data: { '为真的谓词': { v: 1, at: 850 } } },
      { say: 'on-table(x)：x 直接放在桌上。orange、red、yellow 三块（讲义没写出来，是隐含的）。',
        set: join(flyIn(1, SX[0], TY, 0), flyIn(2, SX[1], TY, 150), flyIn(3, SX[2], TY, 300)), hl: [4, 5, 6],
        fx: [{ type: 'ripple', x: SX[0], y: TY, color: C.data, at: 0 }, { type: 'ripple', x: SX[1], y: TY, color: C.data, at: 150 }, { type: 'ripple', x: SX[2], y: TY, color: C.data, at: 300 }],
        data: { '为真的谓词': { v: 4, at: 1150 } } },
      { say: 'clear(x)：x 顶上没压东西。red、blue、yellow 三块是 clear。orange 被 blue 压着，所以不是。',
        set: join(flyIn(4, SX[0], ON2 - BH / 2, 0), flyIn(5, SX[1], ONT - BH / 2, 150), flyIn(6, SX[2], ONT - BH / 2, 300)), hl: [7, 8],
        fx: [{ type: 'flash', obj: 'bOrange', color: C.bad, at: 900 }],
        data: { '为真的谓词': { v: 7, at: 1150 } } },
      { say: 'hand-empty：夹爪空着。到这里一共 8 个为真的谓词，它们合起来就是"状态"。',
        set: flyIn(7, SX[2], HY, 0), hl: [9], fx: [{ type: 'pulse', obj: 'hand', color: C.data, at: 0 }],
        data: { '为真的谓词': { v: 8, at: 850 } } },
      { say: '目标也写成谓词：on(orange, blue)，要把 orange 叠到 blue 上。正好和现在反过来。',
        set: { goal: pop(0) }, hl: [10], fx: [{ type: 'pulse', obj: 'goal', color: C.ok, at: 400 }] },
      { say: '判断目标是否达成，就看目标里的谓词是不是全在状态里。也就是子集关系。现在不在。',
        hl: [11], fx: [{ type: 'flash', obj: 'goal', color: C.bad, at: 300 }],
        log: [{ s: '初始状态 8 个谓词: clear(blue) clear(red) clear(yellow) hand-empty on(blue,orange) on-table(orange) on-table(red) on-table(yellow)', at: 200 }],
        data: { '目标满足': { v: 'False', at: 300 } } }
    ]
  };

  /* ---------------- 场景 2：前提与效果 ---------------- */
  var CODE2 = { lang: 'py', title: '本机实跑的代码（动作，节选）', src:
'# pick-up 照讲义第 13 页原样\n' +
'("pick-up(x)",\n' +
' pre=[("on-table",x), ("clear",x),\n' +
'      ("hand-empty",)],\n' +
' add=[("holding",x)],\n' +
' dele=[("on-table",x), ("hand-empty",)])\n' +
'("unstack(x, y)",\n' +
' pre=[("on",x,y), ("clear",x),\n' +
'      ("hand-empty",)],\n' +
' add=[("holding",x), ("clear",y)],\n' +
' dele=[("on",x,y), ("hand-empty",)])\n' +
'def applicable(s):\n' +
'    return [a for a in actions(s)\n' +
'            if all(p in s for p in a.pre)]\n' +
'def apply(s, a):\n' +
'    return (s - set(a.dele)) | set(a.add)\n' };
  var RULE_Y = 506;
  var sc2 = {
    name: '前提与效果', desc: '动作有前提（执行前必须为真的谓词）和效果（加哪些、删哪些）。前提不满足的动作不能做。',
    code: CODE2, dataTitle: '检查', data: { '动作': '无', '前提成立': '无', '为真的谓词': 8 },
    bg: function (d) { title(d, '动作 = 前提 + 效果'); tableBg(d); rowsBg(d); },
    objects: function () {
      var o = mix(blocks(1), rows(1));
      o.rule = { type: 'box', x: 265, y: RULE_Y, w: 430, h: 40, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.5, text: 'pick-up(x)：on-table(x) ∧ clear(x) ∧ hand-empty', sub: '→ holding(x) ∧ ¬on-table(x) ∧ ¬hand-empty', size: 12, subSize: 11.5, weight: 700, mono: true, opacity: 0 };
      o.try1 = { type: 'box', x: 265, y: 64, w: 170, h: 28, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.5, text: 'pick-up(orange)', size: 12.5, weight: 700, mono: true, opacity: 0 };
      o.x1 = { type: 'text', x: 360, y: 69, text: '不能做', size: 13, weight: 700, color: C.bad, anchor: 'start', opacity: 0 };
      o.a0 = { type: 'box', x: 300, y: 64, w: 206, h: 28, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.5, text: 'unstack(blue, orange)', size: 12, weight: 700, mono: true, opacity: 0 };
      o.a1 = { type: 'box', x: 300, y: 64, w: 130, h: 28, rx: 6, fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: 'pick-up(red)', size: 12, weight: 650, mono: true, opacity: 0 };
      o.a2 = { type: 'box', x: 300, y: 64, w: 150, h: 28, rx: 6, fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: 'pick-up(yellow)', size: 12, weight: 650, mono: true, opacity: 0 };
      return o;
    },
    steps: [
      { say: '讲义给的 pick-up(x)：桌上、顶上空、手空，三条都成立才能拿。拿起后手里有 x，x 不在桌上，手不空。',
        set: { rule: pop(0) }, hl: [1, 2, 3, 4, 5, 6], data: { '动作': 'pick-up(x)' } },
      { say: '想直接拿 orange（目标是把它叠上去）：逐条查前提。',
        set: { try1: pop(0) }, hl: [12, 13, 14], fx: [chk(1, 500, true), chk(7, 800, true)], data: { '动作': 'pick-up(orange)' } },
      { say: 'clear(orange) 不在状态里，因为 blue 还压着它。前提不成立，这个动作不能做。',
        set: { x1: fade(300) }, hl: [14], fx: [{ type: 'shake', obj: 'bOrange', at: 200 }, { type: 'flash', obj: 'bBlue', color: C.bad, at: 400 }, { type: 'shake', obj: 'try1', at: 400 }],
        log: [{ s: "pick-up(orange): 前提不成立，缺 [('clear', 'orange')]", at: 300 }], data: { '前提成立': { v: 'False', at: 300 } } },
      { say: '把 32 个动作实例逐个查一遍，现在前提成立的只有 3 个。',
        set: { try1: fade(0, 300, 0), x1: fade(0, 300, 0), a0: mix(pop(300), { x: { to: 140, dur: 600, delay: 300, ease: 'out' } }), a1: mix(pop(450), { x: { to: 316, dur: 600, delay: 450, ease: 'out' } }), a2: mix(pop(600), { x: { to: 470, dur: 600, delay: 600, ease: 'out' } }) },
        hl: [12, 13, 14], log: [{ s: '所有动作实例个数: 32', at: 200 }, { s: "初始状态下前提成立的动作: ['unstack(blue, orange)', 'pick-up(red)', 'pick-up(yellow)']", at: 700 }],
        data: { '动作': '无', '前提成立': '无' } },
      { say: '选 unstack(blue, orange)：on(blue,orange)、clear(blue)、hand-empty 三条前提都在。',
        set: { a1: fade(0, 300, 0.3), a2: fade(0, 300, 0.3), rule: { text: { to: 'unstack(x,y)：on(x,y) ∧ clear(x) ∧ hand-empty', delay: 200 }, sub: { to: '→ holding(x) ∧ clear(y) ∧ ¬on(x,y) ∧ ¬hand-empty', delay: 200 } } },
        hl: [7, 8, 9], fx: [chk(0, 300, true), chk(4, 550, true), chk(7, 800, true)], data: { '动作': 'unstack(blue,orange)', '前提成立': { v: 'True', at: 900 } } },
      { say: '执行：夹爪移到 orange 上方，把 blue 取走。',
        set: join(handTo(SX[0], 0, 700), mv('bBlue', null, HOLD, 750, 600)), fx: [{ type: 'ripple', obj: 'hand', color: C.warn, at: 1350 }] },
      { say: '效果：删掉 on(blue,orange)、hand-empty。加上 holding(blue)、clear(orange)。新状态还是 8 个谓词。',
        set: join(off(0, 0), off(7, 150), on(8, 500), on(9, 650)), hl: [10, 11, 16],
        fx: [{ type: 'burst', obj: 'bOrange', color: C.ok, at: 700 }], data: { '为真的谓词': { v: 8, at: 900 } } },
      { say: '有效的动作序列，每一步的前提都在上一步的状态里成立。规划就是在这些序列里，搜一条走到目标的。',
        fx: [{ type: 'pulse', obj: 'goal', color: C.ok, at: 200 }] }
    ]
  };

  /* ---------------- 场景 3：BFS 搜计划 ---------------- */
  var PAR = [[null], [0, 0, 0], [0, 0, 0, 1, 1, 2, 2], [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6], [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10]];
  var LY = [96, 182, 268, 354, 440], SP = [0, 120, 70, 48, 27], TCX = 540;
  function nx(d, i) { return TCX + (i - (PAR[d].length - 1) / 2) * SP[d]; }
  var PLAN = ['unstack(blue, orange)', 'put-down(blue)', 'pick-up(orange)', 'stack(orange, blue)'];
  var CODE3 = { lang: 'py', title: '本机实跑的代码（BFS，节选）', src:
'q = deque([(INIT, [])])\n' +
'seen = {INIT}\n' +
'while q:\n' +
'    s, plan = q.popleft()\n' +
'    if GOAL <= s:\n' +
'        return plan          # 最短计划\n' +
'    expanded += 1\n' +
'    for a in applicable(s):\n' +
'        t = apply(s, a)\n' +
'        if t not in seen:    # 见过就跳过\n' +
'            seen.add(t)\n' +
'            q.append((t, plan + [a.name]))\n' };
  function layerOn(d, d0) {
    var s = {};
    PAR[d].forEach(function (p, i) { s['n' + d + '_' + i] = pop(d0 + 350 + i * 25); s['e' + d + '_' + i] = { dash: { to: 1, dur: 400, delay: d0 + i * 25 } }; });
    return s;
  }
  function layerFx(d, at) {
    var f = [];
    PAR[d].forEach(function (p, i) { if (i % 2 === 0 || PAR[d].length < 8) f.push({ type: 'stream', path: 'e' + d + '_' + i, n: 2, gap: 120, dur: 500, at: at + i * 25, color: C.info }); });
    return f;
  }
  var sc3 = {
    name: 'BFS 搜计划', desc: '规划是一个搜索问题。从初始状态出发，一层层试所有前提成立的动作。见过的状态跳过，直到某个状态满足目标。',
    code: CODE3, dataTitle: 'BFS', data: { '层': 0, '本层新状态': 0, '已展开': 0, '已生成': 1 },
    bg: function (d) {
      title(d, '宽度优先搜索：一层一层往下找');
      for (var k = 0; k < 5; k++) d.text(44, LY[k] + 4, '第 ' + k + ' 层', { size: 11.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      for (var d = 1; d < 5; d++) PAR[d].forEach(function (p, i) {
        o['e' + d + '_' + i] = { type: 'path', d: 'M' + nx(d - 1, p) + ',' + (LY[d - 1] + 8) + ' L' + nx(d, i) + ',' + (LY[d] - 8), stroke: C.line, sw: 1.2, dash: 0 };
      });
      for (d = 1; d < 5; d++) o['pp' + d] = { type: 'path', d: 'M' + nx(d - 1, 0) + ',' + (LY[d - 1] + 8) + ' L' + nx(d, 0) + ',' + (LY[d] - 8), stroke: C.ok, sw: 3, flow: 0, opacity: 0, arrow: 'ok' };
      for (d = 0; d < 5; d++) PAR[d].forEach(function (p, i) {
        o['n' + d + '_' + i] = { type: 'circle', x: nx(d, i), y: LY[d], r: d === 4 ? 8 : 9, fill: C.infoW, stroke: C.info, sw: 1.4, opacity: 0 };
      });
      o.rootL = { type: 'text', x: TCX + 18, y: LY[0] + 4, text: '初始状态（8 个谓词）', size: 12, weight: 700, color: C.fg2, anchor: 'start', opacity: 0 };
      for (d = 1; d < 5; d++) o['pl' + d] = { type: 'text', x: nx(d, 0) - 16, y: LY[d] + 4, text: PLAN[d - 1], size: 11.5, weight: 700, mono: true, color: C.ok, anchor: 'end', opacity: 0 };
      o.goalL = { type: 'box', x: 205, y: 500, w: 230, h: 32, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.5, text: '满足 on(orange, blue)', size: 12.5, weight: 700, opacity: 0 };
      o.cnt = { type: 'box', x: 620, y: 500, w: 330, h: 32, rx: 8, fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: '展开 22 个，可达状态共 125 个', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '根结点是初始状态。队列里只有它。', set: { n0_0: pop(0), rootL: fade(200) }, hl: [1, 2] },
      { say: '展开根：前提成立的 3 个动作各生成一个新状态，放进队列。', set: layerOn(1, 0), fx: layerFx(1, 0), hl: [4, 8, 9, 10, 11, 12],
        log: [{ s: "初始状态下前提成立的动作: ['unstack(blue, orange)', 'pick-up(red)', 'pick-up(yellow)']", at: 300 }],
        data: { '层': 1, '本层新状态': { v: 3, at: 500 }, '已展开': { v: 1, at: 300 }, '已生成': { v: 4, at: 500 } } },
      { say: '展开第 1 层的 3 个状态，得到 7 个新状态。比如手里拿着 blue 时做 stack(blue, orange)，会回到初始状态。见过了，跳过。',
        set: layerOn(2, 0), fx: layerFx(2, 0), hl: [10],
        data: { '层': 2, '本层新状态': { v: 7, at: 500 }, '已展开': { v: 4, at: 300 }, '已生成': { v: 11, at: 600 } } },
      { say: '展开第 2 层的 7 个：11 个新状态。',
        set: layerOn(3, 0), fx: layerFx(3, 0), hl: [8, 9, 10, 11, 12],
        data: { '层': 3, '本层新状态': { v: 11, at: 500 }, '已展开': { v: 11, at: 300 }, '已生成': { v: 22, at: 700 } } },
      { say: '展开第 3 层的 11 个：21 个新状态。',
        set: layerOn(4, 0), fx: layerFx(4, 0), hl: [8, 9, 10, 11, 12],
        log: [{ s: '每一层新生成的状态数: {1: 3, 2: 7, 3: 11, 4: 21}', at: 700 }],
        data: { '层': 4, '本层新状态': { v: 21, at: 600 }, '已展开': { v: 22, at: 300 }, '已生成': { v: 43, at: 900 } } },
      { say: '队列轮到第 4 层的第一个状态：目标谓词在里面，搜索停下。',
        set: { n4_0: { fill: { to: C.okW, dur: 300 }, stroke: { to: C.ok, dur: 300 }, r: { to: 12, dur: 400, ease: 'back' } }, goalL: pop(400) },
        fx: [{ type: 'burst', obj: 'n4_0', color: C.ok, at: 300 }], hl: [4, 5],
        log: [{ s: 'BFS 展开的状态数: 22  生成过的不同状态数: 43', at: 300 }] },
      { say: '沿父结点倒回去，就是计划：unstack → put-down → pick-up → stack，和讲义第 13 页那条一样。',
        set: join(
          { pp1: { opacity: { to: 1, dur: 200 }, flow: { to: 1, dur: 300 } }, pp2: { opacity: { to: 1, dur: 200, delay: 300 }, flow: { to: 1, dur: 300, delay: 300 } }, pp3: { opacity: { to: 1, dur: 200, delay: 600 }, flow: { to: 1, dur: 300, delay: 600 } }, pp4: { opacity: { to: 1, dur: 200, delay: 900 }, flow: { to: 1, dur: 300, delay: 900 } } },
          { pl1: fade(200), pl2: fade(500), pl3: fade(800), pl4: fade(1100) }),
        fx: [{ type: 'stream', path: 'pp1', n: 3, gap: 120, dur: 500, at: 0, color: C.ok }, { type: 'stream', path: 'pp2', n: 3, gap: 120, dur: 500, at: 300, color: C.ok }, { type: 'stream', path: 'pp3', n: 3, gap: 120, dur: 500, at: 600, color: C.ok }, { type: 'stream', path: 'pp4', n: 3, gap: 120, dur: 500, at: 900, color: C.ok }],
        hl: [5], log: [{ s: "找到的最短计划（4 步）: ['unstack(blue, orange)', 'put-down(blue)', 'pick-up(orange)', 'stack(orange, blue)']", at: 600 }] },
      { say: '宽度优先保证找到的是最短计划。只有 4 块积木，可达状态就有 125 个。东西一多，状态数会爆炸。',
        set: { cnt: pop(0) }, log: [{ s: '从初始状态可达的状态总数: 125', at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：执行计划 ---------------- */
  var CODE4 = { lang: 'py', title: '本机实跑的代码（逐步执行）', src:
'plan = ["unstack(blue, orange)",\n' +
'        "put-down(blue)",\n' +
'        "pick-up(orange)",\n' +
'        "stack(orange, blue)"]\n' +
's = INIT\n' +
'for name in plan:\n' +
'    a = ACTIONS[name]\n' +
'    assert all(p in s for p in a.pre)\n' +
'    s = (s - set(a.dele)) | set(a.add)\n' +
'print(GOAL <= s)\n' };
  var PCX = [115, 257, 378, 515], PCW = [158, 110, 116, 142];
  function pchip(i) { return { type: 'box', x: PCX[i], y: 506, w: PCW[i], h: 28, rx: 6, fill: C.neutralW, stroke: C.neutral, sw: 1.3, text: PLAN[i], size: 11.5, weight: 700, mono: true, opacity: 0 }; }
  function act(i) { var s = {}; s['p' + i] = { fill: { to: C.warnW, dur: 250 }, stroke: { to: C.warn, dur: 250 } }; if (i > 0) s['p' + (i - 1)] = { fill: { to: C.okW, dur: 250 }, stroke: { to: C.ok, dur: 250 } }; return s; }
  var LOG4 = [
    "unstack(blue, orange) 前提成立=True  +['holding', 'clear'] -['on', 'hand-empty']",
    "put-down(blue)       前提成立=True  +['on-table', 'hand-empty'] -['holding']",
    "pick-up(orange)      前提成立=True  +['holding'] -['on-table', 'hand-empty']",
    "stack(orange, blue)  前提成立=True  +['on', 'hand-empty'] -['holding', 'clear']"];
  var sc4 = {
    name: '执行计划', desc: '照着计划一步步做。每步先查前提，再按效果增删谓词。四步之后 on(orange, blue) 为真。',
    code: CODE4, dataTitle: '执行', data: { '第几步': 0, '手里': '空', '目标满足': 'False' },
    bg: function (d) { title(d, '执行这条 4 步的计划'); tableBg(d); rowsBg(d); },
    objects: function () {
      var o = mix(blocks(1), rows(1));
      o.p0 = pchip(0); o.p1 = pchip(1); o.p2 = pchip(2); o.p3 = pchip(3);
      return o;
    },
    steps: [
      { say: '计划就是一串动作。先把它们排在下面。', set: { p0: pop(0), p1: pop(150), p2: pop(300), p3: pop(450) }, hl: [1, 2, 3, 4] },
      { say: '第 1 步 unstack(blue, orange)：前提都在。夹爪移过去，取走 blue。',
        set: join(act(0), handTo(SX[0], 200, 700), mv('bBlue', null, HOLD, 950, 600), off(0, 1600), off(7, 1700), on(8, 1900), on(9, 2000)),
        fx: [chk(0, 0, true), chk(4, 100, true), chk(7, 200, true)], hl: [6, 7, 8, 9], log: [{ s: LOG4[0], at: 1600 }],
        data: { '第几步': 1, '手里': { v: 'blue', at: 1500 } } },
      { say: '第 2 步 put-down(blue)：把 blue 放到桌上空着的位置。',
        set: join(act(1), handTo(SX[3], 200, 800), mv('bBlue', SX[3], null, 200, 800), mv('bBlue', null, ONT, 1050, 500), off(8, 1600), on(10, 1800), back(7, 1900)),
        fx: [chk(8, 0, true), { type: 'ripple', x: SX[3], y: TY, color: C.data, at: 1550 }], hl: [6, 7, 8, 9], log: [{ s: LOG4[1], at: 1600 }],
        data: { '第几步': 2, '手里': { v: '空', at: 1500 } } },
      { say: '第 3 步 pick-up(orange)：现在 orange 顶上空了，三条前提都成立，拿起来。',
        set: join(act(2), handTo(SX[0], 200, 800), mv('bOrange', null, HOLD, 1050, 600), off(1, 1700), off(7, 1800), on(11, 2000)),
        fx: [chk(1, 0, true), chk(9, 100, true), chk(7, 200, true)], hl: [6, 7, 8, 9], log: [{ s: LOG4[2], at: 1700 }],
        data: { '第几步': 3, '手里': { v: 'orange', at: 1600 } } },
      { say: '第 4 步 stack(orange, blue)：带着 orange 移到 blue 上方，放下。',
        set: join(act(3), handTo(SX[3], 200, 800), mv('bOrange', SX[3], null, 200, 800), mv('bOrange', null, ON2, 1050, 500), off(11, 1600), off(4, 1700), on(12, 1900), back(7, 2000)),
        fx: [chk(11, 0, true), chk(4, 100, true)], hl: [6, 7, 8, 9], log: [{ s: LOG4[3], at: 1600 }],
        data: { '第几步': 4, '手里': { v: '空', at: 1500 } } },
      { say: 'on(orange, blue) 进了状态集合：目标满足。每一步前提都成立，所以这是一条有效计划。',
        set: { p3: { fill: { to: C.okW, dur: 250 }, stroke: { to: C.ok, dur: 250 } }, goal: { fill: { to: C.okW, dur: 300, delay: 200 } } },
        fx: [{ type: 'burst', obj: 'goal', color: C.ok, at: 300 }, { type: 'pulse', obj: 'r12', color: C.ok, at: 100 }], hl: [10],
        log: [{ s: '目标 on(orange, blue) 成立: True', at: 300 }], data: { '目标满足': { v: 'True', at: 300 } } }
    ]
  };

  VZ.register({
    id: 'c3-blocks', title: '经典规划：积木世界里的谓词、前提、效果和搜索',
    sources: [{ t: '第 5 讲 24:49–30:24（经典规划、难点变了）', u: YT + '1489' }, { t: '讲义 lecture-05 第 13–14 页', u: PDF }],
    note: '谓词、四个动作名、pick-up 的前提和效果都照讲义第 13 页。初始状态 on(blue, orange) · clear(red, blue, yellow) 也是。目标 on(orange, blue) 和 4 步计划同样照讲义。讲义只写出了 pick-up 的前提和效果。另外三个动作是按同样写法补全的。orange、red、yellow 在桌上，是讲义隐含的。控制台和 BFS 树的形状都是本机实跑的结果。每层 3 / 7 / 11 / 21 个新状态，展开 22 个、生成 43 个。可达状态一共 125 个。',
    legend: [[C.data, '谓词（状态里为真）'], [C.warn, '当前动作'], [C.ok, '成立 / 新加入 / 计划路径'], [C.bad, '不成立 / 被删除'], [C.info, '搜索里的状态'], [C.neutral, '没选的动作']],
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

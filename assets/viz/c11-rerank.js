/* 11 · 第 20 讲（11/12，没有讲义和录像，按本课已有材料预写）：重排序与评判模型
 * 依据：第 6 讲讲义第 16、26、50 页（重排序、pass@k、学出来的验证器），第 11 讲讲义第 12–17 页（价值函数、评论家、PRM），
 * 第 5 讲讲义第 22、24 页。四个场景里所有控制台输出和数据面板的数，都由 本机验算脚本 和
 * verify-rerank-panels.py 真跑得到。候选表达式、p = 0.3、噪声 1.0 / 0.3 是示意。第 11 讲讲义里的 10 次结果、0.6 / 0.4 等价值照抄讲义。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L06 = 'https://www.cmu-agents.com/slides/lecture-06-coding-agents.pdf', L11 = 'https://www.cmu-agents.com/slides/lecture-11-rl-advanced.pdf';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: 0 }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function off(n, d0) { var s = {}; s[n] = { opacity: { to: 0.25, dur: 300, delay: d0 || 0 }, flow: { to: 0, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function recolor(k, d0) { return { fill: { to: C[k + 'W'], dur: 300, delay: d0 || 0 }, stroke: { to: C[k], dur: 300, delay: d0 || 0 } }; }

  /* ---------------- 场景 1：采 N 挑一 ---------------- */
  var CANDS = ['x > 0', 'x >= 0', 'bool(x)', 'x < 0'], SCORE = [3, 2, 2, 1];
  var CY = [140, 205, 270, 335], CX = 395, VX = 610, VY = 238;
  var CODE0 = { lang: 'py', title: '本机实跑（候选是示意）', src:
'cands = ["x > 0", "x >= 0", "bool(x)", "x < 0"]\n' +
'tests = [(1, True), (0, False), (-2, False)]\n' +
'def score(c):\n' +
'    f = eval("lambda x: " + c)\n' +
'    return sum(f(x) == y for x, y in tests)\n' +
'best = max(cands, key=score)\n' +
'print(best, [score(c) for c in cands])\n' };
  function scoreStep(i, d0) {
    var s = join(on('v' + i, d0), {}), k = SCORE[i] === 3 ? 'ok' : SCORE[i] === 1 ? 'bad' : 'warn';
    s['c' + i] = mix(recolor(k, d0 + 900), { sub: { to: '过 ' + SCORE[i] + ' / 3 个测试', delay: d0 + 800 } });
    return s;
  }
  var sc1 = {
    name: '采 N 挑一', desc: '同一个空让策略采 4 个候选。验证器给每个跑 3 个测试，挑分最高的。模型一点不改，只多花推理的算力（第 6 讲讲义第 16、26 页的做法，候选是示意）。',
    code: CODE0, dataTitle: '这一题（示意）', data: { '候选数 N': 0, '最高分': 0 },
    bg: function (d) { title(d, '采 4 个候选，跑测试打分，挑最高的（示意）'); },
    objects: function () {
      var o = {};
      o.task = { type: 'box', x: 130, y: 100, w: 190, h: 56, rx: 9, fill: C.dataW, stroke: C.data, sw: 1.4, text: 'def is_positive(x):', sub: 'return ___', subMono: true, subSize: 12, size: 12.5, weight: 750, mono: true, opacity: 0 };
      o.pol = { type: 'box', x: 130, y: 238, w: 170, h: 64, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '策略模型', sub: '同一个空采 4 次', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.ver = { type: 'box', x: VX, y: VY, w: 150, h: 64, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.6, text: '验证器', sub: '跑 3 个测试', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      [['1 → True', 0], ['0 → False', 1], ['-2 → False', 2]].forEach(function (t, i) {
        o['t' + i] = { type: 'box', x: 760, y: 190 + i * 48, w: 110, h: 32, rx: 6, fill: C.bg2, stroke: C.line, sw: 1.2, text: t[0], size: 11.5, weight: 700, mono: true, opacity: 0 };
      });
      CANDS.forEach(function (c, i) {
        o['w' + i] = wire('M216,238 C270,238 270,' + CY[i] + ' ' + (CX - 66) + ',' + CY[i], C.info);
        o['v' + i] = wire('M' + (CX + 62) + ',' + CY[i] + ' C' + (CX + 110) + ',' + CY[i] + ' ' + (VX - 120) + ',' + VY + ' ' + (VX - 78) + ',' + VY, C.warn);
      });
      CANDS.forEach(function (c, i) {
        o['c' + i] = { type: 'box', x: 130, y: 238, w: 124, h: 48, rx: 7, fill: C.dataW, stroke: C.data, sw: 1.4, text: c, sub: '', subMono: false, subSize: 11, size: 13, weight: 750, mono: true, opacity: 0 };
      });
      o.outw = wire('M' + VX + ',' + (VY + 34) + ' L' + VX + ',' + (VY + 128), C.ok);
      o.out = { type: 'box', x: VX, y: VY + 160, w: 210, h: 50, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.6, text: '交出：x > 0', size: 13.5, weight: 800, mono: false, opacity: 0 };
      o.one = { type: 'box', x: 300, y: 450, w: 330, h: 50, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.3, dasharray: '5 4', text: '只采 1 个：4 个里有 3 个是错的', size: 12, weight: 750, opacity: 0 };
      o.orc = { type: 'box', x: 430, y: 520, w: 760, h: 36, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '神谕重排序：只要 N 个里有一个对就算对（pass@N）。这是"挑"能达到的上限', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '任务（示意）：给 is_positive 填一个返回表达式。打分器是右边 3 个测试。', set: { task: pop(0), t0: pop(300), t1: pop(400), t2: pop(500) } },
      (function () { var s = join({ pol: pop(0) }, on('w0', 300), on('w1', 300), on('w2', 300), on('w3', 300)); CANDS.forEach(function (c, i) { s['c' + i] = { opacity: { to: 1, dur: 200, delay: 400 + i * 150 }, x: { to: CX, dur: 800, delay: 400 + i * 150, ease: 'inOut' }, y: { to: CY[i], dur: 800, delay: 400 + i * 150, ease: 'inOut' } }; });
        return { say: '策略模型对同一个空采样 4 次，得到 4 个候选。模型的参数一点不改。', set: s, fx: [st('w0', 300, C.info, 3), st('w1', 450, C.info, 3), st('w2', 600, C.info, 3), st('w3', 750, C.info, 3)], data: { '候选数 N': { v: 4, at: 500 } }, hl: [1] }; })(),
      { say: '候选 x > 0 送进验证器。三个测试全过，记 3 分。', set: join({ ver: pop(0) }, scoreStep(0, 200)), fx: [st('v0', 200, C.warn, 4), { type: 'pulse', obj: 'ver', color: C.warn, at: 700 }], hl: [3, 4, 5], log: [{ s: '>>> score("x > 0")', at: 300 }, { s: '3', at: 900 }] },
      { say: '候选 x >= 0：输入 0 时返回 True，错了一个，记 2 分。', set: scoreStep(1, 0), fx: [st('v1', 0, C.warn, 4)], hl: [4, 5], log: [{ s: '>>> score("x >= 0")', at: 100 }, { s: '2', at: 700 }] },
      { say: '候选 bool(x)：输入 -2 时也返回 True，记 2 分。', set: scoreStep(2, 0), fx: [st('v2', 0, C.warn, 4)], hl: [4, 5], log: [{ s: '>>> score("bool(x)")', at: 100 }, { s: '2', at: 700 }] },
      { say: '候选 x < 0：只过了输入 0 那一个，记 1 分。', set: scoreStep(3, 0), fx: [st('v3', 0, C.warn, 4), { type: 'shake', obj: 'c3', at: 900 }], hl: [4, 5], log: [{ s: '>>> score("x < 0")', at: 100 }, { s: '1', at: 700 }] },
      (function () { var s = join(on('outw', 0), { out: pop(500) }, off('v1'), off('v2'), off('v3'), off('v0')); [1, 2, 3].forEach(function (i) { s['c' + i] = { opacity: { to: 0.45, dur: 400, delay: 200 } }; });
        return { say: '按分数挑最高的。x > 0 被交出去，其余三个丢掉。', set: s, fx: [st('outw', 0, C.ok, 5), { type: 'burst', obj: 'out', color: C.ok, at: 900 }], data: { '最高分': { v: 3, at: 500 } }, hl: [6, 7], log: [{ s: 'x > 0 [3, 2, 2, 1]', at: 600 }] }; })(),
      { say: '换成只采 1 个：4 个候选里有 3 个是错的。多半会交错答案（示意）。', set: { one: pop(0) }, fx: [{ type: 'shake', obj: 'c1', at: 400 }, { type: 'shake', obj: 'c2', at: 600 }] },
      { say: '只要候选里有一个对就算对，这叫神谕重排序，是"挑"的上限。真打分器挑不挑得中，看下一段。', set: { orc: fade(0) } }
    ]
  };

  /* ---------------- 场景 2：打分器看走眼 ---------------- */
  var NS = [1, 2, 4, 8, 16], ORC = [0.300, 0.510, 0.760, 0.942, 0.997], N10 = [0.298, 0.416, 0.514, 0.616, 0.706], N03 = [0.298, 0.513, 0.747, 0.930, 0.993];
  var BX = [170, 300, 430, 560, 690], BASE = 470, SCL = 330;
  var CODE1 = { lang: 'py', title: '本机实跑（p 和噪声是示意）', src:
'random.seed(0)\n' +
'p, noise = 0.3, 1.0\n' +
'for N in [1, 2, 4, 8, 16]:\n' +
'    runs = [[random.random() < p\n' +
'             for _ in range(N)]\n' +
'            for _ in range(20000)]\n' +
'    best = [max(r, key=lambda c:\n' +
'                c + random.gauss(0, noise))\n' +
'            for r in runs]\n' +
'    print(N, round(1 - (1 - p) ** N, 3),\n' +
'          round(sum(best) / len(best), 3))\n' };
  function bars(i) {
    var s = {};
    s['bo' + i] = { opacity: { to: 1, dur: 100 }, h: { to: ORC[i] * SCL, dur: 700, ease: 'out' } };
    s['bn' + i] = { opacity: { to: 1, dur: 100, delay: 300 }, h: { to: N10[i] * SCL, dur: 700, delay: 300, ease: 'out' } };
    s['to' + i] = mix(fade(0), { y: { to: BASE - ORC[i] * SCL - 12, dur: 700, ease: 'out' }, num: { to: ORC[i], dur: 700 } });
    s['tn' + i] = mix(fade(300), { y: { to: BASE - N10[i] * SCL - 12, dur: 700, delay: 300, ease: 'out' }, num: { to: N10[i], dur: 700, delay: 300 } });
    s['lb' + i] = fade(0);
    return s;
  }
  var sc2 = {
    name: '打分器看走眼', desc: '候选越多，"至少一个对"越有把握，这是上限。可打分器带噪声时，真挑中的远低于上限。噪声小了，才贴着上限走（本机模拟，p = 0.3，各 20000 次，示意）。',
    code: CODE1, dataTitle: '本机模拟', data: { 'N': 0, '神谕上限': 0, '真挑中': 0, '噪声': 1.0 }, dataFmt: { '神谕上限': 'fixed3', '真挑中': 'fixed3', '噪声': 'fixed1' },
    bg: function (d) { title(d, '灰 = 神谕上限 pass@N，绿 = 带噪声的打分器真挑中的'); d.line(110, BASE, 760, BASE, { stroke: C.line, sw: 1.2 }); },
    objects: function () {
      var o = {};
      NS.forEach(function (n, i) {
        o['bo' + i] = { type: 'box', x: BX[i] - 22, y: BASE, w: 38, h: 0, rx: 3, anchor: 'bc', fill: C.neutral, stroke: 'none', opacity: 0 };
        o['bn' + i] = { type: 'box', x: BX[i] + 22, y: BASE, w: 38, h: 0, rx: 3, anchor: 'bc', fill: C.ok, stroke: 'none', opacity: 0 };
        o['to' + i] = { type: 'text', x: BX[i] - 22, y: BASE - 12, text: '', num: 0, fmt: 'fixed3', size: 11, weight: 800, mono: true, color: C.fg2, anchor: 'middle', opacity: 0 };
        o['tn' + i] = { type: 'text', x: BX[i] + 22, y: BASE - 12, text: '', num: 0, fmt: 'fixed3', size: 11, weight: 800, mono: true, color: C.ok, anchor: 'middle', opacity: 0 };
        o['lb' + i] = { type: 'text', x: BX[i], y: BASE + 22, text: 'N = ' + n, size: 12, weight: 750, color: C.fg2, anchor: 'middle', opacity: 0 };
      });
      o.set = { type: 'box', x: 250, y: 78, w: 300, h: 44, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.3, text: '每个候选做对的概率 p = 0.3', sub: '打分 = 对不对（1 或 0）+ 高斯噪声', subMono: false, subSize: 11, size: 12.5, weight: 750, opacity: 0 };
      o.gap = { type: 'box', x: 610, y: 78, w: 300, h: 44, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, text: 'N = 16：上限 0.997，真挑中 0.706', sub: '多采的好处，大半被噪声吃掉', subMono: false, subSize: 11, size: 12.5, weight: 750, opacity: 0 };
      o.fp = { type: 'box', x: 430, y: 522, w: 740, h: 32, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.2, dasharray: '5 4', text: '若每个候选有 5% 是骗过打分器的错解：N = 1 碰上 5.0%，N = 4 碰上 18.5%，N = 16 碰上 56.0%', size: 11.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '设定（示意）：每个候选做对的概率 0.3。打分器给的分 = 对不对 + 噪声，噪声大小 1.0。', set: { set: pop(0) }, hl: [2] },
      { say: 'N = 1：只有一个，没得挑。上限 0.300，真挑中 0.298（模拟误差）。', set: bars(0), hl: [3, 4, 5, 6, 7, 8, 9], data: { 'N': { v: 1, at: 300 }, '神谕上限': { v: 0.3, at: 400 }, '真挑中': { v: 0.298, at: 700 } }, log: [{ s: '1 0.3 0.298', at: 600 }] },
      { say: 'N = 2：上限 0.510，真挑中 0.416。', set: bars(1), hl: [10, 11], data: { 'N': { v: 2, at: 300 }, '神谕上限': { v: 0.51, at: 400 }, '真挑中': { v: 0.416, at: 700 } }, log: [{ s: '2 0.51 0.416', at: 600 }] },
      { say: 'N = 4：上限 0.760，真挑中 0.514。差距拉开了。', set: bars(2), hl: [10, 11], data: { 'N': { v: 4, at: 300 }, '神谕上限': { v: 0.76, at: 400 }, '真挑中': { v: 0.514, at: 700 } }, log: [{ s: '4 0.76 0.514', at: 600 }] },
      { say: 'N = 8：上限 0.942，真挑中 0.616。', set: bars(3), hl: [10, 11], data: { 'N': { v: 8, at: 300 }, '神谕上限': { v: 0.942, at: 400 }, '真挑中': { v: 0.616, at: 700 } }, log: [{ s: '8 0.942 0.616', at: 600 }] },
      { say: 'N = 16：上限几乎是 1，真挑中只有 0.706。多采只抬高了上限。', set: join(bars(4), { gap: pop(900) }), hl: [10, 11], data: { 'N': { v: 16, at: 300 }, '神谕上限': { v: 0.997, at: 400 }, '真挑中': { v: 0.706, at: 700 } }, log: [{ s: '16 0.997 0.706', at: 600 }] },
      (function () { var s = { gap: fade(0, 300, 0) }; NS.forEach(function (n, i) { s['bn' + i] = { h: { to: N03[i] * SCL, dur: 900, delay: 200 + i * 120, ease: 'inOut' } }; s['tn' + i] = { y: { to: BASE - N03[i] * SCL - 12, dur: 900, delay: 200 + i * 120, ease: 'inOut' }, num: { to: N03[i], dur: 900, delay: 200 + i * 120 } }; });
        return { say: '把噪声降到 0.3，打分器更准了。绿柱几乎追上灰柱，N = 16 时是 0.993（本机另算的）。', set: s, data: { '噪声': { v: 0.3, at: 300 }, '真挑中': { v: 0.993, at: 900 } }, hl: [2] }; })(),
      { say: '打分器准，多采才划算。第 6 讲讲义第 26 页也是这样。神谕重排序远高于按对数概率重排序。', fx: [{ type: 'pulse', obj: 'bo4', color: C.neutral, at: 200 }, { type: 'pulse', obj: 'bn4', color: C.ok, at: 500 }] },
      { say: '反过来，候选越多，越可能碰上一个骗过打分器的错解。数是本机算的，5% 是示意。', set: { fp: pop(0) }, fx: [{ type: 'shake', obj: 'fp', at: 600 }] }
    ]
  };

  /* ---------------- 场景 3：结果奖励 vs 过程奖励 ---------------- */
  var STEPS = ['设分子为 x', '分母是 3x − 7', 'x / (3x − 7) = 2/5', '5x = 2(3x − 7)', '5x = 6x − 14', '所以 x = 7'];
  var SY = [110, 167, 224, 281, 338, 395], SX = 230;
  var CODE2 = { lang: 'py', title: '本机实跑（只取写成等式的四步，代入真答案 14，示意）', src:
'steps = ["x/(3*x-7) == 2/5",\n' +
'         "5*x == 2*(3*x-7)",\n' +
'         "5*x == 6*x - 14",\n' +
'         "x == 7"]\n' +
'orm = eval(steps[-1], {"x": 14})\n' +
'prm = [eval(s, {"x": 14}) for s in steps]\n' +
'print(orm, prm)\n' };
  function mark(i, k, d0) { var s = {}; s['m' + i] = mix(pop(d0), { fill: { to: C[k + 'W'], dur: 1, delay: d0 }, stroke: { to: C[k], dur: 1, delay: d0 }, text: { to: k === 'ok' ? '对' : '错', delay: d0 } }); s['s' + i] = recolor(k, d0 + 200); return s; }
  var sc3 = {
    name: '结果奖励与过程奖励', desc: '结果奖励模型（ORM）只看最后的答案，给整条一个分。过程奖励模型（PRM）一步一步判，能指出错在哪一步。题目和标注来自第 11 讲讲义第 17 页。',
    code: CODE2, dataTitle: '这道题', data: { '结果奖励': '未判', '过程：判对的步数': 0 },
    bg: function (d) { title(d, '分母比分子的 3 倍少 7，分数等于 2/5，分子是多少？（答案 14）'); },
    objects: function () {
      var o = {};
      STEPS.forEach(function (t, i) {
        o['s' + i] = { type: 'box', x: SX, y: SY[i], w: 250, h: 40, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.3, text: t, size: 13, weight: 750, mono: i > 1, opacity: 0 };
        o['m' + i] = { type: 'circle', x: SX + 160, y: SY[i], r: 15, fill: C.neutralW, stroke: C.neutral, sw: 1.5, text: '', opacity: 0 };
      });
      o.ow = wire('M' + (SX + 182) + ',395 L526,395', C.warn);
      o.orm = { type: 'box', x: 620, y: 395, w: 180, h: 56, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '结果奖励模型', sub: '只看最后的答案', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.ov = { type: 'box', x: 772, y: 395, w: 100, h: 40, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.5, text: '整条 0 分', size: 13, weight: 800, opacity: 0 };
      o.prm = { type: 'box', x: 620, y: 200, w: 180, h: 56, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '过程奖励模型', sub: '每一步判对错', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.pw = wire('M526,200 C470,200 460,252 ' + (SX + 182) + ',252', C.info);
      o.note = { type: 'box', x: 430, y: 490, w: 760, h: 52, rx: 9, fill: C.bg2, stroke: C.line, sw: 1.2, text: '讲义：PRM 从人工标注里学每一步对不对，当"价值"的替身', sub: '代价是要人逐步标注，比只标结果贵得多', subMono: false, subSize: 11.5, size: 12.5, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; STEPS.forEach(function (t, i) { s['s' + i] = pop(i * 160); }); return { say: '模型写了六步，最后答 x = 7。真答案是 14。', set: s }; })(),
      { say: '结果奖励模型只看最后的答案。x = 7 不对，整条记 0 分。', set: join(on('ow', 0), { orm: pop(200), ov: pop(900) }, { s5: recolor('bad', 900) }), fx: [st('ow', 0, C.warn, 4), { type: 'shake', obj: 'ov', at: 1100 }], data: { '结果奖励': { v: 0, at: 900 } }, hl: [5] },
      (function () { var s = {}; STEPS.forEach(function (t, i) { s['s' + i] = { stroke: { to: C.bad, dur: 300, delay: i * 60 } }; }); return { say: '这个 0 分没说错在哪。前面写对的步骤，也跟着一起挨了 0 分。', set: s }; })(),
      (function () { var s = join(on('pw', 0), { prm: pop(0) }, mark(0, 'ok', 500), mark(1, 'ok', 700), mark(2, 'ok', 900)); return { say: '过程奖励模型逐步判。设未知数、写分母、列方程，三步都对。', set: s, fx: [st('pw', 0, C.info, 4)], data: { '过程：判对的步数': { v: 3, at: 900 } }, hl: [6] }; })(),
      { say: '去分母、展开，这两步也都对。', set: join(mark(3, 'ok', 0), mark(4, 'ok', 250)), data: { '过程：判对的步数': { v: 5, at: 400 } }, hl: [6] },
      { say: '最后一步：由 5x = 6x − 14 应得 x = 14，模型写成 x = 7。标注员把这一步标成错。', set: mark(5, 'bad', 0), fx: [{ type: 'shake', obj: 's5', at: 400 }], hl: [4, 6, 7], log: [{ s: 'False [True, True, True, False]', at: 600 }] },
      { say: '同一条轨迹，结果奖励只说"错了"。过程奖励说"错在最后一步，前面都对"。', fx: [{ type: 'pulse', obj: 'ov', color: C.bad, at: 100 }, { type: 'pulse', obj: 's5', color: C.bad, at: 500 }] },
      { say: '讲义把 PRM 看成价值的替身。它从人工标注里学每一步对不对。下一个场景讲真正的价值函数。', set: { note: fade(0) } }
    ]
  };

  /* ---------------- 场景 4：价值函数当评判 ---------------- */
  var OUT = [0, 1, 0, 0, 1, 0, 0, 0, 1, 0], OY = OUT.map(function (o, i) { return 82 + i * 30; });
  var CHAIN = [['h₃', 0.3], ['h₄', 0.6], ['h₅', 0.4], ['h₆', 0.0]], HX = [130, 300, 470, 640], HY = 470;
  var EQ = VZ.eq('q', ['V(h₃) ≈', { slot: 1, w: 36 }, '÷ 10 =', { num: 0, fmt: 'fixed2', k: 'ok', w: 64 }], 650, 110, { size: 14 });
  var CODE3 = { lang: 'py', title: '第 11 讲讲义第 12–15 页的数（本机实跑）', src:
'outcomes = [0, 1, 0, 0, 1, 0, 0, 0, 1, 0]\n' +
'V = sum(outcomes) / len(outcomes)\n' +
'mse = lambda v: round(sum((v - r) ** 2\n' +
'                for r in outcomes) / 10, 2)\n' +
'print(V, mse(0.6), mse(0.3))\n' +
'vals = [0.3, 0.6, 0.4, 0.0]  # h3..h6\n' +
'print([round(b - a, 1)\n' +
'       for a, b in zip(vals, vals[1:])])\n' };
  var sc4 = {
    name: '价值函数当评判', desc: '从同一个历史接着跑 10 次，3 次成功，价值估计就是 0.3。评论家用平方误差学会直接预测它。有了评论家，比较动作前后的价值，就能给每一步打分（第 11 讲讲义第 12–15 页）。',
    code: CODE3, dataTitle: '轨迹 B（讲义的示意数）', data: { '成功次数': 0, 'V(h₃)': 0, '平方误差': 0 }, dataFmt: { 'V(h₃)': 'fixed2', '平方误差': 'fixed2' },
    bg: function (d) { title(d, '评判模型 = 价值函数：从这儿往后，平均还能拿多少奖励'); },
    objects: function () {
      var o = {};
      o.h = { type: 'box', x: 110, y: 217, w: 130, h: 54, rx: 10, fill: C.dataW, stroke: C.data, sw: 1.5, text: '历史 h₃', sub: '轨迹 B 走到这里', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      OUT.forEach(function (r, i) {
        o['p' + i] = { type: 'path', d: 'M176,217 C260,217 290,' + OY[i] + ' 378,' + OY[i], stroke: C.info, sw: 1.4, flow: 0, flowColor: C.info, opacity: 0 };
        o['o' + i] = { type: 'circle', x: 396, y: OY[i], r: 12, fill: C.neutralW, stroke: C.neutral, sw: 1.4, text: '', opacity: 0 };
      });
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      o.e6 = { type: 'box', x: 650, y: 190, w: 290, h: 40, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, text: '评论家猜 0.6：平均平方误差 0.30', size: 12.5, weight: 750, opacity: 0 };
      o.e3 = { type: 'box', x: 650, y: 245, w: 290, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.3, text: '猜 0.3（平均值）：误差最小 0.21', size: 12.5, weight: 750, opacity: 0 };
      CHAIN.forEach(function (c, i) {
        o['n' + i] = { type: 'box', x: HX[i], y: HY, w: 96, h: 46, rx: 9, fill: C.infoW, stroke: C.info, sw: 1.4, text: c[0], sub: 'V = ' + c[1].toFixed(1), subMono: true, subSize: 11.5, size: 13, weight: 800, opacity: 0 };
        if (i) {
          o['a' + i] = wire('M' + (HX[i - 1] + 50) + ',' + HY + ' L' + (HX[i] - 52) + ',' + HY, C.warn);
          var dlt = c[1] - CHAIN[i - 1][1], k = dlt > 0 ? 'ok' : 'bad';
          o['d' + i] = { type: 'box', x: (HX[i - 1] + HX[i]) / 2, y: HY - 46, w: 70, h: 28, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: (dlt > 0 ? '+' : '−') + Math.abs(dlt).toFixed(1), size: 12.5, weight: 800, mono: true, opacity: 0 };
        }
      });
      o.alab = { type: 'text', x: 780, y: HY, text: '奖励一直是 0', size: 12, weight: 750, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '轨迹 B 走到了历史 h₃。从这里往后，还能拿多少奖励？', set: { h: pop(0) } },
      (function () { var s = {}; OUT.forEach(function (r, i) { s['p' + i] = { opacity: { to: 1, dur: 200, delay: i * 60 }, flow: { to: 1, dur: 200, delay: i * 60 } }; s['o' + i] = pop(300 + i * 60); }); var f = OUT.map(function (r, i) { return st('p' + i, i * 60, C.info, 2); });
        return { say: '按同一个策略，从 h₃ 接着跑 10 次。', set: s, fx: f }; })(),
      (function () { var s = {}; OUT.forEach(function (r, i) { s['o' + i] = mix(recolor(r ? 'ok' : 'neutral', i * 80), { text: { to: String(r), delay: i * 80 } }); }); return { say: '每次跑完，成功记 1，失败记 0。10 次里有 3 次成功（讲义的示意数）。', set: s, fx: [{ type: 'ripple', obj: 'o1', color: C.ok, at: 200 }, { type: 'ripple', obj: 'o4', color: C.ok, at: 450 }, { type: 'ripple', obj: 'o8', color: C.ok, at: 750 }], data: { '成功次数': { v: 3, at: 800 } }, hl: [1] }; })(),
      { say: '价值的估计就是平均：3 ÷ 10 = 0.30。', set: join(VZ.show(EQ, 0, 60), { q1: { text: { to: '3', delay: 400 } }, q3: { num: { to: 0.3, dur: 700, delay: 500 } } }), fx: [{ type: 'burst', obj: 'q3', color: C.ok, at: 1200 }], data: { 'V(h₃)': { v: 0.3, at: 900 } }, hl: [2], log: [{ s: '0.3 0.3 0.21', at: 900 }] },
      { say: '评论家要学会直接预测这个数。它猜 0.6 时，平均平方误差是 0.30。', set: { e6: pop(0) }, data: { '平方误差': { v: 0.3, at: 400 } }, hl: [3, 4, 5] },
      { say: '猜平均值 0.3 时误差最小，是 0.21。所以评论家用平方误差去拟合真实的后续奖励。', set: { e3: pop(0) }, data: { '平方误差': { v: 0.21, at: 400 } }, hl: [3, 4, 5] },
      (function () { var s = {}; CHAIN.forEach(function (c, i) { s['n' + i] = pop(i * 220); if (i) s['a' + i] = { opacity: { to: 1, dur: 250, delay: i * 220 }, flow: { to: 1, dur: 250, delay: i * 220 } }; }); s.alab = fade(900);
        return { say: '有了评论家，就能看每一步（讲义第 15 页）。轨迹 B 最后三步前后的价值依次是 0.3、0.6、0.4、0。', set: s, fx: [st('a1', 220, C.warn, 3), st('a2', 440, C.warn, 3), st('a3', 660, C.warn, 3)], hl: [6] }; })(),
      { say: '奖励都是 0，就看价值变了多少。第一个动作涨了 0.3，是好动作。后两个分别跌 0.2 和 0.4。', set: { d1: pop(0), d2: pop(250), d3: pop(500) }, fx: [{ type: 'burst', obj: 'd1', color: C.ok, at: 300 }, { type: 'shake', obj: 'd3', at: 800 }], hl: [7, 8], log: [{ s: '[0.3, -0.2, -0.4]', at: 600 }] },
      { say: '结果只有一个 0，评论家却给出了逐步的信号。树搜索的裁判、SayCan 的可供性，都是这种分。它们打的是"从这儿往后有多大希望"。', fx: [{ type: 'pulse', obj: 'h', color: C.data, at: 100 }, { type: 'pulse', obj: 'q3', color: C.ok, at: 500 }] }
    ]
  };

  VZ.register({
    id: 'c11-rerank', title: '重排序与评判模型：采 N 挑一、打分器的噪声、结果与过程奖励、价值函数',
    sources: [{ t: '讲义 lecture-06 第 16、26、50 页', u: L06 }, { t: '讲义 lecture-11 第 9–17 页', u: L11 }],
    note: '场景 1 的候选表达式和测试是示意，打分和挑选是本机真跑。场景 2 的 p = 0.3、噪声 1.0 / 0.3 是示意，各点由本机模拟 20000 次得到（种子 0）。场景 3 的题目、六个步骤和"x = 7 那步错"的标注照第 11 讲讲义第 17 页。代入 14 逐步检查的代码是示意。场景 4 的 10 次结果、0.6 / 0.4 / 0 的价值照第 11 讲讲义第 12–15 页，平方误差和价值差是本机算的。这一讲还没有官方讲义和录像，出来后会替换。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

/* 05 · 第 9 讲 —— 组相对优势：GRPO 的优势怎么算、一批里多个任务、退化的组、DrGRPO 的两处改动、三种方法的权重
 * 数字照讲义 lecture-09 第 37–41、44 页；每个均值、标准差、优势都由 本机验算脚本 第 6–7 部分复算一致。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L9 = 'https://www.cmu-agents.com/slides/lecture-09-rl-basics.pdf', YT = 'https://youtu.be/paAcPaaYZGM';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function cell(x, y, t, k, op, w) { return { type: 'box', x: x, y: y, w: w || 56, h: 30, rx: 5, fill: C[k + 'W'], stroke: C[k], sw: 1.2, text: t, size: 12.5, weight: 750, mono: true, opacity: op == null ? 0 : op }; }

  var CODE = { lang: 'py', title: '本机实跑的代码', src:
'groups = {"x1 hidden 11": [1, 1, 0, 0],\n' +
'          "x2 hidden 3":  [1, 0, 0, 0],\n' +
'          "x3 hidden 7":  [1, 1, 1, 0]}\n' +
'for name, rs in groups.items():\n' +
'    m = sum(rs) / len(rs)\n' +
'    sd = statistics.pstdev(rs)\n' +
'    grpo = [(r - m) / sd for r in rs]\n' +
'    drgrpo = [r - m for r in rs]\n' };

  /* ---------------- 场景 1：一组四条轨迹 ---------------- */
  var CX = [470, 560, 650, 740];
  var sc1 = {
    name: '组相对优势', desc: '同一个任务采样一组 G 条轨迹。用组内平均奖励当基线，再除以组内标准差。不需要单独的价值模型（讲义第 37 页）。',
    code: CODE, dataTitle: '组 x1（隐藏 11）', data: { '组均值 R̄': 0, '组标准差 σ_R': 0 }, dataFmt: { '组均值 R̄': 'fixed2', '组标准差 σ_R': 'fixed2' },
    bg: function (d) {
      title(d, 'Â_j = (R(τ_j) − R̄) / σ_R：这条轨迹比同组的平均好多少');
      ['奖励 R_j', '减去均值', '除以 σ_R', '优势 Â_j'].forEach(function (t, i) { d.text(CX[i], 92, t, { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); });
      ['τ1 8→12→10→11 对', 'τ2 4→8→12→11 对', 'τ3 16→8→9→10 错', 'τ4 1→2→3→4 错'].forEach(function (t, i) { d.text(70, 130 + i * 48, t, { size: 12.5, weight: 650, mono: true, color: i < 2 ? C.ok : C.bad }); });
    },
    objects: function () {
      var o = {}, R = [1, 1, 0, 0];
      R.forEach(function (r, i) {
        var y = 130 + i * 48;
        o['r' + i] = cell(CX[0], y, String(r), r ? 'ok' : 'bad');
        o['c' + i] = cell(CX[1], y, r ? '+0.5' : '−0.5', r ? 'ok' : 'bad');
        o['d' + i] = cell(CX[2], y, '÷0.5', 'neutral');
        o['a' + i] = cell(CX[3], y, r ? '+1' : '−1', r ? 'ok' : 'bad');
        o['p' + i] = wire('M' + (CX[0] + 30) + ',' + y + ' L' + (CX[1] - 30) + ',' + y, C.warn);
        o['q' + i] = wire('M' + (CX[2] + 30) + ',' + y + ' L' + (CX[3] - 30) + ',' + y, C.warn);
      });
      o.mean = { type: 'box', x: CX[0], y: 340, w: 120, h: 34, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.4, text: 'R̄ = 0.5', size: 13, weight: 800, mono: true, opacity: 0 };
      o.sd = { type: 'box', x: CX[2], y: 340, w: 120, h: 34, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.4, text: 'σ_R = 0.5', size: 13, weight: 800, mono: true, opacity: 0 };
      o.eq = { type: 'box', x: 430, y: 430, w: 640, h: 46, rx: 10, fill: C.bg2, stroke: C.line, sw: 1.2, text: 'b(h_t) = R̄ = (1/G) Σ_j R(τ_j)：同组的每个 h_t 共用这一个基线', size: 13, weight: 700, opacity: 0 };
      o.no = { type: 'box', x: 430, y: 494, w: 640, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.3, text: '优势是从多次采样直接算出来的：不需要单独的模型', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      { say: '对同一个任务（隐藏 11）从当前策略采样 G = 4 条轨迹。两条猜中，两条超时。', set: { r0: pop(0), r1: pop(150), r2: pop(300), r3: pop(450) }, hl: [1] },
      { say: '组内平均奖励 R̄ = (1 + 1 + 0 + 0) / 4 = 0.5，它就是这一组的基线。', set: { mean: pop(200) }, hl: [5], data: { '组均值 R̄': { v: 0.5, at: 400 } }, fx: [{ type: 'pulse', obj: 'r0', color: C.info, at: 0 }, { type: 'pulse', obj: 'r1', color: C.info, at: 100 }, { type: 'pulse', obj: 'r2', color: C.info, at: 200 }, { type: 'pulse', obj: 'r3', color: C.info, at: 300 }] },
      (function () { var s = {}, fx = []; for (var i = 0; i < 4; i++) { s['p' + i] = { opacity: { to: 1, dur: 200, delay: i * 120 }, flow: { to: 1, dur: 200, delay: i * 120 } }; s['c' + i] = pop(400 + i * 120); fx.push({ type: 'stream', path: 'p' + i, n: 3, gap: 100, dur: 500, at: i * 120, color: C.warn }); }
        return { say: '每条减去均值：成功的 +0.5，失败的 −0.5。失败也有了信号。', set: s, fx: fx }; })(),
      { say: '再除以组内标准差 σ_R = 0.5（四个数是 1、1、0、0）。', set: mix({ sd: pop(0) }, { d0: pop(300), d1: pop(400), d2: pop(500), d3: pop(600) }), hl: [6], data: { '组标准差 σ_R': { v: 0.5, at: 300 } } },
      (function () { var s = {}, fx = []; for (var i = 0; i < 4; i++) { s['q' + i] = { opacity: { to: 1, dur: 200, delay: i * 120 }, flow: { to: 1, dur: 200, delay: i * 120 } }; s['a' + i] = pop(400 + i * 120); fx.push({ type: 'stream', path: 'q' + i, n: 3, gap: 100, dur: 500, at: i * 120, color: C.warn }); }
        return { say: '优势：成功的 +1，失败的 −1。这条轨迹里每个生成的 token 都乘上它。', set: s, fx: fx, hl: [7], log: [{ s: "x1 hidden 11  rewards [1, 1, 0, 0] mean 0.50 std 0.5000  GRPO A ['+1.00', '+1.00', '-1.00', '-1.00']", at: 900 }] }; })(),
      { say: '一个基线 b(h_t) = R̄ 给同一组的所有历史共用。', set: { eq: pop(0) } },
      { say: '优势是从多次采样里直接算出来的。不像 PPO 那样，要单独训练一个价值模型。', set: { no: pop(0) }, fx: [{ type: 'burst', obj: 'no', color: C.ok, at: 400 }] }
    ]
  };

  /* ---------------- 场景 2：一批里多个任务（x2 手推） ---------------- */
  var GR = [['x1 · 隐藏 11', [1, 1, 0, 0], '0.50', ['+1', '+1', '−1', '−1']], ['x2 · 隐藏 3', [1, 0, 0, 0], '0.25', ['+1.73', '−0.58', '−0.58', '−0.58']], ['x3 · 隐藏 7', [1, 1, 1, 0], '0.75', ['+0.58', '+0.58', '+0.58', '−1.73']]];
  var RX = [300, 350, 400, 450], AX = [600, 670, 740, 810];
  var EQ = VZ.eq('g', ['Â =', '(', { slot: 1, w: 46 }, '−', { slot: 1, w: 56 }, ') ÷', { slot: 1, w: 70 }, '=', { num: 0, fmt: 'fixed2', k: 'ok', w: 70 }], 430, 400, { size: 15 });
  var EQ2 = VZ.eq('h', ['σ =', '√(', { t: '0.25·0.75²', k: 'neutral', w: 112 }, '+', { t: '0.75·0.25²', k: 'neutral', w: 112 }, ') =', { num: 0, fmt: 'fixed4', k: 'info', w: 80 }], 430, 460, { size: 14 });
  var sc2 = {
    name: '一批多个任务', desc: '每个任务有自己的组，均值和标准差在组内各自算。所以同样的"成功"，在难题上的优势更大（讲义第 38 页）。',
    code: CODE, dataTitle: '组 x2（隐藏 3）', data: { 'R̄': 0, 'σ_R': 0, '成功那条的 Â': 0 }, dataFmt: { 'R̄': 'fixed2', 'σ_R': 'fixed4', '成功那条的 Â': 'fixed2' },
    bg: function (d) {
      title(d, 'GRPO：每个任务实例单独归一化');
      d.text(375, 80, 'G = 4 个 rollout 的奖励', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); d.text(520, 80, '组均值', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); d.text(705, 80, '优势 Â_ij', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      GR.forEach(function (g, i) {
        var y = 120 + i * 60;
        o['n' + i] = { type: 'text', x: 70, y: y, text: g[0], size: 12.5, weight: 700, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
        g[1].forEach(function (r, j) { o['r' + i + j] = cell(RX[j], y, String(r), r ? 'ok' : 'bad', 0, 40); o['a' + i + j] = cell(AX[j], y, g[3][j], g[3][j][0] === '+' ? 'ok' : 'bad', 0, 62); });
        o['m' + i] = cell(520, y, g[2], 'info', 0, 64);
      });
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      for (var k2 in EQ2.objs) o[k2] = EQ2.objs[k2];
      o.f1 = cell(0, 0, '1', 'ok', 0, 40); o.f2 = cell(0, 0, '0.25', 'info', 0, 50); o.f3 = cell(0, 0, '0.4330', 'info', 0, 66);
      o.tip = { type: 'box', x: 430, y: 520, w: 680, h: 36, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '难题（x2）上唯一的成功得 +1.73，简单题（x3）上唯一的失败得 −1.73', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; GR.forEach(function (g, i) { s['n' + i] = fade(i * 300); g[1].forEach(function (_, j) { s['r' + i + j] = pop(i * 300 + j * 60); }); }); return { say: '一个批里有三个任务实例（隐藏 11、3、7），每个各采样 4 次。', set: s, hl: [1, 2, 3] }; })(),
      { say: '各自算组均值：0.50、0.25、0.75。', set: { m0: pop(0), m1: pop(200), m2: pop(400) }, hl: [5] },
      { say: '手推 x2 的标准差：奖励 1、0、0、0，均值 0.25：σ = √(0.25 × 0.75² + 0.75 × 0.25²) = 0.4330。', set: join(VZ.show(EQ2, 0, 70), { h6: { num: { to: 0.4330, dur: 700, delay: 700 } } }), hl: [6], data: { 'R̄': { v: 0.25, at: 200 }, 'σ_R': { v: 0.4330, at: 800 } } },
      { say: '再手推 x2 里唯一成功那条的优势：(1 − 0.25) ÷ 0.4330。', set: join(VZ.show(EQ, 0, 60), { f1: { opacity: { from: 1, to: 0, dur: 150, delay: 1600 }, x: { from: RX[0], to: EQ.xs[2], dur: 800, delay: 800, ease: 'inOut' }, y: { from: 180, to: 400, dur: 800, delay: 800, ease: 'inOut' } }, g2: { text: { to: '1', delay: 1600 } },
          f2: { opacity: { from: 1, to: 0, dur: 150, delay: 1800 }, x: { from: 520, to: EQ.xs[4], dur: 800, delay: 1000, ease: 'inOut' }, y: { from: 180, to: 400, dur: 800, delay: 1000, ease: 'inOut' } }, g4: { text: { to: '0.25', delay: 1800 } },
          f3: { opacity: { from: 1, to: 0, dur: 150, delay: 2000 }, x: { from: EQ2.xs[6], to: EQ.xs[6], dur: 800, delay: 1200, ease: 'inOut' }, y: { from: 460, to: 400, dur: 800, delay: 1200, ease: 'inOut' } }, g6: { text: { to: '0.4330', delay: 2000 } } }) },
      { say: '= +1.73。其余三条：(0 − 0.25) ÷ 0.4330 = −0.58。', set: { g8: { num: { to: 1.73, dur: 700, delay: 100 } }, a10: pop(800), a11: pop(900), a12: pop(1000), a13: pop(1100) }, hl: [7], data: { '成功那条的 Â': { v: 1.73, at: 200 } },
        fx: [{ type: 'burst', obj: 'g8', color: C.ok, at: 700 }], log: [{ s: "x2 hidden 3   rewards [1, 0, 0, 0] mean 0.25 std 0.4330  GRPO A ['+1.73', '-0.58', '-0.58', '-0.58']", at: 600 }] },
      { say: 'x1、x3 同理：x1 是 ±1，x3 是三个 +0.58 和一个 −1.73。', set: { a00: pop(0), a01: pop(80), a02: pop(160), a03: pop(240), a20: pop(400), a21: pop(480), a22: pop(560), a23: pop(640) },
        log: [{ s: "x3 hidden 7   rewards [1, 1, 1, 0] mean 0.75 std 0.4330  GRPO A ['+0.58', '+0.58', '+0.58', '-1.73']", at: 700 }] },
      { say: '难题上偶然的一次成功，优势很大。简单题上偶然的一次失败，优势也很大。这就是"组相对"。讲义说明，这里没写论文里的比率、裁剪和 KL 项。', set: { tip: pop(0) } }
    ]
  };

  /* ---------------- 场景 3：退化的组与 DrGRPO ---------------- */
  var sc3 = {
    name: '退化组与 DrGRPO', desc: '全对或全错的组优势全是 0，不贡献梯度。DrGRPO 去掉了两处除法：除以组内标准差，除以回答长度（讲义第 39–41 页）。',
    bg: function (d) { title(d, '两个细节：没有对比就没有信号，归一化方式会悄悄改变权重'); },
    objects: function () {
      var o = {};
      [[0, 0, 0, 0], [1, 1, 1, 1]].forEach(function (rs, g) {
        rs.forEach(function (r, j) { o['z' + g + j] = cell(120 + j * 50 + g * 400, 110, String(r), r ? 'ok' : 'bad', 0, 40); o['y' + g + j] = cell(120 + j * 50 + g * 400, 170, '0', 'neutral', 0, 40); });
        o['zl' + g] = { type: 'text', x: 195 + g * 400, y: 210, text: g ? '全成功：可能太简单' : '全失败：可能太难', size: 12, weight: 700, color: g ? C.ok : C.bad, anchor: 'middle', opacity: 0 };
      });
      o.fix = { type: 'box', x: 430, y: 260, w: 680, h: 36, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.2, text: '全失败时：换任务、扩大探索、加示范，或给更有信息量的奖励', size: 12.5, weight: 700, opacity: 0 };
      o.t1 = { type: 'box', x: 250, y: 360, w: 320, h: 70, rx: 10, fill: C.bg2, stroke: C.line, sw: 1.3, text: '优势：(R_j − R̄) / σ_R → R_j − R̄', sub: '几乎总成功或总失败的题 σ_R 小，权重被放大', subMono: false, subSize: 11, size: 13, weight: 750, opacity: 0 };
      o.t2 = { type: 'box', x: 610, y: 360, w: 320, h: 70, rx: 10, fill: C.bg2, stroke: C.line, sw: 1.3, text: '聚合：(1/|y_j|) Σ_t → (1/C) Σ_t', sub: '除以各自长度会让长的错误回答每个 token 罚得少', subMono: false, subSize: 11, size: 13, weight: 750, opacity: 0 };
      o.lg = { type: 'box', x: 610, y: 470, w: 0, h: 22, rx: 3, anchor: 'l', fill: C.badW, stroke: C.bad, sw: 1.2, opacity: 0 };
      o.sh = { type: 'box', x: 610, y: 500, w: 0, h: 22, rx: 3, anchor: 'l', fill: C.badW, stroke: C.bad, sw: 1.2, opacity: 0 };
      o.lgt = { type: 'text', x: 600, y: 470, text: '长的错误回答：每 token −0.5/长', size: 11, weight: 700, color: C.fg2, anchor: 'end', opacity: 0 };
      o.sht = { type: 'text', x: 600, y: 500, text: '短的错误回答：每 token −0.5/短', size: 11, weight: 700, color: C.fg2, anchor: 'end', opacity: 0 };
      o.dr = { type: 'box', x: 250, y: 486, w: 320, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.3, text: 'DrGRPO：每个 token 都是 Â_j / C', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = { zl0: fade(500) }; for (var j = 0; j < 4; j++) { s['z0' + j] = pop(j * 80); s['y0' + j] = pop(400 + j * 80); } return { say: '一组四条全失败：均值 0，每条的优势都是 0。这组不贡献任何梯度，可能是题对当前策略太难。', set: s, log: [{ s: 'degenerate [0, 0, 0, 0] -> advantages [0.0, 0.0, 0.0, 0.0]', at: 600 }] }; })(),
      (function () { var s = { zl1: fade(500) }; for (var j = 0; j < 4; j++) { s['z1' + j] = pop(j * 80); s['y1' + j] = pop(400 + j * 80); } return { say: '全成功也一样：优势全是 0，可能题太简单。', set: s, log: [{ s: 'degenerate [1, 1, 1, 1] -> advantages [0.0, 0.0, 0.0, 0.0]', at: 600 }] }; })(),
      { say: '如果每条采样都失败，能改什么？换任务实例、扩大探索、加示范，或者给更有信息量的奖励。', set: { fix: pop(0) } },
      { say: 'DrGRPO 的第一处改动：不再除以组内标准差。σ_R 每组不同。几乎总对或总错的题 σ_R 很小，会被不成比例地放大。', set: { t1: pop(0) }, log: [{ s: "x2 DrGRPO A ['+0.75', '-0.25', '-0.25', '-0.25']  (instead of +1.73 / -0.58)", at: 400 }] },
      { say: '第二处：GRPO 用每个回答自己的长度 |y_j| 去平均它的 token。于是一个很长的错误回答，每个 token 受的罚比短的少。', set: { t2: pop(0), lgt: fade(400), sht: fade(400), lg: { opacity: { to: 1, dur: 150, delay: 500 }, w: { to: 40, dur: 600, delay: 500 } }, sh: { opacity: { to: 1, dur: 150, delay: 600 }, w: { to: 160, dur: 600, delay: 600 } } } },
      { say: '这样策略就会慢慢漂向更长的错误回答。DrGRPO 改成除以一个全局常数 C，论文用的是生成预算。每个 token 都是 Â_j / C。奖励本身不变，变的是任务和回答之间的相对权重。', set: { dr: pop(0), lg: { w: { to: 100, dur: 600, delay: 300 } }, sh: { w: { to: 100, dur: 600, delay: 300 } }, lgt: { text: { to: '长的错误回答：每 token −0.5/C', delay: 300 } }, sht: { text: { to: '短的错误回答：每 token −0.5/C', delay: 300 } } } }
    ]
  };

  /* ---------------- 场景 4：三种方法的权重 ---------------- */
  var M = [['ReST-EM', ['1', '1', '0', '0'], '成功轨迹 1，其余 0（就是在保留的数据上做 SFT）'], ['REINFORCE', ['1', '1', '0', '0'], '动作所在轨迹的奖励 R(τ)'], ['GRPO', ['+1', '+1', '−1', '−1'], '相对同一任务其他 rollout 的奖励 Â_j']];
  var sc4 = {
    name: '三种方法的权重', desc: '今天讲的方法，都是给智能体做过的动作加权。∇̂J = Σ_t w_t ∇log π_θ(a_t | h_t)，区别只在权重 w_t（讲义第 44 页）。',
    bg: function (d) {
      title(d, '同一组 τ1–τ4（R = 1, 1, 0, 0），三种方法给的权重');
      ['τ1', 'τ2', 'τ3', 'τ4'].forEach(function (t, j) { d.text(330 + j * 80, 100, t, { anchor: 'middle', size: 13, weight: 750, mono: true, color: C.fg2 }); });
    },
    objects: function () {
      var o = {};
      M.forEach(function (m, i) {
        var y = 150 + i * 90;
        o['n' + i] = { type: 'text', x: 70, y: y, text: m[0], size: 14, weight: 800, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
        m[1].forEach(function (w, j) { o['w' + i + j] = cell(330 + j * 80, y, w, w[0] === '−' ? 'bad' : w === '0' ? 'neutral' : 'ok', 0, 60); });
        o['d' + i] = { type: 'text', x: 70, y: y + 30, text: m[2], size: 11.5, weight: 600, color: C.fg3, anchor: 'start', opacity: 0 };
      });
      o.eq = { type: 'box', x: 430, y: 470, w: 520, h: 44, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.4, text: '∇̂J = Σ_t w_t ∇log π_θ(a_t | h_t)', size: 15, weight: 800, mono: true, opacity: 0 };
      o.sum = { type: 'text', x: 430, y: 524, text: '解决开头三个问题：任务错配 · 数据错配 · 暴露偏差', size: 12.5, weight: 700, color: C.ok, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '公式都长一个样：Σ_t w_t ∇log π_θ(a_t | h_t)。和 SFT 一样的对数概率，只是每个动作多了一个权重 w_t。', set: { eq: pop(0) }, fx: [{ type: 'pulse', obj: 'eq', color: C.info, at: 700 }, { type: 'pulse', obj: 'eq', color: C.info, at: 1300 }] },
      (function () { var s = { n0: fade(0), d0: fade(300) }; for (var j = 0; j < 4; j++) s['w0' + j] = pop(200 + j * 100); return { say: 'ReST-EM：成功轨迹权重 1，失败的 0。就是只在保留的数据上做 SFT。', set: s, log: [{ s: 'ReST-EM    [1, 1, 0, 0]', at: 600 }] }; })(),
      (function () { var s = { n1: fade(0), d1: fade(300) }; for (var j = 0; j < 4; j++) s['w1' + j] = pop(200 + j * 100); return { say: 'REINFORCE：权重是这条轨迹的奖励。二值奖励时和 ReST 一样（区别在 ReST 是批量更新、会聚合数据集）。', set: s, log: [{ s: 'REINFORCE  [1, 1, 0, 0]', at: 600 }] }; })(),
      (function () { var s = { n2: fade(0), d2: fade(300) }; for (var j = 0; j < 4; j++) s['w2' + j] = pop(200 + j * 100); return { say: 'GRPO：权重是组相对优势，失败的轨迹被往下压，成功的被往上推。', set: s, log: [{ s: "GRPO       ['+1', '+1', '-1', '-1']", at: 600 }], fx: [{ type: 'shake', obj: 'w22', at: 800 }, { type: 'shake', obj: 'w23', at: 900 }] }; })(),
      { say: 'DrGRPO 只是去掉了除以 σ。这组的权重变成 +0.5、+0.5、−0.5、−0.5，再统一除以常数 C。', fx: [{ type: 'pulse', obj: 'w20', color: C.ok, at: 100 }, { type: 'pulse', obj: 'w22', color: C.bad, at: 300 }], log: [{ s: "DrGRPO     ['+0.5', '+0.5', '-0.5', '-0.5']", at: 300 }] },
      { say: '三种都用当前策略的轨迹，按奖励加权。任务错配解决了，目标就是期望奖励。数据错配解决了，次优轨迹也能学。暴露偏差也解决了，在自己的轨迹上学会恢复。', set: { sum: fade(0) }, fx: [{ type: 'burst', obj: 'eq', color: C.ok, at: 400 }] }
    ]
  };

  VZ.register({
    id: 'c5-grpo', title: 'GRPO：组相对优势、退化组与 DrGRPO',
    sources: [{ t: '第 9 讲（组相对优势部分）', u: YT }, { t: '讲义 lecture-09 第 37–44 页', u: L9 }],
    note: '所有奖励、均值、标准差、优势照讲义第 37–41、44 页。本机逐个复算一致，比如 x2 的 σ = 0.4330、+1.73、−0.58。讲义说明，这些式子是为当前策略的轨迹写的。论文里的比率、裁剪和 KL 项都省掉了，下一章讲。场景 3 里长短回答的条形长度是示意。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

/* 06 · 第 11 讲 —— 功劳分配：组基线、剩余回报、价值函数（评论家）、TD 误差与 GAE 的手推
 * 修 bug 的任务、四次尝试、0.25 基线照讲义 lecture-11 第 3–8 页；A/B 两条轨迹、10 个延续、0.3、0.30 / 0.21 照第 9–13 页；
 * δ = +0.3 / −0.2 / −0.4、λ = 0.5、Â3 = 0.1 照第 15–16 页。每个数都由 本机验算脚本 第 1–3 部分复算一致。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L11 = 'https://www.cmu-agents.com/slides/lecture-11-rl-advanced.pdf', YT = 'https://youtu.be/jKx7_fOZRzg';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, op, w, h, size) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: true, opacity: op == null ? 0 : op }; }

  /* ---------------- 场景 1：一次尝试一个权重 ---------------- */
  var CODE1 = { lang: 'py', title: '讲义第 3 页 · 有 bug 的代码与测试', src:
'def retry_count(config):\n' +
'    return config.get("retries") or 3\n' +
'\n' +
'# 测试：输入 -> 期望输出\n' +
'# Missing -> 3    None -> 3\n' +
'# 0       -> 0    2    -> 2\n' };
  var sc1 = {
    name: '组基线', desc: '同一个修 bug 任务采四次：只有一次四个测试全过。用组平均当基线，失败的尝试也拿到负权重（讲义第 3–8 页）。',
    code: CODE1, dataTitle: '权重', data: { '基线 b': 0, '成功的权重': 0, '失败的权重': 0 }, dataFmt: { '基线 b': 'fixed2', '成功的权重': 'signed2', '失败的权重': 'signed2' },
    bg: function (d) { title(d, '修 bug：0 应该关掉重试，代码却返回 3'); d.text(150, 120, '尝试', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); d.text(420, 120, '最终测试', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); d.text(600, 120, 'R(τ)', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); d.text(730, 120, '权重 = R − b', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); },
    objects: function () {
      var o = {}, T = ['四个全过', '至少一个失败', '至少一个失败', '至少一个失败'];
      for (var i = 0; i < 4; i++) {
        var y = 160 + i * 56;
        o['n' + i] = cell(150, y, '尝试 ' + (i + 1), 'neutral', 0, 90);
        o['t' + i] = cell(420, y, T[i], i ? 'bad' : 'ok', 0, 150); o['t' + i].mono = false;
        o['r' + i] = cell(600, y, i ? '0' : '1', i ? 'bad' : 'ok', 0, 50);
        o['w' + i] = cell(730, y, i ? '0 − 0.25 = −0.25' : '1 − 0.25 = +0.75', i ? 'bad' : 'ok', 0, 150, 34, 12);
        o['p' + i] = wire('M196,' + y + ' L344,' + y, C.warn);
      }
      o.b = { type: 'box', x: 600, y: 410, w: 230, h: 40, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.5, text: '基线 b = (1+0+0+0)/4 = 0.25', size: 13, weight: 800, mono: false, opacity: 0 };
      o.q = { type: 'box', x: 430, y: 480, w: 640, h: 44, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '但同一条轨迹里每个回合拿的都是同一个权重：哪一步真正有用？', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      { say: '修 bug 的任务：retry_count 把 retries=0 当成"没设"，返回了 3。验证器是四个输入 → 输出的测试。', hl: [1, 2, 4, 5, 6], fx: [{ type: 'flash', x: 300, y: 160, color: C.bad, at: 500 }] },
      (function () { var s = {}, fx = []; for (var i = 0; i < 4; i++) { s['n' + i] = pop(i * 150); s['p' + i] = { opacity: { to: 1, dur: 200, delay: 300 + i * 150 }, flow: { to: 1, dur: 200, delay: 300 + i * 150 } }; s['t' + i] = pop(800 + i * 150); fx.push(st('p' + i, 300 + i * 150, C.warn, 3)); }
        return { say: '采样四次尝试，各自跑测试：只有第 1 次四个全过。', set: s, fx: fx }; })(),
      { say: '奖励：全过 1，否则 0。普通 REINFORCE 下，失败的三次不产生任何更新。', set: { r0: pop(0), r1: pop(120), r2: pop(240), r3: pop(360) } },
      { say: '用组平均当基线：(1 + 0 + 0 + 0) / 4 = 0.25。', set: { b: pop(0) }, data: { '基线 b': { v: 0.25, at: 300 } }, log: [{ s: 'baseline = 0.25  weights = [0.75, -0.25, -0.25, -0.25]', at: 500 }] },
      { say: '权重变成 R − b：成功的 +0.75，失败的各 −0.25。失败的尝试也贡献了信号，它们的动作被往下推。', set: { w0: pop(0), w1: pop(150), w2: pop(300), w3: pop(450) },
        data: { '成功的权重': { v: 0.75, at: 300 }, '失败的权重': { v: -0.25, at: 600 } } },
      { say: '四个权重加起来是 0.75 − 3 × 0.25 = 0。基线把奖励变成了"比同组平均好多少"。', fx: [{ type: 'pulse', obj: 'w0', color: C.ok, at: 100 }, { type: 'pulse', obj: 'w1', color: C.bad, at: 300 }, { type: 'pulse', obj: 'w2', color: C.bad, at: 450 }, { type: 'pulse', obj: 'w3', color: C.bad, at: 600 }, { type: 'pulse', obj: 'b', color: C.info, at: 800 }] },
      { say: '可是成功的轨迹里也可能有错的一步。失败的轨迹里也可能有有用的一步。组权重对一条轨迹的每个回合都一样。这就是功劳分配问题。', set: { q: pop(0) } }
    ]
  };

  /* ---------------- 场景 2：剩余回报与价值 ---------------- */
  var AX = [170, 260, 350, 440, 530, 620];
  var OUT = [0, 1, 0, 0, 1, 0, 0, 0, 1, 0];
  var CODE2 = { lang: 'py', title: '本机实跑 · 第 2 部分', src:
'outs = [0, 1, 0, 0, 1, 0, 0, 0, 1, 0]\n' +
'V_h3 = sum(outs) / len(outs)        # 0.3\n' +
'for v in (0.6, 0.3):\n' +
'    se = sum((v - o)**2 for o in outs)\n' +
'    print(v, se / len(outs))       # 0.30, 0.21\n' };
  var sc2 = {
    name: '剩余回报与价值', desc: '只有最终奖励时，成功轨迹每步的剩余回报都是 1。失败轨迹都是 0。评论家学的是"从这个历史出发的期望剩余回报"V(h)（讲义第 10–13 页）。',
    code: CODE2, dataTitle: '从 B 的 h3 出发', data: { '10 次延续里成功': 0, 'V(h3) 估计': 0, '预测 0.6 的平方误差': 0, '预测 0.3 的平方误差': 0 },
    dataFmt: { 'V(h3) 估计': 'fixed1', '预测 0.6 的平方误差': 'fixed2', '预测 0.3 的平方误差': 'fixed2' },
    bg: function (d) {
      title(d, '评论家：V(h) = 从历史 h 继续下去，平均能拿到多少奖励');
      d.text(70, 110, 'A 成功', { size: 12.5, weight: 700, color: C.ok }); d.text(70, 170, 'B 失败', { size: 12.5, weight: 700, color: C.bad });
    },
    objects: function () {
      var o = {};
      for (var t = 0; t < 6; t++) {
        o['a' + t] = cell(AX[t], 110, 'a' + t, t === 1 ? 'bad' : 'data', 0, 70, 30);
        o['b' + t] = cell(AX[t], 170, 'a' + t, t === 3 ? 'ok' : 'data', 0, 70, 30);
        o['ra' + t] = { type: 'text', x: AX[t], y: 136, text: 'R=1', size: 11, weight: 700, mono: true, color: C.ok, anchor: 'middle', opacity: 0 };
        o['rb' + t] = { type: 'text', x: AX[t], y: 196, text: 'R=0', size: 11, weight: 700, mono: true, color: C.bad, anchor: 'middle', opacity: 0 };
      }
      o.ma = { type: 'text', x: AX[1], y: 86, text: '错误的一步', size: 11, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.mb = { type: 'text', x: AX[3], y: 220, text: '有用的一步', size: 11, weight: 700, color: C.ok, anchor: 'middle', opacity: 0 };
      o.h3 = { type: 'box', x: 120, y: 330, w: 80, h: 40, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.6, text: 'h3', size: 15, weight: 800, mono: true, opacity: 0 };
      OUT.forEach(function (v, k) {
        o['l' + k] = wire('M160,330 C220,330 240,' + (270 + k * 13) + ' 290,' + (270 + k * 13), v ? C.ok : C.neutral);
        o['c' + k] = cell(318, 270 + k * 13, '', v ? 'ok' : 'neutral', 0, 40, 10); o['c' + k].rx = 3;
      });
      o.V = { type: 'box', x: 560, y: 330, w: 210, h: 44, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '', num: 0, fmt: 'fixed1', pre: 'V(h3) ≈ 3 ÷ 10 = ', size: 14, weight: 800, mono: false, opacity: 0 };
      o.pv = wire('M350,330 L450,330', C.info);
      o.se = { type: 'box', x: 430, y: 450, w: 660, h: 50, rx: 10, fill: C.bg2, stroke: C.line, sw: 1.2, text: '训练评论家：L_V(φ) = 𝔼_t[(V_φ(h_t) − R_t)²]', sub: '预测 0.6 时平方误差 0.30。预测均值 0.3 时 0.21（最小）', subMono: false, subSize: 11.5, size: 13.5, weight: 750, mono: false, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = { ma: fade(1300), mb: fade(1500) }; for (var t = 0; t < 6; t++) { s['a' + t] = pop(t * 100); s['b' + t] = pop(600 + t * 100); } return { say: '两条轨迹：A 成功，但第 1 步是个错误。B 失败，但第 3 步其实有用（示意）。', set: s }; })(),
      (function () { var s = {}; for (var t = 0; t < 6; t++) { s['ra' + t] = fade(t * 100); s['rb' + t] = fade(600 + t * 100); } return { say: '只有最终奖励时，R_t 在 A 上处处是 1，在 B 上处处是 0。R_t 是剩余回报，也就是这一步之后拿到的奖励之和。错的步和有用的步分不出来。', set: s, log: [{ s: 'R_0 = 0 + 0 + 0 + 0 + 0 + 1 = 1', at: 300 }, { s: 'R_3 = 0 + 0 + 1 = 1', at: 700 }] }; })(),
      (function () { var s = { h3: pop(0) }, fx = []; OUT.forEach(function (v, k) { s['l' + k] = { opacity: { to: 1, dur: 200, delay: 200 + k * 80 }, flow: { to: 1, dur: 200, delay: 200 + k * 80 } }; s['c' + k] = pop(500 + k * 80); fx.push(st('l' + k, 200 + k * 80, v ? C.ok : C.neutral, 2)); });
        return { say: '想象从 B 的历史 h3 出发，用同一个 rollout 策略再跑 10 次。结果是示意的：3 次成功、7 次失败。', set: s, fx: fx, data: { '10 次延续里成功': { v: 3, at: 1300 } }, hl: [1] }; })(),
      { say: '从 h3 出发的期望剩余回报（价值）约是 3 ÷ 10 = 0.3。', set: join(on('pv'), { V: mix(pop(400), { num: { to: 0.3, dur: 600, delay: 600 } }) }), fx: [st('pv', 100, C.info, 5)], hl: [2], data: { 'V(h3) 估计': { v: 0.3, at: 700 } } },
      { say: '实际中不能每步都重新跑 10 次。所以训练一个评论家 V_φ(h) 去预测剩余回报，用平方误差。预测 0.6 时，误差 [3(0.6−1)² + 7(0.6)²]/10 = 0.30。预测均值 0.3 时最小，是 0.21。', set: { se: pop(0) }, hl: [3, 4, 5],
        data: { '预测 0.6 的平方误差': { v: 0.30, at: 300 }, '预测 0.3 的平方误差': { v: 0.21, at: 600 } }, log: [{ s: 'squared error at V=0.6: 0.30', at: 300 }, { s: 'squared error at V=0.3: 0.21', at: 700 }] },
      { say: '评论家可以是独立的网络，也可以是策略主体上的价值头。价值头要加 stop-gradient，让价值损失不更新策略主体。', fx: [{ type: 'pulse', obj: 'V', color: C.info, at: 200 }] }
    ]
  };

  /* ---------------- 场景 3：TD 误差与 GAE（手推） ---------------- */
  var BX = [215, 425, 635];
  var CODE3 = { lang: 'py', title: '本机实跑 · 第 3 部分（γ = 1）', src:
'V = {3: 0.3, 4: 0.6, 5: 0.4, 6: 0.0}\n' +
'r = {4: 0, 5: 0, 6: 0}\n' +
'd = {t: r[t+1] + V[t+1] - V[t]\n' +
'     for t in (3, 4, 5)}      # TD 误差\n' +
'lam, A = 0.5, {6: 0.0}\n' +
'for t in (5, 4, 3):          # 往回递推\n' +
'    A[t] = d[t] + lam * A[t+1]\n' };
  var EQ = VZ.eq('g', ['Â₃ =', { slot: 1, w: 56 }, '+ 0.5 ×', { slot: 1, w: 56 }, '+ 0.25 ×', { slot: 1, w: 56 }, '=', { num: 0, fmt: 'fixed2', k: 'ok', w: 70 }], 430, 420, { size: 15 });
  var sc3 = {
    name: 'TD 误差与 GAE', desc: '一步的价值变化 δ_t = r + V(下一个) − V(这一个)。GAE 把后面的 δ 按 λ 的幂次加权累加，得到每一步自己的优势（讲义第 15–16 页）。',
    code: CODE3, dataTitle: 'B 的最后三步', data: { 'δ3': 0, 'δ4': 0, 'δ5': 0, 'Â5': 0, 'Â4': 0, 'Â3': 0 }, dataFmt: { 'δ3': 'signed1', 'δ4': 'signed1', 'δ5': 'signed1', 'Â5': 'signed2', 'Â4': 'signed2', 'Â3': 'signed2' },
    bg: function (d) { title(d, '轨迹 B 最后三个动作：奖励都是 0，看评论家的价值怎么变'); },
    objects: function () {
      var o = {}, V = [0.3, 0.6, 0.4, 0.0], D = ['+0.3', '−0.2', '−0.4'], W = ['×1', '×0.5', '×0.25'];
      for (var i = 0; i < 4; i++) o['v' + i] = { type: 'box', x: 110 + i * 210, y: 120, w: 110, h: 44, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.5, text: 'V(h' + (3 + i) + ')=' + V[i].toFixed(1), size: 13, weight: 800, mono: true, opacity: 0 };
      for (var k = 0; k < 3; k++) {
        o['e' + k] = wire('M' + (166 + k * 210) + ',120 L' + (264 + k * 210) + ',120', C.warn);
        o['an' + k] = { type: 'text', x: 215 + k * 210, y: 100, text: 'a' + (3 + k) + ' · r=0', size: 11.5, weight: 700, mono: true, color: C.warn, anchor: 'middle', opacity: 0 };
        o['d' + k] = cell(BX[k], 220, 'δ' + (3 + k) + ' = ' + D[k], k ? 'bad' : 'ok', 0, 130, 38, 13.5);
        o['w' + k] = { type: 'text', x: BX[k], y: 256, text: W[k], size: 13, weight: 750, mono: true, color: C.fg2, anchor: 'middle', opacity: 0 };
        o['f' + k] = cell(0, 0, D[k], k ? 'bad' : 'ok', 0, 50, 26, 12);
      }
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      o.rec = { type: 'box', x: 430, y: 490, w: 600, h: 40, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '往回递推：Â_t = δ_t + λ·Â_{t+1}，最后一步之后没有误差了', size: 13, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '评论家给 B 的每个历史一个价值：h3 0.3、h4 0.6、h5 0.4。B 在 a5 之后结束，h6 没有未来奖励，价值 0。', set: { v0: pop(0), v1: pop(200), v2: pop(400), v3: pop(600) } },
      { say: 'a3 之后：0 + 0.6 − 0.3 = +0.3。这一步让局面变好了。这叫时间差分误差，不打折扣。', set: join(on('e0'), { an0: fade(0), d0: pop(700) }), fx: [st('e0', 100, C.warn, 3)], hl: [3, 4], data: { 'δ3': { v: 0.3, at: 700 } } },
      { say: 'a4 之后：0 + 0.4 − 0.6 = −0.2。a5 之后：0 + 0 − 0.4 = −0.4。', set: join(on('e1'), on('e2', 500), { an1: fade(0), an2: fade(500), d1: pop(600), d2: pop(1100) }), fx: [st('e1', 100, C.warn, 3), st('e2', 600, C.warn, 3)], data: { 'δ4': { v: -0.2, at: 600 }, 'δ5': { v: -0.4, at: 1100 } },
        log: [{ s: 'delta_3 = 0 + 0.6 - 0.3 = +0.3', at: 200 }, { s: 'delta_4 = 0 + 0.4 - 0.6 = -0.2', at: 700 }, { s: 'delta_5 = 0 + 0.0 - 0.4 = -0.4', at: 1200 }] },
      { say: 'a3 的功劳该算多少？后面的误差也和它有关，但越远越不相干。选 λ = 0.5，每往后一步权重减半：1、0.5、0.25。', set: { w0: fade(0), w1: fade(200), w2: fade(400) } },
      { say: '手推：三个 δ 依次飞进公式。', set: join(VZ.show(EQ, 0, 60), { f0: { opacity: { from: 1, to: 0, dur: 150, delay: 1300 }, x: { from: BX[0], to: EQ.xs[1], dur: 800, delay: 500, ease: 'inOut' }, y: { from: 220, to: 420, dur: 800, delay: 500, ease: 'inOut' } }, g1: { text: { to: '0.3', delay: 1300 } },
          f1: { opacity: { from: 1, to: 0, dur: 150, delay: 1500 }, x: { from: BX[1], to: EQ.xs[3], dur: 800, delay: 700, ease: 'inOut' }, y: { from: 220, to: 420, dur: 800, delay: 700, ease: 'inOut' } }, g3: { text: { to: '−0.2', delay: 1500 } },
          f2: { opacity: { from: 1, to: 0, dur: 150, delay: 1700 }, x: { from: BX[2], to: EQ.xs[5], dur: 800, delay: 900, ease: 'inOut' }, y: { from: 220, to: 420, dur: 800, delay: 900, ease: 'inOut' } }, g5: { text: { to: '−0.4', delay: 1700 } } }) },
      { say: '0.3 − 0.1 − 0.1 = 0.1：a3 的估计优势是 +0.1。B 整条轨迹失败，但 a3 这一步还是被往上推了一点。', set: { g7: { num: { to: 0.1, dur: 700, delay: 100 } } }, fx: [{ type: 'burst', obj: 'g7', color: C.ok, at: 700 }], data: { 'Â3': { v: 0.1, at: 300 } }, log: [{ s: 'direct: 0.3 + 0.5*(-0.2) + 0.25*(-0.4) = 0.10', at: 300 }] },
      { say: '实现上不用每次都展开，从最后往前递推就行。Â5 = −0.4，Â4 = −0.2 + 0.5 × (−0.4) = −0.4。Â3 = 0.3 + 0.5 × (−0.4) = 0.1，结果一样。这就是广义优势估计（GAE），PPO 用的就是它。', set: { rec: pop(0) }, hl: [6, 7],
        data: { 'Â5': { v: -0.4, at: 300 }, 'Â4': { v: -0.4, at: 600 } }, log: [{ s: 'A_5 = delta_5 + lam*A_6 = -0.40', at: 200 }, { s: 'A_4 = delta_4 + lam*A_5 = -0.40', at: 600 }, { s: 'A_3 = delta_3 + lam*A_4 = +0.10', at: 1000 }] }
    ]
  };

  VZ.register({
    id: 'c6-credit', title: '功劳分配：组基线、价值函数与 GAE',
    sources: [{ t: '第 11 讲（功劳分配部分）', u: YT }, { t: '讲义 lecture-11 第 3–17 页', u: L11 }],
    note: '修 bug 任务、四次尝试和 0.25 基线照讲义第 3–8 页。A/B 两条轨迹、10 个延续结果（讲义标了示意）、0.3、0.30 / 0.21 照第 9–13 页。V 值、δ、λ = 0.5、Â3 = 0.1 照第 15–16 页。所有算术都是本机实算的。"往回递推得到 Â4 = −0.4、Â5 = −0.4"是复算时补的中间结果。',
    scenes: [sc1, sc2, sc3]
  });
})();

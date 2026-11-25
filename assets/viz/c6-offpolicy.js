/* 06 · 第 11 讲 —— 稳定的更新：重要性采样、整条轨迹的比率、PPO 裁剪、同策略蒸馏的反向 KL
 * 场景 1：三个动作的 μ / π_θ 概率和 1.75 / 0.50 照讲义 lecture-11 第 22–23 页；"两边期望都是 0.70"是 本机验算脚本 第 4 部分的补充复算。
 * 场景 2：1.05 连乘 100 次 ≈ 132 照第 24 页，0.10/0.40 = 0.25 照第 26 页；1.05¹⁰ = 1.63、1.05⁵⁰ = 11.47 是复算时补的中间值。
 * 场景 3：ε = 0.2、c_t = clip(ρ_t, 0.8, 1.2)、目标 min(ρÂ, cÂ) 照第 30–32 页；具体的 ρ 取值和结果是 verify.py 第 5 部分的表。
 * 场景 4：老师 0.8 / 0.2、学生 0.5 / 0.5、KL ≈ 0.223 照第 50–52 页，verify.py 第 6 部分复算 0.2231。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L11 = 'https://www.cmu-agents.com/slides/lecture-11-rl-advanced.pdf', YT = 'https://youtu.be/jKx7_fOZRzg';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, w, h, size, mono) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: mono !== false, opacity: 0 }; }
  function bar(x, y, col) { return { type: 'box', x: x, y: y, w: 0, h: 16, rx: 3, anchor: 'l', fill: col, stroke: 'none', opacity: 0 }; }
  function grow(w, d0) { return { opacity: { to: 1, dur: 120, delay: d0 || 0 }, w: { to: w, dur: 700, delay: d0 || 0, ease: 'out' } }; }

  /* ---------------- 场景 1：重要性采样 ---------------- */
  var ACT = [['显式检查 None', 0.40, 0.70, '1.75', 1], ['用 get(..., 3)', 0.40, 0.20, '0.50', 0], ['保持原代码', 0.20, 0.10, '0.50', 0]];
  var RY = [160, 240, 320], BX = 225, BW = 400;
  var CODE1 = { lang: 'py', title: '本机实跑 · 第 4 部分', src:
'mu = {"None 检查": .40, "get": .40, "原样": .20}\n' +
'pi = {"None 检查": .70, "get": .20, "原样": .10}\n' +
'R  = {"None 检查": 1,   "get": 0,   "原样": 0}\n' +
'ratio = {a: pi[a] / mu[a] for a in mu}\n' +
'sum(pi[a] * R[a] for a in pi)              # 0.70\n' +
'sum(mu[a] * ratio[a] * R[a] for a in mu)   # 0.70\n' };
  var sc1 = {
    name: '重要性采样', desc: '一条 rollout 在 learner 更新之后才结束。动作是旧策略 μ 采的，要更新的却是 π_θ。按比率 π_θ/μ 重新加权，期望就对上了（讲义第 22–23 页）。',
    code: CODE1, dataTitle: '比率与期望', data: { '比率（None 检查）': 0, '比率（get）': 0, '𝔼_π[R]': 0, '𝔼_μ[比率·R]': 0 },
    dataFmt: { '比率（None 检查）': 'fixed2', '比率（get）': 'fixed2', '𝔼_π[R]': 'fixed2', '𝔼_μ[比率·R]': 'fixed2' },
    bg: function (d) {
      title(d, '过期的 rollout：动作来自 μ，学习者已经是 π_θ');
      d.text(120, 100, '动作', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
      d.text(BX, 100, 'μ（采样用的旧策略）', { anchor: 'start', size: 12, weight: 700, color: C.data });
      d.text(BX + 160, 100, 'π_θ（正在更新的策略）', { anchor: 'start', size: 12, weight: 700, color: C.info });
      d.text(700, 100, '比率 π_θ/μ', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
      d.text(800, 100, 'R(a)', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      ACT.forEach(function (a, i) {
        var y = RY[i];
        o['n' + i] = cell(120, y, a[0], 'neutral', 170, 40, 12.5, false);
        o['m' + i] = bar(BX, y - 11, C.data); o['p' + i] = bar(BX, y + 11, C.info);
        o['mt' + i] = { type: 'text', x: BX + a[1] * BW + 8, y: y - 11, text: a[1].toFixed(2), size: 11.5, weight: 750, mono: true, color: C.data, anchor: 'start', opacity: 0 };
        o['pt' + i] = { type: 'text', x: BX + a[2] * BW + 8, y: y + 11, text: a[2].toFixed(2), size: 11.5, weight: 750, mono: true, color: C.info, anchor: 'start', opacity: 0 };
        o['r' + i] = { type: 'box', x: 700, y: y, w: 110, h: 36, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.4, text: '', num: 1, fmt: 'fixed2', pre: '× ', size: 14, weight: 800, mono: true, opacity: 0 };
        o['R' + i] = cell(800, y, String(a[4]), a[4] ? 'ok' : 'bad', 44, 34);
      });
      o.eq = { type: 'box', x: 430, y: 400, w: 600, h: 44, rx: 10, fill: C.bg2, stroke: C.line, sw: 1.2, text: '𝔼_{a∼π_θ}[R(a)] = 𝔼_{a∼μ}[ (π_θ(a|h) / μ(a|h)) · R(a) ]', size: 14, weight: 750, mono: false, opacity: 0 };
      o.e1 = { type: 'box', x: 430, y: 462, w: 600, h: 36, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.2, text: '直接按 π_θ 算：0.70 × 1 + 0.20 × 0 + 0.10 × 0 = 0.70', size: 12.5, weight: 700, mono: false, opacity: 0 };
      o.e2 = { type: 'box', x: 430, y: 512, w: 600, h: 36, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.2, text: '按 μ 采样再乘比率：0.40 × 1.75 × 1 + 0.40 × 0.50 × 0 + 0.20 × 0.50 × 0 = 0.70', size: 12.5, weight: 700, mono: false, opacity: 0 };
      return o;
    },
    steps: [
      { say: '同一个历史下三个可选的编辑。这条 rollout 是旧策略 μ 采的，等它结束时 learner 已经更新成 π_θ。', set: { n0: pop(0), n1: pop(150), n2: pop(300) } },
      { say: 'μ 当时给三个编辑的概率：0.40、0.40、0.20。记录下来的编辑就是从这里采出来的。', set: { m0: grow(0.40 * BW), m1: grow(0.40 * BW, 150), m2: grow(0.20 * BW, 300), mt0: fade(600), mt1: fade(750), mt2: fade(900) } },
      { say: '现在的 π_θ 已经变了：0.70、0.20、0.10。', set: { p0: grow(0.70 * BW), p1: grow(0.20 * BW, 150), p2: grow(0.10 * BW, 300), pt0: fade(600), pt1: fade(750), pt2: fade(900) } },
      { say: '正确的编辑：0.70 ÷ 0.40 = 1.75。它在新策略下更常见，样本权重放大。', set: { r0: mix(pop(0), { num: { to: 1.75, dur: 700, delay: 200 } }) }, hl: [4], data: { '比率（None 检查）': { v: 1.75, at: 300 } },
        fx: [{ type: 'ripple', obj: 'r0', color: C.warn, at: 900 }], log: [{ s: 'check None     mu=0.40 pi=0.70 ratio=1.75', at: 300 }] },
      { say: '不完整的编辑：0.20 ÷ 0.40 = 0.50。保持原样：0.10 ÷ 0.20 = 0.50。它们在新策略下变少了，权重缩小。', set: { r1: mix(pop(0), { num: { to: 0.5, dur: 700, delay: 200 } }), r2: mix(pop(300), { num: { to: 0.5, dur: 700, delay: 500 } }) }, hl: [4],
        data: { '比率（get）': { v: 0.5, at: 300 } }, log: [{ s: 'get(...,3)     mu=0.40 pi=0.20 ratio=0.50', at: 300 }, { s: 'keep original  mu=0.20 pi=0.10 ratio=0.50', at: 600 }] },
      { say: 'R(a) 是做了这个动作之后的最终奖励。只有正确的编辑最后能过全部测试。', set: { R0: pop(0), R1: pop(150), R2: pop(300) }, hl: [3] },
      { say: '重要性采样：在固定的历史下，用 μ 的样本乘上比率。这样期望就等于按 π_θ 采样的期望。', set: { eq: pop(0) } },
      { say: '两边各算一遍（补充复算）：都是 0.70。比率把旧数据"改写"成了新策略的数据。', set: { e1: pop(0), e2: pop(500) }, hl: [5, 6], data: { '𝔼_π[R]': { v: 0.7, at: 300 }, '𝔼_μ[比率·R]': { v: 0.7, at: 800 } },
        fx: [{ type: 'burst', obj: 'e2', color: C.ok, at: 1000 }], log: [{ s: 'E_pi[R] = 0.70 ; E_mu[(pi/mu) R] = 0.70', at: 900 }] }
    ]
  };

  /* ---------------- 场景 2：整条轨迹的比率 ---------------- */
  var CODE2 = { lang: 'py', title: '本机实跑 · 第 4 部分', src:
'for n in (10, 50, 100):\n' +
'    print(1.05 ** n)     # 1.63  11.47  131.50\n' +
'\n' +
'# 前面一步的比率改变后面到达的历史\n' +
'reach = 0.10 / 0.40    # 0.25\n' +
'nxt   = 0.50 / 0.50    # 1.00\n' };
  var sc2 = {
    name: '整条轨迹的比率', desc: '整条轨迹的比率是每一步比率的连乘。每步只差 5%，乘 100 次就到约 132。前面的动作还会改变后面到达的历史（讲义第 24–26 页）。',
    code: CODE2, dataTitle: '连乘', data: { 'n（动作数）': 0, 'w = 1.05ⁿ': 1, '到达比率': 0, '下一个动作比率': 0 },
    dataFmt: { 'w = 1.05ⁿ': 'fixed2', '到达比率': 'fixed2', '下一个动作比率': 'fixed2' },
    bg: function (d) {
      title(d, 'w(τ|x) = Π_t π_θ(a_t|h_t) / μ(a_t|h_t)（环境不变，只乘策略的比率）');
      d.line(700, 470, 820, 470, { stroke: C.line, sw: 1.5 });
    },
    objects: function () {
      var o = {};
      for (var i = 0; i < 10; i++) {
        o['a' + i] = cell(70 + i * 58, 100, '×1.05', 'warn', 52, 30, 11.5);
      }
      o.dots = { type: 'text', x: 650, y: 100, text: '…', size: 18, weight: 800, color: C.fg3, anchor: 'middle', opacity: 0 };
      o.cnt = { type: 'box', x: 330, y: 190, w: 300, h: 50, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.6, text: '', num: 1, fmt: 'fixed2', pre: 'w = 1.05ⁿ = ', size: 16, weight: 800, mono: false, opacity: 0 };
      o.nn = { type: 'text', x: 330, y: 236, text: '', num: 0, fmt: 'int', pre: 'n = ', size: 12.5, weight: 700, mono: true, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.bar = { type: 'box', x: 760, y: 470, w: 60, h: 2.6, rx: 4, anchor: 'bc', fill: C.warn, stroke: 'none', opacity: 0 };
      o.bt = { type: 'text', x: 760, y: 455, text: '', num: 1, fmt: 'fixed1', size: 13, weight: 800, mono: true, color: C.warn, anchor: 'middle', opacity: 0 };
      o.one = { type: 'text', x: 760, y: 492, text: '1 = 没有失配', size: 11, weight: 700, color: C.fg3, anchor: 'middle', opacity: 0 };
      o.hv = { type: 'box', x: 330, y: 278, w: 520, h: 36, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.2, text: '高方差：少数几个样本就能主导一次更新', size: 13, weight: 750, opacity: 0 };
      o.f0 = { type: 'box', x: 120, y: 410, w: 190, h: 64, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '前面的编辑：加 None 检查', sub: 'μ 40%　π_θ 10%', subMono: false, subSize: 11.5, size: 12, weight: 750, opacity: 0 };
      o.f1 = { type: 'box', x: 340, y: 410, w: 170, h: 64, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '记录的历史', sub: '代码里已经有这个检查', subMono: false, subSize: 11.5, size: 12, weight: 750, opacity: 0 };
      o.f2 = { type: 'box', x: 560, y: 410, w: 170, h: 64, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '下一个动作：跑测试', sub: 'μ 50%　π_θ 50%', subMono: false, subSize: 11.5, size: 12, weight: 750, opacity: 0 };
      o.w0 = wire('M215,410 L255,410', C.data); o.w1 = wire('M425,410 L475,410', C.data);
      o.k0 = { type: 'box', x: 230, y: 500, w: 250, h: 34, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.2, text: '到达这个历史：0.10 / 0.40 = 0.25', size: 12.5, weight: 750, opacity: 0 };
      o.k1 = { type: 'box', x: 560, y: 500, w: 200, h: 34, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '这一步：0.50 / 0.50 = 1', size: 12.5, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = { dots: fade(1100) }; for (var i = 0; i < 10; i++) s['a' + i] = pop(i * 90); return { say: '一条长轨迹，每个动作的比率只差一点（讲义的例子：1.05）。', set: s }; })(),
      { say: '乘到第 10 个动作：1.05¹⁰ ≈ 1.63。', set: { cnt: mix(pop(0), { num: { to: 1.63, dur: 800, delay: 200 } }), nn: mix(fade(0), { num: { to: 10, dur: 800, delay: 200 } }), bar: mix(pop(0), { h: { to: 1.63 * 2.6, dur: 800, delay: 200 } }), bt: mix(fade(0), { num: { to: 1.63, dur: 800, delay: 200 }, y: { to: 470 - 1.63 * 2.6 - 12, dur: 800, delay: 200 } }), one: fade(300) },
        hl: [1, 2], data: { 'n（动作数）': { v: 10, at: 200 }, 'w = 1.05ⁿ': { v: 1.63, at: 300 } }, log: [{ s: '1.05^10 = 1.63', at: 600 }] },
      { say: '乘到第 50 个：≈ 11.47。', set: { cnt: { num: { to: 11.47, dur: 800 } }, nn: { num: { to: 50, dur: 800 } }, bar: { h: { to: 11.47 * 2.6, dur: 800 } }, bt: { num: { to: 11.47, dur: 800 }, y: { to: 470 - 11.47 * 2.6 - 12, dur: 800 } } },
        data: { 'n（动作数）': { v: 50, at: 100 }, 'w = 1.05ⁿ': { v: 11.47, at: 200 } }, log: [{ s: '1.05^50 = 11.47', at: 600 }] },
      { say: '乘到第 100 个：1.05¹⁰⁰ ≈ 132。每步只差 5%，整条轨迹的权重已经是一百多倍。', set: { cnt: { num: { to: 131.5, dur: 900 } }, nn: { num: { to: 100, dur: 900 } }, bar: { h: { to: 131.5 * 2.6, dur: 900, ease: 'out' } }, bt: { num: { to: 131.5, dur: 900 }, y: { to: 470 - 131.5 * 2.6 - 12, dur: 900, ease: 'out' } } },
        fx: [{ type: 'shake', obj: 'bar', at: 950 }], data: { 'n（动作数）': { v: 100, at: 100 }, 'w = 1.05ⁿ': { v: 131.5, at: 200 } }, log: [{ s: '1.05^100 = 131.50', at: 700 }] },
      { say: '这就是长轨迹上的高方差。少数几个样本的权重，能大到主导整次更新。', set: { hv: pop(0) } },
      { say: '还有一层：前面的动作改变后面的历史。前面加 None 检查这个编辑，μ 给 40%，π_θ 只给 10%。', set: join(on('w0', 500), { f0: pop(0), f1: pop(600) }), fx: [st('w0', 500, C.data, 3)] },
      { say: '下一个动作"跑测试"在两个策略下都是 50%。单看这一步，比率是 1……', set: join(on('w1'), { f2: pop(300), k1: pop(700) }), fx: [st('w1', 0, C.data, 3)], hl: [5], data: { '下一个动作比率': { v: 1, at: 700 } } },
      { say: '……但在 π_θ 下到达这个历史的可能性只有 0.10 ÷ 0.40 = 0.25。只看当前动作的比率会忽略这一点。', set: { k0: pop(0) }, hl: [4], data: { '到达比率': { v: 0.25, at: 300 } },
        fx: [{ type: 'pulse', obj: 'f0', color: C.bad, at: 300 }], log: [{ s: 'reach ratio = 0.10/0.40 = 0.25 ; next-action ratio = 1.00', at: 400 }] }
    ]
  };

  /* ---------------- 场景 3：PPO 裁剪 ---------------- */
  var PX = [80, 490], PW = 320;
  function px(i, r) { return PX[i] + (r - 0.4) / 1.2 * PW; }
  function py(v) { return 300 - v * 120; }
  function pts(i, arr) { return arr.map(function (p, k) { return (k ? 'L' : 'M') + px(i, p[0]).toFixed(1) + ',' + py(p[1]).toFixed(1); }).join(' '); }
  var CODE3 = { lang: 'py', title: '本机实跑 · 第 5 部分（ε = 0.2）', src:
'clip = lambda x, lo, hi: max(lo, min(hi, x))\n' +
'for A in (+1, -1):\n' +
'    for rho in (0.6, 1.0, 1.4):\n' +
'        c = clip(rho, 0.8, 1.2)\n' +
'        obj = min(rho * A, c * A)\n' +
'# 损失 = -obj（要最小化）\n' };
  var sc3 = {
    name: 'PPO 裁剪', desc: 'ρ = π_θ/μ 被裁到 [0.8, 1.2]，再和原值取最小。比率往"对的方向"走出界之后，目标就不再给额外收益（讲义第 30–32 页）。',
    code: CODE3, dataTitle: '当前这个点', data: { 'Â': 0, 'ρ': 0, 'c = clip(ρ)': 0, 'min(ρÂ, cÂ)': 0 },
    dataFmt: { 'Â': 'signed0', 'ρ': 'fixed1', 'c = clip(ρ)': 'fixed1', 'min(ρÂ, cÂ)': 'signed2' },
    bg: function (d) {
      title(d, 'J_PPO(θ) = 𝔼_t[ min(ρ_t Â_t, clip(ρ_t, 0.8, 1.2) Â_t) ]');
      [0, 1].forEach(function (i) {
        d.text(PX[i] + PW / 2, 68, i ? 'Â = −1（没帮助的动作）' : 'Â = +1（有帮助的动作）', { anchor: 'middle', size: 13, weight: 750, color: i ? C.bad : C.ok });
        d.line(PX[i], 300, PX[i] + PW + 10, 300, { stroke: C.fg3, sw: 1.2 });
        d.text(PX[i] + PW + 14, 304, 'ρ', { size: 12, weight: 700, color: C.fg3 });
      });
    },
    objects: function () {
      var o = {};
      [0, 1].forEach(function (i) {
        o['band' + i] = { type: 'box', x: px(i, 0.8), y: 88, w: px(i, 1.2) - px(i, 0.8), h: 420, rx: 0, anchor: 'tl', fill: C.warnW, stroke: 'none', opacity: 0 };
        o['raw' + i] = { type: 'path', d: pts(i, i ? [[0.4, -0.4], [1.6, -1.6]] : [[0.4, 0.4], [1.6, 1.6]]), stroke: C.fg3, sw: 1.6, dasharray: '5 5', dash: 0, opacity: 0 };
        o['cl' + i] = { type: 'path', d: pts(i, i ? [[0.4, -0.8], [0.8, -0.8], [1.6, -1.6]] : [[0.4, 0.4], [1.2, 1.2], [1.6, 1.2]]), stroke: i ? C.bad : C.ok, sw: 3.5, dash: 0, opacity: 0 };
        [0.4, 0.8, 1.2, 1.6].forEach(function (r, k) { o['tk' + i + k] = { type: 'text', x: px(i, r), y: 316, text: r.toFixed(1), size: 10.5, weight: 600, mono: true, color: C.fg3, anchor: 'middle', opacity: 1 }; });
        o['dot' + i] = { type: 'circle', x: px(i, 1.0), y: py(i ? -1 : 1), r: 7, fill: i ? C.bad : C.ok, stroke: '#fff', sw: 2, opacity: 0 };
      });
      o.lb0 = { type: 'text', x: px(0, 1.0), y: 96, text: '[0.8, 1.2]', size: 11, weight: 700, mono: true, color: C.warn, anchor: 'middle', opacity: 0 };
      o.lb1 = { type: 'text', x: px(1, 1.0), y: 96, text: '[0.8, 1.2]', size: 11, weight: 700, mono: true, color: C.warn, anchor: 'middle', opacity: 0 };
      o.rd0 = { type: 'box', x: PX[0] + PW / 2, y: 420, w: 300, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '', size: 12.5, weight: 750, mono: true, opacity: 0 };
      o.rd1 = { type: 'box', x: PX[1] + PW / 2, y: 180, w: 300, h: 40, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.2, text: '', size: 12.5, weight: 750, mono: true, opacity: 0 };
      o.ci = { type: 'box', x: 430, y: 530, w: 760, h: 36, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: 'CISPO：J = 𝔼_t[ sg(c_t) · Â_t · log π_θ(u_t|u_<t) ]。裁剪后的比率只当固定权重', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '比率 ρ_t = π_θ / μ。裁剪把界外的值换成最近的界：ε = 0.2，界是 [0.8, 1.2]。', set: { band0: fade(0), band1: fade(150), lb0: fade(300), lb1: fade(400) }, hl: [1, 4] },
      { say: '先看有帮助的动作（Â = +1）。不裁剪的话，目标就是 ρ·Â，一条斜线，比率越大越好。', set: { raw0: { opacity: { to: 1, dur: 150 }, dash: { to: 1, dur: 800, delay: 100 } } } },
      { say: 'PPO 取 min(ρÂ, cÂ)：到 1.2 之后变平。', set: { cl0: { opacity: { to: 1, dur: 150 }, dash: { to: 1, dur: 900, delay: 100 } } }, hl: [5] },
      { say: 'ρ = 1.0：两项都是 1.00，正常的梯度。', set: { dot0: pop(0), rd0: mix(pop(100), { text: { to: 'ρ=1.0  min(1.00, 1.00) = +1.00', delay: 100 } }) }, data: { 'Â': { v: 1, at: 0 }, 'ρ': { v: 1, at: 100 }, 'c = clip(ρ)': { v: 1, at: 200 }, 'min(ρÂ, cÂ)': { v: 1, at: 300 } } },
      { say: 'ρ = 1.4：已经比 μ 多给了 40%。裁剪后取 1.20，再往上推没有额外收益。这防止一次更新走太远。', set: { dot0: { x: { to: px(0, 1.4), dur: 800, ease: 'inOut' }, y: { to: py(1.2), dur: 800, ease: 'inOut' } }, rd0: { text: { to: 'ρ=1.4  min(1.40, 1.20) = +1.20', delay: 800 } } },
        fx: [{ type: 'ripple', x: px(0, 1.4), y: py(1.2), color: C.ok, at: 850 }], data: { 'ρ': { v: 1.4, at: 100 }, 'c = clip(ρ)': { v: 1.2, at: 300 }, 'min(ρÂ, cÂ)': { v: 1.2, at: 800 } },
        log: [{ s: 'A=+1 rho=1.4 clip=1.2  min=+1.20', at: 800 }] },
      { say: 'ρ = 0.6：取 min 时选的是没裁剪的 0.60。往"错的方向"偏时不打折，照样拉回来。', set: { dot0: { x: { to: px(0, 0.6), dur: 900, ease: 'inOut' }, y: { to: py(0.6), dur: 900, ease: 'inOut' } }, rd0: { text: { to: 'ρ=0.6  min(0.60, 0.80) = +0.60', delay: 900 } } },
        fx: [{ type: 'ripple', x: px(0, 0.6), y: py(0.6), color: C.ok, at: 950 }], data: { 'ρ': { v: 0.6, at: 100 }, 'c = clip(ρ)': { v: 0.8, at: 300 }, 'min(ρÂ, cÂ)': { v: 0.6, at: 900 } },
        log: [{ s: 'A=+1 rho=0.6 clip=0.8  min=+0.60', at: 900 }] },
      { say: '没帮助的动作（Â = −1）：不裁剪是 −ρ。PPO 的目标在 0.8 以下变平。', set: { raw1: { opacity: { to: 1, dur: 150 }, dash: { to: 1, dur: 700, delay: 100 } }, cl1: { opacity: { to: 1, dur: 150, delay: 500 }, dash: { to: 1, dur: 900, delay: 600 } } } },
      { say: 'ρ = 0.6：已经比 μ 少给很多，取 −0.80，再往下压没有额外收益。', set: { dot1: mix(pop(0), { x: { from: px(1, 1.0), to: px(1, 0.6), dur: 900, delay: 200, ease: 'inOut' }, y: { from: py(-1), to: py(-0.8), dur: 900, delay: 200, ease: 'inOut' } }), rd1: mix(pop(0), { text: { to: 'ρ=0.6  min(−0.60, −0.80) = −0.80', delay: 1100 } }) },
        fx: [{ type: 'ripple', x: px(1, 0.6), y: py(-0.8), color: C.bad, at: 1150 }], data: { 'Â': { v: -1, at: 0 }, 'ρ': { v: 0.6, at: 200 }, 'c = clip(ρ)': { v: 0.8, at: 400 }, 'min(ρÂ, cÂ)': { v: -0.8, at: 1100 } },
        log: [{ s: 'A=-1 rho=0.6 clip=0.8  min=-0.80', at: 1100 }] },
      { say: 'ρ = 1.4：这个坏动作反而变多了，取的是 −1.40，不裁剪，继续往下压。', set: { dot1: { x: { to: px(1, 1.4), dur: 900, ease: 'inOut' }, y: { to: py(-1.4), dur: 900, ease: 'inOut' } }, rd1: { text: { to: 'ρ=1.4  min(−1.40, −1.20) = −1.40', delay: 900 } } },
        fx: [{ type: 'ripple', x: px(1, 1.4), y: py(-1.4), color: C.bad, at: 950 }], data: { 'ρ': { v: 1.4, at: 100 }, 'c = clip(ρ)': { v: 1.2, at: 300 }, 'min(ρÂ, cÂ)': { v: -1.4, at: 900 } },
        log: [{ s: 'A=-1 rho=1.4 clip=1.2  min=-1.40', at: 900 }] },
      { say: '要最小化的损失是 −J。CISPO 用同一个裁剪比率，但只把它当成不求梯度的权重（sg）。', set: { ci: pop(0) }, hl: [6] }
    ]
  };

  /* ---------------- 场景 4：同策略蒸馏的反向 KL ---------------- */
  function S4(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(4); }
  var EQ = VZ.eq('k', ['KL =', '0.5 · ln(0.5/0.8)', '+', '0.5 · ln(0.5/0.2)', '=', { num: 0, fmt: 'fixed3', k: 'info', w: 76 }], 430, 470, { size: 14 });
  var CODE4 = { lang: 'py', title: '本机实跑 · 第 6 部分', src:
'import math\n' +
'student = [0.5, 0.5]\n' +
'teacher = [0.8, 0.2]          # q(·|h3)\n' +
'kl = sum(p * math.log(p / q)\n' +
'         for p, q in zip(student, teacher))\n' +
'# 0.5*ln(0.625) = -0.2350\n' +
'# 0.5*ln(2.5)   = +0.4581\n' +
'# kl            =  0.2231\n' };
  var sc4 = {
    name: '同策略蒸馏', desc: '历史来自学生自己的 rollout。在每个历史上，问老师要下一动作的分布。再用反向 KL 衡量两者差多少（讲义第 50–52 页）。',
    code: CODE4, dataTitle: '在 h3', data: { '学生 a3': 0, '老师 a3': 0, '第一项': 0, '第二项': 0, 'KL': 0 },
    dataFmt: { '学生 a3': 'fixed2', '老师 a3': 'fixed2', '第一项': S4, '第二项': S4, 'KL': 'fixed4' },
    bg: function (d) {
      title(d, '蒸馏：让学生在每个历史上匹配老师的下一动作概率');
      d.text(60, 100, '老师存的轨迹', { size: 12, weight: 700, color: C.fg2 });
      d.text(60, 190, '学生自己的 rollout', { size: 12, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = {}, H = ['h0', 'a0', 'h1', 'a1', 'h2', 'a2', 'h3'];
      H.forEach(function (t, k) {
        o['t' + k] = cell(230 + k * 70, 100, t, k % 2 ? 'info' : 'neutral', 56, 30, 12);
        o['s' + k] = cell(230 + k * 70, 190, t, k % 2 ? 'data' : 'neutral', 56, 30, 12);
      });
      o.off = { type: 'path', d: 'M440,118 C470,150 520,150 560,150', stroke: C.bad, sw: 2, dasharray: '5 4', arrow: 'bad', flow: 0, flowColor: C.bad, opacity: 0 };
      o.offt = { type: 'text', x: 690, y: 150, text: '学生自己犯错，走到训练集里没有的历史', size: 11.5, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.ask = wire('M680,190 C745,195 745,290 630,300', C.info);
      o.askt = { type: 'text', x: 780, y: 245, text: '问老师', size: 12, weight: 750, color: C.info, anchor: 'middle', opacity: 0 };
      ['a3', '另一个'].forEach(function (t, k) {
        var y = 300 + k * 64;
        o['lab' + k] = { type: 'text', x: 160, y: y, text: t, size: 12.5, weight: 750, color: C.fg, anchor: 'end', opacity: 0 };
        o['qb' + k] = bar(180, y - 11, C.info); o['pb' + k] = bar(180, y + 11, C.data);
        o['qt' + k] = { type: 'text', x: 0, y: y - 11, text: '', num: 0, fmt: 'fixed2', size: 11.5, weight: 750, mono: true, color: C.info, anchor: 'start', opacity: 0 };
        o['pt' + k] = { type: 'text', x: 0, y: y + 11, text: '', num: 0, fmt: 'fixed2', size: 11.5, weight: 750, mono: true, color: C.data, anchor: 'start', opacity: 0 };
      });
      o.leg = { type: 'text', x: 640, y: 372, text: '紫：老师 q　蓝：学生 π_θ', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      o.min = { type: 'box', x: 430, y: 530, w: 640, h: 36, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: 'L_OPD = 𝔼_{h∼d_μ}[ D_KL(π_θ(·|h) ‖ q(·|h)) ]：在学生的历史上平均，再最小化', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; for (var k = 0; k < 7; k++) s['t' + k] = pop(k * 90); return { say: '普通蒸馏：在老师存下的轨迹上训练学生。在 h3，老师给 a3 80%，另一个动作 20%。', set: s }; })(),
      { say: '问题是：学生自己行动时会犯错。错误可能把它带到训练集里没有的历史。', set: { off: { opacity: { to: 1, dur: 200 }, flow: { to: 1, dur: 200 } }, offt: fade(300) }, fx: [st('off', 0, C.bad, 3)] },
      (function () { var s = { off: { opacity: { to: 0.25, dur: 300 } }, offt: { opacity: { to: 0.25, dur: 300 } } }; for (var k = 0; k < 7; k++) s['s' + k] = pop(200 + k * 90);
        return { say: '同策略蒸馏：让学生自己生成历史。"同策略"指历史来自学生的 rollout。', set: s }; })(),
      { say: '在学生走到的 h3 上问老师要目标：q(a3|h3) = 0.8，另一个 0.2。', set: join(on('ask'), { askt: fade(0), lab0: fade(300), lab1: fade(300), qb0: grow(0.8 * 380, 400), qb1: grow(0.2 * 380, 550), qt0: mix(fade(400), { x: { to: 188 + 0.8 * 380, dur: 0 }, num: { to: 0.8, dur: 700, delay: 400 } }), qt1: mix(fade(550), { x: { to: 188 + 0.2 * 380, dur: 0 }, num: { to: 0.2, dur: 700, delay: 550 } }) }),
        fx: [st('ask', 0, C.info, 4)], hl: [2], data: { '老师 a3': { v: 0.8, at: 500 } } },
      { say: '学生现在给两个动作一样的概率：0.5、0.5。', set: { pb0: grow(0.5 * 380), pb1: grow(0.5 * 380, 150), pt0: mix(fade(0), { x: { to: 188 + 0.5 * 380, dur: 0 }, num: { to: 0.5, dur: 700 } }), pt1: mix(fade(150), { x: { to: 188 + 0.5 * 380, dur: 0 }, num: { to: 0.5, dur: 700, delay: 150 } }), leg: fade(300) },
        hl: [1], data: { '学生 a3': { v: 0.5, at: 300 } } },
      { say: '手推反向 KL（自然对数），先摆出两项：学生的概率乘 ln(学生 ÷ 老师)。', set: VZ.show(EQ, 0, 80), hl: [3, 4] },
      { say: '第一项：0.5 × ln(0.625) = −0.2350（学生给得比老师少，这项为负）。', fx: [{ type: 'pulse', obj: 'k1', color: C.data, at: 100 }, { type: 'float', obj: 'k1', dy: -30, text: '−0.2350', color: C.data, at: 300 }], hl: [5],
        data: { '第一项': { v: -0.235, at: 300 } }, log: [{ s: '0.5*ln(0.5/0.8) = -0.2350', at: 300 }] },
      { say: '第二项：0.5 × ln(2.5) = +0.4581（学生给得比老师多）。', fx: [{ type: 'pulse', obj: 'k3', color: C.data, at: 100 }, { type: 'float', obj: 'k3', dy: -30, text: '+0.4581', color: C.data, at: 300 }], hl: [6],
        data: { '第二项': { v: 0.4581, at: 300 } }, log: [{ s: '0.5*ln(0.5/0.2) = +0.4581', at: 300 }] },
      { say: '相加：KL ≈ 0.223。这是一个每步都有的稠密信号，不用等最终奖励。', set: { k5: { num: { to: 0.2231, dur: 800, delay: 100 } } }, fx: [{ type: 'burst', obj: 'k5', color: C.info, at: 900 }], hl: [7],
        data: { 'KL': { v: 0.2231, at: 400 } }, log: [{ s: 'KL = 0.2231', at: 700 }] },
      { say: '最小化它，学生的分布就往老师靠。完全一样时 KL = 0（补充复算）。', set: { min: pop(0), pb0: { w: { to: 0.8 * 380, dur: 900, delay: 300 } }, pb1: { w: { to: 0.2 * 380, dur: 900, delay: 300 } },
          pt0: { x: { to: 188 + 0.8 * 380, dur: 900, delay: 300 }, num: { to: 0.8, dur: 900, delay: 300 } }, pt1: { x: { to: 188 + 0.2 * 380, dur: 900, delay: 300 }, num: { to: 0.2, dur: 900, delay: 300 } }, k5: { num: { to: 0, dur: 900, delay: 300 } } },
        data: { '学生 a3': { v: 0.8, at: 600 }, 'KL': { v: 0, at: 900 } }, log: [{ s: 'if student == teacher (0.8/0.2): KL = 0.0000', at: 1000 }] }
    ]
  };

  VZ.register({
    id: 'c6-offpolicy', title: '稳定的更新：重要性采样、PPO 裁剪与蒸馏的 KL',
    sources: [{ t: '第 11 讲（稳定的更新、向老师学）', u: YT }, { t: '讲义 lecture-11 第 22–32、50–52 页', u: L11 }],
    note: 'μ / π_θ 的三组概率、1.75 和 0.50、1.05¹⁰⁰ ≈ 132、0.25、ε = 0.2、老师 0.8 / 0.2、学生 0.5 / 0.5、KL ≈ 0.223 都照讲义。两边期望都是 0.70、1.05¹⁰ 和 1.05⁵⁰、PPO 图上的几个 ρ 取值、"学生和老师一样时 KL = 0"是本机实算补充的。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

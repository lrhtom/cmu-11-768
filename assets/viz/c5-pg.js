/* 05 · 第 9 讲 —— 从奖励到梯度：猜数字与期望奖励、ReST 过滤、策略梯度的手推、老虎机里的基线
 * 场景 1：猜数字的四条轨迹和 J = 0.50 照讲义 lecture-09 第 2、13 页；"二分策略 15/16"是 本机验算脚本 第 4 部分实跑（补充）。
 * 场景 2：ReST 的 Grow / Improve 照第 15–16 页。
 * 场景 3：推导五行照第 19 页，"像 SFT 一样做掩码和缩放"照第 21–22 页。
 * 场景 4：老虎机的 p = 0.25、梯度 +0.75 / 0、+0.375 / +0.125、E[ĝ] = 0.1875、SD 0.325 / 0.108 照第 30–33 页，全部由 verify.py 第 5 部分复算一致。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L9 = 'https://www.cmu-agents.com/slides/lecture-09-rl-basics.pdf', YT = 'https://youtu.be/paAcPaaYZGM';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  var TRAJ = [['8', 'higher', '12', 'lower', '10', 'higher', '11', 'correct', 1], ['4', 'higher', '8', 'higher', '12', 'lower', '11', 'correct', 1],
    ['16', 'lower', '8', 'higher', '9', 'higher', '10', 'timeout', 0], ['1', 'higher', '2', 'higher', '3', 'higher', '4', 'timeout', 0]];
  var PR = [0.30, 0.20, 0.25, 0.25];
  function trajObjs(pre, y0, dy, op) {
    var o = {};
    TRAJ.forEach(function (tr, i) {
      o[pre + 'n' + i] = { type: 'text', x: 70, y: y0 + i * dy, text: 'τ' + (i + 1), size: 13, weight: 750, mono: true, color: C.fg2, anchor: 'middle', opacity: op };
      for (var k = 0; k < 8; k++) {
        var isG = k % 2 === 0, last = k === 7;
        o[pre + i + '_' + k] = { type: 'box', x: 120 + k * 64, y: y0 + i * dy, w: 60, h: 28, rx: 5, fill: isG ? C.dataW : C.bg2, stroke: isG ? C.data : C.line, sw: 1.1,
          text: tr[k], size: 11.5, weight: isG ? 750 : 600, mono: isG, color: last ? (tr[8] ? C.ok : C.bad) : C.fg, opacity: op };
      }
      o[pre + 'r' + i] = { type: 'text', x: 652, y: y0 + i * dy, text: 'R = ' + tr[8], size: 13, weight: 750, mono: true, color: tr[8] ? C.ok : C.bad, anchor: 'start', opacity: op };
    });
    return o;
  }

  /* ---------------- 场景 1：猜数字与期望奖励 ---------------- */
  var sc1 = {
    name: '期望奖励', desc: '1–16 藏一个数，四次机会。猜错告诉你更大还是更小，猜中奖励 1。目标是最大化期望奖励 J（讲义第 2、13 页）。',
    bg: function (d) { title(d, '贯穿例子：猜数字（隐藏的数是 11）'); },
    objects: function () {
      var o = trajObjs('a', 90, 44, 0);
      PR.forEach(function (p, i) {
        o['pb' + i] = { type: 'box', x: 700, y: 90 + i * 44, w: 0, h: 18, rx: 3, anchor: 'l', fill: TRAJ[i][8] ? C.data : C.bad, stroke: 'none', opacity: 0 };
        o['pt' + i] = { type: 'text', x: 700, y: 72 + i * 44, text: p.toFixed(2) + ' × ' + TRAJ[i][8], size: 11, weight: 700, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
      });
      o.J = { type: 'box', x: 430, y: 340, w: 520, h: 50, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.6, text: 'J(θ) = 𝔼_τ∼p_θ [R(τ)] = 0.30 + 0.20 + 0 + 0 = 0.50', size: 14, weight: 800, mono: false, opacity: 0 };
      o.mv = { type: 'box', x: 430, y: 420, w: 560, h: 40, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '训练 = 把概率质量从低奖励的轨迹挪到高奖励的轨迹', size: 13, weight: 700, opacity: 0 };
      o.ex = { type: 'box', x: 430, y: 490, w: 560, h: 44, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.2, dasharray: '5 4', text: '补充（本机实跑）：每次猜中点的二分策略，16 个数里猜中 15 个', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; for (var i = 0; i < 4; i++) { s['an' + i] = fade(i * 400); for (var k = 0; k < 8; k++) s['a' + i + '_' + k] = pop(i * 400 + k * 50); s['ar' + i] = fade(i * 400 + 450); }
        return { say: '同一个任务（藏的是 11）的四条轨迹。τ1、τ2 走法不同，但都猜中。τ3、τ4 四次用完，超时。', set: s }; })(),
      { say: '奖励只在最后给：猜中 1，否则 0。τ1 和 τ2 动作不同、结果一样。完成任务的方式不止一种。', fx: [{ type: 'pulse', obj: 'a0_7', color: C.ok, at: 100 }, { type: 'pulse', obj: 'a1_7', color: C.ok, at: 300 }, { type: 'shake', obj: 'a2_7', at: 500 }, { type: 'shake', obj: 'a3_7', at: 700 }] },
      (function () { var s = {}; PR.forEach(function (p, i) { s['pb' + i] = { opacity: { to: 1, dur: 150, delay: i * 200 }, w: { to: p * 250, dur: 600, delay: i * 200, ease: 'out' } }; s['pt' + i] = fade(i * 200 + 300); });
        return { say: '当前策略走出每条轨迹的概率（讲义上的例子）：0.30、0.20、0.25、0.25。', set: s }; })(),
      { say: '期望奖励 J 是"概率 × 奖励"的总和：0.30 + 0.20 = 0.50。', set: { J: pop(0) }, fx: [{ type: 'burst', obj: 'J', color: C.ok, at: 500 }] },
      { say: '训练要调 θ 让 J 变大。也就是让高奖励的轨迹更可能，低奖励的更不可能。', set: { mv: pop(0), pb0: { w: { to: 0.40 * 250, dur: 800, delay: 300 } }, pb1: { w: { to: 0.30 * 250, dur: 800, delay: 300 } }, pb2: { w: { to: 0.15 * 250, dur: 800, delay: 300 } }, pb3: { w: { to: 0.15 * 250, dur: 800, delay: 300 } } },
        fx: [{ type: 'float', x: 760, y: 70, text: '示意', color: C.fg3, size: 12, at: 400 }] },
      { say: '一个"完美"的策略能做到多好？每次猜剩余区间的中点。16 个可能的数里能猜中 15 个（本机实跑，补充）。', set: { ex: pop(0) }, log: [{ s: 'binary search success over hidden 1..16: 15/16 = 0.9375', at: 300 }] }
    ]
  };

  /* ---------------- 场景 2：ReST ---------------- */
  var sc2 = {
    name: 'ReST：过滤再 SFT', desc: '最简单的 RL：从当前策略采样、算奖励、只留成功的。用标准 SFT 损失训练，再用新策略采样（讲义第 15–16 页）。',
    bg: function (d) { title(d, 'ReST：Grow（采样）→ Improve（过滤 + 训练）→ Repeat'); },
    objects: function () {
      var o = trajObjs('b', 110, 46, 0);
      ['KEEP', 'KEEP', 'DROP', 'DROP'].forEach(function (k, i) { o['k' + i] = { type: 'text', x: 720, y: 110 + i * 46, text: k, size: 12, weight: 800, color: i < 2 ? C.ok : C.bad, anchor: 'start', opacity: 0 }; });
      o.pol = { type: 'box', x: 150, y: 420, w: 130, h: 50, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '策略 π_θ', size: 14, weight: 750, opacity: 0 };
      o.sft = { type: 'box', x: 690, y: 420, w: 150, h: 50, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, text: 'SFT 损失', sub: '只在 τ1、τ2 上', subMono: false, subSize: 11, size: 14, weight: 750, opacity: 0 };
      o.pg = wire('M216,410 C300,300 340,240 380,210', C.info);
      o.pf = wire('M600,170 C680,260 690,330 690,392', C.ok);
      o.pu = wire('M612,430 C460,470 300,470 216,432', C.warn);
      o.eq = { type: 'box', x: 430, y: 520, w: 520, h: 34, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: 'L_ReST = − Σ_{τ: R(τ)=1} Σ_t log π_θ(a_t | h_t)', size: 13, weight: 750, mono: true, opacity: 0 };
      return o;
    },
    steps: [
      { say: 'Grow：用当前策略在任务上采样一批轨迹。', set: join({ pol: pop(0) }, on('pg', 200)), fx: [st('pg', 300, C.info, 5)] },
      (function () { var s = {}; for (var i = 0; i < 4; i++) { s['bn' + i] = fade(i * 200); for (var k = 0; k < 8; k++) s['b' + i + '_' + k] = pop(i * 200 + k * 40); s['br' + i] = fade(i * 200 + 400); }
        return { say: '算每条的奖励：两条成功、两条超时。', set: s }; })(),
      (function () { var s = { k0: fade(0), k1: fade(100), k2: fade(200), k3: fade(300) };
        for (var i = 2; i < 4; i++) { s['bn' + i] = fade(400, 300, 0.25); s['br' + i] = fade(400, 300, 0.25); for (var k = 0; k < 8; k++) s['b' + i + '_' + k] = fade(400, 300, 0.25); }
        return { say: 'Improve：按奖励过滤，只留下 R = 1 的 τ1、τ2，失败的直接丢掉。', set: s }; })(),
      { say: '在留下的轨迹上做标准的 SFT。损失和上一讲一模一样。', set: join(on('pf'), { sft: pop(500), eq: pop(900) }), fx: [st('pf', 100, C.ok, 5)] },
      { say: 'Repeat：用更新后的策略再采样下一批。它学的是自己做成功的轨迹。所以没有"只见过别人示范"的问题。', set: on('pu'), fx: [st('pu', 100, C.warn, 6), { type: 'pulse', obj: 'pol', color: C.info, at: 900 }] },
      { say: '可它也有局限：失败的轨迹一点信号都不给（R = 0，直接丢掉）。下一个场景推出一般的策略梯度。', fx: [{ type: 'flash', obj: 'b2_7', color: C.bad, at: 100 }, { type: 'flash', obj: 'b3_7', color: C.bad, at: 300 }] }
    ]
  };

  /* ---------------- 场景 3：策略梯度的推导 ---------------- */
  var LINES = [['∇J = ∇ Σ_τ p_θ(τ) R(τ)', '期望奖励，对 θ 求梯度'], ['   = Σ_τ ∇p_θ(τ) R(τ)', '只有概率依赖 θ，R(τ) 是环境给的'],
    ['   = Σ_τ p_θ(τ) R(τ) ∇p_θ(τ) / p_θ(τ)', '乘一个、除一个轨迹概率'], ['   = Σ_τ p_θ(τ) R(τ) ∇log p_θ(τ)', '用 ∇p / p = ∇log p'],
    ['   = 𝔼_τ∼p_θ [ R(τ) ∇log p_θ(τ) ]', '变回一个期望：可以用采样估计'], ['∇log p_θ(τ) = Σ_t ∇log π_θ(a_t | h_t)', '环境的概率与 θ 无关，求导时消失']];
  var sc3 = {
    name: '推导策略梯度', desc: '采样和环境都不可微。但期望奖励的梯度，可以改写成"奖励 × 对数概率的梯度"的期望。这个期望能用采样估计（讲义第 18–22 页）。',
    bg: function (d) { title(d, 'REINFORCE：∇J = 𝔼[R(τ) ∇log p_θ(τ)]'); },
    objects: function () {
      var o = {};
      LINES.forEach(function (l, i) {
        o['e' + i] = { type: 'text', x: 70, y: 96 + i * 52, text: l[0], size: 15, weight: 700, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
        o['w' + i] = { type: 'text', x: 820, y: 96 + i * 52, text: l[1], size: 11.5, weight: 600, color: C.fg3, anchor: 'end', opacity: 0 };
      });
      o.hl = { type: 'box', x: 430, y: 96, w: 780, h: 40, rx: 6, fill: 'none', stroke: C.warn, sw: 1.6, opacity: 0 };
      o.loss = { type: 'box', x: 430, y: 440, w: 640, h: 46, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, text: 'L_PG = − R(τ) Σ_{t: m_t=1} log π_θ(u_t | u_<t)', size: 14, weight: 800, mono: true, opacity: 0 };
      o.cmp = { type: 'box', x: 430, y: 506, w: 640, h: 40, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '= 上一讲的 SFT 损失：同样的掩码，只是每个 token 乘上了 R(τ)', size: 13, weight: 700, opacity: 0 };
      return o;
    },
    steps: (function () {
      var steps = [{ say: '不能直接反向传播。动作是离散采样出来的。环境也没法求导，单元测试没法对代码求导。先把 J 写成对所有轨迹的求和。', set: { e0: fade(0), w0: fade(300), hl: fade(400) } }];
      var says = ['奖励 R(τ) 是 rollout 之后观察到的，不依赖 θ。梯度只落在轨迹概率上。', '一个小技巧：乘一个、除一个 p_θ(τ)。', '因为 ∇p / p = ∇log p，就变成了这个样子。',
        '这又是一个关于 p_θ 的期望。从当前策略采样轨迹，用样本均值估计。这就是 REINFORCE。', '轨迹的对数概率 = 环境部分 + 策略部分。环境部分与 θ 无关，求导就只剩每一步动作的 log π_θ。'];
      for (var i = 1; i < 6; i++) {
        var s = {}; s['e' + i] = fade(0); s['w' + i] = fade(300); s.hl = { y: { to: 96 + i * 52, dur: 600, ease: 'inOut' } };
        steps.push({ say: says[i - 1], set: s, fx: [{ type: 'flash', obj: 'e' + i, color: C.warn, at: 200 }] });
      }
      steps.push({ say: '落到实现上，和 SFT 一样把 token 的对数概率加起来。只算策略自己生成的 token，再乘上这条轨迹的奖励 R(τ)。', set: { loss: pop(0), cmp: pop(500), hl: fade(0, 300, 0) } });
      return steps;
    })()
  };

  /* ---------------- 场景 4：老虎机与基线（手推） ---------------- */
  var CODE4 = { lang: 'py', title: '本机实跑的代码（精简）', src:
'p = 0.25                  # σ(-1.1)\n' +
'for b in (0.0, 0.5):\n' +
'    gA = (1 - b) * (1 - p)   # 采到 A，R=1\n' +
'    gB = (0 - b) * (-p)      # 采到 B，R=0\n' +
'    Eg = p * gA + (1 - p) * gB\n' +
'    sd = sqrt(p * (gA - Eg)**2\n' +
'              + (1 - p) * (gB - Eg)**2)\n' +
'    print(b, gA, gB, Eg, sd)\n' };
  var EA = VZ.eq('qa', ['ĝ(A) = (', { slot: 1, w: 46 }, '−', { slot: 1, w: 46 }, ') ×', { slot: 1, w: 60 }, '=', { num: 0, fmt: 'fixed3', k: 'ok', w: 70 }], 430, 330, { size: 14 });
  var EB = VZ.eq('qb', ['ĝ(B) = (', { slot: 1, w: 46 }, '−', { slot: 1, w: 46 }, ') ×', { slot: 1, w: 60 }, '=', { num: 0, fmt: 'fixed3', k: 'ok', w: 70 }], 430, 380, { size: 14 });
  var EE = VZ.eq('qe', ['𝔼[ĝ] = 0.25 ×', { slot: 1, w: 64 }, '+ 0.75 ×', { slot: 1, w: 64 }, '=', { num: 0, fmt: 'fixed4', k: 'info', w: 80 }], 430, 434, { size: 14 });
  function fly(n, txt, fx, fy, tx, ty, delay) { var s = {}; s[n] = { text: { to: txt, delay: 0 }, opacity: { from: 1, to: 0, dur: 150, delay: delay + 800 }, x: { from: fx, to: tx, dur: 800, delay: delay, ease: 'inOut' }, y: { from: fy, to: ty, dur: 800, delay: delay, ease: 'inOut' } }; return s; }
  function fl(slot, txt, delay) { var s = {}; s[slot] = { text: { to: txt, delay: delay } }; return s; }
  var sc4 = {
    name: '老虎机与基线', desc: '一个参数、两个动作，梯度能精确算。基线 b 不改变期望梯度（0.1875）。它却把标准差从 0.325 降到 0.108，方差只剩约九分之一。失败也开始提供信号（讲义第 30–33 页）。',
    code: CODE4, dataTitle: '实算', data: { 'b': 0, 'ĝ(A)': 0, 'ĝ(B)': 0, '𝔼[ĝ]': 0, '标准差': 0 }, dataFmt: { 'b': 'fixed2', 'ĝ(A)': 'fixed3', 'ĝ(B)': 'fixed3', '𝔼[ĝ]': 'fixed4', '标准差': 'fixed3' },
    bg: function (d) {
      title(d, '两臂老虎机：p = π_θ(猜 A) = σ(θ)，θ = −1.1 → p = 0.25');
      d.text(70, 100, '猜 A：概率 0.25，奖励 1，斜率 ∂log π(A)/∂θ = 1 − p = +0.75', { size: 12.5, weight: 650, color: C.data });
      d.text(70, 130, '猜 B：概率 0.75，奖励 0，斜率 ∂log π(B)/∂θ = −p = −0.25', { size: 12.5, weight: 650, color: C.bad });
      d.text(70, 190, '一次采样的梯度估计：ĝ = (R − b) · ∂log π_θ(a)/∂θ', { size: 13, weight: 750, color: C.fg });
    },
    objects: function () {
      var o = {};
      [EA, EB, EE].forEach(function (E) { for (var k in E.objs) o[k] = E.objs[k]; });
      ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'].forEach(function (n) { o[n] = { type: 'box', x: 0, y: 0, w: 50, h: 24, rx: 5, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '', size: 12, weight: 750, mono: true, opacity: 0 }; });
      o.bl = { type: 'box', x: 160, y: 250, w: 150, h: 36, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.6, text: '', num: 0, fmt: 'fixed2', pre: '基线 b = ', size: 14, weight: 800, mono: true, opacity: 0 };
      o.sd = { type: 'box', x: 430, y: 500, w: 560, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, text: '', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      { say: '先不加基线（b = 0）。采到 A（奖励 1）：(1 − 0) × 0.75 = +0.75，A 变得更可能。', set: join({ bl: pop(0) }, VZ.show(EA, 200, 50), fly('f1', '1', 300, 100, EA.xs[1], 330, 600), fl('qa1', '1', 1400), fly('f2', '0', 160, 250, EA.xs[3], 330, 700), fl('qa3', '0', 1500), fly('f3', '0.75', 560, 100, EA.xs[5], 330, 800), fl('qa5', '0.75', 1600), { qa7: { num: { to: 0.75, dur: 600, delay: 1700 } } }),
        hl: [3], data: { 'b': 0, 'ĝ(A)': { v: 0.75, at: 1700 } } },
      { say: '采到 B（奖励 0）：(0 − 0) × (−0.25) = 0。失败什么都没教。', set: join(VZ.show(EB, 0, 50), fly('f4', '0', 300, 130, EB.xs[1], 380, 300), fl('qb1', '0', 1100), fly('f5', '0', 160, 250, EB.xs[3], 380, 400), fl('qb3', '0', 1200), fly('f6', '−0.25', 560, 130, EB.xs[5], 380, 500), fl('qb5', '−0.25', 1300)),
        hl: [4], data: { 'ĝ(B)': { v: 0, at: 1400 } } },
      { say: '期望：0.25 × 0.75 + 0.75 × 0 = 0.1875，正好是真实梯度 p(1 − p)。估计是对的，但只有 1/4 的样本在学东西。', set: join(VZ.show(EE, 0, 60), fly('f7', '0.75', EA.xs[7], 330, EE.xs[1], 434, 300), fl('qe1', '0.75', 1100), fly('f8', '0', EB.xs[7], 380, EE.xs[3], 434, 400), fl('qe3', '0', 1200), { qe5: { num: { to: 0.1875, dur: 700, delay: 1300 } } }),
        hl: [5], data: { '𝔼[ĝ]': { v: 0.1875, at: 1300 }, '标准差': { v: 0.3248, at: 1600 } }, log: [{ s: 'baseline b=0.00: g(A)=+0.7500 g(B)=-0.0000  E[g]=0.1875  SD=0.3248', at: 1500 }] },
      { say: '加一个基线 b = 0.5。"比预期好"的奖励得正优势，"比预期差"的得负优势。', set: { bl: { num: { to: 0.5, dur: 600 } } }, data: { 'b': { v: 0.5, at: 300 } }, fx: [{ type: 'pulse', obj: 'bl', color: C.warn, at: 300 }] },
      { say: '采到 A：(1 − 0.5) × 0.75 = +0.375。', set: join(fl('qa3', '0.5', 300), { qa7: { num: { to: 0.375, dur: 600, delay: 500 } } }), fx: [{ type: 'flash', obj: 'qa3', color: C.warn, at: 300 }], hl: [3], data: { 'ĝ(A)': { v: 0.375, at: 500 } } },
      { say: '采到 B：(0 − 0.5) × (−0.25) = +0.125。失败也有信号了：降低 B，就等于提高 A。', set: join(fl('qb3', '0.5', 300), { qb7: { num: { to: 0.125, dur: 600, delay: 500 } } }), fx: [{ type: 'flash', obj: 'qb3', color: C.warn, at: 300 }, { type: 'burst', obj: 'qb7', color: C.ok, at: 1100 }], hl: [4], data: { 'ĝ(B)': { v: 0.125, at: 500 } } },
      { say: '期望还是 0.25 × 0.375 + 0.75 × 0.125 = 0.1875。基线不改变期望梯度。', set: join(fl('qe1', '0.375', 200), fl('qe3', '0.125', 300), { qe5: { num: { from: 0.1875, to: 0.1875, dur: 400, delay: 400 } } }), hl: [5],
        log: [{ s: 'baseline b=0.50: g(A)=+0.3750 g(B)=+0.1250  E[g]=0.1875  SD=0.1083', at: 500 }] },
      { say: '但两次采样给出的值更接近了。标准差从 0.325 降到 0.108，估计的噪声小多了（讲义第 32–33 页）。', set: { sd: mix(pop(0), { text: { to: 'b = 0 → 标准差 0.325 ｜ b = 0.5 → 标准差 0.108 ｜ 期望都是 0.1875', delay: 0 } }) }, data: { '标准差': { v: 0.1083, at: 300 } }, hl: [6, 7] },
      { say: '讲义的证明：对任何只依赖历史的基线，𝔼[b(h)∇log π] = b(h)∇Σπ = b(h)∇1 = 0。所以不引入偏差。在这个例子里，b = 0.75 时两个值都等于 0.1875，标准差是 0。', log: [{ s: '  b=0.75  g(A)=0.1875 g(B)=0.1875  E=0.1875 SD=0.0000', at: 300 }] }
    ]
  };

  VZ.register({
    id: 'c5-pg', title: '从奖励到梯度：期望奖励、ReST、REINFORCE 与基线',
    sources: [{ t: '第 9 讲（RL Foundations for Agents）', u: YT }, { t: '讲义 lecture-09 第 2–33 页', u: L9 }],
    note: '场景 1 的轨迹和概率照讲义第 2、13 页。"二分策略 15/16"是本机实跑的，讲义没有，是补充。场景 4 中概率的挪动幅度是示意。场景 2 照第 15–16 页。场景 3 的推导照第 19–22 页。场景 4 的所有数照第 30–33 页，本机逐个复算一致。b = 0.75 时方差为 0，是复算时的补充。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

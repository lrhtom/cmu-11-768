/* 02 · 第 3 讲 —— 长上下文的注意力：掩码与比较次数、线性注意力的重排、DeltaNet 的定向修正、RoPE 的相对位置
 * 场景 1：三种掩码的画法照讲义 lecture-03 第 13、18、24 页；n=8、w=3、全局键取第 0 个是示意，次数 36 / 21 / 26 是 本机验算脚本 实算。
 * 场景 2–3：公式照讲义第 20–21 页；二维的 k、v、q 是示意，每个矩阵、每个读出的数都是 verify.py 第 4 部分实算。
 * 场景 4：公式照讲义第 29、31 页；向量和 θ = 0.3 是示意，分数 0.9051 / 0.8129 是 verify.py 第 5 部分实算。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L3 = 'https://www.cmu-agents.com/slides/lecture-03-long-context.pdf', YT = 'https://youtu.be/AiwCCvFW1uE';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function box(x, y, w, h, t, k, op, size, mono) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12, weight: 700, mono: mono !== false, opacity: op == null ? 0 : op };
  }

  /* ---------------- 场景 1：三种掩码 ---------------- */
  var N = 8, CS = 22, GX = [70, 330, 590], GY = 110;
  var KIND = ['全因果', '滑动窗口 w=3', '固定稀疏：窗口 + 全局键'];
  function vis(kind, i, j) {
    if (j > i) return false;
    if (kind === 0) return true;
    if (kind === 1) return i - j < 3;
    return i - j < 3 || j === 0;
  }
  var CNT = [36, 21, 26];
  var sc1 = {
    name: '掩码与比较次数', desc: '全因果注意力里，每个查询要和全部历史比较。局部窗口只看最近 w 个。固定稀疏再加几个全局位置（讲义第 13、18、24 页）。',
    bg: function (d) {
      title(d, '注意力掩码：一个查询（行）能看到哪些键（列）');
      for (var g = 0; g < 3; g++) {
        d.text(GX[g] + N * CS / 2, 86, KIND[g], { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
        for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) d.rect(GX[g] + j * CS, GY + i * CS, CS - 3, CS - 3, { fill: C.bg2, stroke: C.line, rx: 3, sw: 0.8 });
      }
      d.text(GX[0] - 14, GY + N * CS / 2, '查询 →', { anchor: 'end', size: 11, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      for (var g = 0; g < 3; g++) {
        for (var i = 0; i < N; i++) for (var j = 0; j <= i; j++) {
          if (!vis(g, i, j)) continue;
          o['c' + g + '_' + i + '_' + j] = { type: 'box', x: GX[g] + j * CS + (CS - 3) / 2, y: GY + i * CS + (CS - 3) / 2, w: CS - 3, h: CS - 3, rx: 3, fill: (g === 2 && j === 0 && i - j >= 3) ? C.warn : C.bad, stroke: 'none', sw: 0, opacity: 0, s: 0.4 };
        }
        o['n' + g] = { type: 'text', x: GX[g] + N * CS / 2, y: GY + N * CS + 26, text: '', num: 0, fmt: 'int', post: ' 次比较', size: 14, weight: 750, mono: true, color: C.fg, anchor: 'middle', opacity: 0 };
      }
      o.cx = { type: 'box', x: 430, y: 410, w: 520, h: 34, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.3, text: '全因果 O(n²) → 窗口 O(nw)：w 固定时，计算随长度线性增长', size: 13, weight: 700, opacity: 0 };
      o.warn = { type: 'box', x: 430, y: 460, w: 520, h: 34, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, text: '代价：局部层没法直接取到远处的 token', size: 13, weight: 700, opacity: 0 };
      o.big = { type: 'text', x: 430, y: 512, text: 'n = 100,000 时：50 亿次 → 约 5,107 万次（w = 512）', size: 12.5, weight: 700, color: C.info, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}, k = 0; for (var i = 0; i < N; i++) for (var j = 0; j <= i; j++) { s['c0_' + i + '_' + j] = { opacity: { to: 1, dur: 200, delay: i * 120 + j * 25 }, s: { to: 1, dur: 350, delay: i * 120 + j * 25, ease: 'back' } }; k++; }
        s.n0 = mix(fade(1100), { num: { to: 36, dur: 800, delay: 1100 } });
        return { say: '标准的因果注意力是全局的。第 i 个查询和它之前的每个键都比较一次。8 个 token 就是 36 次。', set: s }; })(),
      (function () { var s = {}; for (var i = 0; i < N; i++) for (var j = 0; j <= i; j++) if (vis(1, i, j)) s['c1_' + i + '_' + j] = { opacity: { to: 1, dur: 200, delay: i * 110 + j * 25 }, s: { to: 1, dur: 350, delay: i * 110 + j * 25, ease: 'back' } };
        s.n1 = mix(fade(1000), { num: { to: 21, dur: 800, delay: 1000 } });
        return { say: '滑动窗口：每个查询只看最近 w = 3 个位置，对角线附近一条带。只有 21 次。', set: s }; })(),
      (function () { var s = {}; for (var i = 0; i < N; i++) for (var j = 0; j <= i; j++) if (vis(2, i, j)) s['c2_' + i + '_' + j] = { opacity: { to: 1, dur: 200, delay: i * 110 + j * 25 }, s: { to: 1, dur: 350, delay: i * 110 + j * 25, ease: 'back' } };
        s.n2 = mix(fade(1000), { num: { to: 26, dur: 800, delay: 1000 } });
        return { say: '固定稀疏模式：窗口外再留几个全局位置（橙色，这里是第 0 个）。远处的信息还有一条通道。26 次。', set: s }; })(),
      { say: '一般地，全因果是 O(n²)，窗口是 O(nw)。w 是常数，计算就随长度线性增长。', set: { cx: pop(0) } },
      { say: '代价：一个局部层不能直接取到远处的 token。所以混合模型隔几层局部，再放一层全局。', set: { warn: pop(0) }, fx: [{ type: 'shake', obj: 'warn', at: 400 }] },
      { say: '放大到 10 万个 token：全因果约 50 亿次比较。窗口 512 只要约 5,107 万次（本机实算）。', set: { big: fade(200) } }
    ]
  };

  /* ---------------- 场景 2：线性注意力的重排 ---------------- */
  var KX = 120, MX = 470, MY = 150;
  function mat(pre, x, y, vals, k) {
    var o = {};
    for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) o[pre + r + c] = { type: 'box', x: x + c * 70, y: y + r * 46, w: 62, h: 38, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: '', num: vals[r][c], fmt: 'fixed1', size: 14, weight: 750, mono: true };
    return o;
  }
  function setMat(pre, vals, delay) { var s = {}; for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) s[pre + r + c] = { num: { to: vals[r][c], dur: 600, delay: delay || 0 } }; return s; }
  var KV = [['k₁=[1,0]', 'v₁=[1,2]'], ['k₂=[0,1]', 'v₂=[0,1]'], ['k₃=[1,0]', 'v₃=[3,0]']];
  var LIN = { lang: 'py', title: '本机实跑 · 第 4 部分（线性注意力）', src:
'S = np.zeros((2, 2))\n' +
'for k, v in zip(K, V):\n' +
'    S = S + np.outer(k, v)     # 写：S += k vᵀ\n' +
'o_sum = sum((q @ k) * v for k, v in zip(K, V))\n' +
'o_S = S.T @ q                  # 读：Sᵀ q\n' };
  var EQ2 = VZ.eq('l', ['o =', 'Sᵀq =', { slot: 1, w: 92 }, '=', { slot: 1, w: 92 }], 610, 420, { size: 15 });
  var sc2 = {
    name: '线性注意力', desc: '把 softmax 换成 qᵀk，求和就能重排成 Sᵀq。历史被压进一个固定大小的矩阵 S，每步只加 k vᵀ（讲义第 20 页）。',
    code: LIN, dataTitle: '读出 o（q = [1, 0]）', data: { 'o 用求和算': '—', 'o 用 Sᵀq 算': '—' },
    bg: function (d) {
      title(d, '线性注意力：o_t = Σ (q·kᵢ) vᵢ = (Σ kᵢ vᵢᵀ)ᵀ q = S_tᵀ q');
      d.text(MX + 35, 116, '状态 S（2 × 2，大小固定）', { anchor: 'middle', size: 12.5, weight: 700, color: C.info });
      d.text(KX, 116, '依次到来的键和值（示意）', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = mat('s', MX, MY, [[0, 0], [0, 0]], 'info');
      KV.forEach(function (p, i) {
        o['k' + i] = box(KX - 50, 160 + i * 60, 96, 30, p[0], 'data', 0, 12);
        o['v' + i] = box(KX + 56, 160 + i * 60, 96, 30, p[1], 'ok', 0, 12);
        o['f' + i] = box(0, 0, 70, 26, 'k vᵀ', 'warn', 0, 12);
      });
      o.q = box(MX + 35, 330, 120, 32, 'q = [1, 0]', 'data', 0, 13);
      for (var k in EQ2.objs) o[k] = EQ2.objs[k];
      o.fx1 = box(0, 0, 90, 28, '[4, 2]', 'ok', 0, 13); o.fx2 = box(0, 0, 90, 28, '[4, 2]', 'ok', 0, 13);
      o.bad = { type: 'box', x: 430, y: 490, w: 560, h: 36, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, text: 'k₁ 和 k₃ 是同一个键：旧值没有被擦掉，读出来是两次之和（干扰）', size: 13, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '键值依次到来（二维的小例子，示意）。注意 k₃ 和 k₁ 是同一个键，但值变了。', set: { k0: pop(0), v0: pop(100), k1: pop(300), v1: pop(400), k2: pop(600), v2: pop(700) } },
      { say: '第 1 步：把 k₁ v₁ᵀ 加进 S。外积只写到 k₁ 指向的那一行。', set: mix({ f0: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: KX, to: MX + 35, dur: 900, ease: 'inOut' }, y: { from: 160, to: MY, dur: 900, ease: 'inOut' } } }, setMat('s', [[1, 2], [0, 0]], 900)), hl: [2, 3],
        fx: [{ type: 'ripple', x: MX + 35, y: MY, color: C.warn, at: 900 }] },
      { say: '第 2 步：加 k₂ v₂ᵀ，写到第二行。S 的大小始终是 2 × 2，不随历史变长。', set: mix({ f1: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: KX, to: MX + 35, dur: 900, ease: 'inOut' }, y: { from: 220, to: MY + 46, dur: 900, ease: 'inOut' } } }, setMat('s', [[1, 2], [0, 1]], 900)), hl: [2, 3],
        fx: [{ type: 'ripple', x: MX + 35, y: MY + 46, color: C.warn, at: 900 }] },
      { say: '第 3 步：k₃ = k₁，于是 [3, 0] 直接加到第一行上：[1, 2] + [3, 0] = [4, 2]。', set: mix({ f2: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: KX, to: MX + 35, dur: 900, ease: 'inOut' }, y: { from: 280, to: MY, dur: 900, ease: 'inOut' } } }, setMat('s', [[4, 2], [0, 1]], 900)), hl: [2, 3],
        fx: [{ type: 'flash', obj: 's00', color: C.warn, at: 1000 }, { type: 'flash', obj: 's01', color: C.warn, at: 1000 }] },
      { say: '读：查询 q = [1, 0]。可以老老实实对每个历史求和，也可以直接算 Sᵀq。', set: join({ q: pop(0) }, VZ.show(EQ2, 300, 70)), hl: [4, 5] },
      { say: '两种算法结果相同：都是 [4, 2]。后一种每步只做固定大小的矩阵运算。这就是"把 Transformer 写成 RNN"。', set: { fx1: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: MX + 35, to: EQ2.xs[2], dur: 900, ease: 'inOut' }, y: { from: MY + 20, to: 420, dur: 900, ease: 'inOut' } },
          fx2: { opacity: { from: 1, to: 0, dur: 150, delay: 1300 }, x: { from: KX, to: EQ2.xs[4], dur: 900, delay: 400, ease: 'inOut' }, y: { from: 220, to: 420, dur: 900, delay: 400, ease: 'inOut' } }, l2: { text: { to: '[4, 2]', delay: 900 } }, l4: { text: { to: '[4, 2]', delay: 1300 } } },
        log: [{ s: 'linear t=3  S=[[4.0, 2.0], [0.0, 1.0]]  o via sum=[4.0, 2.0]  o via S^T q=[4.0, 2.0]', at: 1400 }],
        data: { 'o 用求和算': { v: '[4.0, 2.0]', at: 1300 }, 'o 用 Sᵀq 算': { v: '[4.0, 2.0]', at: 900 } } },
      { say: '问题也在这里。同一个键写了两次，旧值没被擦掉，读出来是两次之和。讲义说"只加不擦，干扰不会被显式抹掉"。', set: { bad: pop(0) }, fx: [{ type: 'shake', obj: 'bad', at: 400 }] }
    ]
  };

  /* ---------------- 场景 3：DeltaNet 的定向修正（手推） ---------------- */
  var DEL = { lang: 'py', title: '本机实跑 · 第 4 部分（DeltaNet，β = 1）', src:
'S = np.zeros((2, 2)); beta = 1.0\n' +
'for k, v in zip(K, V):\n' +
'    v_hat = S.T @ k          # 先读：预测\n' +
'    e = v - v_hat            # 误差\n' +
'    S = S + beta * np.outer(k, e)\n' +
'# Gated: S = alpha*S 再做同样的修正\n' };
  var E1 = VZ.eq('a', ['v̂₃ = Sᵀk₃ =', { slot: 1, w: 84 }], 300, 380, { size: 15 });
  var E2 = VZ.eq('b', ['e₃ = v₃ − v̂₃ =', { slot: 1, w: 70 }, '−', { slot: 1, w: 70 }, '=', { slot: 1, w: 84 }], 430, 430, { size: 15 });
  var sc3 = {
    name: 'DeltaNet 修正', desc: '写之前先读：用当前 S 预测这个键的值，只把误差写进去。同一个键的旧值被替换，而不是累加（讲义第 21 页）。',
    code: DEL, dataTitle: 'β = 1 时第 3 步', data: { 'v̂₃': '—', 'e₃': '—', '读出 o': '—' },
    bg: function (d) {
      title(d, 'DeltaNet：v̂ = Sᵀk，e = v − v̂，S ← S + β k eᵀ');
      d.text(MX + 35, 82, '状态 S', { anchor: 'middle', size: 12.5, weight: 700, color: C.info });
    },
    objects: function () {
      var o = mat('s', MX, 110, [[1, 2], [0, 1]], 'info');
      o.k3 = box(150, 130, 110, 30, 'k₃ = [1, 0]', 'data', 0, 12.5);
      o.v3 = box(150, 180, 110, 30, 'v₃ = [3, 0]', 'ok', 0, 12.5);
      for (var k in E1.objs) o[k] = E1.objs[k];
      for (var k2 in E2.objs) o[k2] = E2.objs[k2];
      o.g1 = box(0, 0, 70, 26, '[1, 2]', 'info', 0, 12); o.g2 = box(0, 0, 60, 26, '[3, 0]', 'ok', 0, 12); o.g3 = box(0, 0, 60, 26, '[1, 2]', 'info', 0, 12); o.g4 = box(0, 0, 80, 26, 'k₃ e₃ᵀ', 'warn', 0, 12);
      o.cmp = { type: 'box', x: 430, y: 500, w: 600, h: 36, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.3, text: '读出 [3, 0]：新值替换了旧值（线性注意力读出的是 [4, 2]）', size: 13, weight: 700, opacity: 0 };
      o.gate = { type: 'box', x: 690, y: 290, w: 260, h: 54, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.3, dasharray: '5 4', text: 'Gated DeltaNet：先乘 α 整体衰减', sub: 'α = 1 就退回 DeltaNet，KDA 每个通道一个 α', subMono: false, subSize: 11, size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '前两步和线性注意力一样（S 里已经有 [1, 2] 和 [0, 1]）。第 3 步来了同一个键 k₃ = [1, 0]，新值 [3, 0]。', set: { k3: pop(0), v3: pop(200) }, hl: [2] },
      { say: '先读：用当前的 S 预测 k₃ 对应的值。', set: join(VZ.show(E1, 0, 80), { g1: { opacity: { from: 1, to: 0, dur: 150, delay: 1000 }, x: { from: MX + 35, to: E1.xs[1], dur: 900, delay: 100, ease: 'inOut' }, y: { from: 110, to: 380, dur: 900, delay: 100, ease: 'inOut' } }, a1: { text: { to: '[1, 2]', delay: 1000 } } }), hl: [3],
        data: { 'v̂₃': { v: '[1.0, 2.0]', at: 1000 } } },
      { say: '误差 = 新值 − 预测：[3, 0] − [1, 2] = [2, −2]。', set: join(VZ.show(E2, 0, 70), { g2: { opacity: { from: 1, to: 0, dur: 150, delay: 1100 }, x: { from: 150, to: E2.xs[1], dur: 900, delay: 200, ease: 'inOut' }, y: { from: 180, to: 430, dur: 900, delay: 200, ease: 'inOut' } }, b1: { text: { to: '[3, 0]', delay: 1100 } },
          g3: { opacity: { from: 1, to: 0, dur: 150, delay: 1300 }, x: { from: E1.xs[1], to: E2.xs[3], dur: 900, delay: 400, ease: 'inOut' }, y: { from: 380, to: 430, dur: 900, delay: 400, ease: 'inOut' } }, b3: { text: { to: '[1, 2]', delay: 1300 } }, b5: { text: { to: '[2, −2]', delay: 1700 } } }), hl: [4],
        fx: [{ type: 'burst', obj: 'b5', color: C.warn, at: 1700 }], data: { 'e₃': { v: '[2.0, -2.0]', at: 1700 } } },
      { say: '只沿 k₃ 写入误差：S 的第一行 [1, 2] + [2, −2] = [3, 0]。第二行（无关的记忆）不动。', set: mix({ g4: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: E2.xs[5], to: MX + 35, dur: 900, ease: 'inOut' }, y: { from: 430, to: 110, dur: 900, ease: 'inOut' } } }, setMat('s', [[3, 0], [0, 1]], 900)), hl: [5],
        fx: [{ type: 'flash', obj: 's00', color: C.warn, at: 1000 }, { type: 'flash', obj: 's01', color: C.warn, at: 1000 }, { type: 'pulse', obj: 's11', color: C.ok, at: 1100 }],
        log: [{ s: 'delta  t=3  v_hat=[1.0, 2.0]  e=[2.0, -2.0]  S=[[3.0, 0.0], [0.0, 1.0]]  read(q)=[3.0, 0.0]', at: 1200 }] },
      { say: '再用 q = [1, 0] 读，得到 [3, 0]：旧值被定向修正掉了。', set: { cmp: pop(0) }, data: { '读出 o': { v: '[3.0, 0.0]', at: 300 } } },
      { say: 'Gated DeltaNet 在修正前，先把整个 S 乘一个保留门 α（0 到 1）。α = 0.5 时，第 3 步后 S = [[3, 0], [0, 0.5]]，旧记忆整体淡出。', set: { gate: pop(0) }, hl: [6],
        log: [{ s: 'gated(alpha=0.5) t=3  S=[[3.0, 0.0], [0.0, 0.5]]', at: 400 }] }
    ]
  };

  /* ---------------- 场景 4：RoPE 的相对位置 ---------------- */
  var CXR = [230, 600], CYR = 230, RR = 90, TH = 0.3;
  var QA = Math.atan2(0.5, 1.0), KA = Math.atan2(-0.2, 0.8);
  var sc4 = {
    name: 'RoPE 相对位置', desc: '把 q 按位置 i、k 按位置 j 旋转。两者的点积只和 j − i 有关（讲义第 29 页）。拉长上下文时，可以把位置压缩回见过的范围（第 31 页）。',
    bg: function (d) {
      title(d, 'RoPE：q̃ᵢ = R(i) qᵢ，k̃ⱼ = R(j) kⱼ，q̃ᵢᵀ k̃ⱼ = qᵢᵀ R(j − i) kⱼ');
      CXR.forEach(function (cx) { d.circle(cx, CYR, RR, { stroke: C.line, sw: 1.2 }); d.line(cx - RR - 10, CYR, cx + RR + 10, CYR, { stroke: C.line1, sw: 1 }); d.line(cx, CYR - RR - 10, cx, CYR + RR + 10, { stroke: C.line1, sw: 1 }); });
    },
    objects: function () {
      var o = {};
      CXR.forEach(function (cx, g) {
        o['q' + g] = { type: 'line', x1: cx, y1: CYR, x2: cx + RR * Math.cos(QA), y2: CYR - RR * Math.sin(QA), stroke: C.data, sw: 3, opacity: 0 };
        o['k' + g] = { type: 'line', x1: cx, y1: CYR, x2: cx + RR * Math.cos(KA), y2: CYR - RR * Math.sin(KA), stroke: C.warn, sw: 3, opacity: 0 };
        o['lb' + g] = { type: 'text', x: cx, y: CYR + RR + 34, text: g ? 'i = 10，j = 13' : 'i = 2，j = 5', size: 13, weight: 700, mono: true, color: C.fg2, anchor: 'middle', opacity: 0 };
        o['sc' + g] = { type: 'box', x: cx, y: CYR + RR + 70, w: 170, h: 34, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, text: '', num: 0, fmt: 'fixed4', pre: '分数 = ', size: 14, weight: 750, mono: true, opacity: 0 };
      });
      o.ag0 = { type: 'text', x: CXR[0] + 60, y: CYR - 112, text: '夹角 = 3θ − 原夹角', size: 12, weight: 700, color: C.info, anchor: 'middle', opacity: 0 };
      o.ag1 = { type: 'text', x: CXR[1] - 60, y: CYR + 70, text: '夹角 = 3θ − 原夹角', size: 12, weight: 700, color: C.info, anchor: 'middle', opacity: 0 };
      o.leg = { type: 'text', x: 430, y: 120, text: '蓝：q   橙：k', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.d4 = { type: 'box', x: 430, y: 470, w: 360, h: 32, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.3, text: 'i = 2，j = 6（差 4）：分数 0.8129', size: 13, weight: 700, opacity: 0 };
      o.pi = { type: 'box', x: 430, y: 518, w: 600, h: 34, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.3, text: '位置插值：训练 4K、要用 16K → s = 4，第 12000 位按 12000 / 4 = 3000 的相位转', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '同一对向量 q、k（二维，示意），放到两组不同的位置上。', set: { q0: fade(0), k0: fade(100), q1: fade(200), k1: fade(300), leg: fade(300) } },
      { say: '左边：q 在位置 2，转 2θ。k 在位置 5，转 5θ（θ = 0.3，示意）。', set: { q0: { x2: { to: CXR[0] + RR * Math.cos(QA + 2 * TH), dur: 800 }, y2: { to: CYR - RR * Math.sin(QA + 2 * TH), dur: 800 } }, k0: { x2: { to: CXR[0] + RR * Math.cos(KA + 5 * TH), dur: 900, delay: 200 }, y2: { to: CYR - RR * Math.sin(KA + 5 * TH), dur: 900, delay: 200 } }, lb0: fade(0) } },
      { say: '右边：q 在位置 10、k 在位置 13，各自转得更多。但两者之间的夹角和左边一样，差都是 3。', set: { q1: { x2: { to: CXR[1] + RR * Math.cos(QA + 10 * TH), dur: 900 }, y2: { to: CYR - RR * Math.sin(QA + 10 * TH), dur: 900 } }, k1: { x2: { to: CXR[1] + RR * Math.cos(KA + 13 * TH), dur: 1000, delay: 200 }, y2: { to: CYR - RR * Math.sin(KA + 13 * TH), dur: 1000, delay: 200 } }, lb1: fade(0) } },
      { say: 'q、k 各转了自己的位置角，相对转角都是 (j − i)θ = 3θ。位置的绝对值被消掉了。', set: { ag0: fade(0), ag1: fade(200) },
        fx: [{ type: 'pulse', x: CXR[0], y: CYR, color: C.info, at: 100 }, { type: 'pulse', x: CXR[1], y: CYR, color: C.info, at: 300 }] },
      { say: '所以两个点积完全相同：0.9051。分数只取决于相对位移 j − i，V 不用转。', set: { sc0: mix(pop(0), { num: { to: 0.9051, dur: 700, delay: 200 } }), sc1: mix(pop(200), { num: { to: 0.9051, dur: 700, delay: 400 } }) },
        fx: [{ type: 'burst', obj: 'sc0', color: C.ok, at: 900 }, { type: 'burst', obj: 'sc1', color: C.ok, at: 1100 }] },
      { say: '换成差 4（i = 2，j = 6），分数就变了：0.8129。', set: { d4: pop(0) } },
      { say: '想把训练时的 4K 拉到 16K，就把所有位置除以 s = 4。长位置的相位，就落回训练见过的范围。YaRN 更进一步：只插值长波长的维度，并调注意力温度。', set: { pi: pop(0) } }
    ]
  };

  VZ.register({
    id: 'c2-attn', title: '长上下文的注意力：窗口、线性注意力、DeltaNet、RoPE',
    sources: [{ t: '第 3 讲（架构部分）', u: YT }, { t: '讲义 lecture-03 第 13–24、29–32 页', u: L3 }],
    note: '公式和画法照讲义第 13、18、20–24、29、31 页。为了能手算，例子都缩成小尺寸，并标了示意。8 个 token、w = 3、二维的 k / v / q、θ = 0.3。每个比较次数、矩阵、读出值、点积都是本机用 numpy 实算的。YaRN 的温度公式 √(1/τ) = 0.1 ln s + 1 照讲义第 32 页。讲义提醒它是在 LLaMA 上拟合的配方，不是普适常数。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

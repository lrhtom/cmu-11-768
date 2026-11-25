/* 06 · 第 12 讲 —— RL 系统：一个训练步、KV 缓存有多大、同步 vs 异步、序列延伸、Token-In Token-Out
 * 场景 1：两种引擎和五个阶段照讲义 lecture-12 第 5–8 页；代码是作业 3 scottyrl/tinker_adapter.py 里的真实调用名（流程简化）。
 * 场景 2：128 KB / token、32k ≈ 4 GB、64 条 ≈ 256 GB 照第 9 页；拆成 32 × 8 × 128 × 2 × 2 是按 Llama-3-8B 的结构复算（本机验算脚本 第 9 部分），前缀共享照第 10 页。
 * 场景 3：同步 / 异步的结构照第 25 页和 lecture-11 第 19–20 页；各条 rollout 的时长是示意，11 和 15 是 verify.py 第 10 部分按示意时长算的。
 * 场景 4：外壳 A / B 照第 19–20 页，Qwen 模板删推理照第 21–22 页；各段 token 数是示意，1600 / 1920 是 verify.py 第 11 部分按示意长度算的。
 * 场景 5："Hello" 的几种切法和 token 编号照第 24 页，verify.py 第 12 部分复现。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L12 = 'https://www.cmu-agents.com/slides/lecture-12-rl-systems.pdf', YT = 'https://youtu.be/dwR6NP9nI-8';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, w, h, size, mono) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: mono !== false, opacity: 0 }; }
  function seg(x, y, w, h, k, t, size) { return { type: 'box', x: x, y: y, w: 0, h: h, rx: 3, anchor: 'l', fill: C[k + 'W'], stroke: C[k], sw: 1.1, text: t || '', size: size || 10.5, weight: 700, mono: true, opacity: 0 }; }
  function grow(w, d0, dur) { return { opacity: { to: 1, dur: 100, delay: d0 || 0 }, w: { to: w, dur: dur || 600, delay: d0 || 0, ease: 'out' } }; }

  /* ---------------- 场景 1：一个训练步 ---------------- */
  var STG = ['1 sample', '2 verify', '3 forward', '4 backward', '5 optim_step + sync'];
  var CODE1 = { lang: 'py', title: '作业 3 · 一个同步步（简化）', src:
'groups = [collect_group(policy, t)\n' +
'          for t in tasks]      # 1 采样 2 验证\n' +
'datums = groups_to_batch(groups)  # 优势+掩码\n' +
'await tc.forward_backward_async(\n' +
'    datums, loss_fn="ppo")     # 3 前向 4 反向\n' +
'await tc.optim_step_async(params)  # 5 更新\n' +
'p = await tc.save_weights_for_sampler_async(n)\n' +
'policy = sc.create_sampling_client(model_path=p)\n' };
  var sc1 = {
    name: '一个训练步', desc: 'RL 框架由两种完全不同的工作负载组成。推理引擎负责采样，训练引擎负责前向和反向。rollout 从左流到右，权重从右流回左（讲义第 5–8 页）。',
    code: CODE1, dataTitle: '当前阶段', data: { '阶段': 0 }, dataFmt: { '阶段': function (v) { return v ? STG[Math.round(v) - 1] : '—'; } },
    bg: function (d) { title(d, '推理引擎 ⇄ 训练引擎'); },
    objects: function () {
      var o = {};
      o.inf = { type: 'box', x: 200, y: 170, w: 270, h: 96, rx: 12, fill: C.dataW, stroke: C.data, sw: 1.8, text: '推理引擎（vLLM、SGLang）', sub: 'sample：decode 为主，串行，不要梯度', subMono: false, subSize: 11.5, size: 13.5, weight: 800, opacity: 0 };
      o.trn = { type: 'box', x: 660, y: 170, w: 270, h: 96, rx: 12, fill: C.infoW, stroke: C.info, sw: 1.8, text: '训练引擎（Megatron、FSDP2）', sub: 'forward_backward：可并行，要 autograd', subMono: false, subSize: 11.5, size: 13.5, weight: 800, opacity: 0 };
      o.env = { type: 'box', x: 200, y: 360, w: 230, h: 60, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.5, text: '环境 + 外壳', sub: 'env.step 执行动作 · env.verify 打分', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.ae = wire('M170,220 L170,328', C.data); o.ea = wire('M230,330 L230,222', C.warn);
      o.aet = { type: 'text', x: 160, y: 275, text: '动作', size: 11, weight: 700, color: C.data, anchor: 'end', opacity: 0 };
      o.eat = { type: 'text', x: 242, y: 275, text: '观察', size: 11, weight: 700, color: C.warn, anchor: 'start', opacity: 0 };
      o.ro = wire('M336,150 L522,150', C.data); o.rot = { type: 'text', x: 430, y: 136, text: 'rollout / 轨迹数据', size: 12, weight: 750, color: C.data, anchor: 'middle', opacity: 0 };
      o.ws = wire('M522,195 L336,195', C.info); o.wst = { type: 'text', x: 430, y: 213, text: '权重同步', size: 12, weight: 750, color: C.info, anchor: 'middle', opacity: 0 };
      o.R = cell(430, 360, 'R(τ)', 'ok', 70, 34, 13);
      o.er = wire('M318,360 L392,360', C.ok);
      STG.forEach(function (t, i) { o['s' + i] = cell(110 + i * 160, 480, t, 'neutral', i === 4 ? 170 : 130, 36, 12); });
      o.g = { type: 'text', x: 660, y: 270, text: '', size: 12, weight: 750, mono: true, color: C.info, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: 'RL 框架里有两种根本不同的工作负载。推理引擎做采样，主要是串行的 decode。训练引擎做前向和反向，像 prefill，可并行。', set: { inf: pop(0), trn: pop(250) } },
      { say: '1 sample：推理引擎从当前策略采样动作，外壳在环境里执行。观察再回到上下文里，一来一回很多次。', set: join(on('ae'), on('ea', 300), { env: pop(0), aet: fade(200), eat: fade(500), s0: { opacity: { to: 1, dur: 200 }, fill: { to: C.dataW, dur: 200 }, stroke: { to: C.data, dur: 200 } } }),
        fx: [st('ae', 200, C.data, 3), st('ea', 700, C.warn, 3), st('ae', 1300, C.data, 3), st('ea', 1800, C.warn, 3)], hl: [1, 2], data: { '阶段': { v: 1, at: 0 } } },
      { say: '2 verify：环境的验证器给奖励。可以是测试、工具结果或别的检查。', set: join(on('er'), { R: pop(300), s1: { opacity: { to: 1, dur: 200 }, fill: { to: C.okW, dur: 200 }, stroke: { to: C.ok, dur: 200 } } }), fx: [st('er', 0, C.ok, 3)], hl: [1, 2], data: { '阶段': { v: 2, at: 0 } } },
      { say: '轨迹（token、掩码、采样时的 logprob、奖励）送到训练引擎。', set: join(on('ro'), { rot: fade(0) }), fx: [st('ro', 100, C.data, 6)], hl: [3] },
      { say: '3 forward：训练器在自己这边重新算一遍 logprob，这次带梯度追踪。', set: { s2: { opacity: { to: 1, dur: 200 }, fill: { to: C.infoW, dur: 200 }, stroke: { to: C.info, dur: 200 } }, g: mix(fade(0), { text: { to: 'log π_θ(a_t | h_t)', delay: 0 } }) }, fx: [{ type: 'pulse', obj: 'trn', color: C.info, at: 200 }], hl: [4, 5], data: { '阶段': { v: 3, at: 0 } } },
      { say: '4 backward：反向传播算梯度。', set: { s3: { opacity: { to: 1, dur: 200 }, fill: { to: C.infoW, dur: 200 }, stroke: { to: C.info, dur: 200 } }, g: { text: { to: '∇θ Σ (R − b) log π_θ', delay: 100 } } }, fx: [{ type: 'pulse', obj: 'trn', color: C.info, at: 200 }], hl: [4, 5], data: { '阶段': { v: 4, at: 0 } } },
      { say: '5 optim_step + sync：更新训练器里的权重，再发给推理引擎。还要按推理端的并行布局重新切分。', set: join(on('ws'), { wst: fade(0), s4: { opacity: { to: 1, dur: 200 }, fill: { to: C.warnW, dur: 200 }, stroke: { to: C.warn, dur: 200 } } }), fx: [st('ws', 200, C.info, 6), { type: 'ripple', obj: 'inf', color: C.info, at: 1000 }], hl: [6, 7, 8], data: { '阶段': { v: 5, at: 0 } } },
      { say: '然后用更新后的权重重复。两边各有各的优化。推理端有 KV 缓存、前缀缓存、连续批处理、投机解码。训练端有激活检查点、前缀共享、样本打包。', fx: [st('ae', 0, C.data, 3), st('ea', 500, C.warn, 3), st('ro', 1000, C.data, 4)] }
    ]
  };

  /* ---------------- 场景 2：KV 缓存有多大 ---------------- */
  var EQ = VZ.eq('k', [{ slot: 1, w: 40 }, '×', { slot: 1, w: 34 }, '×', { slot: 1, w: 44 }, '×', { slot: 1, w: 34 }, '×', { slot: 1, w: 34 }, '=', { num: 0, fmt: 'int', k: 'warn', w: 92, post: ' B' }], 430, 250, { size: 14 });
  var CFG = [['32 层', '32'], ['8 个 KV 头', '8'], ['每头 128 维', '128'], ['K 和 V', '2'], ['bf16 2 字节', '2']];
  var CODE2 = { lang: 'py', title: '本机实跑 · 第 9 部分', src:
'L, kvh, hd, byt = 32, 8, 128, 2  # Llama-3-8B\n' +
'per_tok = L * kvh * hd * 2 * byt\n' +
'# 131072 B = 128 KB\n' +
'per_tok * 32768 / 2**30        # 4.0 GiB\n' +
'64 * per_tok * 32768 / 2**30   # 256 GiB\n' };
  var sc2 = {
    name: 'KV 缓存有多大', desc: '每个过去的 token 都要在每一层留一份 K 和 V。Llama-3-8B 用 bf16 时每个 token 128 KB，一条 32k 的轨迹约 4 GB，64 条约 256 GB（讲义第 9–10 页）。',
    code: CODE2, dataTitle: 'KV 缓存', data: { '每个 token': 0, '一条 32k 轨迹': 0, '64 条轨迹': 0 },
    dataFmt: { '每个 token': function (v) { return Math.round(v) + ' KB'; }, '一条 32k 轨迹': function (v) { return v.toFixed(1) + ' GiB'; }, '64 条轨迹': function (v) { return Math.round(v) + ' GiB'; } },
    bg: function (d) { title(d, 'KV 缓存：用大量内存换掉大量重算'); },
    objects: function () {
      var o = {};
      CFG.forEach(function (c, i) { o['c' + i] = cell(110 + i * 160, 110, c[0], 'neutral', 130, 36, 12, false); o['f' + i] = cell(110 + i * 160, 110, c[1], 'warn', 40, 26, 12); });
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      o.kb = { type: 'text', x: 430, y: 292, text: '= 128 KB / token', size: 14, weight: 800, color: C.warn, anchor: 'middle', opacity: 0 };
      o.t1 = { type: 'box', x: 230, y: 370, w: 300, h: 50, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.5, text: '', num: 0, fmt: 'fixed1', pre: '× 32,768 token ≈ ', post: ' GiB', size: 14, weight: 800, mono: false, opacity: 0 };
      o.t2 = { type: 'box', x: 630, y: 370, w: 300, h: 50, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.5, text: '', num: 0, fmt: 'int', pre: '× 64 条轨迹 ≈ ', post: ' GiB', size: 14, weight: 800, mono: false, opacity: 0 };
      o.p = cell(170, 470, '任务提示（共享）', 'info', 200, 36, 12, false);
      for (var k = 0; k < 4; k++) { o['r' + k] = cell(390 + k * 110, 470, 'rollout ' + (k + 1), 'data', 96, 30, 11.5, false); o['pr' + k] = wire('M270,458 C300,420 ' + (360 + k * 110) + ',420 ' + (390 + k * 110) + ',452', C.info); }
      o.pt = { type: 'text', x: 600, y: 515, text: 'GRPO 一组 rollout 共享同一个任务提示：前缀的 KV 只算一次、存一份', size: 12, weight: 750, color: C.info, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '每个过去的 token，都要在每一层留一份 K 和 V。生成第 t 步时，只为新 token 算 q、k、v。再在缓存的全部 k、v 上做注意力，然后把自己追加进去。', set: { c0: pop(0), c1: pop(120), c2: pop(240), c3: pop(360), c4: pop(480) } },
      (function () { var s = {}; CFG.forEach(function (c, i) { var sl = 'k' + (i * 2); s['f' + i] = { opacity: { from: 1, to: 0, dur: 150, delay: 1200 + i * 120 }, x: { from: 110 + i * 160, to: EQ.xs[i * 2], dur: 800, delay: 300 + i * 120, ease: 'inOut' }, y: { from: 110, to: 250, dur: 800, delay: 300 + i * 120, ease: 'inOut' } }; s[sl] = { text: { to: c[1], delay: 1200 + i * 120 } }; });
        return { say: '手推每个 token 的大小，按 Llama-3-8B 的结构。层数、KV 头数、每头维数、K 和 V 两份、bf16 每个数 2 字节。它用分组查询注意力，KV 头只有 8 个。', set: join(VZ.show(EQ, 0, 40), s), hl: [1] }; })(),
      { say: '32 × 8 × 128 × 2 × 2 = 131,072 字节 = 128 KB，和讲义的数一致。', set: { k10: { num: { to: 131072, dur: 900, delay: 100 } }, kb: fade(900) }, fx: [{ type: 'burst', obj: 'k10', color: C.warn, at: 1000 }], hl: [2, 3], data: { '每个 token': { v: 128, at: 600 } }, log: [{ s: 'per token = 32 x 8 x 128 x 2 x 2 = 131072 bytes = 128 KB', at: 900 }] },
      { say: '一条 32k token 的智能体轨迹：约 4 GiB。', set: { t1: mix(pop(0), { num: { to: 4.0, dur: 800, delay: 200 } }) }, hl: [4], data: { '一条 32k 轨迹': { v: 4, at: 500 } } },
      { say: '一批 64 条：约 256 GiB，远超一张卡的显存。KV 缓存是在用大量内存换掉大量重算。', set: { t2: mix(pop(0), { num: { to: 256, dur: 900, delay: 200 } }) }, fx: [{ type: 'shake', obj: 't2', at: 1100 }], hl: [5], data: { '64 条轨迹': { v: 256, at: 600 } }, log: [{ s: '32k tokens = 4.0 GiB ; 64 traces = 256 GiB', at: 900 }] },
      (function () { var s = join({ p: pop(0), pt: fade(900) }); for (var k = 0; k < 4; k++) { s['pr' + k] = { opacity: { to: 1, dur: 200, delay: 300 + k * 120 }, flow: { to: 1, dur: 200, delay: 300 + k * 120 } }; s['r' + k] = pop(500 + k * 120); }
        return { say: '智能体 RL 特别吃前缀缓存。GRPO 一组 rollout 共享同一个任务提示。一条 rollout 前面步骤的 KV，也能在后面的步骤复用。', set: s, fx: [st('pr0', 300, C.info, 3), st('pr1', 420, C.info, 3), st('pr2', 540, C.info, 3), st('pr3', 660, C.info, 3)] }; })()
    ]
  };

  /* ---------------- 场景 3：同步 vs 异步 ---------------- */
  var U = 42, X0 = 170, RL = [3, 5, 9, 4];
  function tx(t) { return X0 + t * U; }
  var ASY = [[[0, 3, 'r1', 0], [3, 8, 'r4', 1], [8, 12, 'r7', 0]], [[0, 5, 'r2', 0], [5, 9, 'r5', 0], [9, 12, 'r8', 0]], [[0, 4, 'r3', 0], [4, 7, 'r6', 0], [7, 12, 'r9', 0]]];
  var CODE3 = { lang: 'py', title: '本机实跑 · 第 10 部分（示意时长）', src:
'roll = [3, 5, 9, 4]; upd = 2\n' +
'step = max(roll) + upd            # 11\n' +
'idle = sum(max(roll) - x for x in roll)  # 15\n' +
'# 异步：rollout worker 不等 learner，\n' +
'# learner 攒够一批完成的轨迹就更新\n' };
  var sc3 = {
    name: '同步 vs 异步', desc: '同步 RL 要等一批里最长的轨迹结束才更新，GPU 大量空等。异步 RL 让 rollout 一直跑，learner 用已经完成的轨迹更新。代价是一部分数据来自旧策略（讲义第 25 页）。',
    code: CODE3, dataTitle: '一步（示意时间单位）', data: { '同步一步耗时': 0, '同步空等的 GPU 时间': 0 },
    bg: function (d) {
      title(d, '同一个 batch：同步 vs 异步（时长示意）');
      d.text(40, 86, '同步', { size: 13, weight: 800, color: C.fg }); d.text(40, 316, '异步', { size: 13, weight: 800, color: C.fg });
      for (var i = 0; i < 4; i++) d.text(X0 - 10, 110 + i * 34, 'GPU ' + (i + 1), { anchor: 'end', size: 11, color: C.fg3 });
      for (var j = 0; j < 3; j++) d.text(X0 - 10, 340 + j * 34, 'rollout ' + (j + 1), { anchor: 'end', size: 11, color: C.fg3 });
      d.text(X0 - 10, 450, 'learner', { anchor: 'end', size: 11, color: C.fg3 });
      d.line(X0, 262, tx(12), 262, { stroke: C.line, sw: 1 }); for (var t = 0; t <= 12; t += 3) d.text(tx(t), 276, String(t), { anchor: 'middle', size: 10, color: C.fg3, mono: true });
    },
    objects: function () {
      var o = {};
      RL.forEach(function (l, i) {
        o['a' + i] = seg(X0, 110 + i * 34, l * U, 24, 'data', '', 10);
        if (l < 9) o['i' + i] = seg(tx(l), 110 + i * 34, (9 - l) * U, 24, 'neutral', '空等 ' + (9 - l), 10);
      });
      o.up = { type: 'box', x: tx(9), y: 98, w: 2 * U, h: 126, rx: 6, anchor: 'tl', fill: C.infoW, stroke: C.info, sw: 1.4, text: '更新', size: 12, weight: 800, opacity: 0 };
      o.st = { type: 'text', x: tx(11) + 10, y: 160, text: '一步 = 9 + 2 = 11', size: 12, weight: 800, color: C.info, anchor: 'start', opacity: 0 };
      ASY.forEach(function (row, j) { row.forEach(function (sg, k) { o['b' + j + k] = seg(tx(sg[0]) + 1, 340 + j * 34, (sg[1] - sg[0]) * U - 2, 24, sg[3] ? 'warn' : 'data', sg[2], 10); }); });
      o.u1 = seg(tx(5), 450, 2 * U, 24, 'info', '更新 1', 10); o.u2 = seg(tx(9), 450, 2 * U, 24, 'info', '更新 2', 10);
      o.v1 = { type: 'text', x: tx(7), y: 474, text: '→ v1', size: 10.5, weight: 700, mono: true, color: C.info, anchor: 'middle', opacity: 0 };
      o.stale = { type: 'box', x: tx(12) + 10, y: 340, w: 172, h: 44, rx: 8, anchor: 'l', fill: C.warnW, stroke: C.warn, sw: 1.2, text: 'r4：v0 采样，v1 训练', sub: '加权修正，或太旧就丢', subMono: false, subSize: 10.5, size: 11.5, weight: 750, opacity: 0 };
      o.gpu = { type: 'box', x: 430, y: 520, w: 700, h: 34, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '异步：训练和推理分开用 GPU。智能体 RL 常卡在 rollout，所以给推理更多卡（比如 3:1）', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; RL.forEach(function (l, i) { s['a' + i] = grow(l * U, i * 120, 300 * l); }); return { say: '同步：同一组 GPU 先一起生成 4 条 rollout（长度示意：3、5、9、4）。', set: s }; })(),
      (function () { var s = {}; RL.forEach(function (l, i) { if (l < 9) s['i' + i] = grow((9 - l) * U, 200 + i * 100, 500); }); return { say: '一批里每条轨迹都结束，策略更新才能开始。短的那几条只能空等最长的 9。', set: s, fx: [{ type: 'flash', obj: 'i0', color: C.neutral, at: 900 }], data: { '同步空等的 GPU 时间': { v: 15, at: 800 } }, log: [{ s: 'idle GPU-time while waiting = 6 + 4 + 0 + 5 = 15', at: 900 }] }; })(),
      { say: '然后更新（示意 2 个单位），一步一共 11。空等的 GPU 时间合计 15。', set: { up: pop(0), st: fade(500) }, hl: [1, 2], data: { '同步一步耗时': { v: 11, at: 400 } }, log: [{ s: 'sync: step time = 9 + 2 = 11', at: 500 }] },
      (function () { var s = {}; ASY.forEach(function (row, j) { row.forEach(function (sg, k) { s['b' + j + k] = grow((sg[1] - sg[0]) * U - 2, j * 100 + sg[0] * 160, (sg[1] - sg[0]) * 160); }); });
        return { say: '异步：rollout worker 一直生成，一条结束马上开下一条，不等 learner。', set: s, hl: [3, 4] }; })(),
      { say: 'learner 用已经完成的轨迹更新。攒够一批就更新，发布新版本 v1，接着训下一批。', set: { u1: grow(2 * U, 0, 500), v1: fade(500), u2: grow(2 * U, 800, 500) }, fx: [{ type: 'ripple', obj: 'u1', color: C.info, at: 600 }] },
      { say: '代价：有些完成的轨迹来自更早的策略版本。r4 在 v0 下开始采样，结束时 learner 已经是 v1。这就是上一讲重要性采样和 PPO 裁剪要处理的"过期"数据。', set: { stale: pop(0) }, fx: [{ type: 'pulse', obj: 'b01', color: C.warn, at: 200 }] },
      { say: '异步还要求推理引擎支持连续批处理和"飞行中"的权重更新。GPU 也可以不对半分。', set: { gpu: pop(0) } }
    ]
  };

  /* ---------------- 场景 4：序列延伸 ---------------- */
  var SC = 0.4, TK = { T: 200, A: 50, O: 300, S: 120 };
  function rowObjs(o, pre, items, y) { var x = 110; items.forEach(function (it, k) { var w = TK[it[0]] * SC; o[pre + k] = seg(x, y, w, 26, it[0] === 'A' ? 'ok' : it[0] === 'S' ? 'info' : it[0] === 'T' ? 'neutral' : 'data', it, 10); x += w; }); }
  var RA = ['T', 'A1', 'O1', 'A2', 'O2', 'A3', 'O3', 'A4', 'O4'], RB1 = ['T', 'A1', 'O1', 'A2', 'O2'], RB2 = ['T', 'S', 'A3', 'O3', 'A4', 'O4'];
  var CODE4 = { lang: 'py', title: '作业 3 · datagen.py 的约定', src:
'extension_suffix([1, 2, 3], [1, 2, 3, 9, 9])\n' +
'# -> [9, 9]  前缀对上：只追加新尾巴\n' +
'extension_suffix([1, 2, 3], [1, 9, 3, 4])\n' +
'# -> None    前缀断了：另起一条序列\n' };
  var sc4 = {
    name: '序列延伸', desc: '提示一直接在上一次后面写，整个回合就能拼成一条序列。新提示 = 上一次的提示 + 上一次的输出 + 新观察。压缩历史会打断它，任务前缀要多算一遍（讲义第 19–22 页）。',
    code: CODE4, dataTitle: 'token 数（示意）', data: { '外壳 A 要处理': 0, '外壳 B 要处理': 0, '参与损失（两者相同）': 0 },
    bg: function (d) {
      title(d, '外壳 A：一直往后追加　外壳 B：每两个观察压缩一次');
      d.text(100, 110, 'A', { anchor: 'end', size: 13, weight: 800, color: C.fg }); d.text(100, 240, 'B ①', { anchor: 'end', size: 13, weight: 800, color: C.fg }); d.text(100, 290, 'B ②', { anchor: 'end', size: 13, weight: 800, color: C.fg });
    },
    objects: function () {
      var o = {};
      rowObjs(o, 'a', RA, 110); rowObjs(o, 'b', RB1, 240); rowObjs(o, 'c', RB2, 290);
      o.am = { type: 'text', x: 430, y: 145, text: '掩码只在 A1–A4 上为 1。一个轨迹优势 Â 广播给每个动作 token', size: 11.5, weight: 700, color: C.ok, anchor: 'middle', opacity: 0 };
      o.tA = { type: 'box', x: 790, y: 150, w: 110, h: 34, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '', num: 0, fmt: 'int', post: ' token', size: 12.5, weight: 800, mono: true, opacity: 0 };
      o.tB = { type: 'box', x: 780, y: 265, w: 110, h: 34, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '', num: 0, fmt: 'int', post: ' token', size: 12.5, weight: 800, mono: true, opacity: 0 };
      o.dup = { type: 'text', x: 150, y: 316, text: '↑ 任务前缀又算一遍：没有损失，但要算上下文', size: 11, weight: 700, color: C.warn, anchor: 'start', opacity: 0 };
      o.rule = { type: 'box', x: 430, y: 370, w: 640, h: 36, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '尽量长时间保持完全相同的前缀，往后拼接', size: 13, weight: 750, opacity: 0 };
      o.q1 = cell(250, 450, 'task → 思考₁ + 调用₁', 'neutral', 230, 34, 11.5, false);
      o.q2 = cell(610, 450, 'task + 调用₁（思考₁被删）+ 输出 →', 'neutral', 330, 34, 11.5, false);
      o.qx = { type: 'text', x: 430, y: 500, text: 'Qwen 3 / 3.5 的默认模板会删掉历史里的推理 → 第 2 回合的提示不再延伸第 1 回合', size: 12, weight: 750, color: C.bad, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; RA.forEach(function (t, k) { s['a' + k] = grow(TK[t[0]] * SC, k * 220, 400); }); return { say: '外壳 A 每个回合把动作和观察追加到已有的历史后面。各段长度是示意：任务 200、动作 50、观察 300。', set: s }; })(),
      { say: '训练时它就是一个数据点。掩码只在四个动作上为 1，轨迹的优势 Â 广播给每个动作 token。', set: { am: fade(0) }, fx: [{ type: 'pulse', obj: 'a1', color: C.ok, at: 200 }, { type: 'pulse', obj: 'a3', color: C.ok, at: 350 }, { type: 'pulse', obj: 'a5', color: C.ok, at: 500 }, { type: 'pulse', obj: 'a7', color: C.ok, at: 650 }],
        data: { '参与损失（两者相同）': { v: 200, at: 400 } } },
      { say: '要处理的 token：200 + 4 × (50 + 300) = 1600。', set: { tA: mix(pop(0), { num: { to: 1600, dur: 800, delay: 200 } }) }, data: { '外壳 A 要处理': { v: 1600, at: 500 } }, log: [{ s: 'harness A: 1 datapoint, 1600 tokens processed, 200 trained', at: 600 }] },
      (function () { var s = {}; RB1.forEach(function (t, k) { s['b' + k] = grow(TK[t[0]] * SC, k * 150, 350); }); RB2.forEach(function (t, k) { s['c' + k] = grow(TK[t[0]] * SC, 900 + k * 150, 350); });
        return { say: '外壳 B 在第二个观察之后，把 A1 O1 A2 O2 总结成 S（示意 120 token）。它保留任务，接着做第 3、4 回合。前缀变了，只能拆成两个数据点。', set: s }; })(),
      { say: '两个数据点都要从任务开头算：900 + 1020 = 1920 token，比 A 多。参与损失的仍然只有那 200 个动作 token。', set: { tB: mix(pop(0), { num: { to: 1920, dur: 800, delay: 200 } }), dup: fade(500) }, fx: [{ type: 'flash', obj: 'c0', color: C.warn, at: 600 }],
        data: { '外壳 B 要处理': { v: 1920, at: 500 } }, log: [{ s: 'harness B: 2 datapoints, 900 + 1020 = 1920 tokens processed, 200 trained', at: 600 }] },
      { say: '所以训练效率上：尽量长时间保持完全相同的前缀、往后拼接。作业 3 的 extension_suffix 就是在检查这个前缀关系。', set: { rule: pop(0) }, hl: [1, 2, 3, 4] },
      { say: '坑在聊天模板。Qwen 3 / 3.5 的默认模板会把过去回合里的推理删掉。第 2 回合的提示就不再是第 1 回合的延伸。所以训练框架常自带定制模板（"renderer"），来保住序列延伸。', set: { q1: pop(0), q2: pop(300), qx: fade(700) }, fx: [{ type: 'shake', obj: 'q2', at: 800 }] }
    ]
  };

  /* ---------------- 场景 5：Token-In, Token-Out ---------------- */
  var CODE5 = { lang: 'py', title: '本机实跑 · 第 12 部分（玩具词表）', src:
'vocab = {"Hello": 4, "H": 1, "He": 2, "Hel": 3,\n' +
'         "ello": 5, "llo": 6, "lo": 7}\n' +
'sampled = [2, 6]          # 模型采样：He + llo\n' +
'text = "Hello"            # 反分词\n' +
'retok = [4]               # 训练端重新分词\n' +
'# logprob 记在 [2, 6] 上，对不上 [4]\n' };
  var sc5 = {
    name: 'Token-In Token-Out', desc: '轨迹从推理引擎传到训练引擎时，存字符串还是存 token？分词是一对一，反分词是多对一。存字符串再重新分词，可能得到和采样时不一样的 token（讲义第 23–24 页）。',
    code: CODE5, dataTitle: '对齐', data: { '采样的 token 数': 0, '重新分词后的 token 数': 0 },
    bg: function (d) { title(d, '推理引擎 → ？ → 训练引擎'); },
    objects: function () {
      var o = {};
      o.s0 = cell(120, 120, 'He · 2', 'data', 80, 36, 13); o.s1 = cell(210, 120, 'llo · 6', 'data', 90, 36, 13);
      o.l0 = { type: 'text', x: 120, y: 152, text: '有 logprob', size: 10.5, weight: 700, color: C.data, anchor: 'middle', opacity: 0 };
      o.l1 = { type: 'text', x: 210, y: 152, text: '有 logprob', size: 10.5, weight: 700, color: C.data, anchor: 'middle', opacity: 0 };
      o.p1 = wire('M262,120 L360,120', C.warn); o.str = cell(430, 120, '"Hello"', 'warn', 120, 40, 15);
      o.p1t = { type: 'text', x: 311, y: 104, text: '反分词', size: 11, weight: 700, color: C.warn, anchor: 'middle', opacity: 0 };
      o.p2 = wire('M492,120 L590,120', C.warn); o.re = cell(660, 120, 'Hello · 4', 'bad', 120, 36, 13);
      o.p2t = { type: 'text', x: 541, y: 104, text: '重新分词', size: 11, weight: 700, color: C.warn, anchor: 'middle', opacity: 0 };
      o.x = { type: 'text', x: 660, y: 160, text: '两个 logprob 该挂到哪？', size: 12, weight: 750, color: C.bad, anchor: 'middle', opacity: 0 };
      [['H · 1', 'ello · 5'], ['He · 2', 'llo · 6'], ['Hel · 3', 'lo · 7']].forEach(function (p, i) {
        var y = 240 + i * 50;
        o['m' + i + 'a'] = cell(160, y, p[0], 'neutral', 80, 32, 12); o['m' + i + 'b'] = cell(250, y, p[1], 'neutral', 90, 32, 12);
        o['mw' + i] = wire('M298,' + y + ' C350,' + y + ' 360,290 412,290', C.fg3);
      });
      o.hl = cell(470, 290, '"Hello"', 'warn', 110, 36, 14);
      o.one = wire('M528,290 L600,290', C.ok); o.oneT = cell(660, 290, 'Hello · 4', 'ok', 120, 34, 13);
      o.mt = { type: 'text', x: 470, y: 340, text: '反分词是多对一，分词是一对一', size: 12, weight: 750, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.fix = { type: 'box', x: 430, y: 440, w: 700, h: 50, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.5, text: 'TITO：rollout 直接存 token id 和对应的 logprob，训练端原样用', sub: '字符串空间里一点不一致（比如模板多加的空白）就会让两边分词对不上', subMono: false, subSize: 11.5, size: 13.5, weight: 800, opacity: 0 };
      o.p3 = wire('M120,165 C100,300 100,380 140,412', C.ok);
      return o;
    },
    steps: [
      { say: '推理引擎采样出两个 token：He（2）和 llo（6）。各自记下了采样时的 logprob（玩具词表，示意）。', set: { s0: pop(0), s1: pop(200), l0: fade(400), l1: fade(500) }, hl: [3], data: { '采样的 token 数': { v: 2, at: 300 } } },
      { say: '如果用字符串传：先反分词，得到 "Hello"。', set: join(on('p1'), { p1t: fade(0), str: pop(400) }), fx: [st('p1', 0, C.warn, 4)], hl: [4] },
      { say: '训练端再分词，词表里正好有整词 Hello（4），得到的是一个 token。', set: join(on('p2'), { p2t: fade(0), re: pop(400) }), fx: [st('p2', 0, C.warn, 4)], hl: [5], data: { '重新分词后的 token 数': { v: 1, at: 500 } } },
      { say: '采样时的两个 logprob 对不上训练端的一个 token。重要性比率、掩码都错位了。', set: { x: fade(0) }, fx: [{ type: 'shake', obj: 're', at: 200 }], hl: [6], log: [{ s: "sampled ids [2, 6] -> text 'Hello' -> re-tokenized [4]", at: 300 }] },
      (function () { var s = { hl: pop(900), mt: fade(1300) }; for (var i = 0; i < 3; i++) { s['m' + i + 'a'] = pop(i * 200); s['m' + i + 'b'] = pop(i * 200 + 100); s['mw' + i] = { opacity: { to: 1, dur: 200, delay: 500 + i * 150 }, flow: { to: 1, dur: 200, delay: 500 + i * 150 } }; }
        return { say: '根源：H + ello、He + llo、Hel + lo 反分词都得到 "Hello"。反分词是多对一的。', set: s, fx: [st('mw0', 500, C.fg3, 2), st('mw1', 650, C.fg3, 2), st('mw2', 800, C.fg3, 2)] }; })(),
      { say: '而 "Hello" 分词只有一种结果：Hello（4）。字符串走一个来回，就不一定回到原来的 token。', set: join(on('one'), { oneT: pop(400) }), fx: [st('one', 0, C.ok, 3)] },
      { say: '解法是 Token-In, Token-Out。rollout 里直接存 token id 和 logprob，训练端原样使用，不经过字符串。', set: join(on('p3'), { fix: pop(300) }), fx: [st('p3', 0, C.ok, 5), { type: 'burst', obj: 'fix', color: C.ok, at: 900 }] }
    ]
  };

  VZ.register({
    id: 'c6-systems', title: 'RL 系统：训练步、KV 缓存、异步、序列延伸与 TITO',
    sources: [{ t: '第 12 讲（RL 系统）', u: YT }, { t: '讲义 lecture-12', u: L12 }, { t: '作业 3（scottyrl）', u: 'https://github.com/cmu-agents/assignment-3' }],
    note: '两种引擎、五个阶段、128 KB / 4 GB / 256 GB、前缀共享、同步与异步的结构、外壳 A / B、Qwen 模板删推理、"Hello" 的切法都照讲义第 5–25 页。32 × 8 × 128 × 2 × 2 是按 Llama-3-8B 的结构复算的。rollout 时长（3、5、9、4）和各段 token 数是示意。11、15、1600、1920 是本机按这些示意值算出的。场景 1 的代码用的是作业 3 tinker_adapter.py 里的真实调用名，流程是简化的。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

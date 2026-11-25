/* 02 · 第 3 讲 —— 上下文为什么越跑越贵：二次增长、prefill / decode、跨调用的前缀缓存、前缀共享
 * 场景 1：每次调用的输入 6K、11K、16K、21K、26K 和累计 80K 照讲义 lecture-03 第 3 页；公式和外推是 本机验算脚本 实算。
 * 场景 2：prefill / decode / KV 缓存 / TTFT / TPOT 照讲义第 7–9 页；token 个数是示意。
 * 场景 3：分段照讲义第 38 页，价格照第 40 页（Claude Opus 5：缓存 $0.50、常规 $5.00、输出 $25.00 每百万 token）；
 *         "每次输出 1K、工具结果 4K"是示意，费用是 verify.py 实算。
 * 场景 4：前缀树的 Match / Split / Evict 照讲义第 42 页的三个对话；路由打分照第 43 页（权重讲义没给，只画定性）。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L3 = 'https://www.cmu-agents.com/slides/lecture-03-long-context.pdf', YT = 'https://youtu.be/AiwCCvFW1uE';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function seg(x, y, w, k, t, op) { return { type: 'box', x: x, y: y, w: 0, h: 30, rx: 4, anchor: 'l', fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t || '', size: 11.5, weight: 700, mono: true, opacity: op == null ? 0 : op }; }
  function grow(n, w, delay, dur) { var s = {}; s[n] = { opacity: { to: 1, dur: 150, delay: delay || 0 }, w: { to: w, dur: dur || 600, delay: delay || 0, ease: 'out' } }; return s; }

  /* ---------------- 场景 1：二次增长 ---------------- */
  var X0 = 130, PK = 20, RY = [96, 148, 200, 252, 304];
  var INP = [6, 11, 16, 21, 26], CUM = [6, 17, 33, 54, 80];
  var EQ = VZ.eq('q', ['总输入 =', { slot: 1, w: 100 }, '+', { slot: 1, w: 116 }, '=', { num: 0, fmt: 'int', post: 'K', k: 'ok', w: 86 }], 430, 420, { size: 15 });
  var CODE1 = { lang: 'py', title: '本机实跑 · 第 1 部分', src:
'P, d, T = 6, 5, 5   # K token（讲义第 3 页）\n' +
'inp = [P + d * t for t in range(T)]\n' +
'cum = np.cumsum(inp).tolist()\n' +
'print(inp, cum)\n' +
'total = T * P + d * T * (T - 1) // 2\n' };
  var sc1 = {
    name: '二次增长', desc: '每次调用都把全部历史重新送进模型。历史线性增长，送进去的总量按平方增长（讲义第 3 页）。',
    code: CODE1, dataTitle: '第几次调用', data: { '调用次数 t': 0, '这次的输入（K）': 0, '累计输入（K）': 0 },
    bg: function (d) {
      title(d, 'input_t = 固定前缀 + 第 t 次调用之前的全部历史');
      RY.forEach(function (y, i) { d.text(60, y, 'Call ' + (i + 1), { size: 12, weight: 700, color: C.fg2 }); });
      d.text(X0, 350, '■ 固定前缀（系统提示 + 工具）', { size: 11.5, color: C.fg3 });
      d.text(X0 + 230, 350, '■ 之前的动作和观察', { size: 11.5, color: C.data });
    },
    objects: function () {
      var o = {};
      RY.forEach(function (y, i) {
        o['f' + i] = seg(X0, y, 6 * PK, 'neutral', '6K');
        o['h' + i] = seg(X0 + 6 * PK, y, (INP[i] - 6) * PK, 'data', i ? (INP[i] - 6) + 'K' : '');
        o['c' + i] = { type: 'text', x: X0 + 26 * PK + 20, y: y, text: '', num: 0, fmt: 'int', pre: '累计 ', post: 'K', size: 12.5, weight: 700, mono: true, color: C.warn, anchor: 'start', opacity: 0 };
      });
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      o.fa = { type: 'box', x: 0, y: 0, w: 96, h: 28, rx: 6, fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: '5 × 6K', size: 12.5, weight: 700, mono: true, opacity: 0 };
      o.fb = { type: 'box', x: 0, y: 0, w: 112, h: 28, rx: 6, fill: C.dataW, stroke: C.data, sw: 1.2, text: '5K × 10', size: 12.5, weight: 700, mono: true, opacity: 0 };
      o.big = { type: 'text', x: 430, y: 486, text: '同样的配方跑 100 次调用：累计 25,350K token', size: 13, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '第 1 次调用：只有固定前缀（系统提示和工具定义），6K。', set: mix(grow('f0', 6 * PK, 0, 600), { c0: mix(fade(600), { num: { to: 6, dur: 400, delay: 600 } }) }), hl: [1, 2],
        data: { '调用次数 t': 1, '这次的输入（K）': { v: 6, at: 300 }, '累计输入（K）': { v: 6, at: 600 } } },
      { say: '第 2 次：前缀之外，还要带上第 1 次的动作和工具结果（+5K）。一共 11K。', set: join(grow('f1', 6 * PK, 0, 400), grow('h1', 5 * PK, 400, 500), { c1: mix(fade(900), { num: { to: 17, dur: 500, delay: 900 } }) }),
        fx: [{ type: 'flash', obj: 'h1', color: C.data, at: 900 }], data: { '调用次数 t': 2, '这次的输入（K）': { v: 11, at: 400 }, '累计输入（K）': { v: 17, at: 900 } } },
      { say: '第 3 次 16K：历史又长了 5K。而且前面的全部历史要重新送一遍。', set: join(grow('f2', 6 * PK, 0, 400), grow('h2', 10 * PK, 400, 600), { c2: mix(fade(1000), { num: { to: 33, dur: 500, delay: 1000 } }) }),
        data: { '调用次数 t': 3, '这次的输入（K）': { v: 16, at: 400 }, '累计输入（K）': { v: 33, at: 1000 } } },
      { say: '第 4、5 次：21K、26K。每次的输入是线性增长的。', set: join(grow('f3', 6 * PK, 0, 300), grow('h3', 15 * PK, 300, 600), grow('f4', 6 * PK, 900, 300), grow('h4', 20 * PK, 1200, 600),
          { c3: mix(fade(900), { num: { to: 54, dur: 500, delay: 900 } }), c4: mix(fade(1800), { num: { to: 80, dur: 500, delay: 1800 } }) }),
        hl: [4], log: [{ s: '[6, 11, 16, 21, 26] [6, 17, 33, 54, 80]', at: 1900 }],
        data: { '调用次数 t': 5, '这次的输入（K）': { v: 26, at: 1200 }, '累计输入（K）': { v: 80, at: 1800 } } },
      { say: '手推累计：T 次调用，每次都有前缀 P，历史一次比一次多 d。', set: VZ.show(EQ, 0, 80), hl: [5] },
      { say: '前缀部分：5 次 × 6K。', set: { fa: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: X0 + 60, to: EQ.xs[1], dur: 900, delay: 0, ease: 'inOut' }, y: { from: 200, to: 420, dur: 900, delay: 0, ease: 'inOut' } }, q1: { text: { to: '5 × 6K', delay: 900 } } },
        fx: [{ type: 'ripple', x: EQ.xs[1], y: 420, color: C.neutral, at: 900 }] },
      { say: '历史部分：5K × (0+1+2+3+4) = 5K × 10，这一项随 T 按平方增长。', set: { fb: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: X0 + 300, to: EQ.xs[3], dur: 900, delay: 0, ease: 'inOut' }, y: { from: 304, to: 420, dur: 900, delay: 0, ease: 'inOut' } }, q3: { text: { to: '5K × 10', delay: 900 } } },
        fx: [{ type: 'ripple', x: EQ.xs[3], y: 420, color: C.data, at: 900 }] },
      { say: '30K + 50K = 80K，和讲义的累计一致。', set: { q5: { num: { to: 80, dur: 700, delay: 100 } } }, fx: [{ type: 'burst', obj: 'q5', color: C.ok, at: 800 }],
        log: [{ s: 'formula T*P + d*T*(T-1)/2 = 30 + 50 = 80', at: 300 }] },
      { say: '同样的配方跑 100 次调用，累计就是 25,350K。所以长时间运行的智能体，必须管理上下文。', set: { big: fade(200) },
        log: [{ s: '  T=100 calls -> total input 25350K', at: 300 }] }
    ]
  };

  /* ---------------- 场景 2：prefill 与 decode ---------------- */
  var PX = [110, 160, 210, 260, 310, 360];
  var sc2 = {
    name: 'prefill 与 decode', desc: 'prefill 一次处理全部提示，写满 KV 缓存。decode 每步只出一个 token，读全部 KV、追加一个（讲义第 7–9 页）。',
    bg: function (d) {
      title(d, '推理的两个阶段：prefill 算力密集，decode 内存带宽密集');
      d.text(60, 110, '提示', { size: 12, weight: 700, color: C.fg3 });
      d.text(110, 298, 'KV 缓存（每个请求一份）', { size: 12, weight: 700, color: C.fg3 });
      d.line(90, 470, 800, 470, { stroke: C.line, sw: 1.2 });
      d.text(90, 494, '请求到达', { size: 11, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      PX.forEach(function (x, i) {
        o['x' + i] = { type: 'box', x: x, y: 110, w: 42, h: 30, rx: 6, fill: C.dataW, stroke: C.data, sw: 1.3, text: 'x' + (i + 1), size: 12, weight: 700, mono: true, opacity: 0 };
        o['p' + i] = wire('M' + x + ',126 C' + x + ',180 520,170 560,212', C.data);
        o['k' + i] = { type: 'box', x: x, y: 330, w: 42, h: 30, rx: 5, fill: C.bg2, stroke: C.neutral, sw: 1.2, text: 'K,V', size: 11, weight: 700, mono: true, opacity: 0 };
      });
      o.llm = { type: 'box', x: 620, y: 230, w: 150, h: 70, rx: 12, fill: C.infoW, stroke: C.info, sw: 1.8, text: '模型', size: 15, weight: 750, opacity: 0 };
      o.wKV = wire('M560,250 C480,300 420,330 390,330', C.warn);
      o.rKV = wire('M390,346 C470,346 560,320 590,266', C.data);
      ['y1', 'y2', 'y3'].forEach(function (n, i) {
        o[n] = { type: 'box', x: 720 + i * 0, y: 120, w: 42, h: 30, rx: 6, fill: C.okW, stroke: C.ok, sw: 1.3, text: n, size: 12, weight: 700, mono: true, opacity: 0 };
        o['k' + (6 + i)] = { type: 'box', x: 410 + i * 50, y: 330, w: 42, h: 30, rx: 5, fill: C.okW, stroke: C.ok, sw: 1.2, text: 'K,V', size: 11, weight: 700, mono: true, opacity: 0 };
      });
      o.pre = { type: 'box', x: 90, y: 446, w: 0, h: 22, rx: 4, anchor: 'l', fill: C.bad, stroke: C.bad, sw: 1, text: 'prefill', size: 11, weight: 700, color: '#fff', opacity: 0 };
      o.t1 = { type: 'circle', x: 420, y: 470, r: 6, fill: C.ok, stroke: C.ok, opacity: 0 };
      o.t2 = { type: 'circle', x: 520, y: 470, r: 6, fill: C.ok, stroke: C.ok, opacity: 0 };
      o.t3 = { type: 'circle', x: 620, y: 470, r: 6, fill: C.ok, stroke: C.ok, opacity: 0 };
      o.ttft = { type: 'text', x: 255, y: 500, text: 'TTFT：到达 → 第一个 token', size: 12, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.tpot = { type: 'text', x: 470, y: 500, text: 'TPOT：两个输出 token 的间隔', size: 12, weight: 700, color: C.info, anchor: 'middle', opacity: 0 };
      o.note = { type: 'text', x: 430, y: 530, text: '费用 = 输入 + 缓存输入 + 输出 token，各自计价', size: 12, weight: 650, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = { llm: pop(600) }; PX.forEach(function (_, i) { s['x' + i] = pop(i * 80); }); return { say: '请求到达：一段提示（这里 6 个 token，示意）。调度器把它排队、合批、分给一台机器。', set: s }; })(),
      (function () {
        var s = { pre: { opacity: { to: 1, dur: 150 }, w: { to: 330, dur: 1300, ease: 'linear' } } };
        var fx = [];
        PX.forEach(function (_, i) { s['p' + i] = { opacity: { to: 1, dur: 200, delay: 100 }, flow: { to: 1, dur: 200, delay: 100 } }; fx.push(st('p' + i, 150 + i * 30, C.data, 3)); });
        fx.push({ type: 'pulse', obj: 'llm', color: C.info, at: 900 });
        return { say: 'prefill：全部提示位置一次并行算完。算力密集，提示越长越慢。', set: s, fx: fx };
      })(),
      (function () {
        var s = join(on('wKV'), {}); PX.forEach(function (_, i) { s['k' + i] = pop(300 + i * 90); });
        return { say: '同时把每个位置的 K、V 写进 KV 缓存。这是每个请求一直保留的状态。', set: s, fx: [st('wKV', 100, C.warn, 6)] };
      })(),
      { say: 'prefill 结束，吐出第一个输出 token y1：从到达到这里就是 TTFT。', set: { y1: mix(pop(0), { x: { from: 620, to: 720, dur: 600 } }), t1: pop(300), ttft: fade(500) },
        fx: [{ type: 'ripple', x: 420, y: 470, color: C.ok, at: 300 }] },
      { say: 'decode：y1 送回模型，读全部 KV（提示 + 已输出），只算一个新位置。', set: join(on('rKV'), { k6: pop(900) }), fx: [st('rKV', 0, C.data, 6), { type: 'pulse', obj: 'llm', color: C.info, at: 700 }] },
      { say: '追加 y1 的 KV，输出 y2。两个输出 token 之间的时间就是 TPOT。', set: { y2: mix(pop(0), { y: { from: 120, to: 160, dur: 500 } }), t2: pop(200), tpot: fade(400) },
        fx: [{ type: 'ripple', x: 520, y: 470, color: C.ok, at: 200 }] },
      { say: '再一步：读全部 KV、追加一个、出 y3。decode 是串行的，每步只出一个 token，瓶颈在搬运 KV 的内存带宽。', set: { k7: pop(500), y3: mix(pop(700), { y: { from: 160, to: 200, dur: 500, delay: 700 } }), t3: pop(900), k8: pop(1100) },
        fx: [st('rKV', 0, C.data, 6), { type: 'ripple', x: 620, y: 470, color: C.ok, at: 900 }] },
      { say: '计费时，输入、缓存命中的输入和输出各有价格。下一个场景看缓存能省多少。', set: { note: fade(200) } }
    ]
  };

  /* ---------------- 场景 3：跨调用的前缀缓存 ---------------- */
  var CX = 130, KP = 13;   // 每 1K token 13 像素
  var CACHED = [0, 7, 12, 17, 22], NEW = [6, 4, 4, 4, 4];
  var NOC = [0.055, 0.08, 0.105, 0.13, 0.155], WC = [0.055, 0.0485, 0.051, 0.0535, 0.056];
  var CY = [92, 136, 180, 224, 268];
  var CODE3 = { lang: 'py', title: '本机实跑 · 第 2 部分（Claude Opus 5）', src:
'# 价格（$ / 百万 token）：讲义第 40 页\n' +
'pc, pr, po = 0.50, 5.00, 25.00\n' +
'inp = [6, 11, 16, 21, 26]          # K\n' +
'cached = [0] + [i - 4 for i in inp[1:]]\n' +
'new = [i - c for i, c in zip(inp, cached)]\n' +
'cost = [(c*pc + n*pr + 1*po) / 1000\n' +
'        for c, n in zip(cached, new)]\n' +
'nocache = [(i*pr + 1*po) / 1000 for i in inp]\n' };
  var sc3 = {
    name: '跨调用缓存', desc: '上一次调用的输入和输出，成了下一次的可复用前缀。只有新回来的工具结果要重新 prefill（讲义第 38、40 页）。',
    code: CODE3, dataTitle: '5 次调用合计（美元）', data: { '不用缓存': 0, '用缓存': 0, '节省': 0 }, dataFmt: { '不用缓存': 'fixed4', '用缓存': 'fixed4', '节省': 'pct1' },
    bg: function (d) {
      title(d, '前缀缓存：可复用的前缀越滚越长');
      CY.forEach(function (y, i) { d.text(56, y, 'Call ' + (i + 1), { size: 12, weight: 700, color: C.fg2 }); });
      [['缓存命中', 'data'], ['新输入', 'bad'], ['输出 1K', 'neutral'], ['工具结果 4K', 'warn']].forEach(function (l, i) {
        d.rect(CX + i * 130, 306, 14, 14, { fill: C[l[1] + 'W'], stroke: C[l[1]], rx: 3 }); d.text(CX + i * 130 + 20, 313, l[0], { size: 11.5, color: C.fg2 });
      });
      d.text(56, 372, '每次的费用', { size: 12, weight: 700, color: C.fg2 });
      d.line(130, 520, 790, 520, { stroke: C.line, sw: 1.2 });
    },
    objects: function () {
      var o = {};
      CY.forEach(function (y, i) {
        var x = CX;
        o['a' + i] = seg(x, y, CACHED[i] * KP, 'data', CACHED[i] ? CACHED[i] + 'K' : ''); x += CACHED[i] * KP;
        o['b' + i] = seg(x, y, NEW[i] * KP, 'bad', NEW[i] + 'K'); x += NEW[i] * KP;
        o['o' + i] = seg(x, y, 1 * KP, 'neutral', ''); x += KP;
        o['t' + i] = seg(x, y, 4 * KP, 'warn', '');
        var bx = 170 + i * 120;
        o['n' + i] = { type: 'box', x: bx, y: 520, w: 34, h: 0, rx: 3, anchor: 'bc', fill: C.badW, stroke: C.bad, sw: 1.2, opacity: 0 };
        o['w' + i] = { type: 'box', x: bx + 40, y: 520, w: 34, h: 0, rx: 3, anchor: 'bc', fill: C.okW, stroke: C.ok, sw: 1.2, opacity: 0 };
        o['nl' + i] = { type: 'text', x: bx + 20, y: 534, text: 'Call ' + (i + 1), size: 11, color: C.fg3, anchor: 'middle', opacity: 0 };
      });
      o.leg1 = { type: 'text', x: 760, y: 392, text: '■ 不用缓存', size: 11.5, weight: 700, color: C.bad, anchor: 'end', opacity: 0 };
      o.leg2 = { type: 'text', x: 760, y: 412, text: '■ 用缓存', size: 11.5, weight: 700, color: C.ok, anchor: 'end', opacity: 0 };
      return o;
    },
    steps: [
      { say: 'Call 1：6K 全是新输入，模型输出 1K（示意）。工具执行后返回 4K 结果（示意）。',
        set: join(grow('b0', 6 * KP, 0, 500), grow('o0', KP, 500, 200), grow('t0', 4 * KP, 700, 400)) },
      { say: 'Call 2：Call 1 的输入和输出 7K 已经算过 KV，直接命中缓存。只有工具结果 4K 是新输入。',
        set: join(grow('a1', 7 * KP, 0, 700), grow('b1', 4 * KP, 700, 400), grow('o1', KP, 1100, 200), grow('t1', 4 * KP, 1300, 400)), fx: [{ type: 'flash', obj: 'a1', color: C.data, at: 700 }] },
      { say: 'Call 3–5：可复用的前缀越滚越长（12K、17K、22K）。每次需要重新 prefill 的，始终只有 4K。',
        set: join(grow('a2', 12 * KP, 0, 500), grow('b2', 4 * KP, 500, 300), grow('o2', KP, 800, 150), grow('t2', 4 * KP, 950, 300),
          grow('a3', 17 * KP, 600, 500), grow('b3', 4 * KP, 1100, 300), grow('o3', KP, 1400, 150), grow('t3', 4 * KP, 1550, 300),
          grow('a4', 22 * KP, 1200, 500), grow('b4', 4 * KP, 1700, 300), grow('o4', KP, 2000, 150), grow('t4', 4 * KP, 2150, 300)), hl: [4, 5] },
      (function () {
        var s = { leg1: fade(0), leg2: fade(0) };
        for (var i = 0; i < 5; i++) {
          s['n' + i] = { opacity: { to: 1, dur: 150, delay: i * 150 }, h: { to: NOC[i] * 800, dur: 600, delay: i * 150, ease: 'out' } };
          s['w' + i] = { opacity: { to: 1, dur: 150, delay: 300 + i * 150 }, h: { to: WC[i] * 800, dur: 600, delay: 300 + i * 150, ease: 'out' } };
          s['nl' + i] = fade(i * 150);
        }
        return { say: '按 Claude Opus 5 的价格算每次调用的费用。不用缓存时越来越贵，用缓存几乎持平。', set: s, hl: [6, 7, 8],
          log: [{ s: '  per-call cost no cache: [0.055, 0.08, 0.105, 0.13, 0.155]', at: 600 }, { s: '  per-call cost cached:   [0.055, 0.0485, 0.051, 0.0535, 0.056]', at: 1300 }] };
      })(),
      { say: '5 次合计：$0.5250 对 $0.2640，省了 49.7%。', data: { '不用缓存': { v: 0.525, at: 200 }, '用缓存': { v: 0.264, at: 500 }, '节省': { v: 49.7, at: 800 } },
        log: [{ s: 'Claude Opus 5                no cache $0.5250 | with cache $0.2640 | saving 49.7%', at: 300 }] },
      { say: '换成 DeepSeek V4 Flash（闲时价），同样的算法省 59.1%。注意，讲义说写缓存可能另外计费。测出来的物理成本和服务商标价也是两回事。',
        log: [{ s: 'DeepSeek V4 Flash (off-peak) no cache $0.0209 | with cache $0.0085 | saving 59.1%', at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：前缀共享与缓存感知路由 ---------------- */
  var sc4 = {
    name: '前缀共享', desc: '推理服务把请求的公共前缀组织成一棵树。匹配就复用，分叉就拆开，满了就从最久没用的叶子开始驱逐（讲义第 42–43 页）。',
    bg: function (d) { title(d, '前缀树（RadixAttention 的做法）与缓存感知路由'); },
    objects: function () {
      function nd(x, y, w, t, k) { return { type: 'box', x: x, y: y, w: w, h: 30, rx: 7, fill: C[k + 'W'], stroke: C[k], sw: 1.4, text: t, size: 11.5, weight: 650, opacity: 0 }; }
      return {
        r: nd(250, 90, 240, 'You are a helpful assistant.', 'data'),
        e1: wire('M250,106 L150,150', C.data), e2: wire('M250,106 L360,150', C.data), e3: wire('M150,182 L150,226', C.data), e4: wire('M360,182 L360,226', C.data),
        a: nd(150, 166, 150, 'User: Hello! …', 'data'),
        b: nd(360, 166, 170, 'User: What can you do? …', 'info'),
        c: nd(150, 242, 170, 'User: Solve this problem …', 'data'),
        dd: nd(360, 242, 170, 'User: Write a story …', 'info'),
        ev: { type: 'text', x: 150, y: 286, text: 'evicted（最久没用的叶子）', size: 11.5, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 },
        req: { type: 'box', x: 90, y: 400, w: 130, h: 50, rx: 10, fill: C.dataW, stroke: C.data, sw: 1.5, text: '新请求', sub: '前缀哈希 A', subMono: false, size: 13, weight: 700, opacity: 0 },
        rt: { type: 'box', x: 330, y: 400, w: 200, h: 56, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.6, text: '缓存感知路由', sub: '分数 = 可复用前缀 − 排队惩罚', subMono: false, size: 13, weight: 700, opacity: 0 },
        w1: { type: 'box', x: 650, y: 370, w: 220, h: 40, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.4, text: 'Worker 1 · 18K 匹配 · 排队 2', size: 12, weight: 650, opacity: 0 },
        w2: { type: 'box', x: 650, y: 430, w: 220, h: 40, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.4, text: 'Worker 2 · 2K 匹配 · 排队 0', size: 12, weight: 650, opacity: 0 },
        p1: wire('M155,400 L228,400', C.data), p2: wire('M430,394 C480,380 500,370 538,370', C.warn), p3: wire('M430,410 C480,425 500,430 538,430', C.warn),
        tip: { type: 'box', x: 650, y: 200, w: 300, h: 120, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.3, dasharray: '5 4', text: '为缓存设计提示', sub: '稳定前缀 · 变化往后追加 · 少改动 · 量命中率', subMono: false, subSize: 11, size: 13, weight: 700, opacity: 0 }
      };
    },
    steps: [
      { say: '两个对话都以同一句系统提示开头。树根存一份 KV，所有请求共用。', set: join({ r: pop(0), a: pop(400) }, on('e1', 300)) },
      { say: 'Match：新请求的前缀和已有路径一致，就复用整段 KV。只追加后缀"Solve this problem …"。', set: join(on('e3'), { c: pop(400) }), fx: [{ type: 'pulse', obj: 'r', color: C.data, at: 0 }, { type: 'pulse', obj: 'a', color: C.data, at: 200 }, { type: 'ripple', obj: 'c', color: C.data, at: 700 }] },
      { say: 'Split：另一个请求在第二句就不同了，于是在公共前缀处分叉。', set: join(on('e2'), { b: pop(400) }), fx: [{ type: 'pulse', obj: 'r', color: C.info, at: 0 }, { type: 'ripple', obj: 'b', color: C.info, at: 600 }] },
      { say: 'Evict：显存不够时，从最久没用到的叶子开始驱逐（LRU）。常用的前缀留下。', set: join(on('e4'), { dd: pop(300), c: { opacity: { to: 0.25, dur: 400, delay: 800 }, stroke: { to: C.bad, dur: 300, delay: 800 } }, ev: fade(900) }),
        fx: [{ type: 'shake', obj: 'c', at: 800 }] },
      { say: '多台机器时，路由要看哪台已经缓存了你的前缀。命中越长越好，但也要扣掉排队的代价。', set: join({ req: pop(0), rt: pop(300), w1: pop(500), w2: pop(600) }, on('p1', 400), on('p2', 800), on('p3', 800)),
        fx: [st('p1', 500, C.data, 3), st('p2', 900, C.warn, 3), st('p3', 900, C.warn, 3)] },
      { say: '讲义给写提示的人的建议是这样的。把指令、工具、例子放在稳定的前缀里。新的回合和观察往后追加。避免无谓的改动，并且度量命中率。', set: { tip: pop(0) } }
    ]
  };

  VZ.register({
    id: 'c2-context', title: '上下文为什么越跑越贵：增长、推理与缓存',
    sources: [{ t: '第 3 讲（Context Management for Long-Context Agents）', u: YT }, { t: '讲义 lecture-03 第 3、7–9、38–44 页', u: L3 }],
    note: '场景 1 的每次输入和累计照讲义第 3 页。公式和 100 次调用的外推是本机实算的。场景 2 的阶段、TTFT、TPOT 照第 7–9 页，6 个提示 token 是示意。场景 3 的分段照第 38 页，价格照第 40 页（2026-08-30 查的价）。"每次输出 1K、工具结果 4K"是示意，费用全部实算。场景 4 的三个操作和对话照第 42 页。路由的 18K / 2K、排队 2 / 0 照第 43 页，打分权重讲义没给。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

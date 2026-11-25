/* 08 · 作业 3 Part 3 —— 异步 GRPO 训练器：有界队列的背压、取出时判过期、跳过的步
 * 规则出自 assignment-3 的 ASSIGNMENT.md Part 3 和 scottyrl/train/async_grpo.py 的 docstring（模块说明、active_policy、
 * collect_fresh_batch、train）。画面里的队列内容、版本号、丢弃数全部来自 本机工作文件 的 D1–D3：
 * 一个真用 asyncio.Queue(maxsize=16) 的玩具模拟，参数取 p3 配置（8 个 worker、每批 8 组、max_staleness 2），
 * rollout 3–6、更新 10 个时间单位的耗时是示意，跑在虚拟时钟上；每组只是一个带版本号的假结果，不是作业的参考实现。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var SRC_MD = { t: 'assignment-3 · ASSIGNMENT.md（Part 3）', u: 'https://github.com/cmu-agents/assignment-3/blob/main/ASSIGNMENT.md' };
  var SRC_AS = { t: 'assignment-3 · scottyrl/train/async_grpo.py', u: 'https://github.com/cmu-agents/assignment-3/blob/main/scottyrl/train/async_grpo.py' };
  var SRC_CFG = { t: 'assignment-3 · configs/p3_number_search_async.yaml', u: 'https://github.com/cmu-agents/assignment-3/blob/main/configs/p3_number_search_async.yaml' };
  var SRC_PY = { t: 'Python 文档 · asyncio.Queue', u: 'https://docs.python.org/3/library/asyncio-queue.html' };

  var VC = ['dataW', 'infoW', 'okW', 'warnW', 'neutralW'], VS = ['data', 'info', 'ok', 'warn', 'neutral'];
  function vfill(v) { return C[VC[v % 5]]; }
  function vstroke(v) { return C[VS[v % 5]]; }
  /* 队列：16 个槽，队头在右（x = QH），队尾在左 */
  var QH = 626, QS = 25, QY = 300;
  function qx(slot) { return QH - slot * QS; }
  var WX = 92, WY = function (i) { return 128 + i * 47; };
  var LX = 750, LY = 300;
  function bxy(k) { return { x: 714 + (k % 4) * 24, y: 404 + Math.floor(k / 4) * 28 }; }
  function chip(v, x, y, op) {
    return { type: 'box', x: x, y: y, w: 21, h: 26, rx: 4, fill: vfill(v), stroke: vstroke(v), sw: 1.3, text: String(v), mono: true, size: 12, weight: 800, opacity: op == null ? 0 : op };
  }
  function worker(i, sub, op) {
    return { type: 'box', x: WX, y: WY(i), w: 118, h: 36, rx: 7, fill: C.warnW, stroke: C.warn, sw: 1.4, text: 'worker ' + i, sub: sub, subMono: false, subSize: 11, size: 12, weight: 700, opacity: op == null ? 1 : op };
  }
  function path(d, col, extra) {
    var a = col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data';
    return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, arrow: a, opacity: 0.35 }, extra || {});
  }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function move(x, y, delay, dur) { return { x: { to: x, dur: dur || 650, delay: delay || 0, ease: 'inOut' }, y: { to: y, dur: dur || 650, delay: delay || 0, ease: 'inOut' } }; }
  function bg(d, t) {
    d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg });
    for (var s = 0; s < 16; s++) d.rect(qx(s) - 11.5, QY - 15, 23, 30, { fill: C.bg, stroke: C.line1, sw: 1, rx: 4 });
    d.text(QH - 7.5 * QS, QY - 32, 'asyncio.Queue(maxsize=16)：右边是队头', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
    d.text(QH - 7.5 * QS, QY + 30, 'await put → 队尾　　队头 → await get', { anchor: 'middle', size: 11.5, color: C.fg3 });
    d.text(WX, 494, 'rollout worker × 8', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
  }
  function base(o, ver) {
    o.pPub = path('M310,66 L' + WX + ',66 L' + WX + ',106', C.info);
    o.pPut = path('M156,' + QY + ' L222,' + QY, C.warn);
    o.pGet = path('M642,' + QY + ' L' + (LX - 78) + ',' + QY, C.data);
    o.pUpd = path('M' + LX + ',' + (LY - 36) + ' L' + LX + ',66 L556,66', C.ok);
    o.pDrop = path('M626,318 L626,452 L602,452', C.bad);
    o.P = { type: 'box', x: 433, y: 66, w: 240, h: 40, rx: 9, fill: C.infoW, stroke: C.info, sw: 1.6, text: '当前策略 v' + ver, sub: 'publish_policy：策略和版本一起换', subMono: false, subSize: 10.5, size: 13, weight: 700, opacity: 1 };
    o.L = { type: 'box', x: LX, y: LY, w: 152, h: 70, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '学习者 v' + ver, sub: '凑满 8 组再更新', subMono: false, subSize: 11, size: 13.5, weight: 700, opacity: 1 };
    o.batch = { type: 'box', x: 750, y: 418, w: 110, h: 72, rx: 8, fill: 'none', stroke: C.line, sw: 1.2, dasharray: '4 3', opacity: 1 };
    o.batchT = { type: 'text', x: 750, y: 468, text: '这一批（8 组）', size: 11.5, color: C.fg3, opacity: 1 };
    o.T = { type: 'box', x: 548, y: 452, w: 104, h: 40, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.4, num: 0, fmt: 'int', pre: '丢弃 ', size: 13, weight: 800, opacity: 0 };
    return o;
  }

  /* ================= 场景 1：有界队列与背压 ================= */
  var CODE1 = { lang: 'py', title: 'async_grpo.py（给好的代码与模块说明，节选）', src:
'def active_policy(self):\n' +
'    """Capture the current policy and its\n' +
'    version as one pair (given)."""\n' +
'    if self.policy is None:\n' +
'        raise RuntimeError(...)\n' +
'    return self.policy, self.version\n' +
'\n' +
'# An asyncio.Queue with maxsize > 0 is\n' +
'# bounded. `await put(...)` pauses a fast\n' +
'# producer while it is full (backpressure),\n' +
'# and `await get()` pauses a consumer\n' +
'# while it is empty.\n' };
  /* 第 3 步开始时（t=24）的队列：[0×14, 1, 0]（队头在前），6 个 worker 拿着 v1 等 put */
  var S1_FILL = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];         // t=4–14 进来的 15 个
  var S1_MORE = [0, 0, 0, 0, 0, 0, 0, 1, 0];                           // t=14–24 又进来的 9 个
  var sc1 = {
    name: '有界队列与背压', desc: 'worker 先捕获 (策略, 版本) 再生成。队列满了，await put 让 worker 停下来等。这就是背压。',
    code: CODE1, dataTitle: '模拟（p3 参数，示意耗时）', data: { '学习者版本': 0, '队列里的组': 0, '等 put 的 worker': 0 },
    bg: function (d) { bg(d, '生产者 → 有界队列 → 学习者'); },
    objects: function () {
      var o = base({}, 0);
      for (var i = 0; i < 8; i++) o['w' + i] = worker(i, '空闲');
      for (var b = 0; b < 8; b++) o['b' + b] = chip(0, 180, QY);
      S1_FILL.forEach(function (v, k) { o['q' + k] = chip(v, 180, QY); });
      S1_MORE.forEach(function (v, k) { o['m' + k] = chip(v, 180, QY); });
      for (var h = 0; h < 6; h++) o['h' + h] = chip(1, WX + 78, WY(h + 2));
      return o;
    },
    steps: [
      { say: '先发布 v0：publish_policy(0)。每个 worker 开始生成一组前，用 active_policy() 一次性捕获 (策略, 版本)。',
        set: (function () { var s = on('pPub'); for (var i = 0; i < 8; i++) s['w' + i] = { sub: { to: '生成 · 捕获 v0', delay: 500 + i * 80 } }; return s; })(),
        fx: [st('pPub', 0, C.info, 6)], hl: [1, 2, 3, 4, 5, 6] },
      { say: '最先完成的 8 组（都标着 v0）经队列送到学习者，凑满一批。学习者开始更新（示意耗时 10）。',
        set: (function () { var s = join(on('pPut'), on('pGet', 300)); for (var b = 0; b < 8; b++) { var p = bxy(b); s['b' + b] = mix(move(p.x, p.y, b * 90, 900), { opacity: { to: 1, dur: 150, delay: b * 90 } }); } s.L = { sub: { to: '更新中 → v1', delay: 1300 } }; return s; })(),
        fx: [st('pPut', 0, C.warn, 4), st('pGet', 400, C.data, 4), { type: 'pulse', obj: 'L', color: C.info, at: 1300 }],
        log: [{ s: '  第 1 步开始取时（t=0）：队列 0 组，版本 []；拿着结果等 put 的 worker 0 个，版本 []', at: 0 }] },
      { say: '学习者更新的这段时间里，worker 没闲着。它们又生成了 15 组，都还是 v0，在队列里排队。',
        set: (function () { var s = {}; S1_FILL.forEach(function (v, k) { s['q' + k] = mix(move(qx(k), QY, k * 80, 650), { opacity: { to: 1, dur: 120, delay: k * 80 } }); }); return s; })(),
        fx: [st('pPut', 0, C.warn, 8)], data: { '队列里的组': { v: 15, at: 1700 } },
        log: [{ s: '  第 2 步开始取时（t=14）：队列 15 组，版本 [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]；拿着结果等 put 的 worker 0 个，版本 []', at: 300 }] },
      { say: '发布 v1。学习者从队头取 8 组（都是 v0，1 − 0 = 1 ≤ 2，新鲜），开始第 2 步。之后开工的 worker 捕获的是 v1。',
        set: (function () {
          var s = join(on('pUpd'), { P: { text: { to: '当前策略 v1', delay: 400 } }, L: { text: { to: '学习者 v1', delay: 400 }, sub: { to: '取第 2 批', delay: 400 } } });
          for (var b = 0; b < 8; b++) s['b' + b] = fade(0, 300, 0.25);
          for (var k = 0; k < 15; k++) s['q' + k] = k < 8 ? mix(move(LX, LY, 700 + k * 60, 500), { opacity: { to: 0, dur: 150, delay: 1150 + k * 60 } }) : move(qx(k - 8), QY, 1300, 600);
          for (var i = 0; i < 8; i++) s['w' + i] = { sub: { to: '生成 · 捕获 v1', delay: 1400 + i * 60 } };
          return s; })(),
        fx: [st('pUpd', 0, C.ok, 4), st('pGet', 700, C.data, 5)], data: { '学习者版本': { v: 1, at: 400 }, '队列里的组': { v: 7, at: 1300 } } },
      { say: '又进来 9 组，多数是更新前开工的 v0，夹着 1 个 v1。队列满到 16。再完成的 6 个 worker 放不进去，只能拿着 v1 结果在 await put 上等。',
        set: (function () {
          var s = {};
          S1_MORE.forEach(function (v, k) { s['m' + k] = mix(move(qx(7 + k), QY, k * 110, 650), { opacity: { to: 1, dur: 120, delay: k * 110 } }); });
          for (var h = 0; h < 6; h++) { s['h' + h] = pop(1400 + h * 90); s['w' + (h + 2)] = { sub: { to: '拿着 v1 等 put', delay: 1400 + h * 90 }, fill: { to: C.neutralW, dur: 300, delay: 1400 + h * 90 }, stroke: { to: C.neutral, dur: 300, delay: 1400 + h * 90 } }; }
          return s; })(),
        fx: [st('pPut', 0, C.warn, 8), { type: 'flash', x: QH - 7.5 * QS, y: QY, color: C.bad, at: 1200 }],
        data: { '队列里的组': { v: 16, at: 1100 }, '等 put 的 worker': { v: 6, at: 1500 } },
        log: [{ s: '  第 3 步开始取时（t=24）：队列 16 组，版本 [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]；拿着结果等 put 的 worker 6 个，版本 [1, 1, 1, 1, 1, 1]', at: 300 }], hl: [8, 9, 10, 11, 12] },
      { say: '这就是背压。学习者慢，生产就自动停下，不会无限堆积旧数据。也不用轮询 full()。学习者每取走一组，排在最前的那个 worker 的 put 才完成。',
        fx: [{ type: 'pulse', obj: 'w2', color: C.neutral, at: 0 }, { type: 'pulse', obj: 'w3', color: C.neutral, at: 120 }, { type: 'pulse', obj: 'L', color: C.info, at: 600 }] }
    ]
  };

  /* ================= 场景 2：取出时判过期 ================= */
  var CODE2 = { lang: 'py', title: 'collect_fresh_batch 的规格（docstring，重排成短行）', src:
'async def collect_fresh_batch(\n' +
'        self, results, stats):\n' +
'    """Collect the next learner batch,\n' +
'    discarding stale queue entries.\n' +
'\n' +
'    Freshness is measured when an entry\n' +
'    is consumed: a group is stale when\n' +
'    self.version - group.policy_version\n' +
'    exceeds cfg.max_staleness. Add the\n' +
'    number of discarded groups to\n' +
'    stats["groups_dropped_stale"] ...\n' +
'    Return exactly cfg.groups_per_batch\n' +
'    fresh groups, whether or not they\n' +
'    are degenerate."""\n' };
  var R = [0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1];   // 第 4 步开始时（t=34）队列，队头在前
  var sc2 = {
    name: '取出时判过期', desc: '学习者到了 v3。取出 v0 的组，3 − 0 = 3 > 2，丢弃。v1 的组 3 − 1 = 2，留下。腾出的位置让等着的 worker 放进来。',
    code: CODE2, dataTitle: '模拟（max_staleness 2）', data: { '学习者版本': 3, '这一批': 0, groups_dropped_stale: 0, '队列里的组': 16 },
    bg: function (d) { bg(d, '学习者取组时才判断过期：版本差 > max_staleness 就丢'); },
    objects: function () {
      var o = base({}, 3);
      for (var i = 0; i < 8; i++) { o['w' + i] = worker(i, '拿着 v2 等 put'); o['w' + i].fill = C.neutralW; o['w' + i].stroke = C.neutral; }
      R.forEach(function (v, k) { o['r' + k] = chip(v, qx(k), QY, 1); });
      for (var h = 0; h < 8; h++) o['h' + h] = chip(2, WX + 78, WY(h), 1);
      for (var n = 0; n < 7; n++) o['n' + n] = chip(3, 180, QY);
      for (var g = 0; g < 8; g++) o['u' + g] = chip(3, WX + 78, WY(g));
      o.T.opacity = 1;
      o.rule = { type: 'box', x: 433, y: 190, w: 300, h: 34, rx: 8, fill: C.bg, stroke: C.line, sw: 1.2, text: '学习者 v3 − 组的版本 > 2 → 丢弃', size: 12.5, weight: 700, opacity: 1 };
      return o;
    },
    steps: [
      { say: '第 4 步开始时（模拟的 t=34），学习者已经是 v3。队列满着，队头是 v0 的组。8 个 worker 拿着 v2 的结果在等 put。',
        fx: [{ type: 'pulse', obj: 'r0', color: C.data, at: 0 }, { type: 'pulse', obj: 'L', color: C.info, at: 300 }],
        log: [{ s: '  第 4 步开始取时（t=34）：队列 16 组，版本 [0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1]；拿着结果等 put 的 worker 8 个，版本 [2, 2, 2, 2, 2, 2, 2, 2]', at: 200 }], hl: [6, 7, 8, 9] },
      { say: '连取 6 组 v0：3 − 0 = 3 > 2，过期，丢掉。每腾出一个位置，排在前面的 worker 的 put 就完成。它的 v2 结果进队尾，然后它捕获 v3，开始新的一组。',
        set: (function () {
          var s = join(on('pDrop'));
          for (var k = 0; k < 6; k++) s['r' + k] = mix(move(548, 452, k * 160, 700), { opacity: { to: 0, dur: 200, delay: k * 160 + 650 } });
          for (var j = 6; j < 16; j++) s['r' + j] = move(qx(j - 6), QY, 1100, 600);
          for (var h = 0; h < 6; h++) { s['h' + h] = move(qx(10 + h), QY, 1500 + h * 100, 650); s['w' + h] = { sub: { to: '生成 · 捕获 v3', delay: 1700 + h * 100 }, fill: { to: C.warnW, dur: 250, delay: 1700 + h * 100 }, stroke: { to: C.warn, dur: 250, delay: 1700 + h * 100 } }; }
          s.T = { num: { to: 6, dur: 800, delay: 300 } };
          return s; })(),
        fx: [st('pDrop', 0, C.bad, 6), st('pPut', 1500, C.warn, 6)], data: { groups_dropped_stale: { v: 6, at: 900 } }, hl: [8, 9, 10, 11] },
      { say: '下一组是 v1：3 − 1 = 2，没超过 2，留下进批。再下一组又是 v0，丢掉。最后两个等着的 worker 也放进来了。',
        set: (function () {
          var p = bxy(0), s = {};
          s.r6 = move(p.x, p.y, 0, 800);
          s.r7 = mix(move(548, 452, 500, 700), { opacity: { to: 0, dur: 200, delay: 1150 } });
          for (var j = 8; j < 16; j++) s['r' + j] = move(qx(j - 8), QY, 1300, 600);
          for (var h = 0; h < 6; h++) s['h' + h] = move(qx(8 + h), QY, 1300, 600);
          s.h6 = move(qx(14), QY, 1700, 650); s.h7 = move(qx(15), QY, 1800, 650);
          s.w6 = { sub: { to: '生成 · 捕获 v3', delay: 1900 }, fill: { to: C.warnW, dur: 250, delay: 1900 }, stroke: { to: C.warn, dur: 250, delay: 1900 } };
          s.w7 = { sub: { to: '生成 · 捕获 v3', delay: 2000 }, fill: { to: C.warnW, dur: 250, delay: 2000 }, stroke: { to: C.warn, dur: 250, delay: 2000 } };
          s.T = { num: { to: 7, dur: 500, delay: 900 } };
          return s; })(),
        fx: [st('pGet', 0, C.data, 3), { type: 'ripple', x: bxy(0).x, y: bxy(0).y, r: 18, color: C.ok, at: 800 }, st('pDrop', 500, C.bad, 3)],
        data: { '这一批': { v: 1, at: 800 }, groups_dropped_stale: { v: 7, at: 1100 } } },
      { say: '接着 7 组 v1 都新鲜，批凑满 8 组。这一步一共取出 15 组：丢 7，用 8。',
        set: (function () {
          var s = {};
          for (var j = 8; j < 15; j++) { var p = bxy(j - 7); s['r' + j] = move(p.x, p.y, (j - 8) * 120, 750); }
          s.r15 = move(qx(0), QY, 1100, 600);
          for (var h = 0; h < 8; h++) s['h' + h] = move(qx(1 + h), QY, 1100, 600);
          return s; })(),
        fx: [st('pGet', 0, C.data, 7)], data: { '这一批': { v: 8, at: 900 }, '队列里的组': { v: 9, at: 1500 } },
        log: [{ s: 'step 4: t=34–44 学习者版本 3 取出的组版本 [0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1] → 丢弃 7，入批 [1, 1, 1, 1, 1, 1, 1, 1]，退化 3，skipped 0 → 版本 4，队列剩 16', at: 300 }], hl: [12, 13, 14] },
      { say: '更新、发布 v4。更新期间 worker 又交来 7 组 v3，队列再次满到 16。8 个 worker 拿着 v3 的结果等 put。',
        set: (function () {
          var s = join(on('pUpd'), { P: { text: { to: '当前策略 v4', delay: 1200 } }, L: { text: { to: '学习者 v4', delay: 1200 } } });
          for (var j = 6; j < 15; j++) if (j !== 7) s['r' + j] = fade(0, 300, 0.25);
          for (var n = 0; n < 7; n++) s['n' + n] = mix(move(qx(9 + n), QY, 200 + n * 110, 650), { opacity: { to: 1, dur: 120, delay: 200 + n * 110 } });
          for (var g = 0; g < 8; g++) { s['u' + g] = pop(1300 + g * 80); s['w' + g] = { sub: { to: '拿着 v3 等 put', delay: 1300 + g * 80 }, fill: { to: C.neutralW, dur: 250, delay: 1300 + g * 80 }, stroke: { to: C.neutral, dur: 250, delay: 1300 + g * 80 } }; }
          s.rule = { text: { to: '学习者 v4 − 组的版本 > 2 → 丢弃', delay: 1200 } };
          return s; })(),
        fx: [st('pPut', 0, C.warn, 7), st('pUpd', 900, C.ok, 4)], data: { '学习者版本': { v: 4, at: 1200 }, '这一批': { v: 0, at: 1200 }, '队列里的组': { v: 16, at: 1100 } },
        log: [{ s: '  第 5 步开始取时（t=44）：队列 16 组，版本 [1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3]；拿着结果等 put 的 worker 8 个，版本 [3, 3, 3, 3, 3, 3, 3, 3]', at: 400 }] },
      { say: '第 5 步：队头的 v1 现在 4 − 1 = 3，过期丢掉。8 个 v2（4 − 2 = 2）进批，等着的 worker 放进来。到第 6 步一共丢 8 组。',
        set: (function () {
          var s = { r15: mix(move(548, 452, 0, 700), { opacity: { to: 0, dur: 200, delay: 650 } }), T: { num: { to: 8, dur: 500, delay: 400 } } };
          for (var j = 6; j < 15; j++) if (j !== 7) s['r' + j] = fade(0, 300, 0);
          for (var h = 0; h < 8; h++) { var p = bxy(h); s['h' + h] = move(p.x, p.y, 800 + h * 100, 700); }
          for (var n = 0; n < 7; n++) s['n' + n] = move(qx(n), QY, 1800, 600);
          for (var g = 0; g < 8; g++) { s['u' + g] = move(qx(7 + g), QY, 2100 + g * 80, 650); s['w' + g] = { sub: { to: '生成 · 捕获 v4', delay: 2300 + g * 80 }, fill: { to: C.warnW, dur: 250, delay: 2300 + g * 80 }, stroke: { to: C.warn, dur: 250, delay: 2300 + g * 80 } }; }
          return s; })(),
        fx: [st('pDrop', 0, C.bad, 3), st('pGet', 800, C.data, 7), st('pPut', 2100, C.warn, 6)], data: { groups_dropped_stale: { v: 8, at: 500 }, '这一批': { v: 8, at: 1600 }, '队列里的组': { v: 15, at: 2700 } },
        log: [{ s: "stats = {'train_steps': 6, 'groups_consumed': 48, 'groups_dropped_stale': 8}", at: 400 }] },
      { say: '同样的耗时，把 max_staleness 改成 4（p43 的设置），一组都不丢。p5 配置的注释给了一个式子：(worker 数 + 队列容量) / 每批组数。它是组最多能旧几个版本。p3 是 (8+16)/8 = 3，大于它的 2。',
        fx: [{ type: 'pulse', obj: 'rule', color: C.warn, at: 0 }, { type: 'pulse', obj: 'T', color: C.bad, at: 300 }],
        log: [{ s: "stats = {'train_steps': 6, 'groups_consumed': 48, 'groups_dropped_stale': 0}", at: 300 }, { s: 'p3_number_search_async: workers 8, queue 16, groups_per_batch 8, group_size 8 → 比值 3；max_staleness 2；loss ppo', at: 1700 }] }
    ]
  };

  /* ================= 场景 3：跳过的步 ================= */
  var CODE3 = { lang: 'py', title: 'AsyncGRPOTrainer.train 的规格（docstring 节选，重排成短行）', src:
'# ... Each collects a fresh batch and,\n' +
'# when the batch has at least one\n' +
'# sequence, updates and publishes\n' +
'# self.version + 1. A batch with no\n' +
'# sequences (every group degenerate) is\n' +
'# a skipped step: no update and no\n' +
'# publish, so the version does not\n' +
'# advance. Either way the iteration is\n' +
'# recorded with exactly one call to the\n' +
'# given record_training(step, batch,\n' +
'# train_metrics) ({} on a skipped step)\n' +
'\n' +
'# On every evaluation boundary ...\n' +
'# capture the pair returned by\n' +
'# active_policy() and schedule\n' +
'# run_evaluation(policy, version, step)\n' +
'# as a task so training continues\n' +
'# while it runs.\n' };
  var sc3 = {
    name: '跳过的步', desc: '全是退化组的批没有序列。不更新、不发布，版本停在原地，但这一步照样记一条。步号和版本从此不再相等。',
    code: CODE3, dataTitle: '模拟（每组都退化）', data: { '步号': 0, '版本': 0, train_steps: 0, groups_consumed: 0 },
    bg: function (d) { bg(d, '退化组照样占一个批位，整批都退化就是"跳过的步"'); },
    objects: function () {
      var o = base({}, 0);
      for (var i = 0; i < 8; i++) o['w' + i] = worker(i, '生成 · 捕获 v0');
      for (var b = 0; b < 16; b++) o['b' + b] = { type: 'box', x: qx(15 - b), y: QY, w: 21, h: 26, rx: 4, fill: C.bg, stroke: C.neutral, sw: 1.3, dasharray: '3 2', text: '0', mono: true, size: 12, weight: 800, opacity: 1 };
      o.grp = { type: 'box', x: 433, y: 172, w: 320, h: 44, rx: 8, fill: C.bg, stroke: C.line, sw: 1.2, text: '一组 8 次奖励 [1, 1, 1, 1, 1, 1, 1, 1]（示意）', sub: '减去组均值全是 0 → None → sequences = []，rewards 保留', subMono: false, subSize: 10.5, size: 12, weight: 700, opacity: 0 };
      o.skip = { type: 'box', x: LX, y: 362, w: 150, h: 30, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.4, text: 'skipped = 1', mono: true, size: 13, weight: 800, opacity: 0 };
      o.ev = { type: 'box', x: 433, y: 520, w: 420, h: 34, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.3, text: '评测边界：捕获 (策略, 版本)，run_evaluation 作为后台任务跑', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '退化组：同一题 8 次的奖励全相同。compute_group_advantages 返回 None，这组没有训练序列。但奖励留着，照样进队列、照样算一组。',
        set: { grp: pop(0) }, fx: [{ type: 'pulse', obj: 'b15', color: C.neutral, at: 600 }] },
      { say: '模拟里把每组都设成退化。学习者取满 8 组（虚线方块，没有序列）。这一批一条序列也没有。',
        set: (function () { var s = {}; for (var b = 15; b >= 8; b--) { var p = bxy(15 - b); s['b' + b] = move(p.x, p.y, (15 - b) * 100, 700); } for (var c = 7; c >= 0; c--) s['b' + c] = move(qx(7 - c), QY, 1100, 600); return s; })(),
        fx: [st('pGet', 0, C.data, 8)], data: { groups_consumed: { v: 8, at: 900 } } },
      { say: '于是这是一个跳过的步：不调 update、不发布新策略，版本还是 v0。但 record_training 照样调用一次，记录里带 skipped = 1。',
        set: { skip: pop(0), L: { sub: { to: '不更新、不发布', delay: 200 } } },
        fx: [{ type: 'shake', obj: 'P', at: 300 }], data: { '步号': { v: 1, at: 200 }, train_steps: { v: 1, at: 200 } },
        log: [{ s: 'step 1: 退化 8/8 → skipped 1，版本 0', at: 300 }], hl: [4, 5, 6, 7, 8, 9, 10, 11] },
      { say: '第 2 步还是从同一个策略采样，结果又全是退化组。步号走到 2，版本仍是 0。所以步号是"学习者迭代了几次"，版本是"真正更新了几次"。两者从第一次跳过起就不再相等。',
        set: (function () { var s = {}; for (var b = 15; b >= 8; b--) s['b' + b] = fade(0, 300, 0.2); for (var c = 7; c >= 0; c--) { var p = bxy(7 - c); s['b' + c] = move(p.x, p.y, 400 + (7 - c) * 100, 700); } return s; })(),
        fx: [st('pGet', 300, C.data, 8), { type: 'pulse', obj: 'skip', color: C.warn, at: 1400 }],
        data: { '步号': { v: 2, at: 1300 }, train_steps: { v: 2, at: 1300 }, groups_consumed: { v: 16, at: 1300 } },
        log: [{ s: 'step 2: 退化 8/8 → skipped 1，版本 0', at: 400 }, { s: "stats = {'train_steps': 2, 'groups_consumed': 16, 'groups_dropped_stale': 0}", at: 1300 }] },
      { say: 'train() 返回的 groups_consumed 把退化组也算进去（16）。train_steps 数的是迭代（2），self.version 是真正的更新次数（0）。公开测试正是这样断言的。',
        fx: [{ type: 'pulse', obj: 'L', color: C.info, at: 0 }, { type: 'pulse', obj: 'P', color: C.info, at: 300 }] },
      { say: '评测也不能卡住训练。到了评测边界，就捕获当时的 (策略, 版本)。再把 run_evaluation 作为后台任务排上。学习者接着训练，评测结果记在排它的那一步。',
        set: { ev: pop(0) }, fx: [{ type: 'ripple', obj: 'ev', color: C.ok, at: 300 }], hl: [13, 14, 15, 16, 17, 18] }
    ]
  };

  VZ.register({
    id: 'c8-async', title: '异步 GRPO 训练器：有界队列、过期丢弃、跳过的步',
    sources: [SRC_MD, SRC_AS, SRC_CFG, SRC_PY],
    note: '规则都出自 ASSIGNMENT.md Part 3 和 async_grpo.py 的 docstring。包括先捕获 (策略, 版本)、await put/get 提供背压、取出时判过期。还有整批退化就跳过且版本不动、评测作为后台任务。代码面板是给好的代码和 docstring 摘抄，重排成了短行。它不是作业的实现。画面里每个队列快照、版本号和丢弃数都是本机实算（D1–D3）。那是一个真用 asyncio.Queue(maxsize=16) 的玩具模拟。8 个 worker、每批 8 组、max_staleness 2 取自 p3 配置。rollout 3–6 和更新 10 个时间单位是示意，跑在虚拟时钟上。"一组 8 次全是 1"是示意。比值 (8+16)/8 = 3 按 p5 配置注释里的式子算。',
    legend: [[C.dataW, '组的版本 v0'], [C.infoW, 'v1'], [C.okW, 'v2'], [C.warnW, 'v3'], [C.bad, '过期丢弃']],
    scenes: [sc1, sc2, sc3]
  });
})();

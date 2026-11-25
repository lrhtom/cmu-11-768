/* 11 · 第 21 讲（课 11/17 才上）：语言模型智能体的树搜索：一步步走的问题、价值函数、最佳优先搜索、回溯、结果
 * 依据：Koh, McAleer, Fried, Salakhutdinov, Tree Search for Language Model Agents, TMLR 2025（arXiv 2407.01476v3），证据在 evidence/。
 * 算法步骤（优先队列、子节点用父节点分数入队、深度 / 预算 / 阈值、重置重放回溯、结束后走到最好的状态）、价值函数的 1 / 0.5 / 0、
 * 20 次取平均、各表的成功率照论文。玩具网站的页面、动作和 20 次判断的票数是示意，搜索过程由 本机验算脚本 真跑。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PAPER = 'https://arxiv.org/abs/2407.01476v3';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, w, h, size, mono) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: mono !== false, opacity: 0 }; }
  function grow(w, d0, dur) { return { opacity: { to: 1, dur: 100, delay: d0 || 0 }, w: { to: w, dur: dur || 600, delay: d0 || 0, ease: 'out' } }; }
  function recolor(k, d0) { return { fill: { to: C[k + 'W'], dur: 300, delay: d0 || 0 }, stroke: { to: C[k], dur: 300, delay: d0 || 0 } }; }

  /* 玩具网站（示意）：同 verify.py */
  var POS = { s0: [280, 100], A: [150, 225], B: [410, 225], A1: [72, 350], A2: [205, 350], B1: [355, 350], B2: [490, 350] };
  var NM = { s0: '首页', A: '「罐头」分类页', A1: '错品牌商品页', A2: '又回到首页', B: '搜 Del Monte', B1: '两件都加进对比', B2: '只加了一件' };
  var VAL = { s0: 0.30, A: 0.60, A1: 0.30, A2: 0.25, B: 0.55, B1: 1.00, B2: 0.55 };
  var PAR = { A: 's0', B: 's0', A1: 'A', A2: 'A', B1: 'B', B2: 'B' };
  function edge(ch) { var p = POS[PAR[ch]], q = POS[ch]; return 'M' + p[0] + ',' + (p[1] + 24) + ' C' + p[0] + ',' + (p[1] + 70) + ' ' + q[0] + ',' + (q[1] - 70) + ' ' + q[0] + ',' + (q[1] - 26); }
  function node(id) { return { type: 'box', x: POS[id][0], y: POS[id][1], w: 124, h: 48, rx: 9, fill: C.neutralW, stroke: C.neutral, sw: 1.4, dasharray: '5 4', text: id + ' · ' + NM[id], sub: '', subMono: true, subSize: 11, size: 11.5, weight: 750, mono: false, opacity: 0 }; }
  function vk(v) { return v >= 0.9 ? 'ok' : v >= 0.5 ? 'warn' : 'bad'; }

  /* ---------------- 场景 1：一步一步走的问题 ---------------- */
  var SAMP = [['click [罐头分类]', 9], ['type [搜索框] [Del Monte]', 7], ['scroll [down]', 4]];
  var sc1 = {
    name: '一步一步走', desc: '普通的网页智能体每一步只看当前页面，就决定动作。走错一步，后面越错越远，回不了头。论文的做法是每一步先在真实网站里展开几个候选、打分。走错了还能退回来（论文第 1、3 节）。',
    dataTitle: '这一步（示意）', data: { '采样次数': 0, '候选动作 b': 0 },
    bg: function (d) { title(d, '任务（示意）：把同一品牌的两种罐装水果都加进对比清单'); },
    objects: function () {
      var o = {};
      o.s0 = mix(node('s0'), { dasharray: null, fill: C.dataW, stroke: C.data });
      SAMP.forEach(function (s, i) {
        o['sm' + i] = cell(640, 110 + i * 46, s[0], i < 2 ? 'info' : 'neutral', 230, 34, 11.5);
        o['sn' + i] = { type: 'text', x: 768, y: 110 + i * 46, text: '×' + s[1], size: 12.5, weight: 800, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
      });
      o.smt = { type: 'text', x: 640, y: 76, text: '同一页面采 20 次输出，数每个动作出现几次', size: 11.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.top = { type: 'box', x: 640, y: 260, w: 260, h: 36, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.3, text: '取出现最多的前 b 个当分支', size: 12.5, weight: 750, opacity: 0 };
      ['A', 'A1'].forEach(function (id) { o[id] = mix(node(id), { dasharray: null }); o['e' + id] = wire(edge(id), C.warn); });
      o.fail = { type: 'box', x: 280, y: 450, w: 420, h: 44, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.5, text: '走到错品牌的商品页：任务失败，也回不了头', size: 13, weight: 800, opacity: 0 };
      o.why = { type: 'box', x: 430, y: 520, w: 760, h: 40, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '误差逐步累积。动作空间又比游戏大得多，没有清楚的输赢信号。搜索要能利用真实环境的反馈', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '智能体停在首页。它是一个靠提示词驱动的大模型。它看页面截图和元素列表，输出下一个动作。', set: { s0: pop(0) } },
      (function () { var s = { smt: fade(0) }; SAMP.forEach(function (x, i) { s['sm' + i] = pop(200 + i * 200); s['sn' + i] = fade(400 + i * 200); }); return { say: '同一页面让模型生成 20 次，每次先写推理再给动作。数一数每个动作出现几次（次数是示意）。', set: s, data: { '采样次数': { v: 20, at: 300 } } }; })(),
      { say: '论文的搜索取出现次数最多的前 b 个动作当分支。不搜索的智能体只执行一个动作。', set: { top: pop(0) }, data: { '候选动作 b': { v: 2, at: 300 } } },
      { say: '不搜索时（这里取第一个采到的动作）：点进「罐头」分类页……', set: join(on('eA'), { A: pop(300) }), fx: [st('eA', 0, C.warn, 4)] },
      { say: '……再点进一个商品页，结果品牌不对。', set: join(on('eA1'), { A1: mix(pop(300), recolor('bad', 500)) }), fx: [st('eA1', 0, C.warn, 4), { type: 'shake', obj: 'A1', at: 700 }] },
      { say: '一步错、步步错：它只看当前页面，没有办法退回去换一条路。论文说这是现有智能体的一个主要瓶颈。', set: { fail: pop(0) } },
      { say: '网页的动作空间远大于棋类游戏，中途也没有明确的输赢。所以要一个能给"做到一半"打分的东西。还要能在真实网站里退回来的搜索。', set: { why: pop(0) } }
    ]
  };

  /* ---------------- 场景 2：价值函数 ---------------- */
  var VOTES = [['A', 8, 8, 4], ['s0', 0, 12, 8], ['B', 4, 14, 2], ['B1', 20, 0, 0]];
  var EQ = VZ.eq('q', ['v =', '(', { slot: 1, w: 34 }, '×1 +', { slot: 1, w: 34 }, '×0.5 +', { slot: 1, w: 34 }, '×0 ) ÷ 20 =', { num: 0, fmt: 'fixed2', k: 'ok', w: 64 }], 430, 380, { size: 14 });
  var CODE2 = { lang: 'py', title: '本机实跑（票数是示意）', src:
'VOTES = {"A": (8, 8, 4), ...}   # 成功/正轨/失败\n' +
'def value(s):\n' +
'    ok, mid, bad = VOTES[s]\n' +
'    assert ok + mid + bad == 20\n' +
'    return (ok * 1 + mid * 0.5 + bad * 0) / 20\n' };
  var sc2 = {
    name: '价值函数', desc: '用一个多模态大模型当裁判。给它任务、几张截图、做过的动作和当前网址。它判"成功 / 失败 / 还没成但在正轨上"，记 1 / 0 / 0.5。独立判 20 次取平均，得到 0 到 1 的分数（论文第 3.2、4.1 节）。',
    code: CODE2, dataTitle: '「罐头」分类页 A', data: { '成功': 0, '正轨': 0, '失败': 0, 'v': 0 }, dataFmt: { 'v': 'fixed2' },
    bg: function (d) { title(d, 'v = f_v(I, {o₁, …, o_t}) ∈ [0, 1]'); },
    objects: function () {
      var o = {};
      o.in = { type: 'box', x: 160, y: 120, w: 260, h: 110, rx: 10, fill: C.dataW, stroke: C.data, sw: 1.4, text: '裁判看到的', sub: '任务 I · 最近几张截图 · 做过的动作 · 当前网址', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.judge = { type: 'box', x: 430, y: 120, w: 150, h: 60, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '多模态大模型', sub: '先推理再判，独立 20 次', subMono: false, subSize: 10.5, size: 12.5, weight: 800, opacity: 0 };
      o.pin = wire('M292,120 L353,120', C.data);
      [['成功 → 1', 'ok'], ['在正轨上 → 0.5', 'warn'], ['失败 → 0', 'bad']].forEach(function (t, i) {
        o['lab' + i] = { type: 'text', x: 600, y: 90 + i * 46, text: t[0], size: 12, weight: 750, color: C[t[1]], anchor: 'start', opacity: 0 };
        o['bar' + i] = { type: 'box', x: 600, y: 110 + i * 46, w: 0, h: 14, rx: 3, anchor: 'l', fill: C[t[1]], stroke: 'none', opacity: 0 };
        o['bn' + i] = { type: 'text', x: 610, y: 110 + i * 46, text: '', num: 0, fmt: 'int', size: 11.5, weight: 800, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
      });
      o.pout = wire('M506,120 L585,120', C.info);
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      VOTES.slice(1).forEach(function (v, i) { o['ot' + i] = cell(220 + i * 210, 480, v[0] + '：' + v[1] + ' / ' + v[2] + ' / ' + v[3] + ' → ' + ((v[1] + v[2] * 0.5) / 20).toFixed(2), vk((v[1] + v[2] * 0.5) / 20), 190, 34, 12); });
      o.note = { type: 'text', x: 430, y: 530, text: '论文：裁判采样温度 1.0、top-p 1.0。算一次分比预测一次动作便宜（约一半）', size: 11.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '状态本身（比如网站数据库）智能体看不到。裁判只能看观察：任务、最近几张截图、做过的动作、当前网址。', set: { in: pop(0) } },
      { say: '把这些交给一个多模态大模型。它先写推理，再判：成功、失败，或者"还没成但在正轨上"。', set: join(on('pin'), { judge: pop(300) }), fx: [st('pin', 0, C.data, 4)] },
      (function () { var s = join(on('pout'), {}), V = VOTES[0]; [1, 2, 3].forEach(function (k, i) { s['lab' + i] = fade(i * 150); s['bar' + i] = grow(V[k] * 11, 300 + i * 150, 700); s['bn' + i] = mix(fade(300 + i * 150), { x: { to: 600 + V[k] * 11 + 8, dur: 700, delay: 300 + i * 150 }, num: { to: V[k], dur: 700, delay: 300 + i * 150 } }); });
        return { say: '同一个页面独立判 20 次。「罐头」分类页 A（示意）：8 次成功、8 次在正轨上、4 次失败。', set: s, fx: [st('pout', 0, C.info, 6)], data: { '成功': { v: 8, at: 500 }, '正轨': { v: 8, at: 650 }, '失败': { v: 4, at: 800 } } }; })(),
      (function () { var s = join(VZ.show(EQ, 0, 40), { q2: { text: { to: '8', delay: 600 } }, q4: { text: { to: '8', delay: 750 } }, q6: { text: { to: '4', delay: 900 } } }); return { say: '手推：成功记 1、正轨记 0.5、失败记 0，取平均。', set: s, hl: [3, 4, 5] }; })(),
      { say: '(8 + 4 + 0) ÷ 20 = 0.60。平均 20 次判断让分数更细、更稳。论文把这叫自一致（self-consistency）。', set: { q8: { num: { to: 0.6, dur: 700, delay: 100 } } }, fx: [{ type: 'burst', obj: 'q8', color: C.ok, at: 800 }], data: { 'v': { v: 0.6, at: 400 } }, log: [{ s: 'A   成功  8  正轨  8  失败  4  -> v = (8*1 + 8*0.5) / 20 = 0.60', at: 500 }] },
      { say: '其他页面同理（示意）。首页 0.30，Del Monte 搜索结果 0.55，两件都加进对比清单 1.00。', set: { ot0: pop(0), ot1: pop(200), ot2: pop(400), note: fade(700) },
        log: [{ s: 's0  -> v = 0.30', at: 100 }, { s: 'B   -> v = 0.55', at: 300 }, { s: 'B1  -> v = 1.00', at: 500 }] },
      { say: '消融里，自一致很关键。GPT-4o 当裁判只判 1 次 28.5%，平均 5 次 32.5%，平均 20 次 37.0%。这是 200 个 VWA 任务上的数。', fx: [{ type: 'pulse', obj: 'judge', color: C.info, at: 200 }] }
    ]
  };

  /* ---------------- 场景 3：最佳优先搜索 ---------------- */
  var QX = 720, QY0 = 140, QH = 44;
  function qy(i) { return QY0 + i * QH; }
  var QORD = [['s0'], ['A', 'B'], ['A1', 'A2', 'B'], ['A2', 'B'], ['B'], ['B1', 'B2'], ['B2']];
  var QSC = { s0: 0, A: 0.30, B: 0.30, A1: 0.60, A2: 0.60, B1: 0.55, B2: 0.55 };
  function qobj(id) { return { type: 'box', x: QX, y: qy(0), w: 200, h: 34, rx: 7, fill: C.bg2, stroke: C.line, sw: 1.2, text: id + ' · 排队分 ' + QSC[id].toFixed(2), size: 12, weight: 750, mono: true, opacity: 0 }; }
  function queueTo(k, d0) { var s = {}; QORD[k].forEach(function (id, i) { s['q' + id] = { y: { to: qy(i), dur: 600, delay: d0 || 0, ease: 'inOut' } }; }); return s; }
  var CODE3 = { lang: 'py', title: '本机实跑 · 照论文附录算法 1（玩具实现）', src:
'while n < c and F:\n' +
'    negv, _, p = heapq.heappop(F)  # 分最高\n' +
'    sp = p[-1]                      # 回溯：重放 p\n' +
'    vp = value(sp); n += 1\n' +
'    if vp >= best_v: best, best_v = p, vp\n' +
'    if vp >= theta: break           # 大概率成功\n' +
'    if n >= c: break                # 预算用完\n' +
'    if len(p) < d:                  # 还没到深度\n' +
'        for ch in CHILD[sp][:b]:    # b 个候选\n' +
'            heapq.heappush(F, (-vp, next(tie),\n' +
'                           p + [ch]))\n' };
  function popNode(id, k, d0) {
    var s = {}; d0 = d0 || 0;
    s['q' + id] = { opacity: { to: 0, dur: 300, delay: d0 + 500 }, x: { to: POS[id][0] + 200, dur: 600, delay: d0 } };
    s[id] = mix(recolor(vk(VAL[id]), d0 + 500), { sub: { to: 'v = ' + VAL[id].toFixed(2), delay: d0 + 600 } });
    return s;
  }
  function pushKids(ids, k, d0) {
    var s = {}; d0 = d0 || 0;
    ids.forEach(function (id, i) { s[id] = pop(d0 + i * 150); s['e' + id] = { opacity: { to: 1, dur: 250, delay: d0 + i * 150 }, flow: { to: 1, dur: 250, delay: d0 + i * 150 } }; s['q' + id] = mix(pop(d0 + 400 + i * 150), {}); });
    return join(s, queueTo(k, d0 + 300));
  }
  var sc3 = {
    name: '最佳优先搜索', desc: '待探索清单按分数排。每轮取出分最高的状态，回溯过去、打分、记下最好的。没到深度就展开 b 个候选，先用父节点的分排队。分数够高或预算用完就停。然后走到最好的状态（论文第 3.3 节、附录算法 1）。',
    code: CODE3, dataTitle: '搜索（d=3, b=2, c=6, θ=0.9，示意）', data: { '已取出 / 预算': 0, '目前最好 v': 0 },
    dataFmt: { '已取出 / 预算': function (v) { return Math.round(v) + ' / 6'; }, '目前最好 v': 'fixed2' },
    bg: function (d) { title(d, '在真实网站里展开、打分、回退'); d.text(QX, 104, '待探索清单（分高的在上）', { anchor: 'middle', size: 12, weight: 750, color: C.fg2 }); },
    objects: function () {
      var o = {};
      Object.keys(POS).forEach(function (id) { o[id] = node(id); if (PAR[id]) o['e' + id] = wire(edge(id), C.neutral); o['q' + id] = qobj(id); });
      o.best = { type: 'text', x: POS.s0[0] + 74, y: POS.s0[1] - 30, text: '目前最好', size: 11.5, weight: 800, color: C.ok, anchor: 'start', opacity: 0 };
      o.end = { type: 'box', x: 280, y: 470, w: 520, h: 44, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.5, text: '走到最好的状态 B1：真正执行 s0 → B → B1，t 前进 2 步', size: 12.5, weight: 800, opacity: 0 };
      return o;
    },
    steps: [
      { say: '从当前状态 s0 开始，清单里先放 s0（玩具实现的写法）。超参数是深度 d、分支 b、预算 c、阈值 θ。这里取 d = 3、b = 2、c = 6、θ = 0.9（示意，论文用 d = 5、b = 5、c = 20）。', set: { s0: pop(0), qs0: pop(200) } },
      { say: '第 1 次：取出 s0，打分 0.30，记为目前最好。没到深度，展开 2 个候选 A、B。它们先用父节点的分 0.30 排队，省得来回回溯。', set: join(popNode('s0', 0), { best: fade(800) }, pushKids(['A', 'B'], 1, 900)), hl: [1, 3, 4, 7, 8, 9],
        data: { '已取出 / 预算': { v: 1, at: 400 }, '目前最好 v': { v: 0.30, at: 700 } }, log: [{ s: '第 1 次：取出 s0 v = 0.30 | 展开 A、B，用父节点的分 0.30 入队', at: 600 }] },
      { say: '第 2 次：A 和 B 同分，先进先出取 A。要先回溯，从首页重放 1 个动作。A 打 0.60，成为目前最好。展开 A1、A2，按 0.60 排到最前。', set: join(popNode('A', 1), { best: { x: { to: POS.A[0] + 66, dur: 600, delay: 700 }, y: { to: POS.A[1] - 30, dur: 600, delay: 700 } } }, pushKids(['A1', 'A2'], 2, 900)),
        data: { '已取出 / 预算': { v: 2, at: 400 }, '目前最好 v': { v: 0.60, at: 700 } }, log: [{ s: '第 2 次：取出 A v = 0.60，目前最好 A | 展开 A1、A2', at: 600 }] },
      { say: '第 3 次：取出 A1，打分只有 0.30（品牌错了）。已到深度 3，不再展开。', set: join(popNode('A1', 2), queueTo(3, 600)), fx: [{ type: 'shake', obj: 'A1', at: 800 }],
        data: { '已取出 / 预算': { v: 3, at: 400 } }, log: [{ s: '第 3 次：取出 A1 v = 0.30 | 已到深度 3，不展开', at: 600 }] },
      { say: '第 4 次：取出 A2，0.25（又绕回首页）。A 这一支看起来不错，往下走却都不行。', set: join(popNode('A2', 3), queueTo(4, 600)), fx: [{ type: 'shake', obj: 'A2', at: 800 }],
        data: { '已取出 / 预算': { v: 4, at: 400 } }, log: [{ s: '第 4 次：取出 A2 v = 0.25 | 已到深度 3，不展开', at: 600 }] },
      { say: '第 5 次：退回去取 B（回溯：重置到首页，重放 1 个动作）。B 打 0.55，没超过 0.60，最好的还是 A。展开 B1、B2。', set: join(popNode('B', 4), pushKids(['B1', 'B2'], 5, 900)),
        data: { '已取出 / 预算': { v: 5, at: 400 } }, log: [{ s: '第 5 次：取出 B v = 0.55，目前最好 A 0.60 | 展开 B1、B2', at: 600 }] },
      { say: '第 6 次：取出 B1，打分 1.00 ≥ θ。大概率已经成功，停止搜索。', set: join(popNode('B1', 5), queueTo(6, 600), { best: { x: { to: POS.B1[0] + 66, dur: 600, delay: 700 }, y: { to: POS.B1[1] - 30, dur: 600, delay: 700 } } }),
        fx: [{ type: 'burst', obj: 'B1', color: C.ok, at: 900 }], hl: [6], data: { '已取出 / 预算': { v: 6, at: 400 }, '目前最好 v': { v: 1.0, at: 700 } }, log: [{ s: '第 6 次：取出 B1 v = 1.00，目前最好 B1 1.00 | v ≥ θ，停', at: 600 }] },
      { say: '搜索结束，走到最好的状态，把这段动作真正执行掉。再从新位置开始下一轮搜索。论文实验里每个任务最多执行 5 个动作。', set: { end: pop(0) }, log: [{ s: '结束：走到 B1，执行 s0 -> B -> B1，t 前进 2 步', at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：回溯 ---------------- */
  var CODE4 = { lang: 'text', title: '论文附录 A.4.1（意译）', src:
'优先队列里存"从起点出发的动作序列 + 分数"\n' +
'执行新动作后：序列追加这个动作，带分数入队\n' +
'要去下一个状态：重置环境到起点，\n' +
'  从头重放它的动作序列\n' };
  var sc4 = {
    name: '回溯：重置再重放', desc: '网页没有存档读档。论文的回溯办法（附录 A.4.1）是先重置到起点。再把到达那个状态的整串动作，从头重放一遍。不用浏览器的"后退"，它会丢掉滚动位置和输入的文字。',
    code: CODE4, dataTitle: '玩具搜索（示意）', data: { '重放的动作数': 0 },
    bg: function (d) { title(d, '怎么从 A2 回到 B？'); },
    objects: function () {
      var o = {};
      ['s0', 'A', 'B', 'A2'].forEach(function (id) { o[id] = mix(node(id), { dasharray: null, fill: C[vk(VAL[id]) + 'W'], stroke: C[vk(VAL[id])], sub: 'v = ' + VAL[id].toFixed(2), opacity: 1 }); });
      o.eA = wire(edge('A'), C.neutral, 1); o.eB = wire(edge('B'), C.neutral, 1); o.eA2 = wire(edge('A2'), C.neutral, 1);
      o.dot = { type: 'circle', x: POS.A2[0], y: POS.A2[1], r: 9, fill: C.info, stroke: '#fff', sw: 2, opacity: 0 };
      o.bk = { type: 'box', x: 680, y: 140, w: 300, h: 70, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.3, dasharray: '5 4', text: '不行：点浏览器"后退"', sub: '会丢掉滚动位置、输入框里已填的字', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.rs = { type: 'box', x: 680, y: 250, w: 300, h: 70, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.3, text: '可以：重置到起点 + 重放动作', sub: '状态完整，代价是更慢', subMono: false, subSize: 11, size: 13, weight: 800, opacity: 0 };
      o.cnt = { type: 'box', x: 680, y: 380, w: 300, h: 44, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.3, text: '', num: 0, fmt: 'int', pre: '玩具搜索一共重放了 ', post: ' 个动作', size: 13, weight: 800, mono: false, opacity: 0 };
      o.slow = { type: 'box', x: 430, y: 500, w: 780, h: 40, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '论文的局限：c = 20 时每轮最多多 20 倍的模型调用，重置重放也很花时间。真实网站上还要禁止下单这类不可撤销的动作', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '刚评完 A2（又绕回首页，0.25），下一个要评的是 B。网页没有"读档"，怎么回到首页那一层的 B？', set: { dot: pop(0) } },
      { say: '最直接的想法是点浏览器"后退"。论文不这么做。后退会丢掉页面状态，比如滚动位置、输入框里已经填的字。', set: { bk: pop(0) }, fx: [{ type: 'shake', obj: 'bk', at: 500 }] },
      { say: '论文的做法：队列里存的是"从起点出发的整串动作"。要去 B，就把环境重置到起点……', set: { rs: pop(0), dot: { x: { to: POS.s0[0], dur: 700, delay: 300, ease: 'inOut' }, y: { to: POS.s0[1], dur: 700, delay: 300, ease: 'inOut' } } }, fx: [{ type: 'ripple', obj: 's0', color: C.info, at: 1000 }], hl: [1, 3, 4] },
      { say: '……再把到 B 的动作（这里只有 1 个）从头重放一遍。', set: { dot: { x: { to: POS.B[0], dur: 800, delay: 100, ease: 'inOut' }, y: { to: POS.B[1], dur: 800, delay: 100, ease: 'inOut' } } }, fx: [st('eB', 0, C.info, 4), { type: 'ripple', obj: 'B', color: C.info, at: 900 }] },
      { say: '所以队列里每一项都是一整串动作：B 是 [B]，B1 是 [B, B1]。取出谁，就重置后把谁的序列跑一遍。', fx: [{ type: 'pulse', obj: 'B', color: C.info, at: 200 }, { type: 'pulse', obj: 's0', color: C.info, at: 500 }], hl: [1, 2] },
      { say: '玩具搜索里，每取出一个状态都要重放一次。0 + 1 + 2 + 2 + 1 + 2 = 8 个动作（本机算的）。', set: { cnt: mix(pop(0), { num: { to: 8, dur: 800, delay: 200 } }) }, data: { '重放的动作数': { v: 8, at: 500 } }, log: [{ s: '共取出 6 个状态，重放动作 8 次', at: 600 }] },
      { say: '这就是搜索的代价：慢。真实部署还要限制破坏性动作。论文建议用分类器拦下来，或者写进价值函数。也可以只在能撤销的场景（写代码、表格）里搜。', set: { slow: pop(0) } }
    ]
  };

  /* ---------------- 场景 5：结果 ---------------- */
  var RES = [['VWA · GPT-4o + SoM', 18.9, 26.4, '+39.7%'], ['VWA · Llama-3-70B + 图片说明', 7.6, 16.7, '+119.7%'], ['WA · GPT-4o', 15.0, 19.2, '+28.0%'], ['WA · Llama-3-70B', 7.6, 10.1, '+32.3%']];
  var BUD = [[0, 24.5], [5, 32.0], [20, 37.0]], SC = 9;
  var sc5 = {
    name: '结果', desc: '同一个模型、不重新训练，只在执行时搜索。VisualWebArena 上 GPT-4o 从 18.9% 到 26.4%。WebArena 上从 15.0% 到 19.2%。预算越大越好（论文表 2、图 2）。',
    dataTitle: '论文的数', data: { 'VWA GPT-4o 加搜索': 0, '预算 c=20 子集': 0 }, dataFmt: { 'VWA GPT-4o 加搜索': 'pct1', '预算 c=20 子集': 'pct1' },
    bg: function (d) { title(d, '成功率（%）：灰 = 不搜索（最多 5 步），绿 = 加搜索'); },
    objects: function () {
      var o = {};
      RES.forEach(function (r, i) {
        var y = 95 + i * 62;
        o['rl' + i] = { type: 'text', x: 40, y: y, text: r[0], size: 12, weight: 750, color: C.fg, anchor: 'start', opacity: 0 };
        o['r0' + i] = { type: 'box', x: 270, y: y - 9, w: 0, h: 14, rx: 3, anchor: 'l', fill: C.neutral, stroke: 'none', opacity: 0 };
        o['r1' + i] = { type: 'box', x: 270, y: y + 9, w: 0, h: 14, rx: 3, anchor: 'l', fill: C.ok, stroke: 'none', opacity: 0 };
        o['rt' + i] = { type: 'text', x: 280 + r[2] * SC, y: y, text: r[1].toFixed(1) + ' → ' + r[2].toFixed(1) + '（' + r[3] + '）', size: 11.5, weight: 800, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
      });
      o.bt = { type: 'text', x: 40, y: 360, text: '搜索预算 c（200 个 VWA 任务子集，GPT-4o，d = b = 5）', size: 12, weight: 750, color: C.fg, anchor: 'start', opacity: 0 };
      BUD.forEach(function (b, i) {
        var x = 140 + i * 200;
        o['bb' + i] = { type: 'box', x: x, y: 520, w: 70, h: 0, rx: 4, anchor: 'bc', fill: i ? C.ok : C.neutral, stroke: 'none', opacity: 0 };
        o['bv' + i] = { type: 'text', x: x, y: 505, text: '', num: 0, fmt: 'pct1', size: 12.5, weight: 800, mono: true, color: C.fg, anchor: 'middle', opacity: 0 };
        o['bl' + i] = { type: 'text', x: x, y: 540, text: 'c = ' + b[0] + (b[0] ? '' : '（不搜）'), size: 11.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      });
      o.gt = { type: 'box', x: 710, y: 450, w: 250, h: 70, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.3, text: '裁判换成真实奖励：43.5%', sub: '裁判再好一点还有很大空间', subMono: false, subSize: 11, size: 12.5, weight: 800, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; RES.forEach(function (r, i) { s['rl' + i] = fade(i * 150); s['r0' + i] = grow(r[1] * SC, i * 150, 600); }); return { say: '不搜索的基线（最多执行 5 步）。VWA 上 GPT-4o 18.9%、Llama 7.6%。WA 上 GPT-4o 15.0%、Llama 7.6%。', set: s }; })(),
      (function () { var s = {}; RES.forEach(function (r, i) { s['r1' + i] = grow(r[2] * SC, 200 + i * 150, 800); s['rt' + i] = fade(900 + i * 150); }); return { say: '加上搜索（d = 5、b = 5、c = 20），四组都明显上升。VWA 上 26.4% 是当时最好的成绩。', set: s, data: { 'VWA GPT-4o 加搜索': { v: 26.4, at: 600 } } }; })(),
      { say: '限制 5 步加搜索，仍比别人的 GPT-4o 不搜索走 30 步（19.8%）强。WA 上别的方法分更高，靠的是针对网站的专门技巧。它们可以和搜索叠加。（WA 的 Llama 那行表里写 +32.3%、正文写 32.2%，原文如此。）', fx: [{ type: 'pulse', obj: 'r10', color: C.ok, at: 200 }] },
      (function () { var s = { bt: fade(0) }; BUD.forEach(function (b, i) { s['bb' + i] = { opacity: { to: 1, dur: 100, delay: i * 250 }, h: { to: b[1] * 3.4, dur: 700, delay: i * 250, ease: 'out' } }; s['bv' + i] = mix(fade(i * 250), { y: { to: 505 - b[1] * 3.4, dur: 700, delay: i * 250, ease: 'out' }, num: { to: b[1], dur: 700, delay: i * 250 } }); s['bl' + i] = fade(i * 250); });
        return { say: '预算越大越好：c = 0 是 24.5%，c = 5 就到 32.0%（+30.6%），c = 20 到 37.0%（+51.0%）。深度和分支也都要放大。', set: s, data: { '预算 c=20 子集': { v: 37.0, at: 800 } } }; })(),
      { say: '把裁判换成测试集的真实成败（只有 0 或 1），子集上能到 43.5%。价值函数还有很大的提升空间。', set: { gt: pop(0) } },
      { say: '按难度看，中等任务（人要 4–9 步）提升最大：12.7% → 22.2%。困难任务可能需要更深的树。', fx: [{ type: 'pulse', obj: 'bb2', color: C.ok, at: 200 }] },
      { say: '全开源也行。附录里用开源的 LLaVA-1.6-34B 当裁判，Llama-3-70B 在 VWA 上 7.6% → 13.5%（+77.6%）。', fx: [{ type: 'pulse', obj: 'r11', color: C.ok, at: 200 }] }
    ]
  };

  VZ.register({
    id: 'c11-tree', title: '语言模型智能体的树搜索：价值函数、最佳优先搜索与回溯',
    sources: [{ t: '论文 v3（TMLR 2025）', u: PAPER }],
    note: '算法步骤、价值函数的 1 / 0.5 / 0 和 20 次平均照论文。超参数 d = 5 / b = 5 / c = 20 和各表成功率也照论文（证据在 evidence/Koh-2025_TreeSearch-LM-Agents__10.48550_arxiv.2407.01476/）。玩具网站的页面、动作、票数是示意。d = 3 / b = 2 / c = 6 / θ = 0.9 也是示意，搜索过程是本机真跑的。课程第 21 讲 11 月 17 日才上，讲者就是论文第一作者。课后会按录像和讲义补充。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

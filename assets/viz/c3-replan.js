/* 03 · 第 5 讲 —— 买 GPU 工作站：只会反应的智能体、三种做法、依赖图上的重新规划、四种压力
 * 场景 1：讲义第 2 页的轨迹（步号 1 / 15 / 31 / 201 / 202、上下文 128k → 14k 照讲义）；
 * 场景 2：讲义第 16 页的三种做法和开发者流程代码；控制台是 本机验算脚本 第 7 部分实跑（供应商数据是示意）；
 * 场景 3：讲义第 3 页的依赖图和重新规划；场景 4：讲义第 17–18 页的四种压力。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = 'https://www.cmu-agents.com/slides/lecture-05-planning.pdf', YT = 'https://youtu.be/S8v-dR4s29M?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op, size) {
    var f = PAL[k];
    var o = { type: 'box', x: x, y: y, w: w, h: h, rx: 9, fill: f[0], stroke: f[1], sw: 1.6, text: t, size: size || 13, weight: 700, opacity: op == null ? 0 : op };
    if (sub) { o.sub = sub; o.subMono = false; o.subSize = 11.5; }
    return o;
  }
  function chip(x, y, t, w, k, mono) { var f = PAL[k || 'data']; return { type: 'box', x: x, y: y, w: w, h: 24, rx: 6, fill: f[0], stroke: f[1], sw: 1.2, text: t, size: 11.5, weight: 650, mono: mono !== false, opacity: 0, trail: { n: 4, gap: 40 } }; }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  var AR = {}; AR[C.ok] = 'ok'; AR[C.info] = 'info'; AR[C.warn] = 'warn'; AR[C.bad] = 'bad'; AR[C.data] = 'data'; AR[C.neutral] = 'neutral';
  function path(d, col, extra) { return mix({ type: 'path', d: d, stroke: col, sw: 1.8, flow: 0, opacity: 0, arrow: AR[col] || 'data' }, extra || {}); }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function dim(name, d0) { var s = {}; s[name] = { flow: { to: 0, dur: 300, delay: d0 || 0 }, opacity: { to: 0.22, dur: 400, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n, rev) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col || C.data, reverse: !!rev }; }
  function along(name, p, t1, delay, dur, extra) { var s = {}; s[name] = mix({ opacity: { to: 1, dur: 150, delay: delay || 0 }, t: { from: 0, to: t1, dur: dur || 900, delay: delay || 0, ease: 'inOut' } }, extra || {}); return s; }
  function bad(delay) { return { fill: { to: C.badW, dur: 300, delay: delay || 0 }, stroke: { to: C.bad, dur: 300, delay: delay || 0 } }; }
  function good(delay) { return { fill: { to: C.okW, dur: 300, delay: delay || 0 }, stroke: { to: C.ok, dur: 300, delay: delay || 0 } }; }

  /* ---------------- 场景 1：只会反应的智能体 ---------------- */
  var AX = 130, AY = 280, VX = 720, VY = [140, 195, 250, 305], BX0 = 90, BW = 600;
  var sc1 = {
    name: '反应式长任务', desc: '讲义第 2 页的智能体只会"看一步做一步"。几百步里，四家供应商挤在一个上下文里搜。最后还是硬挑了一家提交。',
    dataTitle: '轨迹（讲义第 2 页）', data: { '第几步': 0, '上下文 token': '无' },
    bg: function (d) {
      title(d, '只会反应的智能体做一个长任务');
      d.text(40, 524, '上下文', { size: 12, weight: 700, color: C.fg3 });
      d.rect(BX0, 511, BW, 18, { fill: C.bg3, stroke: C.line1, rx: 4 });
    },
    objects: function () {
      var o = {};
      o.task = node(430, 72, 720, 34, '任务：买实验室的新 GPU 工作站。比较各家配置和价格，对照 wiki 查兼容，提交采购申请', null, 'neutral', 0, 12.5);
      VY.forEach(function (y, i) { o['pv' + i] = path('M205,' + AY + ' C 420,' + AY + ' 470,' + y + ' 645,' + y, C.warn); });
      o.pw = path('M205,300 C 280,380 300,380 360,380', C.data, { arrow: 'data' });
      o.pp = path('M150,312 L150,445 L635,445', C.bad);
      o.ag = node(AX, AY, 150, 64, '智能体', '一个线程 · 一个上下文', 'info');
      ['A', 'B', 'C', 'D'].forEach(function (v, i) { o['v' + i] = node(VX, VY[i], 160, 40, 'vendor-' + v.toLowerCase() + '.com', null, 'neutral', 0, 12.5); o['v' + i].mono = true; });
      o.wiki = node(430, 380, 140, 40, '内部 wiki', null, 'data');
      o.portal = node(720, 445, 170, 40, '采购系统', null, 'neutral');
      o.bar = { type: 'box', x: BX0, y: 520, w: 0, h: 18, rx: 4, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1.2, text: '', opacity: 0 };
      o.barT = { type: 'text', x: BX0 + BW + 10, y: 525, text: '', num: 0, fmt: 'int', post: 'k', size: 12, weight: 700, mono: true, color: C.data, anchor: 'start', opacity: 0 };
      o.c1 = mix(chip(205, AY, 'goto vendor-a.com → spec sheet', 230, 'warn'), { along: 'pv0', t: 0 });
      o.c15 = mix(chip(205, AY, 'configure: 2× RTX 6000, 128 GB, 850 W', 270, 'warn'), { along: 'pv0', t: 0 });
      o.c31 = mix(chip(360, 380, 'racks accept 4U; 1600 W/slot', 220, 'data'), { along: 'pw', t: 1 });
      o.sum = node(400, 484, 420, 32, '四家都搜过：只有 D 合适，但交货期 20 周', null, 'data', 0, 12);
      o.q1 = chip(330, 205, '选 D？', 70, 'warn', false); o.q2 = chip(430, 205, '找第五家？', 100, 'warn', false); o.q3 = chip(550, 205, '放宽要求？', 100, 'warn', false);
      o.sub = mix(chip(150, 312, 'New requisition → Submit', 200, 'bad'), { along: 'pp', t: 0 });
      o.irr = label(720, 482, '提交后撤不回来', C.bad);
      o.b1 = label(400, 489, '① 四个独立的搜索挤在一个线程、一个上下文里', C.bad, 'middle', 12);
      o.b2 = label(VX, 345, '② 四家都不理想', C.bad);
      o.b3 = label(130, 232, '③ 还是挑了一家、提交了', C.bad);
      return o;
    },
    steps: [
      { say: '讲义第 2 页的任务：比较几家供应商的工作站配置和价格。再对照内部 wiki 查兼容，最后提交采购申请。',
        set: { task: pop(0), ag: pop(300), v0: pop(500), v1: pop(580), v2: pop(660), v3: pop(740), wiki: pop(820), portal: pop(900) } },
      { say: '第 1 步：去 vendor-a.com，一页一页点到配置表、做 GPU 对比……',
        set: join(on('pv0'), along('c1', 'pv0', 0.92, 0, 1200), { bar: mix(fade(0, 200), { w: { to: 90, dur: 1400, ease: 'out' } }) }),
        fx: [st('pv0', 0, C.warn, 4), { type: 'ripple', obj: 'v0', color: C.warn, at: 1200 }], data: { '第几步': 1 } },
      { say: '第 15 步：配好一台，2 块 RTX 6000、128 GB 内存、850 W 电源。',
        set: { c1: fade(0, 300, 0), c15: mix({ opacity: { to: 1, dur: 150, delay: 200 }, t: { from: 0, to: 0.86, dur: 1200, delay: 200, ease: 'inOut' } }), bar: { w: { to: 150, dur: 1200, ease: 'out' } } },
        fx: [st('pv0', 200, C.warn, 4), { type: 'ripple', obj: 'v0', color: C.warn, at: 1400 }], data: { '第几步': 15 } },
      { say: '第 31 步：读 wiki，才知道机架只收 4U 机箱、每个槽位 1600 W。这个要求是后来才看到的。',
        set: join({ c15: fade(0, 300, 0) }, on('pw', 100), { c31: mix({ opacity: { to: 1, dur: 150, delay: 200 }, t: { from: 1, to: 0.08, dur: 1100, delay: 200, ease: 'inOut' } }), bar: { w: { to: 200, dur: 1200, ease: 'out' } } }),
        fx: [st('pw', 200, C.data, 4, true), { type: 'pulse', obj: 'ag', color: C.data, at: 1300 }], data: { '第几步': 31 } },
      { say: '然后 B、C、D 三家也在同一个线程里挨个搜。所有网页内容都堆进同一个上下文。',
        set: join({ c31: fade(0, 300, 0) }, on('pv1', 0), on('pv2', 700), on('pv3', 1400), { bar: { w: { to: BW, dur: 2200, ease: 'inOut' } }, barT: mix(fade(1800), { num: { to: 128, dur: 500, delay: 1800 } }) }),
        fx: [st('pv1', 0, C.warn, 3), st('pv2', 700, C.warn, 3), st('pv3', 1400, C.warn, 3), { type: 'flash', obj: 'bar', color: C.bad, at: 2200 }], data: { '上下文 token': { v: '128k', at: 2000 } } },
      { say: '上下文满了，做一次压缩：128k → 14k token。压缩后只剩一句话：四家都搜过，只有 D 合适，但交货期 20 周。',
        set: join({ bar: { w: { to: Math.round(BW * 14 / 128), dur: 900, ease: 'inOut' } }, barT: { num: { to: 14, dur: 900 }, x: { to: BX0 + Math.round(BW * 14 / 128) + 10, dur: 900, ease: 'inOut' } }, sum: pop(800) }, dim('pv0'), dim('pv1'), dim('pv2'), dim('pv3'), dim('pw')),
        fx: [{ type: 'pulse', obj: 'bar', color: C.data, at: 900 }], data: { '上下文 token': { v: '14k', at: 900 } } },
      { say: '第 201 步：怎么办？选 D、再找第五家，还是放宽某个要求？只会反应的智能体没有一个地方能把"计划"改掉。',
        set: { q1: pop(0), q2: pop(200), q3: pop(400) }, fx: [{ type: 'pulse', obj: 'ag', color: C.warn, at: 700 }], data: { '第几步': 201 } },
      { say: '第 202 步：它进了采购系统，新建申请，提交。这一步撤不回来。',
        set: join(on('pp'), { q1: fade(0, 300, 0.3), q2: fade(0, 300, 0.3), q3: fade(0, 300, 0.3), sub: mix({ opacity: { to: 1, dur: 150 }, t: { from: 0, to: 0.97, dur: 1300, ease: 'inOut' } }), portal: bad(1300), irr: fade(1400) }),
        fx: [st('pp', 0, C.bad, 5), { type: 'burst', obj: 'portal', color: C.bad, at: 1350 }], data: { '第几步': 202 } },
      { say: '讲义点出三个问题。独立的搜索没分开做。结果都不理想，却没改计划。不该自己拍板的事，自己拍了板。',
        set: { sub: fade(0, 300, 0), sum: fade(0, 300, 0), b1: fade(300), b2: fade(500), b3: fade(900) },
        fx: [{ type: 'flash', obj: 'bar', color: C.bad, at: 0 }, { type: 'flash', obj: 'v1', color: C.bad, at: 400 }, { type: 'flash', obj: 'v2', color: C.bad, at: 450 }, { type: 'shake', obj: 'portal', at: 800 }] }
    ]
  };

  /* ---------------- 场景 2：三种做法 ---------------- */
  var CODE2 = { lang: 'py', title: '讲义第 16 页 · 开发者定义的流程', src:
'for v in VENDORS:            # 固定列表\n' +
'    specs[v] = read_specs(v) # 模型调用\n' +
'ok = [v for v in specs if fits(v)]\n' +
'requisition(cheapest(ok))\n' };
  var CX = [160, 430, 700], Y0 = 158;
  function col(i, t, s, sub2) { return node(CX[i], Y0, 240, 74, t, s, i === 0 ? 'neutral' : i === 1 ? 'info' : 'warn', 0, 13.5); }
  var sc2 = {
    name: '三种做法', desc: '讲义第 16 页："查哪几家"可以由开发者事先写死。也可以由模型在执行前定下，或者在执行中按反馈再改。',
    code: CODE2, dataTitle: '本机实跑', data: { 'ok': '无', '提交': '无', '交货期（周）': '无' },
    bg: function (d) {
      title(d, '谁来决定、什么时候决定');
      d.line(70, 92, 790, 92, { stroke: C.fg3, sw: 1.4 });
      d.path('M782,87 L792,92 L782,97', { stroke: C.fg3, sw: 1.4, fill: 'none' });
      d.text(70, 82, '执行前做的决定', { size: 11.5, weight: 700, color: C.fg3 });
      d.text(790, 82, '执行中做的决定', { size: 11.5, weight: 700, color: C.fg3, anchor: 'end' });
    },
    objects: function () {
      var o = {};
      o.k0 = col(0, '开发者定义的工作流', '开发者写死流程：查固定的几家');
      o.k1 = col(1, '先规划后执行', '模型规划查哪几家，执行前定下');
      o.k2 = col(2, '自适应智能体', '四家都不行，执行反馈让它再找一家');
      for (var i = 0; i < 3; i++) {
        o['src' + i] = node(CX[i], 250, 150, 32, ['开发者', '模型（执行前）', '模型（执行中）'][i], null, i === 0 ? 'neutral' : 'info', 0, 12.5);
        o['pa' + i] = path('M' + CX[i] + ',266 L' + CX[i] + ',306', C.info);
        o['pb' + i] = path('M' + CX[i] + ',352 L' + CX[i] + ',392', C.warn);
        o['pc' + i] = path('M' + CX[i] + ',438 L' + CX[i] + ',470', C.warn);
        ['A', 'B', 'C', 'D'].forEach(function (v, j) { o['v' + i + j] = chip(CX[i] - (i === 2 ? 108 : 81) + j * 54, 330, v, 44, 'data'); });
      }
      o.r0 = node(CX[0], 415, 200, 40, 'ok = [D]', null, 'data', 0, 12.5); o.r0.mono = true;
      o.e0 = node(CX[0], 492, 220, 40, 'requisition(D)', '交货期 20 周也照样提交', 'bad', 0, 12.5);
      o.r1 = node(CX[1], 415, 200, 40, '四家都不理想', null, 'bad', 0, 12.5);
      o.e1 = node(CX[1], 492, 220, 40, '计划里没有"再找一家"', null, 'neutral', 0, 12.5);
      o.r2 = node(CX[2], 415, 200, 40, '反馈：交货期都太长', null, 'bad', 0, 12.5);
      o.pr = path('M800,415 C 828,415 828,372 810,346', C.bad, { dasharray: '5 4' });
      o.vE = chip(808, 330, 'E', 40, 'warn');
      o.e2 = node(CX[2], 492, 220, 40, 'E 合格 → 等人批准', null, 'ok', 0, 12.5);
      o.tl = node(295, 536, 430, 26, '提前承诺：更快、更便宜、更可预测', null, 'neutral', 0, 12);
      o.tr = node(700, 536, 250, 26, '重规划：能用新信息，但更贵更复杂', null, 'warn', 0, 12);
      return o;
    },
    steps: [
      { say: '同一个买 GPU 的任务，三种做法。从左到右，越来越多的决定是在执行过程中才做的。', set: { k0: pop(0), k1: pop(200), k2: pop(400) } },
      { say: '工作流：开发者事先写死"查这四家"。每一家用一次模型调用去读配置表。',
        set: join({ src0: pop(0), v00: pop(500), v01: pop(570), v02: pop(640), v03: pop(710) }, on('pa0', 200)), hl: [1, 2],
        fx: [st('pa0', 200, C.neutral, 4)] },
      { say: '按 wiki 的要求过滤：只有 D 的机箱和功率都合格。',
        set: join(on('pb0'), { v00: bad(300), v01: bad(400), v02: bad(500), r0: pop(700) }), hl: [3],
        fx: [st('pb0', 0, C.warn, 4)], log: [{ s: "ok = ['D']", at: 700 }], data: { 'ok': { v: "['D']", at: 700 } } },
      { say: '取最便宜的提交。流程里根本没有"交货期"这一项。于是 20 周交货的 D 照样被提交（供应商数据是示意）。',
        set: join(on('pc0'), { e0: pop(500) }), hl: [4],
        fx: [st('pc0', 0, C.bad, 4), { type: 'shake', obj: 'e0', at: 900 }],
        log: [{ s: "requisition -> D {'price': 24500, 'chassis': '4U', 'psu_w': 1400, 'lead_weeks': 20}", at: 500 }, { s: '工作流不看交货期：照样提交了 D（lead_weeks=20）', at: 1100 }],
        data: { '提交': { v: 'D', at: 500 }, '交货期（周）': { v: 20, at: 500 } } },
      { say: '先规划后执行：查哪几家由模型来定。但在执行之前就定下，之后照着做。',
        set: join({ src1: pop(0), v10: pop(500), v11: pop(570), v12: pop(640), v13: pop(710) }, on('pa1', 200)), fx: [st('pa1', 200, C.info, 4)] },
      { say: '执行中发现四家都不理想。可计划已经定了，里面没有"再找一家"这一步。',
        set: join(on('pb1'), on('pc1', 900), { v10: bad(200), v11: bad(260), v12: bad(320), v13: bad(380), r1: pop(500), e1: pop(1200) }),
        fx: [st('pb1', 0, C.bad, 4), st('pc1', 900, C.neutral, 3)] },
      { say: '自适应：同样四家都不行。这条执行反馈会让模型改计划，加一家 E 再去搜。',
        set: join({ src2: pop(0) }, on('pa2', 100), on('pb2', 700), { v20: mix(pop(300), bad(900)), v21: mix(pop(350), bad(950)), v22: mix(pop(400), bad(1000)), v23: mix(pop(450), bad(1050)), r2: pop(1100) }, on('pr', 1600), { vE: pop(2300) }),
        fx: [st('pa2', 100, C.info, 3), st('pb2', 700, C.bad, 3), st('pr', 1600, C.bad, 4, true)],
        log: [{ s: "自适应：交货期 <= 8 周的合格供应商 = [] -> 重新规划，加一个结点 search(E)", at: 1300 }] },
      { say: '搜完 E：机箱、功率、交货期都合格。这一步是"提交"，先停下来等人批准。',
        set: join(on('pc2'), { vE: good(0), e2: pop(500) }), fx: [st('pc2', 0, C.ok, 4), { type: 'burst', obj: 'e2', color: C.ok, at: 900 }],
        log: [{ s: "加上 E 之后 ok = ['E'] -> 等人批准后再提交 E", at: 500 }], data: { 'ok': { v: "['E']", at: 500 }, '提交': { v: '等人批准', at: 500 }, '交货期（周）': { v: 4, at: 500 } } },
      { say: '讲义的结论：提前承诺更快、更便宜、更可预测。重新规划能用上执行中才冒出来的信息。只在反馈值得多花的成本和复杂度时才用。',
        set: { tl: pop(0), tr: pop(300) }, fx: [{ type: 'pulse', obj: 'k0', color: C.neutral, at: 0 }, { type: 'pulse', obj: 'k2', color: C.warn, at: 300 }] }
    ]
  };

  /* ---------------- 依赖图（场景 3、4 共用） ---------------- */
  var GX = 140, GY = [150, 205, 260, 315], EY = 400, KX = 410, KY = 232, GTX = 560, RQX = 712;
  function graph(op) {
    var o = {};
    o.grp = { type: 'box', x: GX, y: 232, w: 176, h: 236, rx: 12, fill: 'none', stroke: C.data, sw: 1.4, dasharray: '6 4', text: '', opacity: 0 };
    o.grpT = label(GX, 104, '模块化：各家分开搜', C.data);
    ['A', 'B', 'C', 'D'].forEach(function (v, i) {
      o['pg' + i] = path('M' + (GX + 68) + ',' + GY[i] + ' C ' + (GX + 150) + ',' + GY[i] + ' ' + (KX - 150) + ',' + KY + ' ' + (KX - 86) + ',' + KY, C.data, { opacity: op, flow: op });
    });
    o.pE = path('M' + (GX + 68) + ',' + EY + ' C ' + (GX + 170) + ',' + EY + ' ' + (KX - 60) + ',' + (KY + 70) + ' ' + (KX - 40) + ',' + (KY + 30), C.data);
    o.pR = path('M' + (KX + 30) + ',' + (KY + 30) + ' C ' + (KX + 60) + ',' + (EY + 70) + ' ' + (GX + 160) + ',' + (EY + 50) + ' ' + (GX + 70) + ',' + (EY + 12), C.bad, { dasharray: '6 4' });
    o.pW = path('M' + KX + ',128 L' + KX + ',' + (KY - 30), C.data, { dasharray: '5 4' });
    o.pK = path('M' + (KX + 86) + ',' + KY + ' L' + (GTX - 24) + ',' + KY, C.ok, { opacity: op, flow: op });
    o.pQ = path('M' + (GTX + 24) + ',' + KY + ' L' + (RQX - 86) + ',' + KY, C.warn, { opacity: op, flow: op });
    ['A', 'B', 'C', 'D'].forEach(function (v, i) { o['g' + i] = node(GX, GY[i], 136, 38, 'Vendor ' + v, null, 'neutral', op, 12.5); });
    o.gE = mix(node(GX, EY, 136, 38, 'Vendor E', null, 'bad', 0, 12.5), { dasharray: '5 4' });
    o.chk = node(KX, KY, 172, 58, '兼容检查', '对照 wiki', 'info', op);
    o.wiki = mix(node(KX, 112, 150, 28, 'wiki 要求：后来才到', null, 'data', 0, 12), { rx: 14 });
    o.gate = { type: 'circle', x: GTX, y: KY, r: 22, fill: C.bg, stroke: C.fg3, sw: 1.6, text: '人', opacity: op };
    o.req = node(RQX, KY, 172, 58, '采购申请', null, 'warn', op);
    o.irr = mix(node(RQX, KY + 52, 90, 24, '不可逆', null, 'bad', op, 11.5), { rx: 12 });
    o.rpl = label(KX + 34, EY + 44, 'replan', C.bad, 'start');
    return o;
  }
  var sc3 = {
    name: '依赖图与重规划', desc: '讲义第 3 页：任务里有并行的搜索、依赖和后到的信息。还有一步撤不回来的动作。四家都不合适时，图本身要变，得加一个结点。',
    bg: function (d) { title(d, '把计划画成依赖图，再根据反馈改图'); },
    objects: function () { return graph(0); },
    steps: [
      { say: '先规划：把任务画成依赖图。四家的搜索互不依赖。兼容检查要等它们的结果，最后是采购申请。',
        set: join({ g0: pop(0), g1: pop(100), g2: pop(200), g3: pop(300), chk: pop(600), gate: pop(900), req: pop(1000), irr: pop(1200) }, on('pg0', 400), on('pg1', 450), on('pg2', 500), on('pg3', 550), on('pK', 800), on('pQ', 950)) },
      { say: '四个搜索可以同时做，各自的结果流向兼容检查。',
        fx: [st('pg0', 0, C.data, 4), st('pg1', 60, C.data, 4), st('pg2', 120, C.data, 4), st('pg3', 180, C.data, 4), { type: 'pulse', obj: 'chk', color: C.info, at: 900 }] },
      { say: '兼容要求是后来才到的信息。wiki 上写着机架只收 4U、每槽 1600 W。',
        set: join(on('pW'), { wiki: pop(0) }), fx: [st('pW', 200, C.data, 3), { type: 'ripple', obj: 'chk', color: C.data, at: 800 }] },
      { say: '一核对：四家都不合适。照原来的图，下一步就只能硬交一个。',
        set: { g0: bad(0), g1: bad(100), g2: bad(200), g3: bad(300), chk: bad(500) }, fx: [{ type: 'shake', obj: 'chk', at: 600 }] },
      { say: '重新规划：根据这条反馈改图，加一个新结点"搜第五家"。讲义第 3 页：图本身也会变。',
        set: join(on('pR'), { gE: pop(700), rpl: fade(500), chk: { fill: { to: C.infoW, dur: 300, delay: 300 }, stroke: { to: C.info, dur: 300, delay: 300 } } }),
        fx: [st('pR', 0, C.bad, 4), { type: 'burst', obj: 'gE', color: C.bad, at: 900 }] },
      { say: '搜 Vendor E，结果送回兼容检查：这次合格。',
        set: join(on('pE'), { gE: good(800), chk: good(900) }), fx: [st('pE', 0, C.data, 4), { type: 'ripple', obj: 'chk', color: C.ok, at: 900 }] },
      { say: '下一步是撤不回来的提交。先停在这里，让人看一眼、批准。',
        set: { gate: { stroke: { to: C.ok, dur: 300, delay: 600 }, fill: { to: C.okW, dur: 300, delay: 600 }, text: { to: '批', delay: 700 } } },
        fx: [st('pK', 0, C.ok, 3), { type: 'pulse', obj: 'gate', color: C.warn, at: 300 }, { type: 'burst', obj: 'gate', color: C.ok, at: 800 }] },
      { say: '批准后才提交采购申请。',
        set: { req: good(700) }, fx: [st('pQ', 0, C.warn, 4), { type: 'burst', obj: 'req', color: C.ok, at: 800 }] }
    ]
  };

  /* ---------------- 场景 4：四种压力 ---------------- */
  function g4() {
    var o = graph(1);
    ['pE', 'pR', 'pW'].forEach(function (k) { o[k].opacity = 1; o[k].flow = 1; });
    o.gE.opacity = 1; o.wiki.opacity = 1; o.rpl.opacity = 1;
    o.fbT = label(KX + 150, EY + 30, '反馈：都不合适，就改计划', C.bad, 'start');
    o.ctT = label(GTX, KY - 44, '控制：提交前人来批准', C.warn);
    o.lh = node(430, 500, 760, 34, '长程：要求和进度贯穿整个任务', null, 'data', 0, 12.5);
    o.mapM = label(GX + 10, 86, '规划器 / 执行器分开、训练规划器、可供性', C.fg3, 'middle', 11.5);
    o.mapF = label(KX + 150, EY + 52, '按环境反馈重规划，想、做、看怎么分配', C.fg3, 'start', 11.5);
    o.mapC = label(GTX + 60, KY - 70, '计划当安全边界，人编辑、批准计划', C.fg3, 'middle', 11.5);
    o.mapL = label(430, 534, 'Vending-Bench、执行长度、递归委派（RAO）', C.fg3, 'middle', 11.5);
    return o;
  }
  var sc4 = {
    name: '四种压力', desc: '讲义第 17–18 页：加规划结构有四个理由。模块化、反馈、长程、控制。这一讲后面的方法都按这四个来排。',
    bg: function (d) { title(d, '加规划结构的四个理由'); },
    objects: g4,
    steps: [
      { say: '还是这张图。讲义第 17 页列了四个理由：模块化、反馈、长程、控制。',
        fx: [st('pg0', 0, C.data, 3), st('pg2', 100, C.data, 3), st('pK', 400, C.ok, 3), st('pQ', 600, C.warn, 3)] },
      { say: '模块化：各家的搜索分开做。每个只要自己那点上下文，也可以交给不同的模型。',
        set: { grp: fade(0, 400), grpT: fade(200), mapM: fade(700) },
        fx: [{ type: 'pulse', obj: 'g0', color: C.data, at: 300 }, { type: 'pulse', obj: 'g1', color: C.data, at: 380 }, { type: 'pulse', obj: 'g2', color: C.data, at: 460 }, { type: 'pulse', obj: 'g3', color: C.data, at: 540 }] },
      { say: '反馈：结果都不合适，就修订计划。',
        set: { fbT: fade(0), mapF: fade(600) }, fx: [st('pR', 0, C.bad, 4), { type: 'pulse', obj: 'gE', color: C.bad, at: 700 }] },
      { say: '控制：提交这种撤不回来的动作之前，由人来批准。',
        set: { ctT: fade(0), mapC: fade(600) }, fx: [{ type: 'pulse', obj: 'gate', color: C.warn, at: 200 }, { type: 'pulse', obj: 'irr', color: C.bad, at: 500 }] },
      { say: '长程：要求（wiki 上的约束）和进度（哪几家查过）要从头带到尾。',
        set: { lh: pop(0), mapL: fade(600) }, fx: [{ type: 'flash', obj: 'lh', color: C.data, at: 400 }, st('pW', 0, C.data, 3)] },
      { say: '灰字是这一讲后面对付这四种压力的方法。讲义从第 19 页起，每页顶上都标着它属于哪一种。',
        fx: [{ type: 'pulse', obj: 'grp', color: C.data, at: 0 }, { type: 'pulse', obj: 'chk', color: C.bad, at: 300 }, { type: 'pulse', obj: 'gate', color: C.warn, at: 600 }, { type: 'pulse', obj: 'lh', color: C.data, at: 900 }] }
    ]
  };

  VZ.register({
    id: 'c3-replan', title: '买 GPU 工作站：从只会反应，到带着依赖图重新规划',
    sources: [{ t: '第 5 讲 1:23–6:18（例子与依赖图）', u: YT + '83' }, { t: '第 5 讲 33:09–37:58（三种做法、四个理由）', u: YT + '1989' }, { t: '讲义 lecture-05 第 2–3、16–18 页', u: PDF }],
    note: '场景 1 照讲义第 2 页。步号、动作和观察文字、上下文 128k → 14k 都是讲义的。"只有 D 合适、交货期 20 周"和三个问题也是。上下文条在压缩之前怎么涨是示意。场景 2 的三种做法和代码照讲义第 16 页。控制台是本机把这段代码跑在示意的供应商数据上。价格、机箱、功率、交货期都是编的。只照着"只有 D 合适、交货 20 周"来设。"交货期 ≤ 8 周"这条标准和 Vendor E 也是示意。场景 3 的图照讲义第 3 页。人批准这一步来自第 18 页的"控制"。场景 4 照讲义第 17–18 页。灰字是笔记按讲义第 19–44 页每页顶上标的压力归的类。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

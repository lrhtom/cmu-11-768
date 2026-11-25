/* 03 · 第 5 讲 —— 多智能体电脑操作（MACU）：管理者 + DAG + 并行子智能体 + 跟进循环
 * 场景 1：调度循环照讲义 lecture-05 第 38 页重画（结点字母照图，依赖关系和每一步的进展是示意）；
 * 场景 2：讲义第 39 页早午餐例子的 DAG 结构；就绪集合的调度是 本机验算脚本 第 3b 部分实跑（每个子任务 1 个时间单位是示意），
 *         墙钟时间 / 成功率照讲义第 43 页，加速倍数是 verify.py 第 3 部分实算；
 * 场景 3：改图预算照讲义第 44 页；场景 4：管理者和工人照讲义第 41–42 页，差值是 verify.py 第 3 部分实算。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = 'https://www.cmu-agents.com/slides/lecture-05-planning.pdf', YT = 'https://youtu.be/S8v-dR4s29M?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op, size) {
    var f = PAL[k];
    var o = { type: 'box', x: x, y: y, w: w, h: h, rx: 8, fill: f[0], stroke: f[1], sw: 1.6, text: t, size: size || 12.5, weight: 700, opacity: op == null ? 0 : op };
    if (sub) { o.sub = sub; o.subMono = false; o.subSize = 11.5; }
    return o;
  }
  function panel(x, y, w, h, k) { return { type: 'box', x: x, y: y, w: w, h: h, rx: 12, fill: C.bg, stroke: PAL[k][1], sw: 1.3, text: '', opacity: 0 }; }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  var AR = {}; AR[C.ok] = 'ok'; AR[C.info] = 'info'; AR[C.warn] = 'warn'; AR[C.bad] = 'bad'; AR[C.data] = 'data'; AR[C.neutral] = 'neutral';
  function path(d, col, extra) { return mix({ type: 'path', d: d, stroke: col, sw: 1.8, flow: 0, opacity: 0, arrow: AR[col] || 'data' }, extra || {}); }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n, rev) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 600, at: at || 0, color: col || C.data, reverse: !!rev }; }
  function fly(name, x0, y0, x1, y1, delay, text) { var s = {}; s[name] = { opacity: { from: 1, to: 0, dur: 250, delay: (delay || 0) + 950 }, x: { from: x0, to: x1, dur: 900, delay: delay || 0, ease: 'inOut' }, y: { from: y0, to: y1, dur: 900, delay: delay || 0, ease: 'inOut' } }; if (text) s[name].text = { to: text, delay: delay || 0 }; return s; }

  /* ---------------- 场景 1：调度循环 ---------------- */
  var DN = { A: [315, 192], B: [280, 240], C: [350, 240], D: [280, 292], F: [350, 292], G: [280, 344], E: [318, 386], H: [350, 344] };
  var DE = [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'F'], ['D', 'G'], ['G', 'E']];
  function dn(k, op) { return { type: 'circle', x: DN[k][0], y: DN[k][1], r: 13, fill: C.neutralW, stroke: C.neutral, sw: 1.5, text: k, opacity: op == null ? 0 : op }; }
  function done(k, delay) { var s = {}; s['d' + k] = { fill: { to: C.okW, dur: 300, delay: delay || 0 }, stroke: { to: C.ok, dur: 300, delay: delay || 0 }, text: { to: '完', delay: (delay || 0) + 150 }, opacity: { to: 1, dur: 300, delay: delay || 0 } }; return s; }
  function ready(k, delay) { var s = {}; s['d' + k] = { fill: { to: C.infoW, dur: 300, delay: delay || 0 }, stroke: { to: C.info, dur: 300, delay: delay || 0 }, opacity: { to: 1, dur: 300, delay: delay || 0 } }; return s; }
  var CU1 = [460, 215], CUN = [540, 215];
  var sc1 = {
    name: '调度循环', desc: '讲义第 38 页：管理者把任务拆成依赖图（DAG）。就绪的子任务并行派给电脑操作子智能体。每个子任务做完，由管理者检查。它可能让子智能体接着做，也可能改图。',
    bg: function (d) { title(d, 'MACU 的调度循环'); },
    objects: function () {
      var o = {};
      o.loop = { type: 'box', x: 442, y: 280, w: 660, h: 352, rx: 16, fill: 'none', stroke: C.fg3, sw: 1.3, dasharray: '7 5', text: '', opacity: 0 };
      o.loopT = label(442, 96, '调度循环', C.fg2, 'middle', 12.5);
      o.pDag = panel(315, 280, 130, 250, 'neutral'); o.pDagT = label(315, 170, 'DAG', C.fg3, 'middle', 11.5);
      o.pCua = panel(500, 280, 160, 250, 'data'); o.pCuaT = label(500, 172, '并行的子智能体', C.data, 'middle', 11.5);
      o.pFu = panel(690, 280, 140, 250, 'bad'); o.pFuT = label(690, 172, '跟进循环', C.bad, 'middle', 11.5);
      o.pIn = path('M101,270 L125,270', C.data);
      o.pInit = path('M170,247 L170,128 L315,128 L315,155', C.info, { dasharray: '5 4' });
      o.pInitT = label(242, 115, '初始化 / 改图', C.info, 'middle', 11.5);
      o.pV1 = path('M460,231 L460,297', C.warn); o.pVN = path('M540,231 L540,297', C.warn);
      o.pFu1 = path('M580,205 L630,205', C.ok);
      o.pFu2 = path('M690,220 L690,242', C.info);
      o.pC = path('M675,282 L660,317', C.bad); o.pD = path('M705,282 L720,317', C.ok);
      o.pUpd = path('M655,343 L655,422 L500,422 L500,407', C.bad, { dasharray: '5 4' });
      o.pUpdT = label(578, 438, '更新指令', C.bad, 'middle', 11.5);
      o.pCw = path('M725,343 L725,446 L170,446 L170,293', C.neutral, { dasharray: '5 4' });
      o.pCwT = label(440, 464, '继续工作', C.fg3, 'middle', 11.5);
      o.pOut = path('M760,262 L805,262 L805,495 L742,495', C.ok);
      o.pOut2 = path('M640,495 L607,495', C.ok);
      DE.forEach(function (e, i) { var a = DN[e[0]], b = DN[e[1]]; o['e' + i] = { type: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.line, sw: 1.3, opacity: 0 }; });
      o.eH = { type: 'line', x1: DN.F[0], y1: DN.F[1], x2: DN.H[0], y2: DN.H[1], stroke: C.bad, sw: 1.3, opacity: 0 };
      for (var k in DN) o['d' + k] = dn(k);
      o.dH.dasharray = '4 3'; o.dH.stroke = C.bad; o.dH.fill = C.badW;
      o.inp = node(66, 270, 70, 56, '用户任务', null, 'data', 0, 12);
      o.m1 = node(170, 270, 90, 46, '管理者', 'LLM', 'info');
      o.cu1 = node(CU1[0], CU1[1], 60, 32, 'CUA 1', null, 'data', 0, 12); o.cuN = node(CUN[0], CUN[1], 60, 32, 'CUA N', null, 'data', 0, 12);
      o.dots = label(500, 220, '…', C.fg3, 'middle', 14);
      o.pool = { type: 'box', x: 500, y: 322, w: 140, h: 72, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '', opacity: 0 };
      o.vm1 = node(460, 310, 54, 26, 'VM 1', null, 'ok', 0, 11.5); o.vmN = node(540, 310, 54, 26, 'VM N', null, 'ok', 0, 11.5);
      o.poolT = label(500, 347, '虚拟机池', C.ok, 'middle', 11.5);
      o.fd = node(690, 205, 116, 30, '子智能体完成', null, 'neutral', 0, 12);
      o.m2 = node(690, 262, 110, 40, '管理者', '检查结果', 'info', 0, 12);
      o.cont = node(655, 330, 64, 26, 'continue', null, 'bad', 0, 11.5); o.cont.mono = true;
      o.dn = node(725, 330, 56, 26, 'done', null, 'ok', 0, 11.5); o.dn.mono = true;
      o.m3 = node(690, 495, 100, 36, '管理者', null, 'info', 0, 12);
      o.out = node(540, 495, 130, 40, '总结和交付物', null, 'ok', 0, 12.5);
      o.tC = { type: 'box', x: DN.C[0], y: DN.C[1], w: 30, h: 22, rx: 5, fill: C.infoW, stroke: C.info, sw: 1.3, text: 'C', size: 12, weight: 700, mono: true, opacity: 0, trail: { n: 4, gap: 40 } };
      o.tG = mix(o.tC, { x: DN.G[0], y: DN.G[1], text: 'G' });
      o.tE = mix(o.tC, { x: DN.E[0], y: DN.E[1], text: 'E' });
      o.tF = mix(o.tC, { x: DN.F[0], y: DN.F[1], text: 'F' });
      return o;
    },
    steps: [
      { say: '用户的任务交给管理者。管理者是一个强的大模型（课上说比如近期的 Claude Sonnet 一类）。',
        set: join({ inp: pop(0), m1: pop(250), loop: fade(300, 500), loopT: fade(400), pDag: fade(500, 400), pDagT: fade(500), pCua: fade(600, 400), pCuaT: fade(600), pFu: fade(700, 400), pFuT: fade(700) }, on('pIn', 200)),
        fx: [st('pIn', 300, C.data, 3), { type: 'ripple', obj: 'm1', color: C.info, at: 700 }] },
      { say: '管理者把任务拆成子任务，画成依赖图。箭头表示"要等前一个做完"。',
        set: join(on('pInit'), { pInitT: fade(200), dA: fade(500), dB: fade(600), dC: fade(650), dD: fade(700), dF: fade(750), dG: fade(800), dE: fade(850), e0: fade(550), e1: fade(600), e2: fade(650), e3: fade(700), e4: fade(750), e5: fade(800) }),
        fx: [st('pInit', 0, C.info, 4)] },
      { say: '按依赖顺序执行。假设前几轮 A、B、D 已经做完。现在依赖都满足、可以开工的是 C 和 G（示意）。',
        set: join(done('A', 0), done('B', 200), done('D', 400), ready('C', 800), ready('G', 900), { cu1: pop(1000), cuN: pop(1100), dots: fade(1100) }),
        fx: [{ type: 'pulse', obj: 'dC', color: C.info, at: 1000 }, { type: 'pulse', obj: 'dG', color: C.info, at: 1000 }] },
      { say: 'C 和 G 互不依赖，同时派给两个电脑操作子智能体。',
        set: join(fly('tC', DN.C[0], DN.C[1], CU1[0], CU1[1], 0), fly('tG', DN.G[0], DN.G[1], CUN[0], CUN[1], 150)),
        fx: [{ type: 'ripple', obj: 'cu1', color: C.info, at: 950 }, { type: 'ripple', obj: 'cuN', color: C.info, at: 1100 }] },
      { say: '每个子智能体在自己的虚拟机里点击、打字。低层的电脑操作都在这里发生。',
        set: join({ pool: fade(0, 300), vm1: pop(100), vmN: pop(150), poolT: fade(200) }, on('pV1', 300), on('pVN', 300)),
        fx: [st('pV1', 400, C.warn, 4), st('pVN', 450, C.warn, 4), st('pV1', 1200, C.data, 3, true), st('pVN', 1250, C.data, 3, true)] },
      { say: '子智能体报告"做完了"，进入跟进循环。管理者检查这个子任务的结果。',
        set: join({ fd: pop(0), m2: pop(400) }, on('pFu1', 100), on('pFu2', 400)),
        fx: [st('pFu1', 100, C.ok, 4), st('pFu2', 450, C.info, 3), { type: 'pulse', obj: 'm2', color: C.info, at: 800 }] },
      { say: 'G 的结果没问题："done"。G 在图上标成完成，回到循环继续往下走。',
        set: join({ dn: pop(0) }, on('pD', 0), on('pCw', 300), { pCwT: fade(500) }, done('G', 1000), ready('E', 1300)),
        fx: [st('pD', 0, C.ok, 3), st('pCw', 300, C.neutral, 5), { type: 'burst', obj: 'dG', color: C.ok, at: 1100 }] },
      { say: 'C 的结果不对，管理者回"continue"。它带着更新过的指令，让子智能体接着做。',
        set: join({ cont: pop(0) }, on('pC', 0), on('pUpd', 300), { pUpdT: fade(500) }),
        fx: [st('pC', 0, C.bad, 3), st('pUpd', 300, C.bad, 5), { type: 'flash', obj: 'cu1', color: C.bad, at: 1200 }] },
      { say: '管理者也可以改图。检查结果后发现还缺一步，就加一个新结点 H。这就像开头例子里加第五家供应商。',
        set: { eH: fade(400), dH: pop(500) },
        fx: [st('pInit', 0, C.bad, 4), { type: 'burst', obj: 'dH', color: C.bad, at: 800 }] },
      { say: 'G 完成后 E 就绪，派出去。C 重做通过后 F 就绪，也派出去。',
        set: join(done('C', 0), ready('F', 300), fly('tE', DN.E[0], DN.E[1], CUN[0], CUN[1], 400), fly('tF', DN.F[0], DN.F[1], CU1[0], CU1[1], 600)),
        fx: [st('pV1', 1500, C.warn, 3), st('pVN', 1400, C.warn, 3), st('pFu1', 2000, C.ok, 3)] },
      { say: '就这样一轮一轮：派发、执行、检查、继续或改图。直到图里每个结点都完成。',
        set: join(done('E', 0), done('F', 200), done('H', 1300)),
        fx: [st('pCw', 0, C.neutral, 5), st('pFu1', 600, C.ok, 3), { type: 'burst', obj: 'dH', color: C.ok, at: 1400 }] },
      { say: '图处理完，最后由管理者汇总，交出总结和交付物。',
        set: join(on('pOut'), on('pOut2', 700), { m3: pop(600), out: pop(1000) }),
        fx: [st('pOut', 0, C.ok, 5), st('pOut2', 700, C.ok, 3), { type: 'burst', obj: 'out', color: C.ok, at: 1200 }] }
    ]
  };

  /* ---------------- 场景 2：就绪集合（早午餐例子） ---------------- */
  var BN = [['Beach Chalet', 150, 110], ['Fat Choy', 150, 168], ['Weather', 150, 226], ['Beach Chalet Hours', 150, 284], ['Arrange Tabs', 420, 197], ['Aggregate & report', 660, 197]];
  var WX = [330, 520], WY = 400;
  var CODE2 = { lang: 'py', title: '本机实跑的代码（节选）', src:
'# 讲义第 39 页的 6 个子任务\n' +
'DAG = {"Beach Chalet": [], "Fat Choy": [],\n' +
'       "Weather": [], "Beach Chalet Hours": [],\n' +
'       "Arrange Tabs": SEARCHES,  # 四个查询\n' +
'       "Aggregate & report": ["Arrange Tabs"]}\n' +
'done, rnd = set(), 0\n' +
'while len(done) < len(DAG):\n' +
'    ready = [t for t in DAG if t not in done\n' +
'             and all(d in done for d in DAG[t])]\n' +
'    batch = ready[:N]   # N 个子智能体\n' +
'    rnd += 1     # 1 轮 = 1 个单位（示意）\n' +
'    done |= set(batch)\n' };
  function bnode(i, op) { return node(BN[i][1], BN[i][2], i < 4 ? 170 : 160, 40, BN[i][0], null, 'neutral', op, 12); }
  function rdy(i, d0) { var s = {}; s['b' + i] = { fill: { to: C.infoW, dur: 300, delay: d0 || 0 }, stroke: { to: C.info, dur: 300, delay: d0 || 0 } }; return s; }
  function fin(i, d0) { var s = {}; s['b' + i] = { fill: { to: C.okW, dur: 300, delay: d0 || 0 }, stroke: { to: C.ok, dur: 300, delay: d0 || 0 } }; return s; }
  function job(n, i, w, d0) { return fly(n, BN[i][1], BN[i][2], WX[w], WY, d0, BN[i][0]); }
  function wk(w, d0) { return { type: 'ripple', obj: 'w' + w, color: C.info, at: (d0 || 0) + 900 }; }
  var BY = 520, BS = 4.2;
  var sc2 = {
    name: '就绪集合', desc: '讲义第 39 页的早午餐任务：四个查询互不依赖，可以并行。整理标签页要等它们全做完，汇总报告最后做。',
    code: CODE2, dataTitle: '调度（N = 2）', data: { '轮次': 0, '就绪': 0, '本轮派出': 0, '已完成': 0 },
    bg: function (d) { title(d, '只派"依赖都满足"的子任务'); },
    objects: function () {
      var o = {};
      for (var i = 0; i < 4; i++) o['pe' + i] = path('M235,' + BN[i][2] + ' C 300,' + BN[i][2] + ' 300,197 340,197', C.data);
      o.pe4 = path('M500,197 L580,197', C.data);
      for (i = 0; i < 6; i++) o['b' + i] = bnode(i);
      o.task = label(430, 64, '任务：今天去旧金山吃早午餐合不合适？（讲义第 39 页的演示）', C.fg2, 'middle', 12);
      o.w0 = node(WX[0], WY, 150, 40, '子智能体 1', null, 'data', 0, 12.5); o.w1 = node(WX[1], WY, 150, 40, '子智能体 2', null, 'data', 0, 12.5);
      ['j0', 'j1'].forEach(function (n) { o[n] = { type: 'box', x: 0, y: 0, w: 150, h: 26, rx: 6, fill: C.infoW, stroke: C.info, sw: 1.3, text: '', size: 11.5, weight: 700, opacity: 0, trail: { n: 4, gap: 40 } }; });
      o.rnd = label(430, 462, '', C.fg2, 'middle', 12.5);
      [['n1', 'N=1', 0], ['n2', 'N=2', 1], ['n4', 'N=4', 2]].forEach(function (r) {
        o[r[0]] = { type: 'box', x: 150 + r[2] * 260, y: BY, w: 0, h: 18, rx: 4, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1.2, text: '', opacity: 0 };
        o[r[0] + 'L'] = label(140 + r[2] * 260, BY + 5, r[1], C.fg2, 'end', 12);
        o[r[0] + 'V'] = { type: 'text', x: 156 + r[2] * 260, y: BY + 5, text: '', num: 0, fmt: 'fixed1', size: 12, weight: 700, mono: true, color: C.data, anchor: 'start', opacity: 0 };
      });
      return o;
    },
    steps: [
      { say: '六个子任务：四个查询，整理标签页，汇总报告。四个查询是两家餐馆、天气、营业时间。连线是依赖。',
        set: join({ task: fade(0), b0: pop(100), b1: pop(160), b2: pop(220), b3: pop(280), b4: pop(500), b5: pop(700), w0: pop(900), w1: pop(950) }, on('pe0', 400), on('pe1', 420), on('pe2', 440), on('pe3', 460), on('pe4', 600)), hl: [1, 2, 3, 4, 5] },
      { say: '第 1 轮：依赖都满足的有 4 个。只有 2 个子智能体，先派前两个。',
        set: join(rdy(0), rdy(1), rdy(2), rdy(3), job('j0', 0, 0, 400), job('j1', 1, 1, 550), { rnd: mix(fade(0), { text: { to: '第 1 轮', delay: 0 } }) }),
        fx: [wk(0, 400), wk(1, 550)], hl: [8, 9, 10], data: { '轮次': 1, '就绪': { v: 4, at: 300 }, '本轮派出': { v: 2, at: 400 } } },
      { say: '两个做完，标成完成。', set: join(fin(0, 0), fin(1, 100)), fx: [st('pe0', 0, C.ok, 3), st('pe1', 100, C.ok, 3)], hl: [11, 12], data: { '已完成': { v: 2, at: 300 } } },
      { say: '第 2 轮：剩下的天气、营业时间就绪，派出去，做完。',
        set: join(job('j0', 2, 0, 0), job('j1', 3, 1, 150), fin(2, 1100), fin(3, 1200), { rnd: { text: { to: '第 2 轮', delay: 0 } } }),
        fx: [wk(0, 0), wk(1, 150), st('pe2', 1100, C.ok, 3), st('pe3', 1200, C.ok, 3)], hl: [8, 9, 10, 11, 12], data: { '轮次': 2, '就绪': { v: 2, at: 200 }, '本轮派出': 2, '已完成': { v: 4, at: 1200 } } },
      { say: '第 3 轮：四个查询都完成了，整理标签页才就绪。只有它一个，另一个子智能体闲着。',
        set: join(rdy(4, 0), job('j0', 4, 0, 300), fin(4, 1400), { rnd: { text: { to: '第 3 轮', delay: 0 } }, w1: { opacity: { to: 0.4, dur: 300 } } }),
        fx: [wk(0, 300), st('pe4', 1400, C.ok, 3)], hl: [8, 9, 10], data: { '轮次': 3, '就绪': { v: 1, at: 200 }, '本轮派出': 1, '已完成': { v: 5, at: 1400 } } },
      { say: '第 4 轮：汇总报告。一共 4 轮。',
        set: join(rdy(5, 0), job('j0', 5, 0, 300), fin(5, 1400), { rnd: { text: { to: '第 4 轮：全部完成', delay: 1400 } } }),
        fx: [wk(0, 300), { type: 'burst', obj: 'b5', color: C.ok, at: 1500 }], hl: [7], data: { '轮次': 4, '就绪': { v: 1, at: 200 }, '本轮派出': 1, '已完成': { v: 6, at: 1400 } },
        log: [{ s: "N=2: 4 轮 [['Beach Chalet', 'Fat Choy'], ['Weather', 'Beach Chalet Hours'], ['Arrange Tabs'], ['Aggregate & report']]", at: 1500 }] },
      { say: '换成 1 个或 4 个子智能体：1 个要 6 轮，4 个要 3 轮。再多也快不过依赖链的长度（示意的单位时间）。',
        set: { w1: { opacity: { to: 1, dur: 300 } }, n1: mix(fade(0, 200), { w: { to: 6 * 16, dur: 800 } }), n2: mix(fade(100, 200), { w: { to: 4 * 16, dur: 800, delay: 100 } }), n4: mix(fade(200, 200), { w: { to: 3 * 16, dur: 800, delay: 200 } }), n1L: fade(0), n2L: fade(100), n4L: fade(200),
          n1V: mix(fade(600), { num: { to: 6, dur: 500, delay: 600 }, x: { to: 156 + 6 * 16, dur: 800 } }), n2V: mix(fade(700), { num: { to: 4, dur: 500, delay: 700 }, x: { to: 416 + 4 * 16, dur: 800, delay: 100 } }), n4V: mix(fade(800), { num: { to: 3, dur: 500, delay: 800 }, x: { to: 676 + 3 * 16, dur: 800, delay: 200 } }) },
        log: [{ s: "N=1: 6 轮 [['Beach Chalet'], ['Fat Choy'], ['Weather'], ['Beach Chalet Hours'], ['Arrange Tabs'], ['Aggregate & report']]", at: 300 }, { s: "N=4: 3 轮 [['Beach Chalet', 'Fat Choy', 'Weather', 'Beach Chalet Hours'], ['Arrange Tabs'], ['Aggregate & report']]", at: 900 }] },
      { say: '讲义第 43 页的实测用的是 Odysseys easy 子集，45 个任务。墙钟时间 25.4 → 13.1 → 7.9 分钟，快 1.94 倍和 3.22 倍。',
        set: { n1: { w: { to: 25.4 * BS, dur: 900 } }, n2: { w: { to: 13.1 * BS, dur: 900 } }, n4: { w: { to: 7.9 * BS, dur: 900 } },
          n1V: { num: { to: 25.4, dur: 900 }, x: { to: 156 + 25.4 * BS, dur: 900 } }, n2V: { num: { to: 13.1, dur: 900 }, x: { to: 416 + 13.1 * BS, dur: 900 } }, n4V: { num: { to: 7.9, dur: 900 }, x: { to: 676 + 7.9 * BS, dur: 900 } } },
        log: [{ s: 'N=2: 墙钟 13.1 分钟  加速 1.94 倍  成功率 48.9', at: 600 }, { s: 'N=4: 墙钟 7.9 分钟  加速 3.22 倍  成功率 60.4', at: 900 }],
        data: { '轮次': '无', '就绪': '无', '本轮派出': '无', '已完成': '无' } }
    ]
  };

  /* ---------------- 场景 3：改图预算 ---------------- */
  var B3 = [[0, 25.0, '0.00', 9], [1, 27.8, '0.08', 10], [5, 47.2, '0.41', 17], [10, 58.3, '0.46', 21]];
  var AXY = 480, SC = 5, BXS = [170, 290, 410, 530];
  var sc3 = {
    name: '改图预算', desc: '讲义第 44 页：限制管理者能改几次图。只能用最初那张图时成功率 25.0%，允许改的次数越多越高。',
    dataTitle: '讲义第 44 页', data: { '可改次数': 0, '成功率 %': 0, '每任务 $': 0 }, dataFmt: { '成功率 %': 'fixed1', '每任务 $': 'fixed2' }, dataMeter: { '成功率 %': [0, 60, C.ok] },
    bg: function (d) {
      title(d, '允许重新规划的次数 vs 成功率');
      d.line(110, AXY, 600, AXY, { stroke: C.fg3, sw: 1.3 });
      [0, 15, 30, 45, 60].forEach(function (v) { d.line(110, AXY - v * SC, 600, AXY - v * SC, { stroke: C.line1, sw: 1, dash: '3 4' }); d.text(102, AXY - v * SC + 4, v + '%', { anchor: 'end', size: 11, color: C.fg3, mono: true }); });
      d.text(355, AXY + 57, '规划预算（管理者最多能改几次图）', { anchor: 'middle', size: 12, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      o.mg = node(720, 110, 120, 40, '管理者', null, 'info');
      o.gr = node(720, 250, 120, 40, '依赖图', null, 'neutral');
      o.pDown = path('M705,130 L705,230', C.info);
      o.pUp = path('M735,230 L735,130', C.bad, { dasharray: '5 4' });
      o.upT = label(745, 184, '改图', C.bad, 'start', 12);
      o.cnt = { type: 'box', x: 720, y: 330, w: 150, h: 34, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, text: '', num: 0, fmt: 'int', pre: '已改 ', post: ' 次', size: 13, weight: 700, opacity: 0 };
      B3.forEach(function (b, i) {
        o['bar' + i] = { type: 'box', x: BXS[i], y: AXY, w: 64, h: 0, rx: 4, anchor: 'bc', fill: C.okW, stroke: C.ok, sw: 1.4, text: '', opacity: 0 };
        o['bv' + i] = { type: 'text', x: BXS[i], y: AXY - 8, text: '', num: 0, fmt: 'fixed1', post: '%', size: 13, weight: 700, mono: true, color: C.ok, anchor: 'middle', opacity: 0 };
        o['bl' + i] = label(BXS[i], AXY + 18, String(b[0]), C.fg, 'middle', 13);
        o['bc' + i] = label(BXS[i], AXY + 34, '$' + b[2] + ' / 任务', C.fg3, 'middle', 11.5);
      });
      return o;
    },
    steps: [
      { say: '管理者先画一张图。之后每次检查完子任务，都可能回头改图。实验限制了"最多能改几次"。',
        set: join({ mg: pop(0), gr: pop(200), upT: fade(600), cnt: pop(700) }, on('pDown', 300), on('pUp', 500)), fx: [st('pDown', 300, C.info, 3)] },
      { say: '预算 0：只能照着最初那张图做到底。成功率 25.0%，没有额外成本。',
        set: { bar0: mix(fade(0, 200), { h: { to: 25.0 * SC, dur: 800, ease: 'out' } }), bv0: mix(fade(300), { num: { to: 25.0, dur: 800 }, y: { to: AXY - 25.0 * SC - 8, dur: 800, ease: 'out' } }), bl0: fade(0), bc0: fade(200) },
        data: { '可改次数': 0, '成功率 %': { v: 25.0, at: 600 }, '每任务 $': 0 } },
      { say: '预算 1：允许改一次图，升到 27.8%（每任务 $0.08）。',
        set: { bar1: mix(fade(0, 200), { h: { to: 27.8 * SC, dur: 800, ease: 'out' } }), bv1: mix(fade(300), { num: { to: 27.8, dur: 800 }, y: { to: AXY - 27.8 * SC - 8, dur: 800, ease: 'out' } }), bl1: fade(0), bc1: fade(200), cnt: { num: { to: 1, dur: 300 } } },
        fx: [st('pUp', 0, C.bad, 2), { type: 'pulse', obj: 'gr', color: C.bad, at: 500 }], data: { '可改次数': 1, '成功率 %': { v: 27.8, at: 600 }, '每任务 $': { v: 0.08, at: 600 } } },
      { say: '预算 5：47.2%（每任务 $0.41）。',
        set: { bar2: mix(fade(0, 200), { h: { to: 47.2 * SC, dur: 800, ease: 'out' } }), bv2: mix(fade(300), { num: { to: 47.2, dur: 800 }, y: { to: AXY - 47.2 * SC - 8, dur: 800, ease: 'out' } }), bl2: fade(0), bc2: fade(200), cnt: { num: { to: 5, dur: 800 } } },
        fx: [st('pUp', 0, C.bad, 5), st('pDown', 700, C.info, 3), { type: 'pulse', obj: 'gr', color: C.bad, at: 600 }], data: { '可改次数': 5, '成功率 %': { v: 47.2, at: 600 }, '每任务 $': { v: 0.41, at: 600 } } },
      { say: '预算 10：58.3%（每任务 $0.46）。课上说：这个实验就是"重新规划有用"的直接证据。',
        set: { bar3: mix(fade(0, 200), { h: { to: 58.3 * SC, dur: 800, ease: 'out' } }), bv3: mix(fade(300), { num: { to: 58.3, dur: 800 }, y: { to: AXY - 58.3 * SC - 8, dur: 800, ease: 'out' } }), bl3: fade(0), bc3: fade(200), cnt: { num: { to: 10, dur: 900 } } },
        fx: [st('pUp', 0, C.bad, 8), st('pDown', 900, C.info, 3), { type: 'burst', obj: 'bar3', color: C.ok, at: 900 }], data: { '可改次数': 10, '成功率 %': { v: 58.3, at: 600 }, '每任务 $': { v: 0.46, at: 600 } } },
      { say: '从 0 到 10，成功率多了 33.3 个百分点，每任务多花 $0.46。规划是一种设计选择：它增加复杂度，值不值要看任务。',
        fx: [{ type: 'pulse', obj: 'bar0', color: C.neutral, at: 0 }, { type: 'pulse', obj: 'bar3', color: C.ok, at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：管理者与工人 ---------------- */
  var MG = [['单智能体（无管理者）', 25.0, '无'], ['Opus 4.6', 58.3, '$0.46'], ['Sonnet 4.6', 52.8, '$0.28'], ['GPT-5.4', 44.4, '$0.42'], ['Gemini 3.1 Pro', 41.7, '$0.24'], ['Kimi-K2.6', 41.7, '无']];
  var WK = [['Qwen3.6-27B', 47.2, 66.7], ['Qwen3.6-35B-A3B', 50.0, 58.3], ['Qwen3.5-9B', 50.0, 61.1], ['Qwen3.5-4B', 25.0, 58.3], ['Qwen3.5-2B', 27.8, 44.4]];
  var LX = 170, RX = 600, S4 = 3.4;
  function my(i) { return 110 + i * 34; }
  function wy(i) { return 352 + i * 38; }
  var sc4 = {
    name: '管理者与工人', desc: '讲义第 41–42 页（OSWorld 消融，36 个任务）。工人固定、换管理者，差别很大。管理者固定、换工人，越弱的工人被拉得越多。',
    dataTitle: '本机实算', data: { '比单智能体多（点）': 0 }, dataFmt: { '比单智能体多（点）': 'fixed1' },
    bg: function (d) {
      title(d, '强管理者 + 便宜的工人');
      d.text(40, 76, '工人固定为 Qwen3.5-4B，换管理者（讲义第 41 页）', { size: 12, weight: 700, color: C.fg2 });
      d.text(40, 318, '管理者固定为 Opus 4.6，换工人：单智能体 → MACU（讲义第 42 页）', { size: 12, weight: 700, color: C.fg2 });
      d.line(LX, 92, LX, 300, { stroke: C.fg3, sw: 1.2 });
      d.line(LX, 334, LX, 538, { stroke: C.fg3, sw: 1.2 });
    },
    objects: function () {
      var o = {};
      MG.forEach(function (m, i) {
        o['ml' + i] = label(LX - 8, my(i) + 4, m[0], C.fg2, 'end', 11.5);
        o['mb' + i] = { type: 'box', x: LX, y: my(i), w: 0, h: 20, rx: 3, anchor: 'l', fill: i ? C.infoW : C.neutralW, stroke: i ? C.info : C.neutral, sw: 1.2, text: '', opacity: 0 };
        o['mv' + i] = { type: 'text', x: LX + 6, y: my(i) + 4, text: '', num: 0, fmt: 'fixed1', size: 11.5, weight: 700, mono: true, color: i ? C.info : C.fg3, anchor: 'start', opacity: 0 };
        o['mc' + i] = label(LX + m[1] * S4 + 56, my(i) + 4, m[2] === '无' ? '' : '每任务 ' + m[2], C.fg3, 'start', 11.5);
      });
      WK.forEach(function (w, i) {
        o['wl' + i] = label(LX - 8, wy(i) + 4, w[0], C.fg2, 'end', 11.5);
        o['wa' + i] = { type: 'box', x: LX, y: wy(i) - 7, w: 0, h: 13, rx: 3, anchor: 'l', fill: C.neutralW, stroke: C.neutral, sw: 1.1, text: '', opacity: 0 };
        o['wb' + i] = { type: 'box', x: LX, y: wy(i) + 8, w: 0, h: 13, rx: 3, anchor: 'l', fill: C.okW, stroke: C.ok, sw: 1.1, text: '', opacity: 0 };
        o['wv' + i] = { type: 'text', x: LX + 6, y: wy(i) + 12, text: '', num: 0, fmt: 'fixed1', size: 11.5, weight: 700, mono: true, color: C.ok, anchor: 'start', opacity: 0 };
        o['wn' + i] = { type: 'text', x: LX + 6, y: wy(i) - 3, text: '', num: 0, fmt: 'fixed1', size: 11, weight: 700, mono: true, color: C.fg3, anchor: 'start', opacity: 0 };
        o['wd' + i] = { type: 'text', x: LX + w[2] * S4 + 60, y: wy(i) + 8, text: '', num: 0, fmt: 'signed1', size: 12, weight: 750, mono: true, color: C.ok, anchor: 'start', opacity: 0 };
      });
      o.mgr = node(RX + 110, 150, 120, 40, '管理者', '规划、拆分、检查', 'info', 0, 12.5);
      o.wkr = node(RX + 110, 262, 150, 40, '工人 ×N', '做大部分动作，可本地跑', 'data', 0, 12.5);
      o.pmw = path('M' + (RX + 110) + ',172 L' + (RX + 110) + ',240', C.info);
      return o;
    },
    steps: [
      { say: '模块化的好处：管理者和工人可以用不同的模型。工人用便宜的 Qwen3.5-4B，可以在本地跑，不用调昂贵的 API。',
        set: join({ mgr: pop(0), wkr: pop(300) }, on('pmw', 200)), fx: [st('pmw', 300, C.info, 5)] },
      { say: '基线：不要管理者、单个智能体直接做，25.0%。',
        set: { ml0: fade(0), mb0: mix(fade(0, 200), { w: { to: 25.0 * S4, dur: 700 } }), mv0: mix(fade(200), { num: { to: 25.0, dur: 700 }, x: { to: LX + 25.0 * S4 + 6, dur: 700 } }) } },
      { say: '工人不动，只换管理者：Opus 4.6 58.3%、Sonnet 4.6 52.8%、GPT-5.4 44.4%、Gemini 3.1 Pro 和 Kimi-K2.6 都是 41.7%。',
        set: (function () { var s = {}; for (var i = 1; i < 6; i++) { s['ml' + i] = fade(i * 120); s['mb' + i] = mix(fade(i * 120, 200), { w: { to: MG[i][1] * S4, dur: 800, delay: i * 120 } }); s['mv' + i] = mix(fade(i * 120 + 200), { num: { to: MG[i][1], dur: 800, delay: i * 120 }, x: { to: LX + MG[i][1] * S4 + 6, dur: 800, delay: i * 120 } }); } return s; })(),
        fx: [st('pmw', 0, C.info, 6)], data: { '比单智能体多（点）': { v: 33.3, at: 900 } } },
      { say: '成本只差几毛钱：Opus 每任务 $0.46，Sonnet $0.28。大部分动作是工人做的。所以换个更强的管理者，成本涨得不多。',
        set: { mc1: fade(0), mc2: fade(100), mc3: fade(200), mc4: fade(300) }, fx: [st('pmw', 0, C.data, 8), { type: 'pulse', obj: 'wkr', color: C.data, at: 600 }] },
      { say: '反过来：管理者固定为 Opus 4.6，换不同的工人。比较单智能体（灰）和 MACU（绿）。',
        set: (function () { var s = {}; for (var i = 0; i < 5; i++) { s['wl' + i] = fade(i * 100); s['wa' + i] = mix(fade(i * 100, 200), { w: { to: WK[i][1] * S4, dur: 700, delay: i * 100 } }); s['wn' + i] = mix(fade(i * 100 + 200), { num: { to: WK[i][1], dur: 700, delay: i * 100 }, x: { to: LX + WK[i][1] * S4 + 6, dur: 700, delay: i * 100 } }); s['wb' + i] = mix(fade(i * 100 + 300, 200), { w: { to: WK[i][2] * S4, dur: 800, delay: i * 100 + 300 } }); s['wv' + i] = mix(fade(i * 100 + 500), { num: { to: WK[i][2], dur: 800, delay: i * 100 + 300 }, x: { to: LX + WK[i][2] * S4 + 6, dur: 800, delay: i * 100 + 300 } }); } return s; })() },
      { say: '提升（MACU − 单智能体）：+19.5、+8.3、+11.1、+33.3、+16.6。最弱的 Qwen3.5-4B 从 25.0 拉到 58.3，提升最大。',
        set: (function () { var s = {}; for (var i = 0; i < 5; i++) s['wd' + i] = mix(fade(i * 120), { num: { to: Math.round((WK[i][2] - WK[i][1]) * 10) / 10, dur: 700, delay: i * 120 } }); return s; })(),
        fx: [{ type: 'burst', obj: 'wb3', color: C.ok, at: 900 }], data: { '比单智能体多（点）': { v: 33.3, at: 600 } } },
      { say: '课上的总结：较弱的工人，从管理者那里得到的帮助更多。难的拆分和规划交给管理者，工人只管把小步骤做对。',
        fx: [{ type: 'pulse', obj: 'mgr', color: C.info, at: 0 }, st('pmw', 200, C.info, 6), { type: 'pulse', obj: 'wkr', color: C.data, at: 900 }] }
    ]
  };

  VZ.register({
    id: 'c3-macu', title: '多智能体电脑操作：管理者、依赖图和并行的子智能体',
    sources: [{ t: '第 5 讲 1:08:11–1:14:24（Odysseys 与 MACU）', u: YT + '4091' }, { t: '讲义 lecture-05 第 36–44 页', u: PDF }],
    note: '场景 1 的结构照讲义第 38 页。管理者、DAG、并行子智能体和虚拟机池都是。跟进循环里的 continue 和 done、更新指令、继续工作也是。最后由管理者输出总结和交付物，同样照讲义。DAG 里的结点字母照图。依赖关系、哪个结点先完成是示意。"C 要重做""加结点 H"这些进展也是示意。"管理者用强模型、不对就重做、对了可改图"出自视频。时间是 1:10:15–1:11:40。场景 2 的六个子任务照讲义第 39 页。就绪集合的调度和 N=1/2/4 的轮数是本机实跑的。每个子任务算 1 个单位时间，是示意。墙钟时间 25.4 / 13.1 / 7.9 分钟和成功率照讲义第 43 页。1.94 倍、3.22 倍是本机算的，讲义写 1.9×、3.2×。场景 3 的预算、成功率、成本照讲义第 44 页。讲义没写是哪个基准。场景 4 的数照讲义第 41–42 页，提升值是本机算的。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

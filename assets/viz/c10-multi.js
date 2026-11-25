/* 10 · 第 18 讲（Saujas Vaduguru）：多个智能体怎么分工、通信、汇总
 * 依据：讲义 lecture-18-multi-agent-systems.pdf。场景 1 的京都例子照第 11 页，成功率和步数照第 13 页。
 * 场景 2 的调度循环照第 14–15 页，场景 3 的队列和公告板照第 19–21 页，场景 4 的数照第 23–25 页。
 * 拆法、依赖图、认领顺序、continue 那一次是示意。控制台是 本机验算脚本 本机真跑的输出。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join, fly = VZ.fly;
  var PDF = 'https://www.cmu-agents.com/slides/lecture-18-multi-agent-systems.pdf';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op, dash) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), dasharray: dash ? '5 4' : null, opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n, rev) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col, reverse: !!rev }; }
  function box(x, y, w, h, t, sub, k, op, size) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 9, fill: C[k + 'W'], stroke: C[k], sw: 1.5, text: t, sub: sub || '', subMono: false, subSize: 11.5, size: size || 13, weight: 750, opacity: op == null ? 0 : op };
  }
  function chip(x, y, w, t, k, op) {
    return { type: 'box', x: x, y: y, w: w, h: 28, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: 11.5, weight: 700, mono: false, opacity: op == null ? 0 : op, trail: { n: 4, gap: 40 } };
  }
  function recolor(k, d0) { return { fill: { to: C[k + 'W'], dur: 300, delay: d0 || 0 }, stroke: { to: C[k], dur: 300, delay: d0 || 0 } }; }
  function go(x, y, d0, dur) { return { x: { to: x, dur: dur || 800, delay: d0 || 0, ease: 'inOut' }, y: { to: y, dur: dur || 800, delay: d0 || 0, ease: 'inOut' } }; }
  function grow(w, d0, dur) { return { opacity: { to: 1, dur: 100, delay: d0 || 0 }, w: { to: w, dur: dur || 800, delay: d0 || 0, ease: 'out' } }; }
  function gone(d0) { return { opacity: { to: 0, dur: 250, delay: d0 || 0 } }; }

  /* ---------------- 场景 1：按需派子智能体（讲义第 11、13 页） ---------------- */
  var P = { root: [290, 100], A: [130, 250], B: [410, 250], B1: [320, 400], B2: [510, 400] };
  var CX = 725, CY0 = 112, CH = 38;
  function cy(i) { return CY0 + i * CH; }
  var CODE1 = { lang: 'py', title: '本机实跑的玩具实现（拆法是示意）', src:
'PLAN = {"Kyoto trip": ["cherry blossoms",\n' +
'                       "temple + kid"],\n' +
'        "temple + kid": ["quiet temple",\n' +
'                         "kid activity"]}\n' +
'def solve(task, depth=0):\n' +
'    subs = PLAN.get(task, [])\n' +
'    if not subs:          # 叶子：自己做完\n' +
'        print("depth", depth, task, "-> done")\n' +
'        return task + " done"\n' +
'    print("depth", depth, task, "-> launch",\n' +
'          len(subs))\n' +
'    return [solve(s, depth + 1) for s in subs]\n' +
'r = solve("Kyoto trip")\n' +
'print("root context gets", len(r), "results")\n' };
  var sc1 = {
    name: '按需派子智能体', desc: '根智能体把子目标交给自己的克隆，克隆还能再派克隆。每一层只把一句结果交回上一层，根的上下文一直很干净（讲义第 11、13 页）。',
    code: CODE1, dataTitle: '京都三日游', data: { '智能体数': 1, '最大深度': 0, '根上下文条数': 0 },
    bg: function (d) {
      title(d, '按需派子智能体：子任务交给克隆，只收结果');
      d.text(CX, 78, '根智能体的上下文', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
      d.rect(CX - 105, 92, 210, 210, { rx: 10, fill: 'none', stroke: C.line, sw: 1.2, dash: '5 4' });
    },
    objects: function () {
      var o = {};
      o.eA = wire('M290,128 C290,185 130,175 130,222', C.warn);
      o.eB = wire('M290,128 C290,185 410,175 410,222', C.warn);
      o.eB1 = wire('M410,278 C410,335 320,325 320,372', C.warn);
      o.eB2 = wire('M410,278 C410,335 510,325 510,372', C.warn);
      o.root = box(P.root[0], P.root[1], 236, 56, '根智能体 · 深度 0', '京都三日游：赏樱、安静的寺庙…', 'info');
      o.A = mix(box(P.root[0], P.root[1], 200, 52, 'A · 深度 1', '人少的赏樱地点', 'info'), { s: 0.6, trail: { n: 4, gap: 40 } });
      o.B = mix(box(P.root[0], P.root[1], 214, 52, 'B · 深度 1', '安静的寺庙 + 孩子的活动', 'info'), { s: 0.6, trail: { n: 4, gap: 40 } });
      o.B1 = mix(box(P.B[0], P.B[1], 180, 52, 'B.1 · 深度 2', '一座安静的寺庙', 'info'), { s: 0.6, trail: { n: 4, gap: 40 } });
      o.B2 = mix(box(P.B[0], P.B[1], 180, 52, 'B.2 · 深度 2', '一个孩子的活动', 'info'), { s: 0.6, trail: { n: 4, gap: 40 } });
      o.rA = chip(P.A[0], P.A[1] + 44, 170, '哲学之道，早上去', 'ok');
      o.rB1 = chip(P.B1[0], P.B1[1] + 44, 150, '青莲院', 'ok');
      o.rB2 = chip(P.B2[0], P.B2[1] + 44, 150, '京都铁道博物馆', 'ok');
      o.rB = chip(P.B[0], P.B[1] + 44, 170, '青莲院（安静）', 'ok');
      o.c0 = chip(CX, cy(0), 190, '任务：京都三日游', 'data');
      o.c1 = chip(CX, cy(1), 190, '动作 1：派出 A、B', 'warn');
      o.c4 = chip(CX, cy(4), 190, '动作 2：finish(计划)', 'ok');
      o.bt = { type: 'text', x: 60, y: 470, text: '讲义第 13 页 · 只给 8K 上下文时的成功率', size: 12, weight: 750, color: C.fg2, anchor: 'start', opacity: 0 };
      o.l1 = { type: 'text', x: 60, y: 500, text: '单个智能体（16 步）', size: 12, weight: 700, color: C.fg, anchor: 'start', opacity: 0 };
      o.l2 = { type: 'text', x: 60, y: 530, text: '递归委派（33 步）', size: 12, weight: 700, color: C.fg, anchor: 'start', opacity: 0 };
      o.b1 = { type: 'box', x: 220, y: 500, w: 0, h: 16, rx: 3, anchor: 'l', fill: C.neutral, stroke: 'none', opacity: 0 };
      o.b2 = { type: 'box', x: 220, y: 530, w: 0, h: 16, rx: 3, anchor: 'l', fill: C.ok, stroke: 'none', opacity: 0 };
      o.v1 = { type: 'text', x: 220 + 0.24 * 420 + 10, y: 500, text: '0.24', size: 12.5, weight: 800, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
      o.v2 = { type: 'text', x: 220 + 0.95 * 420 + 10, y: 530, text: '0.95', size: 12.5, weight: 800, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
      return o;
    },
    steps: [
      { say: '根智能体在深度 0，拿到任务。四月初一家人去京都玩三天，要看樱花，还要一座安静的寺庙。', set: { root: pop(0), c0: pop(400) },
        fx: [{ type: 'ripple', obj: 'c0', color: C.data, at: 700 }], data: { '根上下文条数': { v: 1, at: 400 } } },
      { say: '第 1 个动作：派出两个克隆。A 去找人少的赏樱地点，B 去找安静的寺庙和孩子的活动。',
        set: join(on('eA'), on('eB'), { A: mix(go(P.A[0], P.A[1], 200), { opacity: { to: 1, dur: 200, delay: 200 }, s: { to: 1, dur: 800, delay: 200 } }),
          B: mix(go(P.B[0], P.B[1], 350), { opacity: { to: 1, dur: 200, delay: 350 }, s: { to: 1, dur: 800, delay: 350 } }), c1: pop(900) }),
        fx: [st('eA', 0, C.warn, 3), st('eB', 150, C.warn, 3)], hl: [10, 11, 12], data: { '智能体数': { v: 3, at: 600 }, '最大深度': { v: 1, at: 600 }, '根上下文条数': { v: 2, at: 900 } },
        log: [{ s: 'depth 0 Kyoto trip -> launch 2', at: 300 }] },
      { say: 'A 自己搜完，只交回一句"哲学之道，早上去"。它搜索的过程，留在它自己的上下文里。',
        set: { rA: mix(pop(0), go(CX, cy(2), 500, 1000)) }, fx: [{ type: 'pulse', obj: 'A', color: C.info, at: 0 }, { type: 'ripple', x: CX, y: cy(2), r: 26, color: C.ok, at: 1500 }],
        hl: [7, 8, 9], data: { '根上下文条数': { v: 3, at: 1400 } }, log: [{ s: 'depth 1 cherry blossoms -> done', at: 300 }] },
      { say: 'B 觉得还能拆，又派出 B.1 和 B.2，深度到了 2。克隆还能再派克隆。',
        set: join(on('eB1'), on('eB2'), { B1: mix(go(P.B1[0], P.B1[1], 200), { opacity: { to: 1, dur: 200, delay: 200 }, s: { to: 1, dur: 800, delay: 200 } }),
          B2: mix(go(P.B2[0], P.B2[1], 350), { opacity: { to: 1, dur: 200, delay: 350 }, s: { to: 1, dur: 800, delay: 350 } }) }),
        fx: [st('eB1', 0, C.warn, 3), st('eB2', 150, C.warn, 3)], hl: [10, 11, 12], data: { '智能体数': { v: 5, at: 600 }, '最大深度': { v: 2, at: 600 } },
        log: [{ s: 'depth 1 temple + kid -> launch 2', at: 300 }] },
      { say: 'B.1 调 search_web 找到青莲院。B.2 直接交回京都铁道博物馆。两条结果先回到 B。',
        set: { rB1: mix(go(P.B[0] - 40, P.B[1] + 12, 500), { opacity: { from: 1, to: 0, dur: 250, delay: 1300 } }), rB2: mix(go(P.B[0] + 40, P.B[1] + 12, 650), { opacity: { from: 1, to: 0, dur: 250, delay: 1450 } }) },
        fx: [st('eB1', 400, C.ok, 3, true), st('eB2', 550, C.ok, 3, true), { type: 'ripple', obj: 'B', color: C.ok, at: 1400 }], hl: [7, 8, 9],
        log: [{ s: 'depth 2 quiet temple -> done', at: 300 }, { s: 'depth 2 kid activity -> done', at: 700 }] },
      { say: 'B 只把一句"青莲院"交给根。根的上下文里只多了两句结果，没有任何搜索过程。',
        set: { rB: mix(pop(0), go(CX, cy(3), 500, 1000)) }, fx: [st('eB', 300, C.ok, 3, true), { type: 'ripple', x: CX, y: cy(3), r: 26, color: C.ok, at: 1500 }],
        data: { '根上下文条数': { v: 4, at: 1400 } }, hl: [14], log: [{ s: 'root context gets 2 results', at: 900 }] },
      { say: '第 2 个动作：根智能体写出三日游计划，调用 finish 收工。', set: { c4: pop(0) },
        fx: [{ type: 'burst', obj: 'c4', color: C.ok, at: 400 }, { type: 'pulse', obj: 'root', color: C.ok, at: 200 }], data: { '根上下文条数': { v: 5, at: 300 } } },
      { say: '只给 8K 上下文时，递归版本成功率 0.95，单个智能体只有 0.24（讲义第 13 页）。代价是步数 33 对 16。',
        set: { bt: fade(0), l1: fade(100), l2: fade(200), b1: grow(0.24 * 420, 300), b2: grow(0.95 * 420, 450, 1100), v1: fade(1100), v2: fade(1500) },
        fx: [{ type: 'pulse', obj: 'b2', color: C.ok, at: 1600 }] }
    ]
  };

  /* ---------------- 场景 2：管理者按依赖图派活（讲义第 14–15 页） ---------------- */
  var DN = { A: [300, 112], B: [255, 200], C: [345, 200], D: [300, 288] };
  var W1 = [580, 150], W2 = [580, 290], FU = [762, 220];
  function dnode(id) { return { type: 'circle', x: DN[id][0], y: DN[id][1], r: 21, fill: C.neutralW, stroke: C.neutral, sw: 1.6, text: id, size: 14, weight: 800, opacity: 0 }; }
  function card(id) { return mix(chip(DN[id][0], DN[id][1], 64, '任务 ' + id, 'data'), {}); }
  var CODE2 = { lang: 'py', title: '本机实跑：按依赖图分批派活（依赖图是示意）', src:
'DAG = {"A": [], "B": ["A"], "C": ["A"],\n' +
'       "D": ["B", "C"]}\n' +
'done, rounds = set(), []\n' +
'while len(done) < len(DAG):\n' +
'    ready = [t for t in DAG if t not in done\n' +
'             and all(d in done for d in DAG[t])]\n' +
'    rounds.append(ready)   # 这一批同时派出去\n' +
'    done |= set(ready)\n' +
'    print("round", len(rounds), ready)\n' };
  var sc2 = {
    name: '管理者调度', desc: '管理者画依赖图，就绪的子任务一批批并行派给子智能体。做完进入跟进循环，管理者回 continue 或 done，全部完成再汇总（讲义第 14–15 页）。',
    code: CODE2, dataTitle: '调度（依赖图是示意）', data: { '批次': 0, '已完成': 0 }, dataFmt: { '已完成': function (v) { return Math.round(v) + ' / 4'; } },
    bg: function (d) {
      title(d, '有人管的委派：画依赖图、并行派活、跟进、汇总');
      d.text(300, 74, '依赖图', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      o.ab = wire('M290,132 L264,180', C.fg3); o.ac = wire('M310,132 L336,180', C.fg3);
      o.bd = wire('M264,220 L290,268', C.fg3); o.cd = wire('M336,220 L310,268', C.fg3);
      o.task = box(110, 80, 150, 40, '用户任务', '', 'neutral', 0, 12.5);
      o.mgr = box(110, 200, 150, 60, '管理者', '建图 / 跟进', 'info');
      o.tm = wire('M110,100 L110,168', C.data);
      o.md = wire('M186,200 L230,200', C.info);
      ['A', 'B', 'C', 'D'].forEach(function (id) { o['n' + id] = dnode(id); });
      o.w1 = box(W1[0], W1[1], 170, 56, '子智能体 1', '虚拟机 1', 'warn');
      o.w2 = box(W2[0], W2[1], 170, 56, '子智能体 2', '虚拟机 2', 'warn');
      o.fu = box(FU[0], FU[1], 120, 66, '跟进', 'continue / done', 'info', 0, 13);
      o.p1 = wire('M366,150 L493,150', C.warn); o.p2 = wire('M366,250 C430,250 440,290 493,290', C.warn);
      o.q1 = wire('M667,150 C700,150 700,200 702,200', C.ok); o.q2 = wire('M667,290 C700,290 700,240 702,240', C.ok);
      o.back = wire('M762,255 C762,390 110,390 110,232', C.info, 0, true);
      o.cont = wire('M720,254 C700,320 690,312 667,306', C.warn, 0, true);
      o.kA = card('A'); o.kB = card('B'); o.kC = card('C'); o.kD = card('D');
      o.fo = wire('M80,232 C80,470 180,470 263,470', C.ok);
      o.out = box(430, 470, 330, 50, '汇总交付：总结和成果', '', 'ok', 0, 13.5);
      o.lbl = { type: 'text', x: 430, y: 525, text: '讲义第 15 页：任务越长、越能并行，委派的提升越大', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '管理者拿到用户任务，先画依赖图。A 做完才能做 B 和 C，D 要等 B 和 C（子任务是示意）。',
        set: join(on('tm'), on('md', 500), { task: pop(0), mgr: pop(300), nA: pop(700), nB: pop(850), nC: pop(850), nD: pop(1000) }, on('ab', 900), on('ac', 900), on('bd', 1100), on('cd', 1100)),
        fx: [st('tm', 200, C.data, 3), st('md', 600, C.info, 3)], hl: [1, 2] },
      { say: '第 1 批只有 A 就绪。管理者把 A 派给子智能体 1，它在自己的虚拟机里动手。',
        set: join(on('p1'), { nA: recolor('warn', 0), w1: pop(200), kA: mix(fade(200, 150), go(W1[0], W1[1] - 46, 300)) }),
        fx: [st('p1', 300, C.warn, 3), { type: 'ripple', obj: 'w1', color: C.warn, at: 1100 }], hl: [4, 5, 6, 7, 8, 9], data: { '批次': { v: 1, at: 300 } },
        log: [{ s: "round 1 ['A']", at: 400 }] },
      { say: 'A 做完，进入跟进循环。管理者看了结果，回一句 done，A 在图上变绿。',
        set: join(on('q1'), on('back', 900), { fu: pop(100), kA: mix(go(FU[0], FU[1] - 52, 200), recolor('ok', 200), gone(1300)), nA: recolor('ok', 1100) }),
        fx: [st('q1', 200, C.ok, 3), st('back', 1000, C.info, 4), { type: 'ripple', obj: 'mgr', color: C.info, at: 1700 }], data: { '已完成': { v: 1, at: 1100 } } },
      { say: '第 2 批：B 和 C 的依赖都做完了，同时派给子智能体 1 和 2。',
        set: join(on('p2'), { nB: recolor('warn', 0), nC: recolor('warn', 0), w2: pop(150), kB: mix(fade(200, 150), go(W1[0], W1[1] - 46, 300)), kC: mix(fade(200, 150), go(W2[0], W2[1] - 46, 300)) }),
        fx: [st('p1', 300, C.warn, 3), st('p2', 300, C.warn, 3)], hl: [4, 5, 6, 7], data: { '批次': { v: 2, at: 300 } },
        log: [{ s: "round 2 ['B', 'C']", at: 400 }] },
      { say: 'B 做完被判 done。C 交回来的结果还不够（示意），也先进跟进循环。',
        set: join(on('q2'), { kB: mix(go(FU[0], FU[1] - 52, 100), recolor('ok', 100), gone(1100)), nB: recolor('ok', 1000), kC: mix(go(FU[0], FU[1] + 52, 400), recolor('bad', 400)) }),
        fx: [st('q1', 100, C.ok, 3), st('q2', 400, C.ok, 3), st('back', 1100, C.info, 3)], data: { '已完成': { v: 2, at: 1000 } } },
      { say: '管理者回 continue，带着更新过的指令，把 C 发回子智能体 2 补做。',
        set: join(on('cont'), { kC: mix(go(W2[0], W2[1] - 46, 200), recolor('data', 200), { text: { to: 'C · 新指令', delay: 200 } }) }),
        fx: [st('cont', 200, C.warn, 4), { type: 'shake', obj: 'w2', at: 1100 }] },
      { say: 'C 补完，判 done。第 3 批只剩 D，派出去、做完，也判 done。',
        set: { kC: mix(go(FU[0], FU[1] + 52, 0, 700), recolor('ok', 0), gone(800)), nC: recolor('ok', 700), nD: recolor('ok', 1900), kD: mix(fade(800, 150), go(W1[0], W1[1] - 46, 900, 700)) },
        fx: [st('q2', 0, C.ok, 3), st('p1', 900, C.warn, 3), st('back', 1700, C.info, 3)], hl: [9], data: { '批次': { v: 3, at: 900 }, '已完成': { v: 4, at: 1900 } },
        log: [{ s: "round 3 ['D']", at: 1000 }] },
      { say: '全部做完，管理者写总结、交出成果。讲义第 15 页说，任务越长、越能并行，这种委派提升越大。',
        set: join(on('fo'), { kD: gone(0), out: pop(500), lbl: fade(1000) }), fx: [{ type: 'pulse', obj: 'mgr', color: C.info, at: 0 }, st('fo', 100, C.ok, 4), { type: 'burst', obj: 'out', color: C.ok, at: 900 }] }
    ]
  };

  /* ---------------- 场景 3：去中心化的队列和公告板（讲义第 19–21 页） ---------------- */
  var QX = 130, AX = 410, BX = 705;
  function qy(i) { return 112 + i * 54; }
  function ay(i) { return 112 + i * 70; }
  function by(i) { return 106 + i * 38; }
  var CODE3 = { lang: 'py', title: '本机实跑：公共队列认领（认领顺序是示意）', src:
'queue = {"T1": None, "T2": None, "T3": None}\n' +
'board = []      # 只追加，谁都能读\n' +
'def claim(agent, task):\n' +
'    if queue[task] is None:   # 没人领才能领\n' +
'        queue[task] = agent\n' +
'        board.append(agent + " claimed " + task)\n' +
'        return True\n' +
'    return False\n' +
'print(claim("a1", "T1"), claim("a2", "T2"))\n' +
'print(claim("a3", "T1") or claim("a3", "T3"))\n' +
'print(queue)\n' };
  var sc3 = {
    name: '去中心化', desc: '没有管理者。任务挂在公共队列里自己认领，任务上标着谁在做。进展只往共享的公告板上追加，谁都能读（讲义第 19–21 页）。',
    code: CODE3, dataTitle: '队列和公告板', data: { '已认领': 0, '公告板条数': 0, '快了几倍': 0 }, dataFmt: { '快了几倍': 'fixed2' },
    bg: function (d) {
      title(d, '去中心化：公共队列自己领，进展贴在公告板上');
      d.text(QX, 76, '公共任务队列', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
      d.text(AX, 76, '并行的智能体', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
      d.text(BX, 76, '共享上下文（只追加）', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
      d.rect(BX - 118, 88, 236, 250, { rx: 10, fill: 'none', stroke: C.line, sw: 1.2, dash: '5 4' });
    },
    objects: function () {
      var o = {};
      [0, 1, 2].forEach(function (i) {
        o['t' + i] = box(QX, qy(i), 150, 40, 'T' + (i + 1) + ' · 没人领', '', 'data', 0, 12.5);
        o['a' + i] = box(AX, ay(i), 130, 46, '智能体 a' + (i + 1), '', 'info', 0, 13);
      });
      o.c0 = wire('M345,112 L207,112', C.warn); o.c1 = wire('M345,182 C280,182 270,166 207,166', C.warn); o.c2 = wire('M345,252 C280,252 270,220 207,220', C.warn);
      o.rd = wire('M587,180 C540,180 520,252 477,252', C.data);
      o.try3 = chip(AX - 70, ay(2), 86, '领 T1？', 'warn');
      ['a1 claimed T1', 'a2 claimed T2', 'a3 claimed T3'].forEach(function (s, i) { o['b' + i] = mix(chip(AX, ay(i), 200, s, 'warn'), { mono: true }); });
      ['G1：T1 的结果', 'G2：T2 的结果', 'G3：T3 的结果'].forEach(function (s, i) { o['g' + i] = chip(AX, ay(i), 200, s, 'ok'); });
      o.ans = box(BX, 372, 160, 36, '答案：定稿', '', 'ok', 0, 12.5);
      o.h1 = { type: 'text', x: 40, y: 420, text: '讲义第 19 页 · 同一任务的总耗时', size: 12, weight: 750, color: C.fg2, anchor: 'start', opacity: 0 };
      o.l1 = { type: 'text', x: 40, y: 455, text: 'Claude Code + 原生子智能体', size: 12, weight: 700, color: C.fg, anchor: 'start', opacity: 0 };
      o.l2 = { type: 'text', x: 40, y: 500, text: 'DeLM', size: 12, weight: 700, color: C.fg, anchor: 'start', opacity: 0 };
      o.m1 = { type: 'box', x: 230, y: 455, w: 0, h: 18, rx: 3, anchor: 'l', fill: C.bad, stroke: 'none', opacity: 0 };
      o.m2 = { type: 'box', x: 230, y: 500, w: 0, h: 18, rx: 3, anchor: 'l', fill: C.ok, stroke: 'none', opacity: 0 };
      o.v1 = { type: 'text', x: 230 + 162.7 * 2.5 + 10, y: 455, text: '162.7 分钟 · 44% 在等', size: 12, weight: 800, color: C.fg, anchor: 'start', opacity: 0 };
      o.v2 = { type: 'text', x: 230 + 29.3 * 2.5 + 10, y: 500, text: '29.3 分钟 · 2% 在等', size: 12, weight: 800, color: C.fg, anchor: 'start', opacity: 0 };
      return o;
    },
    steps: [
      { say: '初始化一次，预设的子任务挂进公共队列。没有管理者，谁有空谁来领。',
        set: { t0: pop(0), t1: pop(150), t2: pop(300), a0: pop(600), a1: pop(750), a2: pop(900) }, hl: [1, 2] },
      { say: 'a1 领 T1，a2 领 T2。任务上标出谁在做，认领记录追加到公告板。',
        set: join(on('c0'), on('c1'), { t0: mix(recolor('warn', 600), { text: { to: 'T1 · a1 在做', delay: 600 } }), t1: mix(recolor('warn', 750), { text: { to: 'T2 · a2 在做', delay: 750 } }),
          b0: mix(pop(900), go(BX, by(0), 900)), b1: mix(pop(1050), go(BX, by(1), 1050)) }),
        fx: [st('c0', 0, C.warn, 3), st('c1', 150, C.warn, 3)], hl: [3, 4, 5, 6, 7, 9], data: { '已认领': { v: 2, at: 700 }, '公告板条数': { v: 2, at: 1700 } },
        log: [{ s: 'True True', at: 600 }] },
      { say: 'a3 也想领 T1，可 T1 上已经标着 a1。没人领才能领，它被挡了回来。',
        set: { try3: mix(go(QX + 20, qy(0) + 26, 200, 900), { opacity: { from: 1, to: 0, dur: 300, delay: 1600 } }) },
        fx: [{ type: 'shake', obj: 't0', at: 1150 }, { type: 'flash', obj: 't0', color: C.bad, at: 1150 }], hl: [4, 8] },
      { say: '它改领还空着的 T3。认领记录照样只往板上追加，不改别人写的。',
        set: join(on('c2'), { t2: mix(recolor('warn', 300), { text: { to: 'T3 · a3 在做', delay: 300 } }), b2: mix(pop(500), go(BX, by(2), 500)) }),
        fx: [st('c2', 0, C.warn, 3)], hl: [10, 11], data: { '已认领': { v: 3, at: 400 }, '公告板条数': { v: 3, at: 1300 } },
        log: [{ s: 'True', at: 300 }, { s: "{'T1': 'a1', 'T2': 'a2', 'T3': 'a3'}", at: 700 }] },
      { say: '谁做完，谁把结果压缩成一条，追加到共享上下文（示意）。',
        set: { g0: mix(pop(0), go(BX, by(3), 0)), g1: mix(pop(250), go(BX, by(4), 250)), g2: mix(pop(500), go(BX, by(5), 500)), t0: mix(recolor('ok', 800), { text: { to: 'T1 · a1 做完', delay: 800 } }), t1: mix(recolor('ok', 1050), { text: { to: 'T2 · a2 做完', delay: 1050 } }), t2: mix(recolor('ok', 1300), { text: { to: 'T3 · a3 做完', delay: 1300 } }) },
        data: { '公告板条数': { v: 6, at: 1300 } } },
      { say: '别人随时能读这块板，不用等谁来转达。没有新的子任务了，就定稿出答案。',
        set: join(on('rd'), { ans: pop(900) }), fx: [st('rd', 0, C.data, 5), { type: 'ripple', obj: 'a2', color: C.data, at: 800 }, { type: 'burst', obj: 'ans', color: C.ok, at: 1200 }] },
      { say: '讲义第 19 页：Claude Code 加原生子智能体用了 162.7 分钟。智能体的时间里，44% 在等。',
        set: { h1: fade(0), l1: fade(100), m1: grow(162.7 * 2.5, 200, 1300), v1: fade(1400) } },
      { say: 'DeLM 只用 29.3 分钟，只等 2%。162.7 ÷ 29.3 ≈ 5.55，讲义标的是快 5.5 倍。',
        set: { l2: fade(0), m2: grow(29.3 * 2.5, 100, 600), v2: fade(700) }, data: { '快了几倍': { v: 5.55, at: 900 } }, log: [{ s: '162.7 / 29.3 = 5.55', at: 900 }],
        fx: [{ type: 'pulse', obj: 'm2', color: C.ok, at: 900 }] }
    ]
  };

  /* ---------------- 场景 4：通信 vs 各干各的（讲义第 23–25 页） ---------------- */
  var LY = [112, 146, 180], SX = [560, 650, 730];
  var CODE4 = { lang: 'py', title: '本机实跑：讲义第 23–24 页的数', src:
'deltas = [4.30, 1.61, 1.50, 1.18, 1.03,\n' +
'          0.92, 0.88, -0.85, -0.84, 0.83,\n' +
'          0.60, 0.54, 0.54, -0.54, 0.53,\n' +
'          -0.34, 0.33, 0.27, -0.25, 0.20,\n' +
'          0.19, 0.16, -0.13, -0.09, 0.003]\n' +
'print(sum(d > 0 for d in deltas), "of",\n' +
'      len(deltas))\n' +
'tb = {"single pass@1": 52.53,\n' +
'      "independent pass@2": 62.36,\n' +
'      "team@2": 60.67}\n' +
'print(max(tb, key=tb.get))\n' };
  var TB = [['单个智能体 pass@1', 52.53, 'neutral'], ['独立跑两次 pass@2', 62.36, 'ok'], ['通信的两人团队 team@2', 60.67, 'info']];
  var sc4 = {
    name: '通信不总是赢', desc: '通信的智能体在同步点交换验证过的进展。它在 ARC-AGI-3 上多数游戏更好，在 Terminal-Bench 2.0 上却没赢过独立多跑（讲义第 23–25 页）。',
    code: CODE4, dataTitle: '讲义第 23–24 页', data: { '通信更好的游戏': 0, 'team@2（%）': 0 }, dataFmt: { '通信更好的游戏': function (v) { return Math.round(v) + ' / 25'; }, 'team@2（%）': 'fixed2' },
    bg: function (d) {
      title(d, '各干各的 vs 互相通信');
      d.text(220, 78, '各干各的', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
      d.text(640, 78, '互相通信', { anchor: 'middle', size: 12.5, weight: 750, color: C.fg2 });
      ['a1', 'a2', 'a3'].forEach(function (a, i) { d.text(48, LY[i], a, { anchor: 'middle', size: 12, weight: 700, color: C.fg2, mono: true }); d.text(468, LY[i], a, { anchor: 'middle', size: 12, weight: 700, color: C.fg2, mono: true }); });
      d.line(62, 96, 62, 196, { stroke: C.fg3, sw: 1.5 }); d.line(380, 96, 380, 196, { stroke: C.fg3, sw: 1.5 });
      d.line(482, 96, 482, 196, { stroke: C.fg3, sw: 1.5 }); d.line(800, 96, 800, 196, { stroke: C.fg3, sw: 1.5 });
      d.text(62, 212, '起点', { anchor: 'middle', size: 11.5, color: C.fg3 }); d.text(380, 212, '终点', { anchor: 'middle', size: 11.5, color: C.fg3 });
      d.text(482, 212, '起点', { anchor: 'middle', size: 11.5, color: C.fg3 }); d.text(800, 212, '终点', { anchor: 'middle', size: 11.5, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      [300, 372, 330].forEach(function (x2, i) {
        o['la' + i] = { type: 'path', d: 'M62,' + LY[i] + ' L' + x2 + ',' + LY[i], stroke: C.data, sw: 2.5, dash: 0, arrow: 'data', opacity: 1 };
        o['da' + i] = { type: 'circle', x: 62, y: LY[i], r: 7, fill: C.data, stroke: 'none', opacity: 0, along: 'la' + i, t: 0, trail: { n: 5, gap: 40 } };
        o['lb' + i] = { type: 'path', d: 'M482,' + LY[i] + ' L792,' + LY[i], stroke: C.line, sw: 1.5, opacity: 0.6 };
        o['db' + i] = { type: 'circle', x: 482, y: LY[i], r: 7, fill: C.info, stroke: 'none', opacity: 0, trail: { n: 5, gap: 40 } };
      });
      SX.forEach(function (x, j) {
        o['s' + j] = { type: 'path', d: 'M' + x + ',96 L' + x + ',196', stroke: C.warn, sw: 1.5, dasharray: '4 4', opacity: 0 };
        o['x' + j] = { type: 'path', d: 'M' + x + ',' + LY[0] + ' L' + x + ',' + LY[2], stroke: C.ok, sw: 2, opacity: 0 };
      });
      o.arc = box(430, 262, 380, 46, '', '', 'ok', 0, 13.5);
      o.arc.num = 0; o.arc.fmt = 'int'; o.arc.pre = 'ARC-AGI-3：通信更好的游戏 '; o.arc.post = ' / 25';
      o.th = { type: 'text', x: 60, y: 336, text: '讲义第 24 页 · Terminal-Bench 2.0 平均准确率', size: 12, weight: 750, color: C.fg2, anchor: 'start', opacity: 0 };
      TB.forEach(function (r, i) {
        var y = 372 + i * 46;
        o['tl' + i] = { type: 'text', x: 60, y: y, text: r[0], size: 12, weight: 700, color: C.fg, anchor: 'start', opacity: 0 };
        o['tb' + i] = { type: 'box', x: 250, y: y, w: 0, h: 18, rx: 3, anchor: 'l', fill: C[r[2]], stroke: 'none', opacity: 0 };
        o['tv' + i] = { type: 'text', x: 250 + r[1] * 7 + 10, y: y, text: r[1].toFixed(2) + '%', size: 12.5, weight: 800, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
      });
      return o;
    },
    steps: [
      (function () { var s = {}; [0, 1, 2].forEach(function (i) { s['da' + i] = { opacity: { to: 1, dur: 150, delay: i * 150 }, t: { from: 0, to: 1, dur: 1500, delay: i * 150, ease: 'inOut' } }; s['la' + i] = { dash: { to: 1, dur: 1500, delay: i * 150, ease: 'inOut' } }; });
        return { say: '各干各的：三个智能体从起点跑到终点，互不相干。最后挑最好的那个结果。', set: s }; })(),
      (function () { var s = {}; [0, 1, 2].forEach(function (i) { s['db' + i] = mix(fade(i * 100, 150), go(SX[0], LY[i], i * 100, 900)); s['lb' + i] = { opacity: { to: 1, dur: 300 } }; }); s.s0 = fade(0); s.x0 = fade(1000);
        return { say: '互相通信：大家跑到第一个同步点就停下，交换验证过的进展。', set: s,
          fx: [{ type: 'stream', path: 'x0', n: 3, gap: 120, dur: 500, at: 1100, color: C.ok }, { type: 'stream', path: 'x0', n: 3, gap: 120, dur: 500, at: 1200, color: C.ok, reverse: true }] }; })(),
      (function () { var s = { s1: fade(0), x1: fade(1000), x0: fade(0, 300, 0) }; [0, 1, 2].forEach(function (i) { s['db' + i] = go(SX[1], LY[i], 100 + i * 80, 900); });
        return { say: '拿到别人的进展，再接着跑。到下一个同步点，再交换一次。', set: s,
          fx: [{ type: 'stream', path: 'x1', n: 3, gap: 120, dur: 500, at: 1100, color: C.ok }, { type: 'stream', path: 'x1', n: 3, gap: 120, dur: 500, at: 1200, color: C.ok, reverse: true }] }; })(),
      (function () { var s = { s2: fade(0), x2: fade(700), x1: fade(0, 300, 0) }; [0, 1, 2].forEach(function (i) { s['db' + i] = go(800, LY[i], 100 + i * 80, 1500); });
        return { say: '过完最后一个同步点，一起到终点。讲义第 25 页说，分享验证过的进展才能有效协作。', set: s,
          fx: [{ type: 'stream', path: 'x2', n: 3, gap: 110, dur: 450, at: 800, color: C.ok }, { type: 'ripple', x: 800, y: LY[1], r: 30, color: C.ok, at: 1800 }] }; })(),
      { say: 'ARC-AGI-3 上，5 个通信的 Sonnet 4.6 和独立跑 5 次取最好的比。25 个游戏里，18 个走得更远。',
        set: { x2: fade(0, 300, 0), arc: mix(pop(0), { num: { to: 18, dur: 1200, delay: 300 } }) }, fx: [{ type: 'burst', obj: 'arc', color: C.ok, at: 1500 }],
        hl: [1, 2, 3, 4, 5, 6, 7], data: { '通信更好的游戏': { v: 18, at: 900 } }, log: [{ s: '18 of 25', at: 900 }] },
      { say: '可在 Terminal-Bench 2.0 上，通信没赢过多跑几次独立的。单个智能体是 52.53%。',
        set: { th: fade(0), tl0: fade(100), tb0: grow(52.53 * 7, 200), tv0: fade(1000) } },
      { say: '独立跑两次平均 62.36%，通信的两人团队 60.67%。各干各的反而更高。',
        set: { tl1: fade(0), tl2: fade(150), tb1: grow(62.36 * 7, 100), tb2: grow(60.67 * 7, 250), tv1: fade(900), tv2: fade(1050) },
        fx: [{ type: 'pulse', obj: 'tb1', color: C.ok, at: 1200 }], hl: [8, 9, 10, 11], data: { 'team@2（%）': { v: 60.67, at: 900 } }, log: [{ s: 'independent pass@2', at: 1100 }] }
    ]
  };

  VZ.register({
    id: 'c10-multi', title: '多个智能体怎么分工、通信、汇总：派子智能体、管理者调度、公共队列、通信的得失',
    sources: [{ t: '第 18 讲讲义（Saujas Vaduguru）第 11–25 页', u: PDF }],
    note: '京都的例子照讲义第 11 页，成功率和步数照第 13 页。调度循环照第 14–15 页。队列和公告板照第 19–21 页，通信的数照第 23–25 页。拆法、依赖图、认领顺序和 continue 那一次是示意。公告板上的结果条目也是示意。控制台的输出是本机真跑的。这一讲没有录像，说明依据讲义。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

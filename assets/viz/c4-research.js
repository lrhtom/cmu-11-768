/* 04 · 第 10 讲 —— 深度研究智能体的数据流：一次搜索 vs 多次搜索、推理-检索循环、引用核查、让检索器看到推理
 * 场景 1 照讲义 lecture-10 第 3–11 页（"Akari Asai 的办公室在哪"和"AI 智能体综述文献能比得上专家吗"两个问题）。
 * 场景 2 的循环结构照讲义第 52–57 页；代码面板和控制台是 本机验算脚本 第 3b2 段在本机的实跑：
 *   语料是按讲义内容写的 5 段小文档，检索用手写的 BM25（讲义第 100 页说的"词面检索"），策略是写死的（不调模型，示意）。
 * 场景 3 的判定照讲义第 47–49 页，准确率 1/2 由 verify.py 第 3c 段算出。
 * 场景 4 照讲义第 105–106、115–123 页（AgentIR），数字都是讲义上的。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L10 = 'https://www.cmu-agents.com/slides/lecture-10-deep-research-agents.pdf', YT = 'https://youtu.be/nKUBrXFQBUM?t=';
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function akey(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'neutral'; }
  function wire(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: akey(col), opacity: 0 }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 300, delay: d0 || 0 }, flow: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function node(x, y, w, h, t, sub, k, mono) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.7, text: t, sub: sub, subMono: !!mono, subSize: 11.5, size: 13, weight: 700, opacity: 0 };
  }
  function chip(x, y, w, t, k, size, mono, h) { return { type: 'box', x: x, y: y, w: w, h: h || 30, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: mono !== false, opacity: 0 }; }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  function recolor(k, delay) { return { fill: { to: PAL[k][0], dur: 400, delay: delay || 0 }, stroke: { to: PAL[k][1], dur: 400, delay: delay || 0 } }; }
  function rider(path, w, k) { return { type: 'box', along: path, t: 0, w: w, h: 26, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: '', size: 11, weight: 650, mono: true, opacity: 0, trail: { n: 4, gap: 40 } }; }
  function ride(dur, delay, text) {
    var o = { t: { from: 0, to: 1, dur: dur, delay: delay || 0, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: (delay || 0) + dur + 120 } };
    if (text != null) o.text = { to: text, delay: 0 };
    return o;
  }
  function seq(lines, start) { var at = start || 0; return lines.map(function (s) { var o = { s: s, at: at }; at += Math.min(s.length * 16, 600) + 90; return o; }); }

  /* ---------------- 场景 1：一次搜索 vs 很多次搜索 ---------------- */
  var sc1 = {
    name: '一次还是多次', desc: '简单问题搜一次就有答案。研究问题没有哪一条结果能单独回答。要计划、搜、反思、再搜，最后带着引用作答。',
    bg: function (d) { title(d, '简单问题搜一次就够，研究问题要搜很多次'); d.text(40, 64, '简单问题', { size: 12.5, weight: 700, color: C.fg3 }); d.text(40, 226, '研究问题', { size: 12.5, weight: 700, color: C.fg3 }); },
    objects: function () {
      var o = {};
      o.q1 = node(150, 110, 220, 46, 'Akari Asai 的办公室？', '', 'info');
      o.s1 = node(340, 110, 100, 40, '搜索', '', 'warn');
      o.e1 = node(530, 110, 200, 46, '证据：教职工主页', '5507 Gates & Hillman', 'data');
      o.a1 = node(735, 110, 130, 40, 'GHC 5507', '', 'ok');
      o.l1 = wire('M262,110 L288,110', C.info); o.l2 = wire('M392,110 L428,110', C.warn); o.l3 = wire('M632,110 L668,110', C.data);
      o.q2 = node(430, 266, 620, 40, 'AI 智能体综述科学文献，能做得和人类专家一样好吗？', '', 'info');
      o.pl = node(140, 360, 200, 70, '计划', '分开"基准高分"和"与专家直接比"', 'info');
      o.sr = node(370, 360, 150, 50, '搜索', '', 'warn');
      o.rA = chip(600, 335, 250, 'A：研究基准，和别的 AI 比分', 'data', 11.5, false);
      o.rB = chip(600, 385, 250, 'B：专家评测，和人写的答案比', 'data', 11.5, false);
      o.rf = node(370, 460, 300, 50, '反思：高分 ≠ 比得上专家。测了哪些任务？', '', 'info');
      o.sr2 = chip(660, 460, 150, '再搜一次', 'warn', 12, false);
      o.fa = node(430, 525, 640, 36, '答案：在测过的任务上有希望，全面比得上专家还没被证明 [1][2]', '', 'ok');
      o.m1 = wire('M242,360 L293,360', C.info); o.m2 = wire('M447,350 L473,335', C.warn); o.m3 = wire('M447,370 L473,385', C.warn);
      o.m4 = wire('M560,402 L470,438', C.data); o.m5 = wire('M522,460 L583,460', C.warn); o.m6 = wire('M660,477 L600,506', C.ok);
      return o;
    },
    steps: [
      { say: '"Akari Asai 在 CMU 的办公室是哪间？"搜一次就找到教职工主页。',
        set: join({ q1: pop(0), s1: pop(300), e1: pop(700) }, on('l1', 200), on('l2', 500)), fx: [st('l1', 200, C.info, 2), st('l2', 500, C.warn, 3)] },
      { say: '证据"5507 Gates & Hillman Centers"进语言模型，答出 GHC 5507。一次检索就够。',
        set: join(on('l3', 0), { a1: pop(400) }), fx: [st('l3', 0, C.data, 3), { type: 'burst', obj: 'a1', color: C.ok, at: 700 }] },
      { say: '再看研究问题。AI 智能体综述科学文献，能做得和人类专家一样好吗？没有哪一条结果能单独回答。',
        set: { q2: pop(0) } },
      { say: '先计划：要把"基准上的高分"和"和专家直接比"分开。再找综述研究，看怎么比的，比较任务和局限。',
        set: join({ pl: pop(0) }, on('m1', 400), { sr: pop(600) }), fx: [st('m1', 400, C.info, 3)] },
      { say: '搜到两类结果。A 是研究基准，和别的 AI 比分。B 是专家评测，和人写的答案比。',
        set: join(on('m2', 0), on('m3', 100), { rA: pop(300), rB: pop(500) }), fx: [st('m2', 0, C.warn, 2), st('m3', 100, C.warn, 2)] },
      { say: '反思：两项研究的比法不同。基准分高，并没回答"比不比得上专家"。测了哪些任务和领域？',
        set: join(on('m4', 0), { rf: pop(300) }), fx: [st('m4', 0, C.data, 3)] },
      { say: '再搜一次：任务、领域、评测方案……',
        set: join(on('m5', 0), { sr2: pop(300) }), fx: [st('m5', 0, C.warn, 3)] },
      { say: '最终答案带引用。在测过的综述任务上，专家更喜欢 OpenScholar 的回答 [1]。但全面比得上专家还没被证明 [2]。',
        set: join(on('m6', 0), { fa: pop(400) }), fx: [st('m6', 0, C.ok, 3), { type: 'burst', obj: 'fa', color: C.ok, at: 800 }] }
    ]
  };

  /* ---------------- 场景 2：推理-检索循环（本机实跑的示意） ---------------- */
  var CODE2 = { lang: 'py', title: '本机实跑（策略写死，示意）', src:
'def search(q, k=2):        # 词面检索 BM25\n' +
'    s = bm25_scores(q, CORPUS)\n' +
'    top = sorted(range(len(s)),\n' +
'                 key=lambda i: -s[i])[:k]\n' +
'    return [(i, s[i]) for i in top if s[i] > 0]\n' +
'\n' +
'def run(question, policy):\n' +
'    ctx = [("user", question)]\n' +
'    for step in policy:\n' +
'        ctx.append(("agent", step))\n' +
'        m = re.match(r\'<tool> search\\("(.+)"\\)\',\n' +
'                     step)\n' +
'        if m:\n' +
'            hits = search(m.group(1))\n' +
'            ctx.append(("tool", fmt(hits)))\n' +
'        if step.startswith("<answer>"):\n' +
'            return ctx\n' };
  var CX = [90, 225, 370, 515, 660, 790];
  var sc2 = {
    name: '推理检索循环', desc: '模型写推理，再写一个搜索调用。外壳执行搜索，把结果接回上下文。模型接着推理，最后写出带引用的答案。蓝色是模型写的，灰色是用户和工具给的。',
    code: CODE2, dataTitle: '上下文', data: { '消息数': 1, '累计词数': 4, '检索到': '无' },
    bg: function (d) { title(d, '深度研究智能体的一次推理：想 → 搜 → 读 → 再想 → 带引用作答'); d.text(40, 76, '目前的上下文', { size: 12.5, weight: 700, color: C.fg3 }); },
    objects: function () {
      var o = {};
      o.c0 = chip(CX[0], 110, 122, '用户：比得上专家吗？', 'neutral', 11, false, 36);
      o.c1 = chip(CX[1], 110, 130, '推理：找专家对比', 'data', 11, false, 36);
      o.c2 = chip(CX[2], 110, 150, 'tool: search(…)', 'data', 11, true, 36);
      o.c3 = chip(CX[3], 110, 130, '工具输出 [1] [2]', 'neutral', 11, false, 36);
      o.c4 = chip(CX[4], 110, 130, '推理：看测了哪些任务', 'data', 11, false, 36);
      o.c5 = chip(786, 110, 84, '答案 [1,2]', 'ok', 11.5, false, 36);
      o.lm = node(330, 250, 300, 50, '语言模型智能体', '', 'info');
      o.pIn = wire('M330,130 L330,224', C.data);
      o.out = chip(330, 330, 300, '', 'data', 12, true, 32);
      o.pOut = wire('M330,276 L330,312', C.data);
      o.pTool = wire('M481,330 L590,330 L590,388', C.warn);
      o.tool = node(650, 420, 200, 56, '搜索工具', 'BM25 · 5 段小语料', 'warn');
      o.pBack = wire('M752,410 L800,410 L800,180 L515,180 L515,131', C.neutral);
      o.d1 = chip(560, 500, 150, 'doc1 · 2.0639', 'ok', 11.5); o.d2 = chip(720, 500, 150, 'doc2 · 0.7382', 'ok', 11.5);
      o.d0 = label(330, 500, '其余 3 段：0.0000', C.fg3, 'middle', 12);
      o.tq = rider('pTool', 120, 'warn');
      o.tb = rider('pBack', 150, 'neutral');
      o.leg = label(330, 410, '蓝 = 模型生成   灰 = 用户输入和工具输出', C.fg3, 'middle', 11.5);
      return o;
    },
    steps: [
      { say: '上下文一开始只有用户的问题："Can agents match experts?"',
        set: { c0: pop(0), lm: pop(300), leg: fade(500) }, log: ['>>> ctx = run("Can agents match experts?", POLICY)'], hl: [7, 8] },
      { say: '① 模型先写推理：<think> Find expert comparisons </think>。',
        set: join(on('pIn', 0), on('pOut', 300), { out: mix(pop(500), { text: { to: '<think> Find expert comparisons', delay: 500 } }) }),
        fx: [st('pIn', 0, C.data, 3)], log: [{ s: '[agent] <think> Find expert comparisons </think>', at: 700 }], hl: [9, 10] },
      { say: '这段推理接进上下文。② 模型再写一个工具调用：search("expert comparisons")。',
        set: { c1: { opacity: { to: 1, dur: 200, delay: 0 }, x: { from: 330, to: CX[1], dur: 800, delay: 0, ease: 'inOut' }, y: { from: 330, to: 110, dur: 800, delay: 0, ease: 'inOut' } }, out: { text: { to: '<tool> search("expert comparisons")', delay: 900 } } },
        log: [{ s: '[agent] <tool> search("expert comparisons") </tool>', at: 1000 }], data: { '消息数': { v: 2, at: 800 }, '累计词数': { v: 9, at: 800 } }, hl: [11, 12, 13] },
      { say: '③ 外壳认出这是搜索调用，把查询交给搜索工具执行。',
        set: join(on('pTool', 0), { tool: pop(0), c2: { opacity: { to: 1, dur: 200, delay: 300 }, x: { from: 330, to: CX[2], dur: 800, delay: 300, ease: 'inOut' }, y: { from: 330, to: 110, dur: 800, delay: 300, ease: 'inOut' } }, tq: ride(900, 200, 'expert comparisons') }),
        fx: [st('pTool', 100, C.warn, 4), { type: 'ripple', obj: 'tool', color: C.warn, at: 1100 }], data: { '消息数': { v: 3, at: 1000 }, '累计词数': { v: 14, at: 1000 } }, hl: [1, 2, 3, 4, 5, 14] },
      { say: 'BM25 给 5 段文档打分。讲 OpenScholar 专家对比的那段最高，2.0639。DR Tulu 那段其次，0.7382，其余是 0。',
        set: { d1: pop(0), d2: pop(250), d0: fade(500) }, fx: [{ type: 'pulse', obj: 'd1', color: C.ok, at: 300 }], data: { '检索到': { v: 'doc1, doc2', at: 300 } } },
      { say: '④ 取前两段，工具输出"[1] OpenScholar [2] DR Tulu"接回上下文。检索到的文字，成了智能体上下文的一部分。',
        set: join(on('pBack', 0), { tb: ride(1000, 0, '[1] [2]'), c3: fade(1000), d1: fade(1000, 300, 0), d2: fade(1100, 300, 0), d0: fade(1100, 300, 0) }),
        fx: [st('pBack', 0, C.neutral, 4)], log: [{ s: '[tool]  [1] OpenScholar [2] DR Tulu   (BM25 2.0639, 0.7382)', at: 900 }], data: { '消息数': { v: 4, at: 1000 }, '累计词数': { v: 19, at: 1000 } }, hl: [15] },
      { say: '⑤ 模型读了检索结果，接着推理："<think> Check the tested tasks"。它要去看那些研究测了什么。',
        set: { out: { text: { to: '<think> Check the tested tasks', delay: 0 } }, c4: { opacity: { to: 1, dur: 200, delay: 600 }, x: { from: 330, to: CX[4], dur: 900, delay: 600, ease: 'inOut' }, y: { from: 330, to: 110, dur: 900, delay: 600, ease: 'inOut' } } },
        fx: [st('pIn', 0, C.data, 5)], log: [{ s: '[agent] <think> Check the tested tasks </think>', at: 300 }], data: { '消息数': { v: 5, at: 1300 }, '累计词数': { v: 25, at: 1300 } }, hl: [9, 10] },
      { say: '⑥ 写出带引用的答案："<answer> Promising on tested tasks [1,2] …"，循环结束。本机跑完：6 条消息、33 个词。',
        set: { out: { text: { to: '<answer> Promising on tested tasks [1,2]', delay: 0 }, fill: { to: C.okW, dur: 300, delay: 0 }, stroke: { to: C.ok, dur: 300, delay: 0 } }, c5: { opacity: { to: 1, dur: 200, delay: 600 }, x: { from: 330, to: 786, dur: 900, delay: 600, ease: 'inOut' }, y: { from: 330, to: 110, dur: 900, delay: 600, ease: 'inOut' } } },
        fx: [{ type: 'burst', obj: 'c5', color: C.ok, at: 1600 }], log: seq(['[agent] <answer> Promising on tested tasks [1,2] </answer>', '>>> len(ctx), sum(len(toks(t)) for _, t in ctx)', '6 33'], 200),
        data: { '消息数': { v: 6, at: 1500 }, '累计词数': { v: 33, at: 1500 } }, hl: [16, 17] }
    ]
  };

  /* ---------------- 场景 3：核查引用 ---------------- */
  var sc3 = {
    name: '核查引用', desc: '答案对了，不代表证据用对了。把报告拆成"论断 + 引用的网址"。再读被引的那页，判断它支不支持这句话。',
    dataTitle: '引用核查（讲义第 49 页）', data: { '论断数': 0, '被支持': 0, '引用准确率': 0, '有效引用': 0 }, dataFmt: { '引用准确率': 'pct' },
    bg: function (d) { title(d, 'FACT：被引用的那一页，支持报告里的这句话吗？'); d.text(150, 92, '① 抽出"论断 + 网址"', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg3 }); d.text(450, 92, '② 读被引的那一页', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg3 }); d.text(730, 92, '③ 判断支不支持', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg3 }); },
    objects: function () {
      var o = {};
      o.k1 = node(150, 160, 230, 64, 'OpenScholar 和人写的答案', '做过比较。[1]', 'neutral');
      o.k2 = node(150, 300, 230, 64, 'OpenScholar 在每个领域', '都比得上专家。[1]', 'neutral');
      o.pg = node(450, 230, 230, 120, '[1] OpenScholar 论文', '专家对比只覆盖部分问题，没测每个领域', 'data');
      o.w1 = wire('M267,160 L333,200', C.data); o.w2 = wire('M267,300 L333,260', C.data);
      o.v1 = node(730, 160, 150, 44, '支持', '', 'ok'); o.v2 = node(730, 300, 150, 44, '不支持', '', 'bad');
      o.j1 = wire('M567,200 L653,165', C.ok); o.j2 = wire('M567,260 L653,295', C.bad);
      o.acc = node(430, 430, 420, 50, '引用准确率 = 1 / 2 = 50%', '有效引用：1 对', 'warn');
      [['搜索复杂度', 'BrowseComp'], ['领域专长', 'MedBrowseComp'], ['答案质量', 'ScholarQABench'], ['证据支撑', 'DeepResearch Bench']].forEach(function (q, i) {
        o['dm' + i] = node(130 + i * 200, 515, 186, 44, q[0], q[1], i === 3 ? 'warn' : 'neutral');
      });
      return o;
    },
    steps: [
      { say: '一份研究报告里有两句话，都引了 [1]（OpenScholar 那篇）。先把每句论断和它引的网址抽出来。',
        set: { k1: pop(0), k2: pop(300) }, data: { '论断数': { v: 2, at: 300 } } },
      { say: '去读被引的那一页。它说专家对比只在一部分研究问题上做过。并没有每个领域都测。',
        set: join(on('w1', 0), on('w2', 200), { pg: pop(500) }), fx: [st('w1', 0, C.data, 3), st('w2', 200, C.data, 3)] },
      { say: '第一句"和人写的答案做过比较"，被引页支持。',
        set: join(on('j1', 0), { v1: pop(300), k1: recolor('ok', 300) }), fx: [st('j1', 0, C.ok, 3)], data: { '被支持': { v: 1, at: 400 } } },
      { say: '第二句"每个领域都比得上专家"，被引页没测每个领域，不支持。引用是真的，结论却被夸大了。',
        set: join(on('j2', 0), { v2: pop(300), k2: recolor('bad', 300) }), fx: [st('j2', 0, C.bad, 3), { type: 'shake', obj: 'v2', at: 700 }] },
      { say: '两句里一句被支持：引用准确率 1/2 = 50%，有效引用 1 对。这是本机算的。',
        set: { acc: pop(0) }, fx: [{ type: 'burst', obj: 'acc', color: C.warn, at: 400 }],
        log: seq(['  OpenScholar was compared with human answers. [1]   -> Supported', '  OpenScholar matches experts in every field. [1]    -> Not supported', '  citation accuracy = 1/2 = 50%; effective citations = 1'], 200),
        data: { '引用准确率': { v: 50, at: 400 }, '有效引用': { v: 1, at: 400 } } },
      { say: '讲义把深度研究的评测拆成四个维度。DeepResearch Bench 补的是最后一个，也就是证据支撑。它查引用的来源到底支不支持论断。',
        set: { dm0: pop(0), dm1: pop(200), dm2: pop(400), dm3: pop(600) }, fx: [{ type: 'pulse', obj: 'dm3', color: C.warn, at: 1000 }] }
    ]
  };

  /* ---------------- 场景 4：让检索器看到推理（AgentIR） ---------------- */
  var AB = [['只给查询', 48.7, 'neutral'], ['+ 推理', 55.5, 'warn'], ['+ DR-Synth 训练', 59.4, 'data'], ['两者都有（AgentIR）', 66.3, 'bad']];
  var sc4 = {
    name: '检索器看推理', desc: '普通检索器只看到最新的那条查询。它看不到智能体为什么要搜。AgentIR 把当前推理也给它，并用专门造的标签训练。',
    dataTitle: 'Tongyi-DR 的准确率（%，讲义第 118 页）', data: { '只给查询': 0, '+ 推理': 0, '+ DR-Synth': 0, 'AgentIR': 0 },
    dataFmt: { '只给查询': 'fixed1', '+ 推理': 'fixed1', '+ DR-Synth': 'fixed1', 'AgentIR': 'fixed1' },
    bg: function (d) { title(d, '检索器常常只看到查询：把智能体的推理也交给它（AgentIR）'); },
    objects: function () {
      var o = {};
      ['原始任务', '之前的推理', '之前的查询', '之前的证据'].forEach(function (t, i) { o['h' + i] = chip(150, 90 + i * 40, 220, t, 'neutral', 12, false); });
      o.cr = chip(150, 260, 220, '当前推理 τ_t', 'info', 12, false); o.lq = chip(150, 305, 220, '最新查询 q_t', 'warn', 12, false);
      o.pQ = wire('M262,305 L478,305', C.warn);
      o.pR = wire('M262,260 L478,288', C.info);
      o.x = label(370, 250, '推理没交给检索器', C.bad, 'middle', 12.5);
      o.ret = node(560, 300, 160, 56, '检索器', '', 'neutral');
      o.pD = wire('M642,300 L700,300', C.data);
      o.docs = node(760, 300, 100, 56, '排好序', '的文档', 'data');
      AB.forEach(function (a, i) {
        var y = 395 + i * 38;
        o['a' + i] = label(70, y, a[0], C.fg2, 'start', 12);
        o['b' + i] = { type: 'box', x: 250, y: y, w: 0, h: 22, rx: 4, anchor: 'l', fill: PAL[a[2]][0], stroke: PAL[a[2]][1], sw: 1.2, text: '', opacity: 0 };
        o['n' + i] = { type: 'text', x: 256, y: y, text: '', num: 0, fmt: 'fixed1', size: 12.5, weight: 700, color: PAL[a[2]][1], anchor: 'start', opacity: 0 };
      });
      return o;
    },
    steps: [
      { say: '智能体的上下文里有任务、之前的推理、查询、证据。可普通检索器只收到最新的那条查询（讲义第 105 页）。',
        set: join({ h0: fade(0), h1: fade(100), h2: fade(200), h3: fade(300), cr: fade(400), lq: fade(500), ret: pop(600) }, on('pQ', 800)), fx: [st('pQ', 900, C.warn, 4)] },
      { say: '当前推理说明了"为什么搜、要找什么"，却没交给检索器。',
        set: { x: fade(0) }, fx: [{ type: 'shake', obj: 'cr', at: 200 }] },
      { say: 'AgentIR 把检索器的输入改成"当前推理 + 查询"。它还学习哪些文档对这一步推理有用（讲义第 106 页）。',
        set: join(on('pR', 0), { x: fade(0, 300, 0), ret: mix(recolor('bad', 300), { text: { to: 'AgentIR', delay: 300 } }) }, on('pD', 900), { docs: pop(1100) }),
        fx: [st('pR', 100, C.info, 4), st('pQ', 300, C.warn, 4), st('pD', 1000, C.data, 3)] },
      { say: '难点是中间那些搜索没有现成标签。DR-Synth 拿最终问题和答案，给每一轮的候选文档重排序。排前的当正例，排后的当反例。',
        fx: [{ type: 'pulse', obj: 'ret', color: C.bad, at: 200 }, { type: 'pulse', obj: 'docs', color: C.data, at: 500 }] },
      { say: '讲义第 118 页的消融，用 Tongyi-DR 当智能体。只给查询 48.7%，加推理 55.5%。用 DR-Synth 训是 59.4%，两者都有 66.3%。',
        set: (function () { var s = {}; AB.forEach(function (a, i) { var d0 = i * 350; s['a' + i] = fade(d0); s['b' + i] = { opacity: { to: 1, dur: 150, delay: d0 }, w: { to: a[1] * 4.5, dur: 700, delay: d0, ease: 'out' } }; s['n' + i] = { opacity: { to: 1, dur: 150, delay: d0 }, x: { from: 256, to: 256 + a[1] * 4.5, dur: 700, delay: d0, ease: 'out' }, num: { to: a[1], dur: 700, delay: d0 } }; }); return s; })(),
        data: { '只给查询': { v: 48.7, at: 300 }, '+ 推理': { v: 55.5, at: 650 }, '+ DR-Synth': { v: 59.4, at: 1000 }, 'AgentIR': { v: 66.3, at: 1350 } } },
      { say: '两样都有用，合起来最好。讲义还比了给检索器哪段历史。当前推理的信号最强，把之前的文档也塞进去反而变差。',
        fx: [{ type: 'burst', obj: 'b3', color: C.bad, at: 300 }] }
    ]
  };

  VZ.register({
    id: 'c4-research', title: '深度研究智能体：多次搜索、推理-检索循环、引用核查、让检索器看推理',
    sources: [{ t: '第 10 讲 0:40–3:27（一次搜索 vs 多次搜索）', u: YT + '40' }, { t: '第 10 讲 20:13–21:36（FACT 引用核查）', u: YT + '1213' },
      { t: '第 10 讲 23:59–25:21（推理-检索循环）', u: YT + '1439' }, { t: '第 10 讲 50:01–55:39（AgentIR）', u: YT + '3001' }, { t: '讲义 lecture-10 第 3–11、47–57、105–123 页', u: L10 }],
    note: '场景 1、3、4 的问题、结论、判定和数字照讲义。页码是第 3–11、47–49、105–123 页。场景 4 的 48.7 / 55.5 / 59.4 / 66.3，是讲义第 118 页 Tongyi-DR 那一组。场景 2 是本机实跑。5 段小语料是照讲义内容写的。BM25 是手写的，k1 = 1.2、b = 0.75。策略写死，没有调模型，所以是示意。控制台和"6 条消息、33 个词"是真跑出来的。场景 3 的支持和不支持照讲义第 48 页，1/2 = 50% 是本机算的。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

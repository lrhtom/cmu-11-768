/* 09 · 第 15 讲（Daniel Fried）：工作流编排与大规模监控
 * 场景 1–3：客服工作流的节点、条件路由、共享状态、检查点 / 中断 / 恢复 / 重试照讲义第 7–17 页。控制台和状态面板的内容是
 *          本机验算脚本 用 LangGraph 1.2.18 真跑的输出（分类和起草用写死的规则代替 LLM，示意）。
 * 场景 4：Docent 调查的数照讲义第 26–31 页。场景 5：评审 2/10 → 7/10、Hodoscope 四步照第 33–37 页。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = 'https://www.cmu-agents.com/slides/lecture-15-orchestration-and-monitoring.pdf';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 1 : op }; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, w, h, size, mono) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: mono !== false, opacity: 0 }; }
  function grow(w, d0, dur) { return { opacity: { to: 1, dur: 100, delay: d0 || 0 }, w: { to: w, dur: dur || 700, delay: d0 || 0, ease: 'out' } }; }
  function hi(k, d0) { return { fill: { to: C[k + 'W'], dur: 250, delay: d0 || 0 }, stroke: { to: C[k], dur: 250, delay: d0 || 0 } }; }

  /* 工作流图（场景 1、3 共用） */
  var N = { rd: [80, 230, '读邮件'], cl: [210, 230, '分类'], sd: [350, 150, '查文档'], bt: [350, 310, '建 bug 单'], dr: [490, 230, '起草'], rv: [620, 330, '人工审核'], se: [740, 150, '发送'] };
  function graphObjs(o) {
    Object.keys(N).forEach(function (k) { o[k] = { type: 'box', x: N[k][0], y: N[k][1], w: 96, h: 40, rx: 9, fill: C.neutralW, stroke: C.neutral, sw: 1.4, text: N[k][2], size: 12.5, weight: 800, opacity: 1 }; });
    o.e1 = wire('M128,230 L162,230', C.fg3); o.e2 = wire('M258,222 C300,200 290,150 302,150', C.fg3); o.e3 = wire('M258,238 C300,260 290,310 302,310', C.fg3);
    o.e4 = wire('M398,150 C440,150 430,222 442,222', C.fg3); o.e5 = wire('M398,310 C440,310 430,238 442,238', C.fg3);
    o.e6 = wire('M538,222 C600,200 640,150 692,150', C.fg3); o.e7 = wire('M538,238 C580,280 570,330 572,330', C.fg3);
    o.e8 = wire('M620,310 C640,250 700,200 730,172', C.fg3);
    o.l2 = { type: 'text', x: 270, y: 168, text: '问题/账单', size: 10.5, weight: 700, color: C.fg3, anchor: 'middle', opacity: 1 };
    o.l3 = { type: 'text', x: 270, y: 296, text: 'bug', size: 10.5, weight: 700, color: C.fg3, anchor: 'middle', opacity: 1 };
    o.l7 = { type: 'text', x: 560, y: 300, text: '账单/紧急', size: 10.5, weight: 700, color: C.fg3, anchor: 'middle', opacity: 1 };
    return o;
  }
  var CODE1 = { lang: 'py', title: '本机实跑 · 分类节点里的路由（照讲义第 15 页）', src:
'intent = c["intent"]\n' +
'destination = (\n' +
'    "bug_tracking" if intent == "bug"\n' +
'    else "search_documentation"\n' +
'    if intent in {"question", "feature",\n' +
'                  "billing"}\n' +
'    else "draft_response")\n' +
'return Command(update={"classification": c},\n' +
'               goto=destination)\n' };
  var sc1 = {
    name: '条件路由', desc: '两封邮件走同一张图的不同路。密码问题走"查文档 → 起草 → 发送"。重复扣费被分成账单类，起草后多走一步人工审核（讲义第 6–8 页，本机用 LangGraph 真跑）。',
    code: CODE1, dataTitle: '这一封', data: { '分类': 0 }, dataFmt: { '分类': function (v) { return v === 1 ? 'question · low' : v === 2 ? 'billing · high' : '无'; } },
    bg: function (d) { title(d, '客服工作流：实线固定，条件边按分类走'); },
    objects: function () {
      var o = graphObjs({});
      o.m1 = cell(210, 470, '邮件 1：我忘了密码，怎么重置？', 'data', 300, 36, 12, false);
      o.m2 = cell(590, 470, '邮件 2：紧急！被扣了两次钱，请退款', 'bad', 300, 36, 12, false);
      return o;
    },
    steps: [
      { say: '同一张图：读邮件 → 分类 → 起草 → 发送。分类决定先查文档、建 bug 单，还是直接起草。必要时先人工审核。', fx: [{ type: 'pulse', obj: 'cl', color: C.info, at: 200 }] },
      { say: '邮件 1（密码问题）进来：读邮件，交给分类。', set: { m1: pop(0), rd: hi('data', 300) }, fx: [st('e1', 400, C.data, 3)] },
      { say: '分类结果是 question，紧急程度 low。路由选"查文档"。', set: { cl: hi('info', 0) }, fx: [st('e2', 300, C.data, 3)], hl: [1, 2, 3, 4, 5, 6, 7], data: { '分类': { v: 1, at: 200 } },
        log: [{ s: 'classify_intent -> {"intent": "question", "urgency": "low", ...}', at: 200 }] },
      { say: '查到重置指南，起草。不需要审核，直接发送。', set: { sd: hi('data', 0), dr: hi('info', 500), se: hi('ok', 1000) }, fx: [st('e4', 200, C.data, 3), st('e6', 700, C.ok, 3)],
        log: [{ s: 'search_documentation -> ["Reset guide: ..."]', at: 200 }, { s: 'send_reply -> {"sent": true}', at: 1000 }] },
      { say: '邮件 2（重复扣费）进来：分类成 billing、紧急程度 high，同样先查文档。', set: { m2: pop(0), dr: hi('neutral', 0), se: hi('neutral', 0) }, data: { '分类': { v: 2, at: 500 } },
        fx: [st('e1', 300, C.bad, 3), st('e2', 700, C.bad, 3)], log: [{ s: 'classify_intent -> {"intent": "billing", "urgency": "high", ...}', at: 500 }] },
      { say: '起草之后，因为是账单类，条件边把它送去人工审核。要不要审核，取决于模型的分类。', set: { dr: hi('info', 0), rv: hi('warn', 500) }, fx: [st('e4', 0, C.bad, 3), st('e7', 400, C.warn, 4), { type: 'ripple', obj: 'rv', color: C.warn, at: 900 }] },
      { say: '一致性就来自这里。退款必须过审批，这条规矩写在图里，不靠模型自觉。', fx: [{ type: 'pulse', obj: 'rv', color: C.warn, at: 200 }] }
    ]
  };

  /* ---------------- 场景 2：共享状态 ---------------- */
  var FIELDS = [['email_content', '"Urgent: Acme Cloud charged our company twice …"', 'read_email'], ['classification', '{intent: billing, urgency: high, topic: duplicate charge}', 'classify_intent'],
    ['search_results', '["Billing-review policy: refunds need employee approval"]', 'search_documentation'], ['draft_response', '"Draft for \'duplicate charge\': …"', 'draft_response'], ['review_decision', '{approved: true, by: employee}', 'human_review']];
  var CODE2 = { lang: 'py', title: '讲义第 11–12 页 · 状态和节点', src:
'class SupportState(TypedDict, total=False):\n' +
'    email_id: str\n' +
'    email_content: str\n' +
'    classification: dict\n' +
'    search_results: list[dict]\n' +
'    draft_response: str\n' +
'    review_decision: dict\n' +
'\n' +
'def classify_intent(state):\n' +
'    ...\n' +
'    return {"classification": classification}\n' };
  var sc2 = {
    name: '共享状态', desc: '节点之间传一份共享状态。每个节点读状态、做事，只返回它改了的字段，框架负责合并（讲义第 11–13 页，字段的值来自本机实跑的那封重复扣费邮件）。',
    code: CODE2, dataTitle: '已填的字段', data: { '字段数': 0 },
    bg: function (d) { title(d, 'SupportState：一路往里填'); d.text(120, 80, '节点', { anchor: 'middle', size: 12, weight: 750, color: C.fg2 }); d.text(560, 80, '它返回的更新', { anchor: 'middle', size: 12, weight: 750, color: C.fg2 }); },
    objects: function () {
      var o = {};
      FIELDS.forEach(function (f, i) {
        var y = 125 + i * 72;
        o['n' + i] = cell(120, y, f[2], 'info', 200, 36, 12);
        o['w' + i] = wire('M222,' + y + ' L278,' + y, C.info, 0);
        o['k' + i] = cell(370, y, f[0], 'warn', 170, 36, 12);
        o['v' + i] = { type: 'text', x: 465, y: y, text: f[1], size: 10.5, weight: 700, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
      });
      return o;
    },
    steps: (function () {
      var says = ['读邮件节点只返回 email_content。', '分类节点读 email_content，只返回 classification（账单、紧急）。', '查文档节点读 classification，只返回 search_results。', '起草节点读邮件和检索结果，只返回 draft_response。', '审核节点在人批准后返回 review_decision。'];
      var S = FIELDS.map(function (f, i) {
        var s = {}; s['n' + i] = pop(0); s['w' + i] = { opacity: { to: 1, dur: 200, delay: 300 }, flow: { to: 1, dur: 200, delay: 300 } }; s['k' + i] = pop(600); s['v' + i] = fade(900);
        return { say: says[i], set: s, fx: [st('w' + i, 300, C.info, 3)], hl: i === 1 ? [9, 10, 11] : [i + 2], data: { '字段数': { v: i + 1, at: 800 } } };
      });
      S.push({ say: '节点只关心自己读写的几个字段，所以能单独测试。给定输入、固定模型输出，再检查它返回的更新和路由（讲义第 20 页）。', fx: [{ type: 'pulse', obj: 'n1', color: C.info, at: 200 }] });
      return S;
    })()
  };

  /* ---------------- 场景 3：检查点、中断、重试 ---------------- */
  var CODE3 = { lang: 'py', title: '本机实跑 · 重试、中断、恢复（LangGraph 1.2.18）', src:
'g.add_node("search_documentation",\n' +
'    search_documentation,\n' +
'    retry_policy=RetryPolicy(max_attempts=3,\n' +
'        retry_on=TimeoutError))\n' +
'def human_review(state):\n' +
'    decision = interrupt({"draft": ...})\n' +
'    ...\n' +
'graph = g.compile(checkpointer=InMemorySaver())\n' +
'graph.invoke(Command(resume={"approved": True}),\n' +
'    {"configurable": {"thread_id": "t2"}})\n' };
  var sc3 = {
    name: '检查点与中断', desc: '查文档超时一次，重试策略让它重做。起草后 interrupt 让工作流停下，状态存进检查点。用同一个执行 ID 传入人的决定来恢复。批准才发送，拒绝就结束（讲义第 16–17 页，本机实跑）。',
    code: CODE3, dataTitle: '执行 t2 的检查点', data: { '查文档尝试次数': 0, 'next': 0, 'sent': 0 },
    dataFmt: { 'next': function (v) { return v === 1 ? "('human_review',)" : v === 2 ? '()' : '无'; }, 'sent': function (v) { return v ? 'True' : 'False'; } },
    bg: function (d) { title(d, '可恢复的进度：重试、暂停、用同一个 ID 继续'); },
    objects: function () {
      var o = graphObjs({});
      o.x1 = { type: 'text', x: 350, y: 112, text: '报错 TimeoutError', size: 11.5, weight: 800, mono: true, color: C.bad, anchor: 'middle', opacity: 0 };
      o.ck = { type: 'box', x: 620, y: 440, w: 300, h: 60, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.4, text: '检查点：thread_id = t2', sub: "状态全部存下，next = ('human_review',)", subMono: true, subSize: 10.5, size: 12.5, weight: 800, mono: false, opacity: 0 };
      o.ckw = wire('M620,352 L620,408', C.info, 0);
      o.ok = cell(240, 440, '恢复：resume={approved: True}', 'ok', 300, 36, 12, false);
      o.no = cell(240, 500, '另一个执行 t3：approved: False → 不发送就结束', 'bad', 380, 34, 11.5, false);
      return o;
    },
    steps: [
      { say: '重复扣费那封邮件走到查文档：第一次调用故意超时。', set: { sd: hi('bad', 0), x1: pop(200) }, fx: [{ type: 'shake', obj: 'sd', at: 300 }], data: { '查文档尝试次数': { v: 1, at: 200 } } },
      { say: '重试策略只对临时错误重做这个节点，这里是 TimeoutError。第 2 次成功了，前面的工作不用重来。', set: { sd: hi('data', 200), x1: { opacity: { to: 0, dur: 300, delay: 200 } } }, hl: [1, 2, 3, 4], data: { '查文档尝试次数': { v: 2, at: 300 } },
        fx: [{ type: 'ripple', obj: 'sd', color: C.ok, at: 400 }], log: [{ s: 'search attempts = 2', at: 400 }] },
      { say: '起草完，路由去人工审核。审核节点调用 interrupt：工作流停下，把草稿交给应用去问人。', set: { dr: hi('info', 0), rv: hi('warn', 500) }, fx: [st('e4', 0, C.data, 3), st('e7', 400, C.warn, 4)], hl: [5, 6],
        log: [{ s: 'interrupt: {"draft": "...", "question": "approve / edit / reject?"}', at: 700 }] },
      { say: '此刻状态全部存在检查点里，下一步停在 human_review。还什么都没发。', set: join({ ck: pop(0) }, { ckw: { opacity: { to: 1, dur: 200 }, flow: { to: 1, dur: 200 } } }), fx: [st('ckw', 0, C.info, 3)], hl: [8], data: { 'next': { v: 1, at: 300 }, 'sent': { v: 0, at: 300 } },
        log: [{ s: "next = ('human_review',) | sent = False", at: 400 }] },
      { say: '员工批准后，应用用同一个 thread_id 恢复，把决定传进去。审核节点从中断处继续，然后发送。', set: { ok: pop(0), se: hi('ok', 700) }, fx: [st('e8', 400, C.ok, 4)], hl: [9, 10], data: { 'next': { v: 2, at: 800 }, 'sent': { v: 1, at: 800 } },
        log: [{ s: 'human_review -> {"review_decision": {"approved": true, ...}}', at: 400 }, { s: 'send_reply -> {"sent": true}', at: 800 }] },
      { say: '换一个执行 ID 再来一遍，这次人拒绝。工作流直接结束，不发送。这对应讲义第 21 页"回复被拒，结束不发送"那条测试。', set: { no: pop(0) }, fx: [{ type: 'shake', obj: 'no', at: 400 }],
        log: [{ s: 'human_review -> {"review_decision": {"approved": false, ...}}', at: 300 }, { s: 'next = () | sent = False', at: 500 }] },
      { say: '节点粒度决定能保住多少。检索结果在生成前存下了，生成崩溃时只需重做生成（讲义第 16 页）。', fx: [{ type: 'pulse', obj: 'ck', color: C.info, at: 200 }] }
    ]
  };

  /* ---------------- 场景 4：Docent 调查 ---------------- */
  var CODE4 = { lang: 'text', title: '讲义第 27、30 页 · 给 Docent 的提示（节选）', src:
'with docent, For each failed run, compare it\n' +
'to a successful run from the other model on\n' +
'the same task and write a short paragraph\n' +
'explaining the cause.\n' +
'\n' +
'with docent, Filter to tasks where neither\n' +
'model times out across all rollouts ...\n' +
'compute the macro-average reward per model\n' +
'on this subset.\n' };
  var sc4 = {
    name: '查一次退步', desc: '同一个外壳，Terminal-Bench 上 GPT-5.1 Codex（27%）比 GPT-5 Codex（40%）差。成对比较失败运行，归纳失败模式，再用运行元数据检验。原来是超时（讲义第 26–31 页）。',
    code: CODE4, dataTitle: '讲义第 26–31 页', data: { '要解释的失败运行': 0 },
    bg: function (d) { title(d, '为什么新版本分更低？'); d.text(60, 90, 'GPT-5 Codex', { size: 12.5, weight: 800, color: C.data }); d.text(60, 130, 'GPT-5.1 Codex', { size: 12.5, weight: 800, color: C.warn }); },
    objects: function () {
      var o = {}, SC = 6;
      [['p', 40, 27, '总成功率（89 个任务，518 次运行）', 90], ['t', 32, 50, '超时比例（219 / 265 次计分运行）', 250], ['q', 42.9, 50.0, '只看都不超时的 28 个任务：平均成功率', 410]].forEach(function (r) {
        o[r[0] + 'h'] = { type: 'text', x: 220, y: r[4] - 30, text: r[3], size: 12, weight: 750, color: C.fg2, anchor: 'start', opacity: 0 };
        o[r[0] + 'a'] = { type: 'box', x: 220, y: r[4], w: 0, h: 18, rx: 3, anchor: 'l', fill: C.data, stroke: 'none', opacity: 0 };
        o[r[0] + 'b'] = { type: 'box', x: 220, y: r[4] + 40, w: 0, h: 18, rx: 3, anchor: 'l', fill: C.warn, stroke: 'none', opacity: 0 };
        o[r[0] + 'at'] = { type: 'text', x: 228 + r[1] * SC, y: r[4], text: r[0] === 'q' ? '0.429' : r[1] + '%', size: 12, weight: 800, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
        o[r[0] + 'bt'] = { type: 'text', x: 228 + r[2] * SC, y: r[4] + 40, text: r[0] === 'q' ? '0.500' : r[2] + '%', size: 12, weight: 800, mono: true, color: C.fg, anchor: 'start', opacity: 0 };
      });
      o.fm = { type: 'box', x: 680, y: 210, w: 300, h: 70, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.3, text: '归纳出的失败模式', sub: '5.1：交付前时间用完。5：交付了但形式常不对', subMono: false, subSize: 10.5, size: 12.5, weight: 800, opacity: 0 };
      o.rev = { type: 'box', x: 520, y: 510, w: 340, h: 40, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.5, text: '排名反过来了：退步主要来自超时', size: 12.5, weight: 800, opacity: 0 };
      return o;
    },
    steps: [
      { say: '同样的外壳，89 个任务、518 次运行：GPT-5 Codex 成功 40%，GPT-5.1 Codex 只有 27%。只看分数，看不出为什么。', set: { ph: fade(0), pa: grow(40 * 6, 200), pb: grow(27 * 6, 400), pat: fade(900), pbt: fade(1100) } },
      { say: '先让工具成对比较，给每个失败运行写一段失败原因。对照的是另一个模型在同一任务上的成功运行。要解释的失败一共 108 个（79 + 29）。', fx: [{ type: 'pulse', obj: 'pb', color: C.warn, at: 300 }], hl: [1, 2, 3, 4], data: { '要解释的失败运行': { v: 108, at: 400 } } },
      { say: '看具体的一对，是"从图片还原代码"那题。失败的那次一直试读不出来的 ASCII 渲染，很晚才装 OCR。装完，时间也用完了。', fx: [{ type: 'shake', obj: 'pb', at: 400 }] },
      { say: '归纳失败模式。5.1 往往在交付之前时间用完。5 是交付了，但形式常常不对。', set: { fm: pop(0) } },
      { say: '提出假设"是超时"，用运行元数据检验：超时比例 GPT-5 是 32%，GPT-5.1 是 50%。', set: { th: fade(0), ta: grow(32 * 6, 200), tb: grow(50 * 6, 400), tat: fade(900), tbt: fade(1100) }, hl: [6, 7, 8, 9] },
      { say: '只看两边都不超时的 28 个任务，平均成功率 0.429 对 0.500。5.1 反而更好，排名反过来了。', set: { qh: fade(0), qa: grow(42.9 * 6, 200), qb: grow(50.0 * 6, 400), qat: fade(900), qbt: fade(1100), rev: pop(1300) }, fx: [{ type: 'burst', obj: 'rev', color: C.ok, at: 1600 }] },
      { say: '教训：分数下降不等于能力下降。要回到轨迹里成对地看，再用数据检验你的假设。讲义也提醒了这一分析的局限。', fx: [{ type: 'pulse', obj: 'qb', color: C.ok, at: 200 }] }
    ]
  };

  /* ---------------- 场景 5：发现没想到的行为 ---------------- */
  var STEP5 = [['1 总结', '每个动作压成一句行为描述', 'data'], ['2 嵌入', '所有组嵌入、投影到二维', 'info'], ['3 密度差', '按组估密度，叠出独有的动作', 'warn'], ['4 人工复核', '人判断这些动作有没有问题', 'ok']];
  var sc5 = {
    name: '发现没想到的行为', desc: 'LLM 评审只会标记你让它找的东西。把大量动作总结、嵌入，再按组比较密度。这样才能看到事先没想到要查的行为（讲义第 33–37 页，Hodoscope 和 Commit0 的例子）。',
    dataTitle: '讲义第 33 页', data: { '评审给的可疑度': 0 }, dataFmt: { '评审给的可疑度': function (v) { return Math.round(v) + ' / 10'; } },
    bg: function (d) { title(d, '评审要提示，聚类能自己冒出来'); },
    objects: function () {
      var o = {};
      o.act = cell(200, 100, 'git log --all（翻看"未来"的提交）', 'neutral', 330, 36, 12, false);
      o.judge = { type: 'box', x: 560, y: 100, w: 240, h: 50, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.4, text: '', num: 0, fmt: 'int', pre: 'LLM 评审：可疑度 ', post: ' / 10', size: 13, weight: 800, mono: false, opacity: 0 };
      o.hint = cell(560, 160, '+ 一个记录这个漏洞的 issue 链接', 'warn', 280, 32, 11.5, false);
      STEP5.forEach(function (s, i) { o['s' + i] = { type: 'box', x: 120 + i * 205, y: 290, w: 180, h: 64, rx: 10, fill: C[s[2] + 'W'], stroke: C[s[2]], sw: 1.4, text: s[0], sub: s[1], subMono: false, subSize: 10.5, size: 13, weight: 800, opacity: 0 }; if (i) o['sw' + i] = wire('M' + (210 + (i - 1) * 205) + ',290 L' + (30 + i * 205) + ',290', C.fg3, 0); });
      o.c0 = { type: 'box', x: 430, y: 420, w: 640, h: 50, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.4, text: 'Commit0：一簇"Git 操作"里，智能体在从早期提交找回被删掉的代码', sub: '基准要它重写删掉的代码，可早期提交还留在 Git 历史里', subMono: false, subSize: 10.5, size: 12.5, weight: 800, opacity: 0 };
      o.scale = { type: 'text', x: 430, y: 510, text: '讲义第 38 页：一份事故复盘说已复核超过 70 亿条智能体轨迹、用了超过 300 万 GPU 小时', size: 11.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '一个智能体在 SWE-bench 里执行了 git log --all，翻看仓库"未来"的提交。这是一个已知的漏洞。', set: { act: pop(0) } },
      { say: '让 Claude Opus 4.6 当评审：它只给 2/10 的可疑度，没看出问题。', set: { judge: mix(pop(0), { num: { to: 2, dur: 600, delay: 200 } }) }, data: { '评审给的可疑度': { v: 2, at: 400 } } },
      { say: '给它看一个记录这个漏洞的 issue 链接之后，改成 7/10。评审要有人提示该标记哪种行为。可这正是我们不知道的。', set: { hint: pop(0), judge: { num: { to: 7, dur: 600, delay: 400 } } }, fx: [{ type: 'ripple', obj: 'judge', color: C.warn, at: 900 }], data: { '评审给的可疑度': { v: 7, at: 700 } } },
      (function () { var s = {}; STEP5.forEach(function (x, i) { s['s' + i] = pop(i * 250); if (i) s['sw' + i] = { opacity: { to: 1, dur: 200, delay: i * 250 - 100 }, flow: { to: 1, dur: 200, delay: i * 250 - 100 } }; });
        return { say: '另一条路是聚类，即 Hodoscope 的四步。总结每个动作 → 嵌入并投影 → 按组比较密度 → 人来复核。', set: s, fx: [st('sw1', 200, C.fg3, 2), st('sw2', 450, C.fg3, 2), st('sw3', 700, C.fg3, 2)] }; })(),
      { say: '关键在第 3 步：对比不同模型或设置，找出某一组特别多的簇（讲义里标成红色）。讲义举了 Commit0、ImpossibleBench、iQuest / SWE-bench 三个例子。每个都要回到原始动作，结合上下文判断。', fx: [{ type: 'pulse', obj: 's2', color: C.warn, at: 200 }, { type: 'ripple', obj: 's3', color: C.ok, at: 900 }] },
      { say: '在 Commit0 上，一簇"Git 操作"暴露了问题。智能体在从早期提交里找回被删的代码。这是一个事先没想到要查的作弊行为。', set: { c0: pop(0) }, fx: [{ type: 'pulse', obj: 's3', color: C.ok, at: 300 }] },
      { say: '规模越来越大。智能体产生的上下文，已经多到人没法完整复核。这类自动化的调查工具会越来越重要。', set: { scale: fade(0) } }
    ]
  };

  VZ.register({
    id: 'c9-graph', title: '工作流编排与大规模监控：LangGraph 客服流程、Docent 调查、行为聚类',
    sources: [{ t: '第 15 讲讲义（Daniel Fried）', u: PDF }],
    note: '工作流的结构和代码照讲义第 6–17 页。场景 1–3 的控制台和状态值，是本机用 LangGraph 1.2.18 真跑的。分类和起草用写死的规则代替 LLM，是示意。场景 4、5 的数字照讲义第 26–38 页。这一讲录像暂不可用，说明依据讲义。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

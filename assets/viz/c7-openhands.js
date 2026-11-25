/* 07 · 第 14 讲 —— OpenHands SDK 里一次动作的数据流，以及工具、确认、压缩、远程执行
 * 代码面板是讲义 lecture-14 第 14–20 页幻灯片上的代码（为了每行不超过 46 列，有几处折行）；场景 3 末尾几行、
 * 场景 4 的参数含义、场景 5 的 RemoteConversation / WebSocket / detect_platform 来自 OpenHands 官方文档（已用 WebFetch 核对）。
 * 场景 1 的三轮动作（ls、建 FACTS.txt、cat）和 8 个事件、场景 3 的 rm / ls build 两条命令、场景 4 压缩后保留 4 条尾部事件都是示意，
 * 计数由 本机验算脚本 的 G 段算出；场景 2 的控制台和变量来自 verify.py 的 F 段（本机用 pydantic 的 BaseModel 代替 OpenHands 的 Action / Observation 基类实跑）。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = { t: '讲义 lecture-14 第 14–20 页', u: 'https://www.cmu-agents.com/slides/lecture-14-openhands.pdf' };
  var DOC = { t: 'OpenHands 文档 · Hello World', u: 'https://docs.openhands.dev/sdk/guides/hello-world' };
  var DOC_SEC = { t: 'OpenHands 文档 · Security（确认策略）', u: 'https://docs.openhands.dev/sdk/guides/security' };
  var DOC_CON = { t: 'OpenHands 文档 · Context Condenser', u: 'https://docs.openhands.dev/sdk/guides/context-condenser' };
  var DOC_DKR = { t: 'OpenHands 文档 · Docker Sandbox', u: 'https://docs.openhands.dev/sdk/guides/agent-server/docker-sandbox' };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op) {
    var f = PAL[k];
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: f[0], stroke: f[1], sw: 1.7, text: t, sub: sub, subMono: false, subSize: 11.5, size: 13.5, weight: 700, opacity: op == null ? 0 : op };
  }
  function group(x, y, w, h, k) { return { type: 'box', x: x, y: y, w: w, h: h, rx: 14, fill: C.bg, stroke: PAL[k][1], sw: 1.4, dasharray: '6 4', text: '', opacity: 0 }; }
  function label(x, y, t, col, anchor) { return { type: 'text', x: x, y: y, text: t, size: 12.5, weight: 700, color: col, anchor: anchor || 'start', opacity: 0 }; }
  function path(d, col, extra) { return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, opacity: 0, arrow: col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : col === C.neutral ? 'neutral' : 'data' }, extra || {}); }
  function ghost(d) { return { type: 'path', d: d, stroke: 'none', sw: 0, opacity: 0 }; }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function chip(x, y, t, w, k, mono) { var f = PAL[k || 'data']; return { type: 'box', x: x, y: y, w: w || 150, h: 28, rx: 6, fill: f[0], stroke: f[1], sw: 1.3, text: t, mono: mono !== false, size: 11.5, weight: 650, opacity: 0, trail: { n: 4, gap: 40 } }; }
  /* 沿路径走一趟：从这一步开头就出现在起点，走到终点后淡出 */
  function ride(dur, delay, text) { var o = { t: { from: 0, to: 1, dur: dur, delay: delay || 0, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: (delay || 0) + dur + 100 } }; if (text) o.text = { to: text, delay: 0 }; return o; }

  /* ---------------- 场景 1：一次动作的数据流 ---------------- */
  var SLOT = function (i) { return 176 + i * 38; };
  var TY = { term: 245, file: 305, task: 365 };
  var CODE1 = { lang: 'py', title: '讲义第 14–15 页 · hello world', src:
'llm = LLM(\n' +
'    model=os.getenv("LLM_MODEL", "gpt-5.5"),\n' +
'    api_key=os.getenv("LLM_API_KEY"),\n' +
')\n' +
'agent = Agent(\n' +
'    llm=llm,\n' +
'    tools=[\n' +
'        Tool(name=TerminalTool.name),\n' +
'        Tool(name=FileEditorTool.name),\n' +
'        Tool(name=TaskTrackerTool.name),\n' +
'    ],\n' +
')\n' +
'cwd = os.getcwd()\n' +
'conversation = Conversation(\n' +
'    agent=agent, workspace=cwd)\n' +
'conversation.send_message(\n' +
'    "3 project facts in FACTS.txt")\n' +
'conversation.run()\n' };
  var EV = [['消息 · 用户', 'data'], ['动作 · terminal', 'warn'], ['观察 · terminal', 'ok'], ['动作 · file_editor', 'warn'], ['观察 · file_editor', 'ok'], ['动作 · terminal', 'warn'], ['观察 · terminal', 'ok'], ['动作 · finish', 'warn']];
  function ev(i, delay) { var s = {}; s['e' + i] = VZ.fly(230, SLOT(i), delay, 700); return s; }
  var sc1 = {
    name: '一次动作', desc: 'send_message 把任务存成第一个事件。run() 循环：事件 → 模型 → 动作 → 工具在工作区执行 → 观察存回对话。直到模型宣布结束。',
    code: CODE1, dataTitle: '对话里的事件', data: { '事件': 0, '动作': 0, '观察': 0 },
    bg: function (d) { title(d, 'OpenHands：一次"动作-观察"在各部件之间怎么流动'); },
    objects: function () {
      var o = {};
      o.convG = group(230, 310, 180, 380, 'data');
      o.convT = label(230, 142, 'Conversation · 事件', C.data, 'middle');
      o.wsG = group(720, 320, 190, 300, 'ok');
      o.wsT = label(720, 192, 'Workspace（当前目录）', C.ok, 'middle');
      o.pu = path('M145,76 L230,76 L230,118', C.data);
      o.pca = path('M322,290 L403,290', C.data);
      o.pal = path('M465,268 L465,129', C.data);
      o.pla = path('M495,129 L495,268', C.warn);
      o.paw = path('M557,295 L638,295', C.warn);
      o.pwa = path('M638,322 L557,322', C.ok);
      o.pac = path('M403,322 L322,322', C.data);
      o.rT = ghost('M480,100 L480,300 L600,300 L720,' + TY.term);
      o.rF = ghost('M480,100 L480,300 L600,300 L720,' + TY.file);
      o.oT = ghost('M720,' + TY.term + ' L600,322 L480,322');
      o.oF = ghost('M720,' + TY.file + ' L600,322 L480,322');
      o.user = node(90, 76, 110, 46, '用户', '', 'neutral');
      o.llm = node(480, 100, 160, 56, 'LLM', 'gpt-5.5（默认值）', 'info');
      o.ag = node(480, 300, 150, 60, 'Agent', 'LLM + 3 件工具', 'info');
      o.tT = node(720, TY.term, 160, 40, 'TerminalTool', '', 'warn');
      o.tF = node(720, TY.file, 160, 40, 'FileEditorTool', '', 'warn');
      o.tK = node(720, TY.task, 160, 40, 'TaskTrackerTool', '', 'warn');
      o.facts = chip(720, 430, 'FACTS.txt', 110, 'data');
      EV.forEach(function (e, i) { o['e' + i] = mix(chip(i === 0 ? 90 : 480, i === 0 ? 76 : 300, e[0], 160, e[1], false), { trail: null }); });
      o.aT = mix(chip(480, 100, 'terminal: ls', 150, 'warn'), { along: 'rT', t: 0 });
      o.aF = mix(chip(480, 100, 'file_editor: create', 170, 'warn'), { along: 'rF', t: 0 });
      o.oTc = mix(chip(720, TY.term, '输出', 110, 'ok'), { along: 'oT', t: 0 });
      o.oFc = mix(chip(720, TY.file, '文件已创建', 110, 'ok', false), { along: 'oF', t: 0 });
      return o;
    },
    steps: [
      { say: '讲义第 14 页：先配一个 Agent。它是一个 LLM 加三件工具：终端、文件编辑器、任务清单。模型名、API 密钥都从环境变量读。',
        set: { llm: pop(0), ag: pop(200), wsG: fade(300, 400), wsT: fade(400), tT: pop(500), tF: pop(600), tK: pop(700) }, hl: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { say: '第 15 页：Conversation 把这个 Agent 和一个工作区绑在一起，这里是当前目录。它记下任务、动作、观察。',
        set: mix({ convG: fade(0, 400), convT: fade(100), user: pop(300) }, on('pu', 500), on('pca', 600), on('pac', 700)), hl: [13, 14, 15] },
      { say: 'send_message：用户的任务成了对话里的第一个事件。',
        set: ev(0, 100), fx: [st('pu', 0, C.data, 4), { type: 'ripple', obj: 'convG', color: C.data, at: 800 }], data: { '事件': { v: 1, at: 700 } }, hl: [16, 17] },
      { say: 'run() 开始循环。Agent 把对话里的事件整理成发给模型的消息，送进 LLM。',
        set: on('pal', 400), fx: [st('pca', 0, C.data, 4), { type: 'pulse', obj: 'ag', color: C.info, at: 600 }, st('pal', 600, C.data, 4), { type: 'pulse', obj: 'llm', color: C.info, at: 1200 }], hl: [18] },
      { say: '模型返回一个动作（工具调用，示意：用终端 ls 看看项目）。Agent 把它交给终端工具执行，动作本身也记成一个事件。',
        set: join(on('pla'), on('paw', 600), { aT: ride(1600, 100, 'terminal: ls') }, ev(1, 1000)),
        fx: [st('pla', 100, C.warn, 3), st('paw', 800, C.warn, 3), { type: 'pulse', obj: 'tT', color: C.warn, at: 1700 }], data: { '事件': { v: 2, at: 1300 }, '动作': { v: 1, at: 1300 } } },
      { say: '终端在工作区里跑完，输出作为观察回到 Agent，再存进对话。下一轮模型就能看到它。',
        set: join(on('pwa'), { oTc: ride(1300, 100) }, ev(2, 1200)),
        fx: [st('pwa', 100, C.ok, 3), st('pac', 900, C.ok, 3)], data: { '事件': { v: 3, at: 1500 }, '观察': { v: 1, at: 1500 } } },
      { say: '下一轮：模型让文件编辑器写出 FACTS.txt（示意）。观察回来，对话里又多两个事件。',
        set: join({ aF: ride(1500, 0, 'file_editor: create'), facts: pop(1500), oFc: ride(1200, 1700) }, ev(3, 900), ev(4, 2600)),
        fx: [st('paw', 700, C.warn, 3), { type: 'pulse', obj: 'tF', color: C.warn, at: 1500 }, st('pwa', 1800, C.ok, 3), st('pac', 2500, C.ok, 3)],
        data: { '事件': { v: 5, at: 3000 }, '动作': { v: 2, at: 1200 }, '观察': { v: 2, at: 3000 } } },
      { say: '再用终端检查一遍文件（示意），然后模型宣布完成，run() 返回。三轮动作 + 结束，一共 8 个事件。',
        set: join({ aT: ride(1500, 0, 'terminal: cat FACTS.txt'), oTc: ride(1200, 1700) }, ev(5, 900), ev(6, 2600), ev(7, 3400)),
        fx: [st('paw', 700, C.warn, 3), { type: 'pulse', obj: 'tT', color: C.warn, at: 1500 }, st('pwa', 1800, C.ok, 3), st('pac', 2500, C.ok, 3), { type: 'ripple', obj: 'convG', color: C.ok, at: 4100 }],
        data: { '事件': { v: 8, at: 4000 }, '动作': { v: 4, at: 4000 }, '观察': { v: 3, at: 3200 } } }
    ]
  };

  /* ---------------- 场景 2：自定义工具 ---------------- */
  var CODE2 = { lang: 'py', title: '讲义第 16 页 · 自定义 grep 工具（节选）', src:
'class GrepAction(Action):\n' +
'    pattern: str = Field(\n' +
'        description="Regex to search for"\n' +
'    )\n' +
'    path: str = Field(default=".")\n' +
'\n' +
'class GrepObservation(Observation):\n' +
'    matches: list[str] = Field(\n' +
'        default_factory=list\n' +
'    )\n' };
  var sc2 = {
    name: '自定义工具', desc: '一个工具 = 带类型的动作 + 执行器 + 观察。动作的字段变成模型看到的参数说明。模型填的参数先校验，再执行。',
    code: CODE2, dataTitle: '这一次调用', data: { 'required': '—', 'pattern': '—', 'path': '—', 'matches': 0 },
    bg: function (d) { title(d, '自定义工具：动作（带类型）→ 执行器 → 观察'); },
    objects: function () {
      var o = {};
      o.psc = path('M240,252 L370,128', C.data);
      o.pcall = path('M410,128 L285,252', C.warn);
      o.pex = path('M312,300 L373,300', C.warn);
      o.pfile = path('M450,331 L450,386', C.neutral);
      o.pob = path('M527,300 L578,300', C.ok);
      o.pback = path('M690,252 L512,128', C.ok);
      o.llm = node(450, 100, 150, 54, 'LLM', '', 'info');
      o.act = node(190, 300, 240, 92, 'GrepAction', 'pattern: str（必填）· path: str = "."', 'data');
      o.exe = node(450, 300, 150, 60, '执行器', '在工作区里搜索', 'warn');
      o.obs = node(690, 300, 220, 92, 'GrepObservation', 'matches: list[str]', 'ok');
      o.f0 = chip(450, 404, 'src/app.py', 130, 'neutral'); o.f1 = chip(450, 440, 'src/util.py', 130, 'neutral'); o.f2 = chip(450, 476, 'README.md', 130, 'neutral');
      o.call = chip(450, 100, '{"pattern": "TODO"}', 190, 'warn');
      o.bad = chip(450, 100, '{"pattern": 3}', 150, 'bad');
      o.err = label(190, 372, '', C.bad, 'middle');
      return o;
    },
    steps: [
      { say: '讲义第 16 页：动作是带类型的输入。pattern 是要搜的正则，path 默认是当前目录。观察是一个 matches 列表。',
        set: { llm: pop(0), act: pop(200), exe: pop(400), obs: pop(600), f0: fade(700), f1: fade(800), f2: fade(900) }, hl: [1, 2, 3, 4, 5, 7, 8, 9, 10] },
      { say: '这些字段变成模型看到的工具参数说明。pattern 必填、带说明，path 有默认值（本机实跑生成的 JSON Schema）。',
        set: on('psc'), fx: [st('psc', 0, C.data, 5), { type: 'pulse', obj: 'llm', color: C.info, at: 700 }],
        log: [{ s: '>>> schema["required"]', at: 100 }, { s: "['pattern']", at: 600 }, { s: '>>> schema["properties"]["path"]', at: 900 }, { s: '{"default": ".", "title": "Path", "type": "string"}', at: 1500 }],
        data: { 'required': { v: "['pattern']", at: 600 } }, hl: [2, 3, 5] },
      { say: '模型发来参数 {"pattern": "TODO"}，只填了 pattern。校验后得到一个带类型的动作，path 自动用默认值 "."。',
        set: join(on('pcall'), { call: mix(fade(0, 150), { x: { to: 190, dur: 900, delay: 100, ease: 'inOut' }, y: { to: 238, dur: 900, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: 1100 } }), act: { sub: { to: "pattern='TODO' · path='.'", delay: 1100 } } }),
        fx: [st('pcall', 100, C.warn, 4), { type: 'pulse', obj: 'act', color: C.data, at: 1100 }],
        log: [{ s: '>>> GrepAction(**{"pattern": "TODO"})', at: 100 }, { s: "GrepAction(pattern='TODO', path='.')", at: 1100 }],
        data: { 'pattern': { v: 'TODO', at: 1100 }, 'path': { v: '.', at: 1100 } }, hl: [1, 2, 5] },
      { say: '执行器拿着这个动作在工作区里搜，示意的三个文件。找到 3 处，装进观察对象。',
        set: join(on('pex'), on('pfile', 300), on('pob', 1100), { obs: { sub: { to: 'matches: 3 条', delay: 1300 } } }),
        fx: [st('pex', 0, C.warn, 3), { type: 'pulse', obj: 'exe', color: C.warn, at: 400 }, st('pfile', 400, C.neutral, 3), { type: 'flash', obj: 'f0', color: C.ok, at: 800 }, { type: 'flash', obj: 'f1', color: C.ok, at: 900 }, { type: 'flash', obj: 'f2', color: C.ok, at: 1000 }, st('pob', 1100, C.ok, 3), { type: 'ripple', obj: 'obs', color: C.ok, at: 1400 }],
        log: [{ s: '>>> execute(a)', at: 100 }, { s: "GrepObservation(matches=['src/app.py:2', 'src/util.py:2', 'README.md:1'])", at: 1300 }],
        data: { 'matches': { v: 3, at: 1300 } }, hl: [7, 8, 9, 10] },
      { say: '观察是结构化的对象。交给模型前转成它能读的文字，成为下一轮的输入。',
        set: on('pback'), fx: [st('pback', 0, C.ok, 5), { type: 'pulse', obj: 'llm', color: C.info, at: 800 }], hl: [7] },
      { say: '如果模型把参数类型填错，比如 pattern 给了个数字，校验直接报错。坏参数到不了执行器（本机用 pydantic 实跑的结果）。',
        set: { bad: mix(fade(0, 150), { x: { to: 190, dur: 900, delay: 100, ease: 'inOut' }, y: { to: 238, dur: 900, delay: 100, ease: 'inOut' } }), err: mix(fade(1200), { text: { to: '校验失败：pattern 要的是字符串', delay: 0 } }) },
        fx: [st('pcall', 100, C.bad, 4), { type: 'shake', obj: 'act', at: 1100 }, { type: 'flash', obj: 'act', color: C.bad, at: 1100 }],
        log: [{ s: '>>> GrepAction(**{"pattern": 3})', at: 100 }, { s: "ValidationError: 1 error; string_type ('pattern',)", at: 1100 }], hl: [2] }
    ]
  };

  /* ---------------- 场景 3：动作确认 ---------------- */
  var CODE3 = { lang: 'py', title: '讲义第 20 页 + 文档里的批准 / 拒绝', src:
'conversation.set_confirmation_policy(\n' +
'    AlwaysConfirm())\n' +
'conversation.send_message(\n' +
'    "Directory listing with ls -la")\n' +
'conversation.run()\n' +
'# 文档：此时状态 WAITING_FOR_CONFIRMATION\n' +
'# 批准：再调用一次 run()\n' +
'conversation.run()\n' +
'# 拒绝：带上理由\n' +
'conversation.reject_pending_actions(\n' +
'    "reason")\n' };
  var sc3 = {
    name: '动作确认', desc: '设了 AlwaysConfirm 以后，每个动作执行前都停下等人。批准就执行，拒绝就把理由交回给智能体，让它换做法。',
    code: CODE3, dataTitle: '对话', data: { '状态': '—', '已执行': 0, '已拒绝': 0 },
    bg: function (d) { title(d, '动作确认：执行之前先停下来问人'); },
    objects: function () {
      var o = {};
      o.pa = path('M207,270 L328,270', C.warn);
      o.pb = path('M532,270 L663,270', C.ok);
      o.pu = path('M420,238 L420,140', C.warn);
      o.pd = path('M442,140 L442,238', C.ok);
      o.pr = path('M328,296 L207,296', C.bad);
      o.pobs = path('M730,302 L730,360 L140,360 L140,302', C.ok);
      o.ag = node(140, 270, 130, 60, 'Agent', '', 'info');
      o.pend = node(430, 270, 200, 62, '待执行的动作', '—', 'warn');
      o.hm = node(430, 110, 150, 56, '人', '批准 / 拒绝', 'neutral');
      o.ws = node(730, 270, 130, 60, 'Workspace', '终端', 'ok');
      o.stat = { type: 'box', x: 430, y: 430, w: 380, h: 40, rx: 8, fill: C.bg, stroke: C.line, sw: 1.3, text: 'RUNNING', mono: true, size: 13, weight: 700, opacity: 0 };
      o.statT = label(430, 404, '对话状态', C.fg2, 'middle');
      o.a1 = chip(140, 232, 'terminal: ls -la', 170, 'warn');
      o.a2 = chip(140, 232, 'terminal: rm -rf build/', 200, 'warn');
      o.a3 = chip(140, 232, 'terminal: ls build/', 180, 'warn');
      o.rs = chip(330, 296, 'reason', 90, 'bad');
      o.rev = label(430, 500, '', C.info, 'middle');
      return o;
    },
    steps: [
      { say: '讲义第 20 页：给对话设一个确认策略 AlwaysConfirm。每个动作在执行前都先暂停。',
        set: mix({ ag: pop(0), pend: pop(200), hm: pop(400), ws: pop(600), stat: fade(700), statT: fade(700) }, on('pa', 300), on('pb', 500)), data: { '状态': 'RUNNING' }, hl: [1, 2] },
      { say: '任务是列目录：模型给出 ls -la，但动作停在"待执行"。对话进入 WAITING_FOR_CONFIRMATION（文档里的状态名），去问人。',
        set: join(on('pu', 900), { a1: mix(fade(0, 150), { x: { to: 430, dur: 900, delay: 100, ease: 'inOut' } }), pend: { sub: { to: '等人批准', delay: 900 } }, stat: { text: { to: 'WAITING_FOR_CONFIRMATION', delay: 1000 }, stroke: { to: C.warn, delay: 1000 } } }),
        fx: [st('pa', 100, C.warn, 3), st('pu', 1000, C.warn, 3), { type: 'pulse', obj: 'hm', color: C.warn, at: 1500 }],
        data: { '状态': { v: 'WAITING_FOR_CONFIRMATION', at: 1000 } }, hl: [3, 4, 5, 6] },
      { say: '人同意：再调用一次 run()，动作才真正执行，输出作为观察回到 Agent。',
        set: join(on('pd'), on('pobs', 1400), { a1: { x: { to: 730, dur: 900, delay: 400, ease: 'inOut' }, opacity: { to: 0, dur: 250, delay: 1400 } }, pend: { sub: { to: '—', delay: 400 } }, stat: { text: { to: 'RUNNING', delay: 400 }, stroke: { to: C.line, delay: 400 } } }),
        fx: [st('pd', 0, C.ok, 3), st('pb', 500, C.ok, 3), { type: 'ripple', obj: 'ws', color: C.ok, at: 1300 }, st('pobs', 1400, C.ok, 5)],
        data: { '状态': { v: 'RUNNING', at: 400 }, '已执行': { v: 1, at: 1300 } }, hl: [7, 8] },
      { say: '下一个动作是删目录（示意）：同样停在待执行，等人决定。',
        set: { pobs: { flow: { to: 0, dur: 300 }, opacity: { to: 0.25, dur: 300 } }, a2: mix(fade(0, 150), { x: { to: 430, dur: 900, delay: 100, ease: 'inOut' } }), pend: { sub: { to: '等人批准', delay: 900 } }, stat: { text: { to: 'WAITING_FOR_CONFIRMATION', delay: 1000 }, stroke: { to: C.warn, delay: 1000 } } },
        fx: [st('pa', 100, C.warn, 3), st('pu', 1000, C.warn, 3), { type: 'pulse', obj: 'hm', color: C.warn, at: 1500 }],
        data: { '状态': { v: 'WAITING_FOR_CONFIRMATION', at: 1000 } }, hl: [6] },
      { say: '人拒绝：调用 reject_pending_actions，附上理由。这个动作不执行，理由交回给 Agent。',
        set: join(on('pr', 900), { pd: { stroke: { to: C.bad, dur: 200 } }, a2: { fill: { to: C.badW, delay: 500 }, stroke: { to: C.bad, delay: 500 }, y: { to: 330, dur: 600, delay: 700, ease: 'bounce' }, opacity: { to: 0, dur: 300, delay: 1800 } }, rs: mix({ opacity: { from: 0, to: 1, dur: 200, delay: 900 } }, { x: { to: 262, dur: 800, delay: 1000, ease: 'inOut' } }), pend: { sub: { to: '已拒绝', delay: 500 } }, stat: { text: { to: '拒绝，理由交回 Agent', delay: 1300 }, stroke: { to: C.bad, delay: 1300 } } }),
        fx: [st('pd', 0, C.bad, 3), { type: 'shake', obj: 'pend', at: 500 }, st('pr', 1000, C.bad, 3), { type: 'pulse', obj: 'ag', color: C.info, at: 1900 }],
        data: { '状态': { v: '已拒绝', at: 1300 }, '已拒绝': { v: 1, at: 1300 } }, hl: [9, 10, 11] },
      { say: '智能体按理由改了做法（示意：先看看 build 里有什么）。在 AlwaysConfirm 下，新动作照样要先等批准。',
        set: { rs: fade(0, 300, 0), a3: mix(fade(200, 150), { x: { to: 430, dur: 900, delay: 300, ease: 'inOut' } }), pend: { sub: { to: '等人批准', delay: 1100 } }, stat: { text: { to: 'WAITING_FOR_CONFIRMATION', delay: 1200 }, stroke: { to: C.warn, delay: 1200 } }, rev: mix(fade(1300), { text: { to: '文档里还有 ConfirmRisky：只让高风险的动作停下', delay: 0 } }) },
        fx: [st('pa', 300, C.warn, 3), st('pu', 1200, C.warn, 3)],
        data: { '状态': { v: 'WAITING_FOR_CONFIRMATION', at: 1200 } }, hl: [1, 2] }
    ]
  };

  /* ---------------- 场景 4：上下文压缩 ---------------- */
  var CODE4 = { lang: 'py', title: '讲义第 18 页 · 上下文压缩器', src:
'condenser = LLMSummarizingCondenser(\n' +
'    llm=llm.model_copy(\n' +
'        update={"usage_id": "condenser"}),\n' +
'    max_size=10,\n' +
'    keep_first=2,\n' +
')\n' +
'agent = Agent(llm=llm, tools=tools,\n' +
'              condenser=condenser)\n' };
  var VY = function (i) { return 92 + i * 38; };
  var EL = ['1 系统提示', '2 用户任务', '3 动作', '4 观察', '5 动作', '6 观察', '7 动作', '8 观察', '9 动作', '10 观察', '11 动作'];
  var sc4 = {
    name: '上下文压缩', desc: '事件数超过 max_size 就压缩。开头 keep_first 条原样保留。较早的一段换成一条摘要，最近的事件保留。',
    code: CODE4, dataTitle: '视图', data: { '事件数': 0, '被压缩': 0 },
    bg: function (d) { title(d, 'LLMSummarizingCondenser：老事件 → 一条摘要'); },
    objects: function () {
      var o = {};
      o.pin = path('M352,244 L518,268', C.data);
      o.pout = path('M518,292 L352,168', C.info);
      o.cd = node(620, 280, 200, 70, '压缩用的 LLM', 'usage_id = "condenser"', 'info');
      o.maxL = { type: 'line', x1: 160, y1: VY(9) + 19, x2: 470, y2: VY(9) + 19, stroke: C.bad, sw: 2, dasharray: '6 4', opacity: 0 };
      o.maxT = label(370, VY(10) + 2, 'max_size = 10', C.bad);
      o.keepB = { type: 'box', x: 260, y: (VY(0) + VY(1)) / 2, w: 190, h: 74, rx: 8, fill: 'none', stroke: C.ok, sw: 2, text: '', opacity: 0 };
      o.keepT = label(370, (VY(0) + VY(1)) / 2 + 4, 'keep_first = 2', C.ok);
      EL.forEach(function (t, i) { o['v' + i] = chip(260, VY(i), t, 170, i < 2 ? 'data' : (i % 2 ? 'ok' : 'warn'), false); o['v' + i].trail = null; });
      o.sum = chip(620, 280, '摘要（事件 3–7）', 170, 'info', false);
      o.note = label(620, 420, '', C.fg2, 'middle');
      return o;
    },
    steps: [
      { say: '讲义第 18 页：给 Agent 配一个压缩器。它用复制出来的同款模型，只换了 usage_id = "condenser"。笔记的理解是，这样好把压缩的用量单独记账。',
        set: { cd: pop(0) }, hl: [1, 2, 3, 7, 8] },
      { say: '对话一条条往下长。按文档的说法，开头的事件是系统提示和最初的用户消息。',
        set: (function () { var s = {}; for (var i = 0; i < 10; i++) s['v' + i] = mix(fade(i * 120, 200), { x: { from: 230, to: 260, dur: 300, delay: i * 120 } }); s.maxL = fade(1300); return s; })(),
        data: { '事件数': { v: 10, at: 1200 } }, hl: [4] },
      { say: '第 11 条事件进来，超过 max_size = 10，触发压缩。',
        set: { v10: mix(fade(0, 200), { x: { from: 230, to: 260, dur: 300 } }), maxT: fade(300) },
        fx: [{ type: 'flash', obj: 'maxL', color: C.bad, at: 300 }, { type: 'shake', obj: 'v10', at: 400 }], data: { '事件数': { v: 11, at: 200 } }, hl: [4] },
      { say: '开头 keep_first = 2 条（系统提示、用户任务）一定原样保留。',
        set: { keepB: fade(0, 300), keepT: fade(200) }, fx: [{ type: 'pulse', obj: 'keepB', color: C.ok, at: 300 }], hl: [5] },
      { say: '较早的一段（这里是事件 3–7）交给压缩用的 LLM 写成摘要。尾部留几条，文档没给数，这里示意取最近 4 条。',
        set: join(on('pin'), (function () { var s = {}; for (var i = 2; i < 7; i++) s['v' + i] = { x: { to: 600, dur: 800, delay: (i - 2) * 120, ease: 'in' }, y: { to: 280, dur: 800, delay: (i - 2) * 120, ease: 'in' }, opacity: { to: 0, dur: 300, delay: 700 + (i - 2) * 120 } }; return s; })()),
        fx: [st('pin', 0, C.data, 5), { type: 'pulse', obj: 'cd', color: C.info, at: 1200 }], data: { '被压缩': { v: 5, at: 1200 } }, hl: [2, 3] },
      { say: '摘要替换掉被压缩的那段，最近 4 条原样上移。视图从 11 条变成 2 + 1 + 4 = 7 条（本机按这个规则算过）。',
        set: join(on('pout'), { sum: mix(fade(0, 200), { x: { to: 260, dur: 900, delay: 200, ease: 'inOut' }, y: { to: VY(2), dur: 900, delay: 200, ease: 'inOut' } }) },
          (function () { var s = {}; for (var i = 7; i < 11; i++) s['v' + i] = { y: { to: VY(i - 4), dur: 700, delay: 900 + (i - 7) * 100, ease: 'inOut' } }; return s; })(),
          { maxT: fade(0, 300, 0), maxL: { opacity: { to: 0.3, dur: 300 } }, pin: { flow: { to: 0, dur: 300 }, opacity: { to: 0.2, dur: 300 } } }),
        fx: [st('pout', 200, C.info, 4), { type: 'ripple', obj: 'sum', color: C.info, at: 1100 }], data: { '事件数': { v: 7, at: 1500 } } },
      { say: '讲义提醒：摘要可能丢细节。所以把文件和测试当证据。重要的结论写进文件、用测试确认。不要只指望它留在上下文里。',
        set: { note: mix(fade(200), { text: { to: '原始指令 + 摘要 + 最近的工作', delay: 0 } }) },
        fx: [{ type: 'pulse', obj: 'sum', color: C.info, at: 0 }, { type: 'pulse', obj: 'keepB', color: C.ok, at: 300 }] }
    ]
  };

  /* ---------------- 场景 5：远程执行 ---------------- */
  var CODE5 = { lang: 'py', title: '讲义第 19 页 · Docker 工作区', src:
'with DockerWorkspace(\n' +
'    server_image=server_image,\n' +
'    platform=detect_platform(),\n' +
') as workspace:\n' +
'    agent = get_default_agent(\n' +
'        llm=llm, cli_mode=True)\n' +
'    conversation = Conversation(\n' +
'        agent=agent, workspace=workspace)\n' +
'    conversation.send_message(\n' +
'        "3 project facts in FACTS.txt")\n' +
'    conversation.run()\n' };
  var sc5 = {
    name: '远程执行', desc: '换成 DockerWorkspace：Agent Server 跑在容器里，循环和工具都在容器里执行。本地只剩一样的对话接口，事件实时传回来。',
    code: CODE5, dataTitle: '这一次', data: { '镜像平台': '—', '对话': 'Conversation' },
    bg: function (d) { title(d, 'DockerWorkspace：同样的对话接口，循环搬进容器'); },
    objects: function () {
      var o = {};
      o.locG = group(175, 300, 270, 330, 'data');
      o.locT = label(56, 158, '你的机器', C.data);
      o.dkG = group(620, 310, 380, 330, 'ok');
      o.dkT = label(446, 168, 'Docker 容器', C.ok);
      o.pmsg = path('M262,222 L533,222', C.data);
      o.pev = path('M533,254 L262,254', C.ok);
      o.pllm = path('M600,212 L600,99', C.data);
      o.pllm2 = path('M640,99 L640,212', C.warn);
      o.ptool = path('M600,270 L600,362', C.warn);
      o.ptool2 = path('M640,362 L640,270', C.ok);
      o.conv = node(175, 238, 170, 62, 'Conversation', '本地只剩接口', 'data');
      o.dp = node(175, 380, 170, 56, 'detect_platform()', '看本机 CPU 架构', 'neutral');
      o.srv = node(620, 240, 170, 62, 'Agent Server', 'Agent 循环在这里', 'info');
      o.cws = node(620, 392, 170, 56, '容器里的工作区', '工具在这里执行', 'ok');
      o.api = node(620, 76, 150, 44, 'LLM API', '', 'neutral');
      o.plat = chip(175, 420, 'linux/amd64', 120, 'neutral');
      o.msg = chip(262, 222, '3 project facts…', 150, 'data', false);
      o.evc = chip(533, 254, '事件流', 90, 'ok', false);
      return o;
    },
    steps: [
      { say: '讲义第 19 页：把工作区换成 DockerWorkspace，Agent Server 就跑在一个 Docker 容器里。',
        set: { locG: fade(0, 400), locT: fade(100), conv: pop(200), dkG: fade(300, 400), dkT: fade(400), srv: pop(500), cws: pop(650), api: pop(800), dp: pop(900) }, hl: [1, 2, 3, 4] },
      { say: '文档说，detect_platform() 看本机 CPU 架构，用来挑对应的镜像。ARM（包括 Apple Silicon）返回 linux/arm64，其他返回 linux/amd64。这里示意的是 x86 机器。',
        set: { plat: mix(fade(0, 200), { x: { to: 740, dur: 1100, delay: 300, ease: 'inOut' }, y: { to: 168, dur: 1100, delay: 300, ease: 'inOut' } }) },
        fx: [{ type: 'pulse', obj: 'dp', color: C.neutral, at: 100 }, { type: 'ripple', obj: 'dkG', color: C.ok, at: 1400 }], data: { '镜像平台': { v: 'linux/amd64', at: 1400 } }, hl: [3] },
      { say: '对话接口和本地时一模一样。文档说，此时 Conversation 会自动变成远程对话（RemoteConversation），消息发进容器。',
        set: join(on('pmsg'), { msg: mix(fade(0, 150), { x: { to: 533, dur: 1100, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: 1300 } }), conv: { sub: { to: 'RemoteConversation', delay: 300 } } }),
        fx: [st('pmsg', 100, C.data, 5), { type: 'pulse', obj: 'srv', color: C.info, at: 1300 }], data: { '对话': { v: 'RemoteConversation', at: 300 } }, hl: [7, 8, 9, 10] },
      { say: '动作-观察循环在容器里跑。Server 调模型拿动作，工具在容器里的工作区执行，观察回到 Server。',
        set: join(on('pllm'), on('pllm2', 500), on('ptool', 1000), on('ptool2', 1500)),
        fx: [st('pllm', 0, C.data, 3), { type: 'pulse', obj: 'api', color: C.neutral, at: 500 }, st('pllm2', 500, C.warn, 3), st('ptool', 1000, C.warn, 3), { type: 'ripple', obj: 'cws', color: C.ok, at: 1500 }, st('ptool2', 1500, C.ok, 3)], hl: [11] },
      { say: '事件通过 WebSocket 实时传回本地，这是文档的说法。本地的对话对象看到的，和在本机跑时一样。',
        set: join(on('pev'), { evc: mix(fade(0, 150), { x: { to: 262, dur: 1100, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: 1300 } }) }),
        fx: [st('pev', 100, C.ok, 6), { type: 'ripple', obj: 'conv', color: C.ok, at: 1300 }] },
      { say: '对照上一讲第 21 页：这更接近"智能体在沙箱里"。作业 1 则是外壳留在本机，只有命令送进 Modal 沙箱。这叫"工具在沙箱里"。',
        fx: [{ type: 'pulse', obj: 'dkG', color: C.ok, at: 0 }, { type: 'pulse', obj: 'locG', color: C.data, at: 400 }] }
    ]
  };

  VZ.register({
    id: 'c7-openhands', title: 'OpenHands SDK：一次动作的数据流和几个关键部件',
    sources: [PDF, DOC, DOC_SEC, DOC_CON, DOC_DKR],
    note: '代码面板是讲义第 14–20 页的代码（有折行）。三件默认工具、Workspace / Conversation / run 的分工出自第 14–15 页。动作、执行器、观察出自第 16 页。"压缩：老事件变摘要、保留原始指令和最近工作、可能丢细节"出自第 18 页。Docker 里的 Agent Server 出自第 19 页。"执行前暂停、待执行动作交给人、拒绝后改计划"出自第 20 页。WAITING_FOR_CONFIRMATION、reject_pending_actions、ConfirmRisky、max_size / keep_first 的含义、RemoteConversation、WebSocket 事件流、detect_platform 的行为来自 OpenHands 文档。场景 1 的三轮具体动作、场景 3 的 rm / ls build 两条命令、场景 4"尾部保留 4 条"、场景 5 的 linux/amd64 都是示意。场景 1、4 的事件计数和场景 2 的控制台输出，都是本机实跑得到的。场景 2 用 pydantic 的 BaseModel 代替 OpenHands 的基类。',
    legend: [[C.data, '消息 / 事件'], [C.info, '模型 / Agent'], [C.warn, '动作 / 工具调用'], [C.ok, '观察 / 结果'], [C.bad, '拒绝 / 校验失败'], [C.neutral, '人 / 文件 / 外部']],
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

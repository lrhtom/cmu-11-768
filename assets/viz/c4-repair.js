/* 04 · 第 6 讲 —— 编程智能体修一个 bug：定位 → 复现 → 修改 → 验证 → 交补丁 → 按 SWE-bench 的规矩评分 → 反过来注入 bug 造训练题
 * 例子照讲义 lecture-06 第 33–36、44–45、48–49、51–52 页的 retries（"0 被当成默认值 3"）。
 * 控制台和数据面板全部来自 本机验算脚本 第 1 部分在本机的实跑（run-verify.txt）：真建了一个 git 仓库（cli.py / config.py / client.py / test_config.py），
 *   用 git grep 代替讲义里的 rg 搜索，python -m unittest 跑测试，git diff 出补丁，再在一个全新的副本上"先打候选补丁、再打测试补丁、再跑测试"评分。
 * 场景 3 的交卷三步照作业 1 的 tasks/code-skills/submit-task/SKILL.md；场景 4 的评分顺序照作业 1 的 src/assignment/eval/harness.py（_grade）。
 * 场景 5 末尾的"只在最后给奖励"照讲义第 49 页，是示意，没有真的训练。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L6 = 'https://www.cmu-agents.com/slides/lecture-06-coding-agents.pdf', YT = 'https://youtu.be/1BWeH1oOM7k?t=';
  var A1 = 'https://github.com/cmu-agents/assignment-1/blob/main/';
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function akey(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'neutral'; }
  function wire(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: akey(col), opacity: 0 }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 300, delay: d0 || 0 }, flow: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function node(x, y, w, h, t, sub, k, op) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.7, text: t, sub: sub, subMono: false, subSize: 11.5, size: 13.5, weight: 700, opacity: op == null ? 0 : op };
  }
  function file(x, y, w, t) { return { type: 'box', x: x, y: y, w: w, h: 36, rx: 7, fill: C.bg2, stroke: C.neutral, sw: 1.4, text: t, size: 12.5, weight: 700, mono: true, opacity: 0 }; }
  function chip(x, y, w, t, k, size) { return { type: 'box', x: x, y: y, w: w, h: 28, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: true, opacity: 0 }; }
  function rider(path, w, k) { return { type: 'box', along: path, t: 0, w: w, h: 26, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: '', size: 11, weight: 650, mono: true, opacity: 0, trail: { n: 4, gap: 40 } }; }
  function ride(dur, delay, text) {
    var o = { t: { from: 0, to: 1, dur: dur, delay: delay || 0, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: (delay || 0) + dur + 120 } };
    if (text != null) o.text = { to: text, delay: 0 };
    return o;
  }
  function label(x, y, t, col, anchor) { return { type: 'text', x: x, y: y, text: t, size: 12, weight: 700, color: col || C.fg2, anchor: anchor || 'start', opacity: 0 }; }
  function recolor(k, delay) { return { fill: { to: PAL[k][0], dur: 400, delay: delay || 0 }, stroke: { to: PAL[k][1], dur: 400, delay: delay || 0 } }; }
  /* 控制台：一行接一行打出来 */
  function seq(lines, start) {
    var at = start || 0;
    return lines.map(function (s) { var o = { s: s, at: at }; at += Math.min(s.length * 16, 650) + 90; return o; });
  }

  /* ---- 公共布局：左边是沙箱里的仓库，右上是智能体（或评分脚本），中间是 shell ---- */
  var TX = [460, 560, 660, 760];
  function base(o, opt) {
    o.repoG = { type: 'box', x: 200, y: 345, w: 300, h: 330, rx: 14, fill: C.bg, stroke: C.neutral, sw: 1.3, dasharray: '6 4', text: '', opacity: 0 };
    o.repoT = label(64, 200, opt.repo || '仓库 /testbed（在沙箱里）', C.fg3);
    o.dCall = wire('M125,260 L168,323', C.neutral);
    o.dUse = wire('M232,323 L275,260', C.neutral);
    o.dTest = wire('M200,435 L200,368', C.neutral);
    o.lCall = label(116, 300, '调用', C.fg3, 'end');
    o.lUse = label(262, 300, '用它的结果', C.fg3);
    o.lTest = label(210, 405, '测试它', C.fg3);
    o.pIss = wire('M292,92 L497,92', C.data);
    o.pSend = wire('M497,108 L292,108', C.ok);
    o.pCmd = wire('M570,121 L570,296', C.warn);
    o.pObs = wire('M630,296 L630,121', C.data);
    o.pEdit = wire('M498,345 L279,345', C.warn);
    o.pTest = wire('M520,364 L520,455 L279,455', C.warn);
    o.issue = node(170, 92, 240, 52, opt.issue || 'Issue：0 变成了 3', opt.issueSub || 'retries=0，客户端却重试 3 次', opt.issueK || 'bad');
    o.agent = node(600, 92, 200, 54, opt.agent || '编程智能体', opt.agentSub || 'LLM + bash 工具', 'info');
    o.shell = node(600, 330, 200, 64, opt.shell || '沙箱 · shell', opt.shellSub || '在 /testbed 里执行命令', 'neutral');
    o.fcli = file(125, 240, 120, 'cli.py');
    o.fclient = file(275, 240, 120, 'client.py');
    o.fcfg = file(200, 345, 150, 'config.py');
    o.ftest = file(200, 455, 150, 'test_config.py');
    o.cmd = rider('pCmd', 210, 'warn');
    o.cmd2 = rider('pCmd', 210, 'warn');
    o.obs = rider('pObs', 150, 'data');
    o.obs2 = rider('pObs', 150, 'bad');
    o.edit = rider('pEdit', 150, 'warn');
    o.tedit = rider('pTest', 120, 'warn');
    (opt.tests || ['missing', 'None', 'positive', 'zero']).forEach(function (t, i) { o['t' + i] = chip(TX[i], 505, 92, t, 'neutral', 12); });
  }
  function showBase(d0, cfgK) {
    var s = { issue: pop(d0), agent: pop(d0 + 150), shell: pop(d0 + 300), repoG: fade(d0 + 200), repoT: fade(d0 + 300),
      fcli: pop(d0 + 400), fclient: pop(d0 + 480), fcfg: pop(d0 + 560), ftest: pop(d0 + 640) };
    return join(s, on('pCmd', d0 + 700), on('pObs', d0 + 760));
  }
  /* 静止起点：场景一开始就把公共部分摆好（opacity 1） */
  function preset(o, keys) { keys.forEach(function (k) { o[k].opacity = 1; if (o[k].flow === 0) o[k].flow = 1; }); }
  var BASEKEYS = ['repoG', 'repoT', 'issue', 'agent', 'shell', 'fcli', 'fclient', 'fcfg', 'ftest', 'pCmd', 'pObs'];

  /* ---------------- 场景 1：定位与复现 ---------------- */
  var CODE1 = { lang: 'py', title: 'config.py 与复现测试（本机实跑的那份）', src:
'# config.py：智能体看到的源码\n' +
'def retry_count(config):\n' +
'    return config.get("retries") or 3\n' +
'\n' +
'# 智能体加到 test_config.py 的复现测试\n' +
'def test_zero(self):\n' +
'    self.assertEqual(\n' +
'        retry_count({"retries": 0}), 0)\n' +
'\n' +
'# 智能体在 shell 里跑的命令\n' +
'$ git grep -n retries\n' +
'$ python -m unittest \\\n' +
'    test_config.RetryTests.test_zero\n' };
  var GREP = ['$ git grep -n retries',
    'cli.py:5:    return {"retries": retry_count(args)}',
    'config.py:2:    return config.get("retries") or 3',
    'test_config.py:10:        self.assertEqual(retry_count({"retries": None}), 3)',
    'test_config.py:13:        self.assertEqual(retry_count({"retries": 2}), 2)'];
  var sc1 = {
    name: '定位与复现', desc: '从症状出发搜代码，顺着值找到默认值规则。再写一个复现测试，亲眼看到 3 != 0。',
    code: CODE1, dataTitle: '这一轮的观察', data: { '命中行': 0, 'retries 输入': '无', '实际返回': '无', '期望返回': '无' },
    bg: function (d) { title(d, '定位（localize）：从症状出发找到病根，并先复现出来'); },
    objects: function () { var o = {}; base(o, {}); return o; },
    steps: [
      { say: '任务只有一段 issue 和整个仓库：retries 设成 0，客户端却重试了 3 次。',
        set: join(showBase(0), on('pIss', 900)), fx: [st('pIss', 1000, C.data, 4)] },
      { say: '先从症状出发搜：git grep -n retries（讲义用的是 rg retries .）。',
        set: { cmd: ride(900, 0, 'git grep -n retries') }, fx: [{ type: 'ripple', obj: 'shell', color: C.warn, at: 900 }], hl: [11], log: [GREP[0]] },
      { say: '4 处命中：cli.py、config.py 和测试里的两行。一个参数会被好几处代码碰到。',
        set: { obs: ride(900, 0, '4 处命中') },
        fx: [{ type: 'pulse', obj: 'fcli', color: C.data, at: 900 }, { type: 'pulse', obj: 'fcfg', color: C.data, at: 1000 }, { type: 'pulse', obj: 'ftest', color: C.data, at: 1100 }],
        log: seq(GREP.slice(1), 300), data: { '命中行': { v: 4, at: 900 } } },
      { say: '顺着值走：cli.py 调用 config.py 的 retry_count，client.py 用它的结果，测试也在测它（讲义第 45 页）。',
        set: join(on('dCall', 0), on('dUse', 300), on('dTest', 600), { lCall: fade(200), lUse: fade(500), lTest: fade(800) }),
        fx: [st('dCall', 100, C.neutral, 3), st('dUse', 400, C.neutral, 3), st('dTest', 700, C.neutral, 3)] },
      { say: '嫌疑落在 config.py 的默认值规则：config.get("retries") or 3。',
        set: { fcfg: recolor('bad', 0) }, fx: [{ type: 'pulse', obj: 'fcfg', color: C.bad, at: 300 }], hl: [2, 3] },
      { say: '先复现再动手。往测试文件里加一个复现测试 test_zero，配 0 次就该是 0 次。',
        set: join(on('pTest', 0), { tedit: ride(1000, 200, '+ test_zero') }), fx: [st('pTest', 100, C.warn, 3), { type: 'ripple', obj: 'ftest', color: C.warn, at: 1200 }], hl: [6, 7, 8] },
      { say: '只跑这一个测试：断言失败，3 != 0。问题被稳定地复现出来了。',
        set: { cmd2: ride(900, 0, 'unittest …test_zero'), obs2: ride(900, 1300, 'FAILED'), t3: mix(fade(2200), recolor('bad', 2200)) },
        fx: [{ type: 'shake', obj: 'fcfg', at: 2300 }],
        hl: [12, 13], log: seq(['$ python -m unittest test_config.RetryTests.test_zero', 'FAIL: test_zero (test_config.RetryTests.test_zero)', 'AssertionError: 3 != 0', 'Ran 1 test in 0.003s', 'FAILED (failures=1)'], 100),
        data: { 'retries 输入': { v: '0', at: 1300 }, '实际返回': { v: '3', at: 1600 }, '期望返回': { v: '0', at: 1600 } } },
      { say: '原因：0 在 Python 里是假值，0 or 3 得 3。它和"没配置"一样，被换成了默认值。下一步改条件，不改测试。',
        fx: [{ type: 'float', x: 200, y: 310, text: '0 or 3 → 3', size: 15, color: C.bad, at: 300 }],
        log: seq(['>>> 0 or 3', '3', '>>> None or 3', '3', '>>> 2 or 3', '2'], 100), hl: [3] }
    ]
  };

  /* ---------------- 场景 2：修改与验证 ---------------- */
  var CODE2 = { lang: 'py', title: '讲义第 35 页 · 改之前 / 改之后', src:
'# 改之前：所有"假值"都换成默认值\n' +
'def retry_count(config):\n' +
'    return config.get("retries") or 3\n' +
'\n' +
'# 改之后：只有 None 才用默认值\n' +
'def retry_count(config):\n' +
'    value = config.get("retries")\n' +
'    return 3 if value is None else value\n' +
'\n' +
'$ python -m unittest -v test_config\n' };
  var UT4 = ['$ python -m unittest -v test_config',
    'test_missing (test_config.RetryTests.test_missing) ... ok',
    'test_none (test_config.RetryTests.test_none) ... ok',
    'test_positive (test_config.RetryTests.test_positive) ... ok',
    'test_zero (test_config.RetryTests.test_zero) ... ok',
    'Ran 4 tests in 0.000s', 'OK'];
  var sc2 = {
    name: '修改与验证', desc: '只在值为 None 时用默认值。再把全部测试跑一遍。既要修好 0，也不能把原来的默认值情况改坏。',
    code: CODE2, dataTitle: '测试结果', data: { '通过': 0, '失败': 0, 'retry_count(0)': '3' },
    bg: function (d) { title(d, '修改（edit）与验证（verify）：改条件、不改测试，再跑全部测试'); },
    objects: function () {
      var o = {}; base(o, {}); preset(o, BASEKEYS); o.fcfg.fill = C.badW; o.fcfg.stroke = C.bad;
      o.lp = chip(600, 430, 70, '定位', 'data', 12); o.ed = chip(700, 430, 70, '修改', 'warn', 12); o.vf = chip(800, 430, 56, '验证', 'ok', 12);
      o.c1 = wire('M636,430 L662,430', C.data); o.c2 = wire('M736,430 L769,430', C.warn);
      o.c3 = wire('M800,445 C800,476 600,476 600,447', C.bad);
      o.cT = label(700, 483, '失败 → 修正假设', C.bad, 'middle');
      o.okA = label(760, 540, '0 修好了', C.ok, 'middle');
      o.okB = label(560, 540, '默认值没改坏', C.ok, 'middle');
      return o;
    },
    steps: [
      { say: '修改：只有值是 None 时，才用默认值 3。0 是用户明确配的，要原样保留（讲义第 35 页）。',
        set: join(on('pEdit', 0), { edit: ride(1000, 100, 'value is None'), fcfg: recolor('ok', 1100) }),
        fx: [st('pEdit', 100, C.warn, 4), { type: 'ripple', obj: 'fcfg', color: C.ok, at: 1100 }], hl: [6, 7, 8], data: { 'retry_count(0)': { v: '0', at: 1100 } } },
      { say: '然后跑全部测试：缺省、None、0、正数四种情况（讲义第 36 页）。',
        set: { cmd: ride(900, 0, 'unittest -v test_config') }, fx: [{ type: 'ripple', obj: 'shell', color: C.warn, at: 900 }], hl: [10], log: [UT4[0]] },
      { say: '四个测试依次通过：Ran 4 tests，OK。',
        set: { obs: ride(800, 0, '4 个 ok'), t0: mix(fade(700), recolor('ok', 700)), t1: mix(fade(900), recolor('ok', 900)), t2: mix(fade(1100), recolor('ok', 1100)), t3: mix(fade(1300), recolor('ok', 1300)) },
        log: seq(UT4.slice(1), 300), data: { '通过': { v: 4, at: 1300 } } },
      { say: '验证要同时看两件事。新情况 0 修好了，原来的三种默认值情况也没改坏。',
        set: { okA: fade(0), okB: fade(400) },
        fx: [{ type: 'pulse', obj: 't3', color: C.ok, at: 100 }, { type: 'pulse', obj: 't0', color: C.ok, at: 500 }, { type: 'pulse', obj: 't1', color: C.ok, at: 600 }, { type: 'pulse', obj: 't2', color: C.ok, at: 700 }] },
      { say: '这就是讲义第 33 页的"定位-修改-验证"循环。一轮不够，就再来一轮。',
        set: join({ lp: pop(0), ed: pop(250), vf: pop(500) }, on('c1', 300), on('c2', 550)), fx: [st('c1', 400, C.data, 3), st('c2', 650, C.warn, 3)] },
      { say: '要是失败了，分两种。0 还是 3，就回去定位值在哪儿变的。默认值情况坏了，就改规则再验证。',
        set: join(on('c3', 0), { cT: fade(300) }), fx: [st('c3', 200, C.bad, 4), { type: 'pulse', obj: 'lp', color: C.bad, at: 900 }] }
    ]
  };

  /* ---------------- 场景 3：交补丁（作业 1 的 submit-task 技能） ---------------- */
  var CODE3 = { lang: 'text', title: 'assignment-1 · submit-task/SKILL.md（节选）', src:
'---\n' +
'name: submit-task\n' +
'description: When the task is complete,\n' +
'  take the required steps to submit the\n' +
'  solution. DO NOT submit without\n' +
'  invoking this skill.\n' +
'---\n' +
'# Step 1: Create the patch file\n' +
'git diff -- path/to/file1 > patch.txt\n' +
'#  (only the source files you modified)\n' +
'# Step 2: Verify the patch\n' +
'#  headers show --- a/ and +++ b/\n' +
'# Step 3: Submit\n' +
'#  call send_message with a summary\n' };
  var PATCH = ['$ git diff -- config.py > patch.txt', '$ cat patch.txt',
    'diff --git a/config.py b/config.py', 'index 2b793f1..f2e6173 100644', '--- a/config.py', '+++ b/config.py', '@@ -1,2 +1,3 @@',
    ' def retry_count(config):', '-    return config.get("retries") or 3', '+    value = config.get("retries")', '+    return 3 if value is None else value'];
  var sc3 = {
    name: '交补丁', desc: '作业 1 的 submit-task 技能：系统提示里只有技能名和描述。调用 invoke_skill 才拿到全文。然后出补丁、核对、提交。',
    code: CODE3, dataTitle: 'patch.txt', data: { '技能内容': '只有描述', '行数': 0, '增加行': 0, '删除行': 0, '含测试文件': '无' },
    bg: function (d) { title(d, '交卷：把改动做成 patch.txt（作业 1 的 submit-task 技能）'); },
    objects: function () {
      var o = {}; base(o, { issue: '用户 / 评分方', issueSub: '只收 patch.txt', issueK: 'data' }); preset(o, BASEKEYS);
      o.fcfg.fill = C.okW; o.fcfg.stroke = C.ok; o.ftest.fill = C.warnW; o.ftest.stroke = C.warn;
      o.pSkill = wire('M742,176 L688,122', C.info);
      o.skill = node(775, 200, 104, 46, 'SKILL.md', 'submit-task', 'info');
      o.inv = rider('pSkill', 100, 'info');
      o.card = node(680, 430, 250, 56, 'patch.txt', '只含 config.py', 'ok');
      o.nt = label(200, 497, 'test_zero 不进补丁', C.warn, 'middle');
      o.sent = rider('pSend', 150, 'ok');
      return o;
    },
    steps: [
      { say: '修好了怎么交？系统提示里只放技能的名字和一句描述，全文先不放。这叫渐进式披露。',
        set: { skill: pop(0) }, fx: [{ type: 'pulse', obj: 'agent', color: C.info, at: 400 }], hl: [2, 3, 4, 5, 6] },
      { say: '智能体调用 invoke_skill("submit-task")，SKILL.md 全文才进上下文。里面写着先出补丁、再核对、最后提交。',
        set: join(on('pSkill', 0), { inv: ride(900, 100, 'invoke_skill') }), fx: [st('pSkill', 200, C.info, 4), { type: 'ripple', obj: 'agent', color: C.info, at: 1000 }],
        hl: [8, 9, 10, 11, 12, 13, 14], data: { '技能内容': { v: '全文', at: 1000 } } },
      { say: '第 1 步：git diff -- config.py > patch.txt，只列改过的源文件。复现测试 test_zero 不进补丁。',
        set: { cmd: ride(900, 0, 'git diff > patch.txt'), card: pop(1000), nt: fade(1200) },
        fx: [{ type: 'ripple', obj: 'shell', color: C.warn, at: 900 }, { type: 'shake', obj: 'ftest', at: 1300 }], hl: [8, 9, 10], log: [PATCH[0]] },
      { say: '补丁很小：一处改动，删 1 行、加 2 行，头部是 --- a/config.py 和 +++ b/config.py。',
        log: seq(PATCH.slice(1), 0), data: { '行数': { v: 9, at: 600 }, '增加行': { v: 2, at: 2200 }, '删除行': { v: 1, at: 1800 }, '含测试文件': { v: '否', at: 600 } } },
      { say: '第 2 步：读一遍 patch.txt，确认只有想要的改动、路径头是 a/ 和 b/。',
        set: { obs: ride(900, 0, 'patch.txt 核对过') }, fx: [{ type: 'pulse', obj: 'card', color: C.ok, at: 300 }], hl: [11, 12] },
      { say: '第 3 步：send_message 写一段总结。提交之后就不能再动了，patch.txt 被取出来送去评分。',
        set: join(on('pSend', 0), { sent: ride(900, 100, 'send_message') }), fx: [st('pSend', 100, C.ok, 4), { type: 'burst', obj: 'card', color: C.ok, at: 1200 }], hl: [13, 14] }
    ]
  };

  /* ---------------- 场景 4：按 SWE-bench 的规矩评分 ---------------- */
  var CODE4 = { lang: 'py', title: 'assignment-1 · eval/harness.py · _grade（节选）', src:
'if patch is not None:\n' +
'    applied, error = _apply_patch(\n' +
'        env, patch, "/tmp/candidate.diff")\n' +
'    if not applied:\n' +
'        return report   # 补丁打不上\n' +
'applied, error = _apply_patch(\n' +
'    env, test_patch, "/tmp/test.diff")\n' +
'result = env.execute(test_cmd, cwd=TESTBED)\n' +
'report.results = parse_report(output, fw)\n' +
'report.fail_to_pass = {t: report.results\n' +
'    .get(t, MISSING) for t in fail_to_pass}\n' +
'report.pass_to_pass = {t: report.results\n' +
'    .get(t, MISSING) for t in pass_to_pass}\n' +
'# resolved：两组里每个测试都是 PASSED\n' };
  var sc4 = {
    name: '按规矩评分', desc: '全新测试床，回到 base commit。先打候选补丁，再打隐藏的测试补丁。跑测试，看 FAIL_TO_PASS 和 PASS_TO_PASS。',
    code: CODE4, dataTitle: '评分报告', data: { 'FAIL_TO_PASS': '无', 'PASS_TO_PASS': '无', 'RESOLVED': '无' },
    bg: function (d) { title(d, '评分（作业 1 的 harness 照 SWE-bench）：候选补丁先打，测试补丁后打'); },
    objects: function () {
      var o = {};
      base(o, { repo: '全新测试床（base commit）', issue: 'patch.txt', issueSub: '候选补丁（只改 config.py）', issueK: 'ok', agent: '评分脚本', agentSub: 'harness · 不调模型', shell: '测试床 · shell', shellSub: '跑 test_cmd',
        tests: ['zero', 'missing', 'None', 'positive'] });
      preset(o, BASEKEYS); o.agent.fill = C.neutralW; o.agent.stroke = C.neutral;
      o.pTP = wire('M742,176 L688,122', C.warn);
      o.tp = node(775, 200, 104, 46, 'test.diff', '隐藏测试补丁', 'warn');
      o.tpr = rider('pTP', 90, 'warn'); o.tpr2 = rider('pTP', 90, 'warn');
      o.cand = rider('pIss', 110, 'ok');
      o.edit2 = rider('pTest', 120, 'warn');
      o.gF = { type: 'box', x: 460, y: 505, w: 104, h: 44, rx: 9, fill: 'none', stroke: C.bad, sw: 1.4, dasharray: '5 3', text: '', opacity: 0 };
      o.gP = { type: 'box', x: 660, y: 505, w: 304, h: 44, rx: 9, fill: 'none', stroke: C.ok, sw: 1.4, dasharray: '5 3', text: '', opacity: 0 };
      o.lF = label(460, 474, 'FAIL_TO_PASS', C.bad, 'middle');
      o.lP = label(660, 474, 'PASS_TO_PASS', C.ok, 'middle');
      o.res = node(680, 430, 200, 40, 'RESOLVED: yes', '', 'ok');
      return o;
    },
    steps: [
      { say: '评分时只认 patch.txt。换一个全新的测试床，回到 base commit。智能体在沙箱里的其他改动，全都不算。',
        set: { tp: pop(300) }, fx: [{ type: 'pulse', obj: 'issue', color: C.ok, at: 0 }, { type: 'pulse', obj: 'repoG', color: C.neutral, at: 300 }] },
      { say: '先看基线：不打候选补丁，只打隐藏的测试补丁，它会加上 test_zero。跑一遍，test_zero 失败。',
        set: join(on('pTP', 0), on('pTest', 1200), { tpr: ride(700, 100), cmd: ride(800, 800, 'git apply test.diff'), tedit: ride(900, 1700, '+ test_zero'), t0: mix(fade(2700), recolor('bad', 2700)), t1: mix(fade(2800), recolor('ok', 2800)), t2: mix(fade(2900), recolor('ok', 2900)), t3: mix(fade(3000), recolor('ok', 3000)) }),
        fx: [st('pTP', 100, C.warn, 3), st('pTest', 1700, C.warn, 3)], hl: [6, 7, 8],
        log: seq(['FAIL_TO_PASS (0/1)', '  [ FAILED] test_zero', 'PASS_TO_PASS (3/3)', 'RESOLVED: no'], 2700),
        data: { 'FAIL_TO_PASS': { v: '0/1', at: 2800 }, 'PASS_TO_PASS': { v: '3/3', at: 3000 }, 'RESOLVED': { v: 'no', at: 3300 } } },
      { say: '正式评分再开一个干净测试床。第一步打候选补丁：git apply candidate.diff，只碰 config.py。',
        set: join(on('pIss', 0), on('pEdit', 900), { t0: fade(0, 300, 0), t1: fade(0, 300, 0), t2: fade(0, 300, 0), t3: fade(0, 300, 0), cand: ride(800, 0, 'patch.txt'), cmd2: ride(700, 800, 'git apply candidate'), edit: ride(800, 1500, 'config.py 已修'), fcfg: recolor('ok', 2300) }),
        fx: [st('pIss', 0, C.ok, 3), st('pEdit', 1500, C.warn, 3)], hl: [1, 2, 3, 4, 5],
        log: seq(['$ git apply -v candidate.diff', 'Checking patch config.py...', 'Applied patch config.py cleanly.'], 800),
        data: { 'FAIL_TO_PASS': '无', 'PASS_TO_PASS': '无', 'RESOLVED': '无' } },
      { say: '第二步才打测试补丁。顺序是故意的。候选补丁要是去改测试，测试补丁就会盖回来或打不上。所以骗不了分。',
        set: { tpr2: ride(700, 0), cmd: ride(700, 700, 'git apply test.diff'), edit2: ride(900, 1300, '+ test_zero') },
        fx: [{ type: 'ripple', obj: 'ftest', color: C.warn, at: 2200 }], hl: [6, 7],
        log: seq(['$ git apply -v test.diff', 'Checking patch test_config.py...', 'Applied patch test_config.py cleanly.'], 700) },
      { say: '跑 test_cmd，按测试框架的输出格式逐行解析每个测试的状态。',
        set: { cmd: ride(800, 0, 'unittest -v test_config'), t0: mix(fade(900), recolor('ok', 900)), t1: mix(fade(1000), recolor('ok', 1000)), t2: mix(fade(1100), recolor('ok', 1100)), t3: mix(fade(1200), recolor('ok', 1200)) },
        hl: [8, 9], log: seq(UT4, 100) },
      { say: 'FAIL_TO_PASS：修之前失败、修之后必须通过的测试。这里是 test_zero，1/1。',
        set: { gF: fade(0), lF: fade(200) }, fx: [{ type: 'pulse', obj: 't0', color: C.ok, at: 300 }], hl: [10, 11],
        log: seq(['FAIL_TO_PASS (1/1)', '  [   PASS] test_zero'], 300), data: { 'FAIL_TO_PASS': { v: '1/1', at: 400 } } },
      { say: 'PASS_TO_PASS：修之前就通过、修之后不许改坏的测试，这里 3/3。两组全过才算 resolved。',
        set: { gP: fade(0), lP: fade(200), res: pop(1600) }, fx: [{ type: 'burst', obj: 'res', color: C.ok, at: 1900 }], hl: [12, 13, 14],
        log: seq(['PASS_TO_PASS (3/3)', '  [   PASS] test_missing', '  [   PASS] test_none', '  [   PASS] test_positive', 'RESOLVED: yes'], 300),
        data: { 'PASS_TO_PASS': { v: '3/3', at: 400 }, 'RESOLVED': { v: 'yes', at: 1700 } } },
      { say: '作业 1 的 django__django-15368 也这样评：FAIL_TO_PASS 只有 test_f_expression 1 个，PASS_TO_PASS 有 29 个。',
        fx: [{ type: 'float', x: 460, y: 455, text: '15368：1 个', size: 13, color: C.bad, at: 200 }, { type: 'float', x: 660, y: 455, text: '15368：29 个', size: 13, color: C.ok, at: 600 }] }
    ]
  };

  /* ---------------- 场景 5：反过来造题——注入 bug ---------------- */
  var CODE5 = { lang: 'py', title: '讲义第 52 页 · 注入并检查一个 bug', src:
'# 能跑通的基线：4 个测试全过\n' +
'value = config.get("retries")\n' +
'return 3 if value is None else value\n' +
'\n' +
'# 变异：只改代码，不改测试\n' +
'return 3 if not value else value\n' +
'\n' +
'# 留下"新出现失败"的变异 = 一道新题：\n' +
'#   生成的 issue + 带 bug 的补丁\n' +
'#   + 验证过的测试\n' };
  var MUT = ['$ python -m unittest -v test_config',
    'test_missing (test_config.RetryTests.test_missing) ... ok', 'test_none (test_config.RetryTests.test_none) ... ok',
    'test_positive (test_config.RetryTests.test_positive) ... ok', 'test_zero (test_config.RetryTests.test_zero) ... FAIL',
    'AssertionError: 3 != 0', 'FAILED (failures=1)', '>> Mutated: 3 pass · 1 fail'];
  var sc5 = {
    name: '注入 bug 造题', desc: '从能跑通的仓库出发，改代码，不改测试。留下让测试新失败的改动，就是一道可验证的训练题。拿它做 RL，奖励只在最后给。',
    code: CODE5, dataTitle: '测试 / 奖励', data: { '通过': 4, '失败': 0, '奖励': '无' },
    bg: function (d) { title(d, '反过来：往能跑通的仓库里注入 bug，造出可验证的训练题'); },
    objects: function () {
      var o = {};
      base(o, { issue: '新任务实例', issueSub: 'issue + 带 bug 的补丁 + 测试', issueK: 'warn', agent: '造题流水线', agentSub: '变异代码 · 跑测试', shellSub: '跑测试筛题' });
      preset(o, ['repoG', 'repoT', 'agent', 'shell', 'fcli', 'fclient', 'fcfg', 'ftest', 'pCmd', 'pObs']);
      o.fcfg.fill = C.okW; o.fcfg.stroke = C.ok;
      ['t0', 't1', 't2', 't3'].forEach(function (k) { o[k].opacity = 1; o[k].fill = C.okW; o[k].stroke = C.ok; });
      o.aS = chip(470, 410, 92, 'Search', 'warn', 12); o.aE = chip(590, 410, 92, 'Edit', 'warn', 12); o.aT = chip(710, 410, 92, 'Test/finish', 'warn', 11);
      o.a1 = wire('M518,410 L542,410', C.warn); o.a2 = wire('M638,410 L662,410', C.warn);
      o.rw = node(800, 410, 56, 40, 'R', '', 'ok');
      o.a3 = wire('M758,410 L770,410', C.ok);
      o.back = wire('M800,432 C800,458 470,458 470,426', C.bad);
      o.bT = label(635, 472, '晚出的失败说不清是哪一步错的', C.bad, 'middle');
      return o;
    },
    steps: [
      { say: '从一个能跑通的仓库出发：4 个测试全过（讲义第 51–52 页的做法）。',
        fx: [{ type: 'pulse', obj: 'fcfg', color: C.ok, at: 0 }, { type: 'pulse', obj: 't3', color: C.ok, at: 300 }], log: ['>> Before: 4 pass · 0 fail'], hl: [1, 2, 3] },
      { say: '变异代码、不动测试：把 value is None 改成 not value。',
        set: join(on('pEdit', 600), { cmd: ride(700, 0, 'is None → not value'), edit: ride(800, 700, 'not value'), fcfg: recolor('bad', 1500) }),
        fx: [st('pEdit', 700, C.warn, 3), { type: 'shake', obj: 'fcfg', at: 1600 }], hl: [5, 6] },
      { say: '再跑测试：3 过 1 挂，挂的正是 test_zero。0 又被当成了 3。',
        set: { obs2: ride(800, 0, '3 过 1 挂'), t3: recolor('bad', 800) }, log: seq(MUT, 100), data: { '通过': { v: 3, at: 900 }, '失败': { v: 1, at: 900 } } },
      { say: '留下这种"让测试新失败"的变异。失败的测试就是验收标准。再配一段生成的 issue，就是一道新题。',
        set: join(on('pSend', 0), { issue: pop(300) }), fx: [st('pSend', 0, C.ok, 4), { type: 'burst', obj: 'issue', color: C.warn, at: 800 }], hl: [8, 9, 10] },
      { say: '收轨迹之前先验证环境。恢复原代码，4 个测试又全过，题目确实可解（讲义第 48 页）。',
        set: { fcfg: recolor('ok', 300), t3: recolor('ok', 600) }, log: ['>> Restored: 4 pass · 0 fail'], data: { '通过': { v: 4, at: 600 }, '失败': { v: 0, at: 600 } }, hl: [2, 3] },
      { say: '拿这道题做强化学习。智能体的每个动作都是训练目标：搜索、修改、测试/结束（讲义第 49 页）。',
        set: join({ aS: pop(0), aE: pop(250), aT: pop(500) }, on('a1', 300), on('a2', 550)), fx: [st('a1', 400, C.warn, 2), st('a2', 650, C.warn, 2)] },
      { say: '可奖励只在最后给一次：修好了 1，没修好 0。最后失败了，也说不清是前面哪一步做错的。',
        set: join(on('a3', 0), { rw: pop(200) }, on('back', 800), { bT: fade(1100) }), fx: [st('back', 900, C.bad, 5)], data: { '奖励': { v: '0 或 1', at: 400 } } }
    ]
  };

  VZ.register({
    id: 'c4-repair', title: '编程智能体修一个 bug：定位 → 修改 → 验证 → 交补丁 → 评分 → 造题',
    sources: [{ t: '第 6 讲 47:03–49:51（定位-修改-验证）', u: YT + '2823' }, { t: '第 6 讲 58:03–59:25（找相关代码）', u: YT + '3483' },
      { t: '第 6 讲 59:25–1:02:18（SWE-bench 与 FAIL_TO_PASS / PASS_TO_PASS）', u: YT + '3565' }, { t: '第 6 讲 1:05:08–1:07:14（SWE-smith 注入 bug）', u: YT + '3908' },
      { t: '讲义 lecture-06 第 33–36、44–45、48–52 页', u: L6 },
      { t: 'assignment-1 · tasks/code-skills/submit-task/SKILL.md', u: A1 + 'tasks/code-skills/submit-task/SKILL.md' },
      { t: 'assignment-1 · src/assignment/eval/harness.py', u: A1 + 'src/assignment/eval/harness.py' }, { t: 'SWE-bench 官网（排行榜）', u: 'https://www.swebench.com/' }],
    note: 'retries 例子和定位-修改-验证循环照讲义第 33–36 页。依赖图照第 45 页，注入 bug 的做法照第 51–52 页。控制台和数据面板全是本机实跑的输出。本机真建了 git 仓库，用 git grep 代替讲义里的 rg。测试用 python -m unittest 跑，补丁用 git diff 出。评分按作业 1 harness.py 的顺序。在新副本上先打候选补丁，后打测试补丁。控制台里的 Traceback 和本机路径行省略了。交卷三步照作业 1 的 SKILL.md。django__django-15368 的测试数数自作业 1 的 instance.json，FAIL_TO_PASS 1 个，PASS_TO_PASS 29 个。场景 5 最后两步照讲义第 49 页，RL 只在最后给奖励，是示意。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

/* 08 · 作业 1 —— ReAct 循环：拼提示 → 模型 → tool_calls → execute_tool_calls → tool 消息按 tool_call_id 接回
 * 结构出自 assignment-1 的 ASSIGNMENT.md Part 1 第 1–4 节和 src/assignment/agent/base.py（run / query_language_model）。
 * 控制台里的每一行、数据面板里的数，都来自 本机验算脚本 的 A 段实跑（run-verify.txt）：
 *   作业代码的示意实现（本机工作文件）+ 假环境 + 固定的"示意回复"，不调真实模型、不连 Modal。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var SRC_BASE = { t: 'assignment-1 · src/assignment/agent/base.py', u: 'https://github.com/cmu-agents/assignment-1/blob/main/src/assignment/agent/base.py' };
  var SRC_CODE = { t: 'assignment-1 · src/assignment/agent/code_agent.py', u: 'https://github.com/cmu-agents/assignment-1/blob/main/src/assignment/agent/code_agent.py' };
  var SRC_MD = { t: 'assignment-1 · ASSIGNMENT.md（Part 1）', u: 'https://github.com/cmu-agents/assignment-1/blob/main/ASSIGNMENT.md' };

  var KC = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], bad: [C.badW, C.bad], warn: [C.warnW, C.warn], neutral: [C.neutralW, C.neutral] };
  var PX = 153, PW = 228;
  function SY(i) { return 94 + i * 31; }
  function chip(text, k, x, y, op) {
    return { type: 'box', x: x, y: y, w: PW, h: 25, rx: 6, fill: KC[k][0], stroke: KC[k][1], sw: 1.3, text: text, size: 11.5, weight: 600, opacity: op == null ? 0 : op };
  }
  function node(x, y, w, h, t, sub, k, op) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: KC[k][0], stroke: KC[k][1], sw: 1.7, text: t, sub: sub, subMono: false, subSize: 11.5, size: 13.5, weight: 700, opacity: op == null ? 0 : op };
  }
  function path(d, col, extra) {
    var a = col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data';
    return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, arrow: a, opacity: 0 }, extra || {});
  }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function title(d, t) {
    d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg });
    d.rect(32, 50, 242, 490, { fill: C.bg, stroke: C.line1, sw: 1, rx: 10 });
    d.text(153, 68, '消息列表（每次请求的提示）', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
  }
  /* 公共的舞台：模型、run() 循环、分发、环境、步数 */
  var P_PROMPT = 'M278,104 L583,104', P_REPLY = 'M690,134 L690,300 L570,300', P_ASST = 'M370,300 L280,300',
    P_EXEC = 'M470,327 L470,380 L690,380 L690,409', P_OBS = 'M583,440 L280,440', P_SKILL = 'M430,327 L430,380 L408,380';
  function stage(op) {
    return {
      pPrompt: path(P_PROMPT, C.data), pReply: path(P_REPLY, C.info), pAsst: path(P_ASST, C.info),
      pExec: path(P_EXEC, C.warn), pObs: path(P_OBS, C.ok),
      M: node(690, 104, 210, 58, '模型', 'OpenAI 兼容端点（示意回复）', 'info', op),
      L: node(470, 200, 196, 52, 'run() 循环', 'while not self.finished', 'neutral', op),
      X: node(470, 300, 196, 52, 'execute_tool_calls', '按名字分发、解析参数', 'warn', op),
      E: node(690, 440, 210, 58, 'Environment', '沙箱（这里是假环境）', 'warn', op),
      S: { type: 'box', x: 600, y: 515, w: 190, h: 40, rx: 8, fill: C.bg, stroke: C.line, sw: 1.4, num: 0, fmt: 'int', pre: 'steps_taken = ', size: 13, weight: 700, mono: true, opacity: op == null ? 0 : op }
    };
  }
  function flyer(text, k, along) {
    return mix(chip(text, k, 0, 0, 0), { along: along, t: 0, trail: { n: 4, gap: 40 }, w: 150 });
  }
  function travel(name, d0) {
    var s = {}; s[name] = { t: { from: 0, to: 1, dur: 850, delay: d0 || 0, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 200, delay: (d0 || 0) + 850 } }; return s;
  }

  var CODE_LOOP = { lang: 'py', title: '示意实现 · base.py · run 的循环体', src:
'while not self.finished:\n' +
'    if self.steps_taken >= self.step_limit:\n' +
'        raise StepLimitError(...)\n' +
'    self.maybe_compact_context()\n' +
'    message = self.query_language_model()\n' +
'    self.history.append(message)\n' +
'    calls = message.get("tool_calls") or []\n' +
'    if calls:\n' +
'        self.history.extend(\n' +
'            self.execute_tool_calls(calls))\n' +
'    else:\n' +
'        self.history.append(\n' +
'            {"role": "user",\n' +
'             "content": NO_TOOL_NUDGE})\n' };

  /* ---------------- 场景 1：一圈 ReAct ---------------- */
  var sc1 = {
    name: '一圈 ReAct', desc: '拼提示、要动作、执行工具、把观察按 tool_call_id 接回历史，再进下一圈。',
    code: CODE_LOOP, dataTitle: '外壳状态', data: { steps_taken: 0, 'len(history)': 0, finished: 'False' },
    bg: function (d) { title(d, 'ReAct 循环的一圈：CodeAgent + 假环境 + 示意回复'); },
    objects: function () {
      var o = stage(0);
      o.c0 = chip('system · 系统提示 + 技能目录', 'data', PX, SY(0));
      o.c1 = chip('user · 任务：终局走法返回 500', 'data', PX, SY(1));
      o.a1f = flyer('assistant · call_1', 'info', 'pReply');
      o.a1 = chip('assistant · call_1 execute(ls)', 'info', 470, 300);
      o.cmd = { type: 'box', x: 690, y: 350, w: 120, h: 26, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.2, text: 'ls', mono: true, size: 12, weight: 700, opacity: 0 };
      o.t1f = flyer('tool · call_1', 'ok', 'pObs');
      o.t1 = chip('tool · call_1 · ls 的输出', 'ok', 280, 440);
      o.br = { type: 'path', d: 'M30,' + (SY(2) - 8) + ' L24,' + (SY(2) - 8) + ' L24,' + (SY(3) + 8) + ' L30,' + (SY(3) + 8), stroke: C.warn, sw: 2, opacity: 0 };
      o.brT = { type: 'text', x: 153, y: SY(4) + 2, text: 'call_1 的调用和观察成对出现', size: 11.5, color: C.warn, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '起点：消息列表里只有系统提示和任务两条。模型、外壳和环境就位。',
        set: { c0: pop(0), c1: pop(150), M: pop(300), L: pop(400), X: pop(500), E: pop(600), S: pop(700) }, hl: [1] },
      { say: '每一圈先查步数：0 < 10，继续。压缩开关没开，maybe_compact_context 直接返回。',
        fx: [{ type: 'pulse', obj: 'S', color: C.warn, at: 100 }, { type: 'float', x: 600, y: 480, text: '0 < 10', color: C.warn, size: 15, at: 200 },
          { type: 'pulse', obj: 'L', color: C.neutral, at: 900 }], hl: [2, 3, 4] },
      { say: 'query_language_model：build_prompt 拼出 2 条消息，连同 tools 发给模型，步数加一。',
        set: join(on('pPrompt'), { S: { num: { to: 1, dur: 500, delay: 900 } } }),
        fx: [{ type: 'pulse', obj: 'c0', color: C.data, at: 0 }, { type: 'pulse', obj: 'c1', color: C.data, at: 100 }, st('pPrompt', 200, C.data, 5),
          { type: 'ripple', obj: 'M', color: C.info, at: 900 }],
        log: [{ s: '[agent] step 1/10: requesting action', at: 200 }], data: { steps_taken: { v: 1, at: 900 } }, hl: [5] },
      { say: '模型回一条 assistant 消息：一句推理加一个 tool_call（call_1，execute，命令 ls）。它原样记进历史。',
        set: join(on('pReply'), on('pAsst', 900), travel('a1f'), { a1: mix(VZ.fly(PX, SY(2), 1000, 750), {}) }),
        fx: [st('pReply', 0, C.info, 4), st('pAsst', 900, C.info, 3), { type: 'ripple', x: PX, y: SY(2), r: 24, color: C.info, at: 1750 }],
        log: [{ s: '[agent] step 1: tool call(s): execute', at: 400 }], data: { 'len(history)': { v: 1, at: 1700 } }, hl: [6, 7] },
      { say: '有 tool_calls：交给 execute_tool_calls。它按名字找到 execute，解析参数，调用 env.execute("ls")。',
        set: join(on('pExec', 300), { cmd: pop(1100) }),
        fx: [{ type: 'pulse', obj: 'X', color: C.warn, at: 0 }, st('pExec', 300, C.warn, 5), { type: 'ripple', obj: 'E', color: C.warn, at: 1000 }], hl: [8, 9, 10] },
      { say: '环境回 output 和 returncode。format_tool_output 包成标签，作为 tool 消息（tool_call_id = call_1）接到历史末尾。',
        set: join(on('pObs'), travel('t1f'), { t1: VZ.fly(PX, SY(3), 950, 750), cmd: fade(0, 300, 0), br: fade(1700, 300), brT: fade(1800) }),
        fx: [st('pObs', 0, C.ok, 5), { type: 'ripple', x: PX, y: SY(3), r: 24, color: C.ok, at: 1700 }],
        log: [{ s: 'tool[call_1] <output>README.md\\npyproject.toml\\nsrc\\ntests\\n</output>\\n<returncode>0</returncode>', at: 300 }],
        data: { 'len(history)': { v: 2, at: 1600 } } },
      { say: '回到循环开头：finished 还是 False。下一次请求的提示变成 4 条消息。这一对动作和观察，就是模型看得到的"记忆"。',
        fx: [{ type: 'pulse', obj: 'L', color: C.neutral, at: 0 }, { type: 'pulse', obj: 'c0', color: C.data, at: 300 }, { type: 'pulse', obj: 'c1', color: C.data, at: 380 },
          { type: 'pulse', obj: 'a1', color: C.info, at: 460 }, { type: 'pulse', obj: 't1', color: C.ok, at: 540 }, st('pPrompt', 700, C.data, 7)], hl: [1] },
      { say: '循环一直转，直到某个工具把 finished 设成 True（CodeAgent 是 send_message），或者用完 step_limit。本机这一轮转了 7 步。',
        set: { S: { num: { to: 7, dur: 900, delay: 200 } } },
        fx: [{ type: 'float', x: 470, y: 160, text: 'finished = True', color: C.ok, size: 16, at: 1100 }],
        log: [{ s: 'finished = True  steps_taken = 7', at: 300 }], data: { steps_taken: { v: 7, at: 200 }, finished: { v: 'True', at: 1100 } } }
    ]
  };

  /* ---------------- 场景 2：坏调用变成可恢复的观察 ---------------- */
  var CODE_DISPATCH = { lang: 'py', title: '示意实现 · code_agent.py（节选、简写）', src:
'for call in tool_calls:\n' +
'    fn = call.get("function") or {}\n' +
'    name = fn.get("name")\n' +
'    raw = fn.get("arguments") or "{}"\n' +
'    try:\n' +
'        args = json.loads(raw)\n' +
'        if not isinstance(args, dict):\n' +
'            raise ValueError("not an object")\n' +
'    except ValueError as exc:\n' +
'        content = error(f"could not parse ...")\n' +
'    else:\n' +
'        if name not in names:\n' +
'            content = error(f"unknown tool ...")\n' +
'        elif name == "execute":\n' +
'            content = self._execute(args)\n' +
'    out.append({"role": "tool",\n' +
'                "tool_call_id": call.get("id"),\n' +
'                "content": content})\n' };
  var sc2 = {
    name: '坏调用可恢复', desc: '坏 JSON、未知工具、只有文字，都不碰沙箱，也不让运行崩掉。它们变成模型看得见的观察。',
    code: CODE_DISPATCH, dataTitle: '外壳状态', data: { steps_taken: 1, 'len(env.commands)': 1, 'len(history)': 2 },
    bg: function (d) { title(d, '三种"坏"回复：变成观察，循环继续'); },
    objects: function () {
      var o = stage(1);
      o.S.num = 1;
      o.c0 = chip('system · 系统提示 + 技能目录', 'data', PX, SY(0), 0.5);
      o.c1 = chip('user · 任务：终局走法返回 500', 'data', PX, SY(1), 0.5);
      o.a1 = chip('assistant · call_1 execute(ls)', 'info', PX, SY(2), 0.5);
      o.t1 = chip('tool · call_1 · ls 的输出', 'ok', PX, SY(3), 0.5);
      o.a2f = flyer('assistant · call_2', 'info', 'pReply');
      o.a2 = chip('assistant · call_2 execute({not json', 'info', 470, 300);
      o.t2 = chip('tool · call_2 · <error> 坏 JSON', 'bad', 470, 300);
      o.a3f = flyer('assistant · call_3', 'info', 'pReply');
      o.a3 = chip('assistant · call_3 read_file(…)', 'info', 470, 300);
      o.t3 = chip('tool · call_3 · <error> 未知工具', 'bad', 470, 300);
      o.a4f = flyer('assistant · 只有文字', 'info', 'pReply');
      o.a4 = chip('assistant · 只有一句推理，没有调用', 'info', 470, 300);
      o.n4 = chip('user · 提醒：上条没有工具调用', 'data', 470, 300);
      o.x1 = { type: 'text', x: 690, y: 488, text: '没收到命令', size: 13, weight: 700, color: C.bad, opacity: 0 };
      o.cnt = { type: 'box', x: 470, y: 150, w: 200, h: 30, rx: 7, fill: C.bg, stroke: C.line, sw: 1.2, text: "env.commands = ['ls']", mono: true, size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '接着上一圈。第 2 步，模型回了一个参数不是合法 JSON 的 execute 调用：{not json。',
        set: join(on('pPrompt'), on('pReply', 300), on('pAsst', 1100), travel('a2f', 300), { a2: VZ.fly(PX, SY(4), 1200, 700), S: { num: { to: 2, dur: 500, delay: 200 } } }),
        fx: [st('pPrompt', 0, C.data, 4), st('pReply', 300, C.info, 4), { type: 'ripple', x: PX, y: SY(4), r: 24, color: C.info, at: 1900 }],
        log: [{ s: '[agent] step 2/10: requesting action', at: 0 }, { s: '[agent] step 2: tool call(s): execute', at: 800 }],
        data: { steps_taken: { v: 2, at: 200 }, 'len(history)': { v: 3, at: 1900 } }, hl: [1, 2, 3, 4] },
      { say: 'json.loads 抛错，不执行任何命令，环境什么也没收到。错误被写成一条 tool 消息交回去，id 仍是 call_2。',
        set: { E: { opacity: { to: 0.35, dur: 300 } }, x1: fade(300), t2: VZ.fly(PX, SY(5), 700, 750) },
        fx: [{ type: 'shake', obj: 'X', at: 0 }, { type: 'flash', obj: 'X', color: C.bad, at: 100 }, { type: 'ripple', x: PX, y: SY(5), r: 24, color: C.bad, at: 1450 }],
        log: [{ s: '<error>could not parse arguments for execute: Expecting property name enclosed in double quotes: line 1 column 2 (char 1)</error>', at: 500 }],
        data: { 'len(history)': { v: 4, at: 1450 } }, hl: [5, 6, 9, 10] },
      { say: '第 3 步，模型调用了不存在的工具 read_file。同样不执行，错误里列出可用的工具，让它自己改正。',
        set: join(on('pPrompt'), travel('a3f', 300), { a3: VZ.fly(PX, SY(6), 1200, 700), t3: VZ.fly(PX, SY(7), 2100, 700), S: { num: { to: 3, dur: 500, delay: 200 } } }),
        fx: [st('pPrompt', 0, C.data, 4), st('pReply', 300, C.info, 4), { type: 'shake', obj: 'X', at: 1900 }, { type: 'ripple', x: PX, y: SY(7), r: 24, color: C.bad, at: 2800 }],
        log: [{ s: '[agent] step 3: tool call(s): read_file', at: 600 }, { s: "<error>unknown tool 'read_file'; available: execute, invoke_skill, send_message</error>", at: 2000 }],
        data: { steps_taken: { v: 3, at: 200 }, 'len(history)': { v: 6, at: 2800 } }, hl: [12, 13] },
      { say: '第 4 步，模型只写了一句推理、没有 tool_calls。循环保留这条回复，再补一条 user 提醒，什么也不执行。',
        set: join(on('pPrompt'), travel('a4f', 300), { a4: VZ.fly(PX, SY(8), 1200, 700), n4: VZ.fly(PX, SY(9), 2100, 700), S: { num: { to: 4, dur: 500, delay: 200 } } }),
        fx: [st('pPrompt', 0, C.data, 4), st('pReply', 300, C.info, 4), { type: 'pulse', obj: 'L', color: C.neutral, at: 1900 }],
        log: [{ s: '[agent] step 4: response contained no parsed tool call; the loop should preserve the response and continue', at: 700 }],
        data: { steps_taken: { v: 4, at: 200 }, 'len(history)': { v: 8, at: 2800 } }, hl: [] },
      { say: '到这里，环境只执行过一条命令 ls。坏 JSON、未知工具、纯文字都没碰沙箱，也都没让运行崩掉。',
        set: { cnt: pop(0) }, fx: [{ type: 'pulse', obj: 'cnt', color: C.warn, at: 300 }, { type: 'pulse', obj: 'E', color: C.neutral, at: 500 }],
        data: { 'len(env.commands)': 1 } },
      { say: '每个调用都配一条 tool 消息（call_2、call_3）。这样提供商才会接受下一次请求。纯文字那步没有调用，接的是 user 提醒。',
        fx: [{ type: 'pulse', obj: 'a2', color: C.info, at: 0 }, { type: 'pulse', obj: 't2', color: C.bad, at: 150 }, { type: 'pulse', obj: 'a3', color: C.info, at: 700 },
          { type: 'pulse', obj: 't3', color: C.bad, at: 850 }, { type: 'pulse', obj: 'a4', color: C.info, at: 1400 }, { type: 'pulse', obj: 'n4', color: C.data, at: 1550 }], hl: [16, 17, 18] }
    ]
  };

  /* ---------------- 场景 3：取技能并提交 ---------------- */
  var CODE_SUBMIT = { lang: 'py', title: '示意实现 · code_agent.py（节选）', src:
'def _invoke_skill(self, args):\n' +
'    name = args.get("name")\n' +
'    if name not in self.skills:\n' +
'        return error(f"unknown skill {name!r}")\n' +
'    return self.skills[name]["content"]\n' +
'\n' +
'def _send_message(self, args):\n' +
'    summary = args.get("summary")\n' +
'    if not isinstance(summary, str):\n' +
'        return error("summary must be a string")\n' +
'    patch = self.env.execute("cat patch.txt")\n' +
'    if patch.get("returncode") == 0:\n' +
'        self.submitted_patch = patch["output"]\n' +
'    self.finished = True\n' +
'    return format_tool_output({"status": ...})\n' };
  var sc3 = {
    name: '取技能并提交', desc: '按技能目录取全文，照做生成 patch.txt，send_message 结束循环。finally 写轨迹、关沙箱。',
    code: CODE_SUBMIT, dataTitle: '外壳状态', data: { steps_taken: 4, finished: 'False', submitted_patch: "''" },
    bg: function (d) { title(d, '技能 → 补丁 → send_message → 循环结束'); },
    objects: function () {
      var o = stage(1);
      o.S.num = 4;
      o.pSkill = path(P_SKILL, C.data);
      o.K = node(343, 380, 120, 46, 'self.skills', 'submit-task', 'data', 1);
      o.T = node(380, 515, 170, 40, 'trajectory.json', '', 'neutral', 0);
      o.c0 = chip('system · 技能目录：submit-task', 'data', PX, SY(0), 1);
      o.c1 = chip('user · 任务', 'data', PX, SY(1), 0.55);
      o.c2 = chip('… 前 4 步，8 条 …', 'neutral', PX, SY(2), 0.55);
      o.a5f = flyer('assistant · call_5', 'info', 'pReply');
      o.a5 = chip('assistant · call_5 invoke_skill', 'info', 470, 300);
      o.t5 = chip('tool · call_5 · 技能全文', 'ok', 343, 380);
      o.a6f = flyer('assistant · call_6', 'info', 'pReply');
      o.a6 = chip('assistant · call_6 execute(git diff…)', 'info', 470, 300);
      o.t6 = chip('tool · call_6 · 退出码 0', 'ok', 280, 440);
      o.a7f = flyer('assistant · call_7', 'info', 'pReply');
      o.a7 = chip('assistant · call_7 send_message', 'info', 470, 300);
      o.t7 = chip('tool · call_7 · 已送达，结束', 'ok', 470, 300);
      o.cmd = { type: 'box', x: 690, y: 350, w: 210, h: 26, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.2, text: 'git diff -- … > patch.txt', mono: true, size: 11.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '系统提示里早就有技能目录。目录里只有 submit-task 的名字和描述（约 46 个 token），没有 patch.txt 这几个字。',
        fx: [{ type: 'pulse', obj: 'c0', color: C.data, at: 0 }, { type: 'float', x: 153, y: SY(0) - 22, text: '目录 46 tokens', color: C.data, size: 14, at: 300 }, { type: 'pulse', obj: 'K', color: C.data, at: 800 }] },
      { say: '第 5 步，模型先调 invoke_skill("submit-task")。这个工具不碰沙箱，直接从 self.skills 里取。',
        set: join(on('pPrompt'), on('pReply', 300), on('pSkill', 1900), travel('a5f', 300), { a5: VZ.fly(PX, SY(3), 1200, 700), S: { num: { to: 5, dur: 500, delay: 200 } } }),
        fx: [st('pPrompt', 0, C.data, 4), st('pReply', 300, C.info, 4), st('pSkill', 1900, C.data, 3), { type: 'ripple', obj: 'K', color: C.data, at: 2500 }],
        log: [{ s: '[agent] step 5/10: requesting action', at: 0 }, { s: '[agent] step 5: tool call(s): invoke_skill', at: 800 }],
        data: { steps_taken: { v: 5, at: 200 } }, hl: [1, 2, 3, 4, 5] },
      { say: '技能全文（约 335 个 token）作为 tool 消息进来。里面才写着：用 git diff 生成 patch.txt、读一遍检查、再 send_message。',
        set: { t5: VZ.fly(PX, SY(4), 100, 800) },
        fx: [{ type: 'ripple', x: PX, y: SY(4), r: 26, color: C.ok, at: 900 }, { type: 'float', x: 153, y: SY(4) + 26, text: '全文 335 tokens', color: C.ok, size: 14, at: 1000 }], hl: [5] },
      { say: '第 6 步，照技能做：execute 运行 git diff -- src/chess_app/game.py > patch.txt，退出码 0。',
        set: join(on('pExec', 1200), on('pObs', 2300), travel('a6f', 300), { a6: VZ.fly(PX, SY(5), 1200, 700), cmd: pop(1900), t6: VZ.fly(PX, SY(6), 2500, 700), S: { num: { to: 6, dur: 500, delay: 200 } } }),
        fx: [st('pReply', 300, C.info, 4), st('pExec', 1200, C.warn, 4), st('pObs', 2300, C.ok, 4)],
        log: [{ s: '[agent] step 6/10: requesting action', at: 0 }, { s: '[agent] step 6: tool call(s): execute', at: 800 }],
        data: { steps_taken: { v: 6, at: 200 } }, hl: [] },
      { say: '第 7 步 send_message：外壳读一次 patch.txt 存进 submitted_patch，然后把 finished 设成 True。',
        set: join(travel('a7f', 300), { a7: VZ.fly(PX, SY(7), 1200, 700), cmd: { text: { to: 'cat patch.txt', delay: 1500 } }, t7: VZ.fly(PX, SY(8), 2700, 700), S: { num: { to: 7, dur: 500, delay: 200 } } }),
        fx: [st('pReply', 300, C.info, 4), st('pExec', 1500, C.warn, 4), { type: 'ripple', obj: 'E', color: C.warn, at: 2200 }],
        log: [{ s: '[agent] step 7: tool call(s): send_message', at: 600 }, { s: "env.commands = ['ls', 'git diff -- src/chess_app/game.py > patch.txt', 'cat patch.txt']", at: 2300 }],
        data: { steps_taken: { v: 7, at: 200 }, submitted_patch: { v: "'diff --git a/src/…'", at: 2400 }, finished: { v: 'True', at: 3200 } }, hl: [11, 12, 13, 14, 15] },
      { say: 'while not self.finished 不再成立，循环结束：这一轮一共 7 步。',
        fx: [{ type: 'pulse', obj: 'L', color: C.ok, at: 0 }, { type: 'float', x: 470, y: 160, text: '循环结束', color: C.ok, size: 16, at: 200 }],
        log: [{ s: 'finished = True  steps_taken = 7', at: 200 }] },
      { say: '最后 finally 块照常执行，它是 starter 给好的，不许改。它把 prompts、responses、compactions 写进轨迹文件，按 auto_stop_environment 关掉沙箱。',
        set: { T: pop(0), E: { opacity: { to: 0.4, dur: 400, delay: 700 }, sub: { to: 'stop()', delay: 700 } } },
        fx: [{ type: 'ripple', obj: 'T', color: C.neutral, at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：步数上限 ---------------- */
  var sc4 = {
    name: '步数上限', desc: '同样的示意回复，把 step_limit 设成 3。第 4 圈开头就抛 StepLimitError，finally 照样写轨迹。',
    code: CODE_LOOP, dataTitle: '外壳状态', data: { steps_taken: 0, step_limit: 3, finished: 'False' },
    bg: function (d) { title(d, 'step_limit = 3：恰好 3 次请求，然后抛异常'); },
    objects: function () {
      var o = stage(1);
      o.T = node(380, 515, 170, 40, 'trajectory.json', '', 'neutral', 0);
      o.c0 = chip('system · 系统提示（没给技能）', 'data', PX, SY(0), 1);
      o.c1 = chip('user · 任务', 'data', PX, SY(1), 1);
      ['call_1 execute(ls)', 'call_2 execute({not json', 'call_3 read_file(…)'].forEach(function (t, i) {
        o['a' + i] = chip('assistant · ' + t, 'info', 470, 300);
        o['t' + i] = chip('tool · ' + t.split(' ')[0] + (i ? ' · <error>' : ' · ls 的输出'), i ? 'bad' : 'ok', 470, 300);
      });
      o.lim = { type: 'box', x: 470, y: 146, w: 210, h: 30, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.6, text: 'StepLimitError', mono: true, size: 14, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '同一串示意回复，换成没有技能的 CodeAgent，并把 step_limit 设成 3。',
        fx: [{ type: 'pulse', obj: 'S', color: C.warn, at: 0 }], hl: [1, 2, 3] },
      { say: '第 1 圈：0 < 3，请求、执行 ls、接回观察。',
        set: join(on('pPrompt'), on('pReply'), on('pExec'), on('pObs'), { a0: VZ.fly(PX, SY(2), 700, 600), t0: VZ.fly(PX, SY(3), 1400, 600), S: { num: { to: 1, dur: 400, delay: 200 } } }),
        fx: [st('pPrompt', 0, C.data, 3), st('pReply', 300, C.info, 3), st('pExec', 900, C.warn, 3)],
        log: [{ s: '[agent] step 1/3: requesting action', at: 0 }, { s: '[agent] step 1: tool call(s): execute', at: 700 }], data: { steps_taken: { v: 1, at: 200 } }, hl: [5] },
      { say: '第 2 圈：1 < 3，坏 JSON，变成错误观察。',
        set: { a1: VZ.fly(PX, SY(4), 700, 600), t1: VZ.fly(PX, SY(5), 1400, 600), S: { num: { to: 2, dur: 400, delay: 200 } } },
        fx: [st('pPrompt', 0, C.data, 3), st('pReply', 300, C.info, 3), { type: 'shake', obj: 'X', at: 1200 }],
        log: [{ s: '[agent] step 2/3: requesting action', at: 0 }, { s: '[agent] step 2: tool call(s): execute', at: 700 }], data: { steps_taken: { v: 2, at: 200 } } },
      { say: '第 3 圈：2 < 3，未知工具，变成错误观察。finished 仍是 False。',
        set: { a2: VZ.fly(PX, SY(6), 700, 600), t2: VZ.fly(PX, SY(7), 1400, 600), S: { num: { to: 3, dur: 400, delay: 200 } } },
        fx: [st('pPrompt', 0, C.data, 3), st('pReply', 300, C.info, 3), { type: 'shake', obj: 'X', at: 1200 }],
        log: [{ s: '[agent] step 3/3: requesting action', at: 0 }, { s: '[agent] step 3: tool call(s): read_file', at: 700 }], data: { steps_taken: { v: 3, at: 200 } } },
      { say: '回到开头：3 ≥ 3，抛出 StepLimitError。正好发了 3 次请求，公开测试 test_step_limit_raises 数的就是请求次数。',
        set: { lim: pop(300), S: { stroke: { to: C.bad, dur: 300 }, fill: { to: C.badW, dur: 300 } } },
        fx: [{ type: 'flash', obj: 'S', color: C.bad, at: 0 }, { type: 'burst', x: 470, y: 146, color: C.bad, at: 500 }],
        log: [{ s: 'StepLimitError: not finished after 3 model calls | steps_taken = 3 | finished = False', at: 600 }], hl: [2, 3] },
      { say: '异常往外抛之前，finally 照样写轨迹、关沙箱。失败的运行也必须留下轨迹，评分要看。',
        set: { T: pop(0), E: { opacity: { to: 0.4, dur: 400, delay: 600 }, sub: { to: 'stop()', delay: 600 } } },
        fx: [{ type: 'ripple', obj: 'T', color: C.neutral, at: 300 }] }
    ]
  };

  VZ.register({
    id: 'c8-react', title: 'ReAct 循环：一圈一圈地转，坏调用变成观察',
    sources: [SRC_MD, SRC_BASE, SRC_CODE],
    note: '循环结构、四种角色、坏 JSON / 未知工具要变成可恢复的观察。只有文字时保留回复并继续、步数上限、finally 写轨迹并关沙箱。这些都出自 ASSIGNMENT.md Part 1，以及 base.py / code_agent.py 的 starter。代码面板是本笔记的示意实现。模型回复是固定的示意回复，环境是只记录命令的假环境。控制台每一行、数据面板的数都是本机实算的真实输出。"目录 46 / 全文 335 tokens"用 harness 自己的 rough_message_tokens 算出。',
    legend: [[C.data, '系统 / 任务 / 提示消息'], [C.info, '模型和它的 assistant 消息'], [C.warn, '工具调用 / 环境'], [C.ok, 'tool 观察'], [C.bad, '错误观察']],
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

/* 08 · 作业 1 —— 技能的渐进披露（Part 1 第 4 节）与上下文压缩（Part 2）
 * 规则出自 assignment-1 的 ASSIGNMENT.md 和 src/assignment/agent/base.py（load_skills / maybe_compact_context / compact_context）。
 * 所有 token 数都用 harness 自己的 rough_message_tokens（JSON 字符数 ÷ 4 向上取整）在本机算出：
 * 本机验算脚本 的 B1、B2 段（run-verify.txt）。压缩时模型写的摘要是固定的"示意回复"。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var SRC_MD = { t: 'assignment-1 · ASSIGNMENT.md（Part 1 第 4 节、Part 2）', u: 'https://github.com/cmu-agents/assignment-1/blob/main/ASSIGNMENT.md' };
  var SRC_BASE = { t: 'assignment-1 · src/assignment/agent/base.py', u: 'https://github.com/cmu-agents/assignment-1/blob/main/src/assignment/agent/base.py' };
  var SRC_SKILL = { t: 'assignment-1 · tasks/code-skills/submit-task/SKILL.md', u: 'https://github.com/cmu-agents/assignment-1/blob/main/tasks/code-skills/submit-task/SKILL.md' };
  var KC = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], bad: [C.badW, C.bad], warn: [C.warnW, C.warn], neutral: [C.neutralW, C.neutral] };
  function box(x, y, w, h, t, k, o) {
    return mix({ type: 'box', x: x, y: y, w: w, h: h, rx: 7, fill: KC[k][0], stroke: KC[k][1], sw: 1.4, text: t, size: 12, weight: 650, opacity: 0 }, o || {});
  }
  function txt(x, y, t, o) { return mix({ type: 'text', x: x, y: y, text: t, size: 12, color: C.fg2, anchor: 'start', opacity: 0 }, o || {}); }
  function path(d, col, extra) {
    var a = col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data';
    return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, arrow: a, opacity: 0 }, extra || {});
  }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }

  /* ================= 场景 1：技能目录 ================= */
  var FILE = ['---', 'name: submit-task', 'description: When the task is complete,', '  take the required steps to submit …', '---',
    'When you have finished, you must submit', '# Step 1: Create the patch file', 'Run `git diff -- … > patch.txt` …',
    '# Step 2: Verify the patch', '# Step 3: Submit (send_message)'];
  var CODE_LOAD = { lang: 'py', title: '示意实现 · base.py · load_skills（简写）', src:
'for folder in sorted(child_dirs):\n' +
'    text = (folder / "SKILL.md").read_text()\n' +
'    match = FRONTMATTER.match(text)\n' +
'    if not match:\n' +
'        raise ValueError("missing frontmatter")\n' +
'    meta = yaml.safe_load(match.group(1))\n' +
'    name = meta.get("name")\n' +
'    desc = meta.get("description")\n' +
'    if not name or not desc:\n' +
'        raise ValueError("needs name + desc")\n' +
'    if name in skills:\n' +
'        raise ValueError("duplicate skill name")\n' +
'    skills[name] = {\n' +
'        "metadata": f"name: {name}\\n"\n' +
'                    f"description: {desc}",\n' +
'        "content": text}\n' };
  var BX = 200, BK = 0.42;   // 条形图起点、每 token 的像素
  var sc1 = {
    name: '技能目录', desc: 'load_skills 只把 name + description 拼成目录，放进系统提示。全文留在字典里，等着按需取。',
    code: CODE_LOAD, dataTitle: 'rough tokens（本机算）', data: { '目录 submit-task': 0, '全文 submit-task': 0, '目录 select-move': 0, '全文 select-move': 0 },
    bg: function (d) {
      title(d, '渐进披露的第一层：系统提示里只放技能目录');
      d.text(46, 58, 'tasks/code-skills/submit-task/SKILL.md', { size: 12, weight: 700, color: C.fg2, mono: true });
      d.text(380, 58, 'self.skills（load_skills 的返回值）', { size: 12, weight: 700, color: C.fg2 });
      d.text(648, 58, '系统提示（CodeAgent）', { size: 12, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      o.file = { type: 'box', x: 40, y: 68, w: 300, h: 262, rx: 8, anchor: 'tl', fill: C.bg, stroke: C.line, sw: 1.3, opacity: 0 };
      FILE.forEach(function (t, i) {
        o['f' + i] = txt(52, 88 + i * 24.5, t, { mono: true, size: 11.5, color: i < 5 ? C.data : C.fg2, weight: i < 5 ? 700 : 400 });
      });
      o.fm = { type: 'box', x: 46, y: 76, w: 288, h: 122, rx: 6, anchor: 'tl', fill: 'none', stroke: C.data, sw: 2, dasharray: '5 4', opacity: 0 };
      o.pParse = path('M342,140 L376,140', C.data);
      o.yaml = box(490, 110, 210, 44, 'name / description', 'data', { sub: 'yaml.safe_load(frontmatter)', subSize: 11 });
      o.meta = box(490, 190, 210, 44, 'metadata（2 行）', 'data', { sub: 'name: … / description: …', subSize: 11 });
      o.cont = box(490, 270, 210, 44, 'content（整个文件）', 'ok', { sub: '1,278 个字符', subSize: 11, subMono: false });
      o.sys = { type: 'box', x: 632, y: 68, w: 198, h: 200, rx: 8, anchor: 'tl', fill: C.bg, stroke: C.line, sw: 1.3, opacity: 0 };
      ['You are a software engineering', 'agent … system_information …', 'Reusable skills are available.'].forEach(function (t, i) {
        o['s' + i] = txt(642, 88 + i * 20, t, { size: 11.5, color: C.fg3 });
      });
      o.cat = box(731, 210, 182, 62, '<skills>', 'data', { sub: 'name: submit-task', subSize: 11.5, size: 12 });
      o.pCat = path('M596,190 L620,190 L620,210 L638,210', C.data);
      o.tool = box(731, 300, 182, 30, '+ INVOKE_SKILL_TOOL', 'warn', { mono: true, size: 11.5 });
      // 条形图
      o.lb0 = txt(46, 390, 'submit-task', { weight: 700, color: C.fg, mono: true });
      o.lb1 = txt(46, 470, 'select-move', { weight: 700, color: C.fg, mono: true });
      o.b0m = box(BX, 376, 0, 18, '', 'data', { anchor: 'l', sw: 0, fill: C.data });
      o.b0c = box(BX, 402, 0, 18, '', 'ok', { anchor: 'l', sw: 0, fill: C.ok });
      o.b1m = box(BX, 456, 0, 18, '', 'data', { anchor: 'l', sw: 0, fill: C.data });
      o.b1c = box(BX, 482, 0, 18, '', 'ok', { anchor: 'l', sw: 0, fill: C.ok });
      o.v0m = txt(BX + 46 * BK + 8, 376, '目录 46', { color: C.data, weight: 700 });
      o.v0c = txt(BX + 335 * BK + 8, 402, '全文 335', { color: C.ok, weight: 700 });
      o.v1m = txt(BX + 24 * BK + 8, 456, '目录 24', { color: C.data, weight: 700 });
      o.v1c = txt(BX + 1228 * BK + 8, 482, '全文 1,228', { color: C.ok, weight: 700 });
      o.ratio = box(770, 420, 110, 28, '约 51 倍', 'info', { size: 13 });
      return o;
    },
    steps: [
      { say: '技能是一个子目录里的 SKILL.md。开头两条 --- 之间是 YAML 头（frontmatter），写着 name 和 description。后面是正文。',
        set: (function () { var s = { file: fade(0, 300) }; FILE.forEach(function (t, i) { s['f' + i] = fade(150 + i * 70, 250); }); return s; })(), hl: [1, 2] },
      { say: '用正则取出头部，交给 yaml.safe_load：得到 name 和 description。没有头部、YAML 坏了、缺字段，都抛清楚的 ValueError。',
        set: join(on('pParse', 400), { fm: fade(0, 300), yaml: pop(800) }),
        fx: [st('pParse', 400, C.data, 4)], hl: [3, 4, 5, 6, 7, 8, 9, 10] },
      { say: '名字不能重复。每个技能存两样：metadata（两行：name 和 description），content（整个文件原文）。',
        set: { meta: pop(0), cont: pop(400) },
        fx: [{ type: 'pulse', obj: 'meta', color: C.data, at: 300 }, { type: 'pulse', obj: 'cont', color: C.ok, at: 700 }], hl: [11, 12, 13, 14, 15, 16] },
      { say: 'CodeAgent 把所有技能的 metadata 拼成目录，包进系统提示的 <skills> 块。基类同时把 invoke_skill 工具加进工具表。全文不进提示。',
        set: join(on('pCat', 200), { sys: fade(0, 300), s0: fade(100), s1: fade(200), s2: fade(300), cat: pop(900), tool: pop(1400) }),
        fx: [st('pCat', 200, C.data, 4), { type: 'flash', obj: 'cont', color: C.neutral, at: 600 }],
        log: [{ s: "tools = ['invoke_skill', 'execute', 'send_message']", at: 1400 }] },
      { say: '代价差多少？用外壳自己的估算，JSON 字符数 ÷ 4。submit-task 的目录一条 46 个 token，全文 335 个。',
        set: { lb0: fade(0), b0m: { w: { to: 46 * BK, dur: 600, delay: 100 }, opacity: { to: 0.85, dur: 200, delay: 100 } }, b0c: { w: { to: 335 * BK, dur: 800, delay: 300 }, opacity: { to: 0.85, dur: 200, delay: 300 } },
          v0m: fade(700), v0c: fade(1100) },
        log: [{ s: 'rough tokens: 目录一条 = 46 ；全文 = 335', at: 300 }], data: { '目录 submit-task': { v: 46, at: 100 }, '全文 submit-task': { v: 335, at: 300 } } },
      { say: 'Part 3 的下棋技能 select-move 差得更多：目录 24，全文 1,228，约 51 倍。技能一多，只放目录就省下大量上下文。',
        set: { lb1: fade(0), b1m: { w: { to: 24 * BK, dur: 600, delay: 100 }, opacity: { to: 0.85, dur: 200, delay: 100 } }, b1c: { w: { to: 1228 * BK, dur: 1000, delay: 300 }, opacity: { to: 0.85, dur: 200, delay: 300 } },
          v1m: fade(700), v1c: fade(1300), ratio: pop(1600) },
        log: [{ s: 'select-move: len(metadata) = 61  len(content) = 4771  rough tokens 目录/全文 = 24 / 1228', at: 300 }],
        data: { '目录 select-move': { v: 24, at: 100 }, '全文 select-move': { v: 1228, at: 300 } } }
    ]
  };

  /* ================= 场景 2：按需取全文、坏文件、没有技能 ================= */
  var sc2 = {
    name: '按需取全文', desc: '第二层：模型调 invoke_skill 时，全文才作为观察进来。坏的技能文件在加载时就报错。没有技能时，提示里不提提交方法。',
    code: CODE_LOAD, dataTitle: '提示里有没有', data: { 'submit-task': 'True', 'patch.txt': 'False' },
    bg: function (d) { title(d, '渐进披露的第二层：invoke_skill 按需取全文'); },
    objects: function () {
      var o = {};
      o.pAsk = path('M290,130 L536,130', C.info);
      o.pBack = path('M538,230 L420,230 L420,250 L290,250', C.ok);
      o.sys = box(170, 130, 230, 46, '系统提示：<skills> 目录', 'data', { opacity: 1, sub: 'name + description，46 tokens', subSize: 11 });
      o.K = box(650, 160, 220, 120, 'self.skills', 'ok', { opacity: 1, sub: "['submit-task'] → content", subSize: 11 });
      o.call = box(410, 104, 190, 28, 'invoke_skill("submit-task")', 'warn', { mono: true, size: 11.5 });
      o.obs = box(170, 250, 230, 46, 'tool 消息：技能全文', 'ok', { sub: '335 tokens，含 patch.txt 的做法', subSize: 11 });
      o.e0 = box(240, 360, 360, 30, 'no-frontmatter → ValueError', 'bad', { mono: true, size: 11.5 });
      o.e1 = box(240, 400, 360, 30, 'bad-yaml → ValueError', 'bad', { mono: true, size: 11.5 });
      o.e2 = box(240, 440, 360, 30, 'no-desc → ValueError', 'bad', { mono: true, size: 11.5 });
      o.none = box(650, 420, 300, 90, '没有技能（skills_path=None）', 'neutral', { sub: "工具只有 execute、send_message", subSize: 11.5 });
      return o;
    },
    steps: [
      { say: '模型在系统提示里看到目录，有个 submit-task。描述说"提交前必须先调用它"，它就决定调用 invoke_skill。',
        set: join(on('pAsk', 300), { call: pop(200) }), fx: [{ type: 'pulse', obj: 'sys', color: C.data, at: 0 }, st('pAsk', 300, C.info, 4), { type: 'ripple', obj: 'K', color: C.ok, at: 1000 }] },
      { say: '外壳按名字从 self.skills 取出全文，作为这次调用的 tool 观察接回去。这时提示里才第一次出现 patch.txt。',
        set: join(on('pBack'), { obs: pop(800) }), fx: [st('pBack', 0, C.ok, 5), { type: 'ripple', obj: 'obs', color: C.ok, at: 900 }],
        data: { 'patch.txt': { v: 'True', at: 900 } } },
      { say: '所以目录要写清"什么时候该取"。submit-task 的描述写着，提交前一定要先调用它。全文的 335 个 token，只在真用时才付。',
        fx: [{ type: 'pulse', obj: 'sys', color: C.data, at: 0 }, { type: 'float', x: 170, y: 96, text: 'DO NOT submit without invoking this skill', color: C.data, size: 12, at: 300 },
          { type: 'pulse', obj: 'obs', color: C.ok, at: 1200 }] },
      { say: '加载时就把坏文件拦下。没有 --- 头、YAML 写坏、缺 description，三种都是清楚的 ValueError。这是本机实跑，路径缩写成 …。',
        set: { e0: pop(100), e1: pop(900), e2: pop(1700) }, hl: [4, 5, 6, 9, 10],
        log: [{ s: 'no-frontmatter  ValueError: …\\skills-bad\\no-frontmatter\\s\\SKILL.md: missing --- frontmatter ---', at: 100 },
          { s: 'bad-yaml        ValueError: …\\skills-bad\\bad-yaml\\s\\SKILL.md: malformed frontmatter', at: 900 },
          { s: 'no-desc         ValueError: …\\skills-bad\\no-desc\\s\\SKILL.md: frontmatter needs a description', at: 1700 }] },
      { say: '名字重复也要报错，这是作业点名的私有测试项。两个技能叫同一个名字，invoke_skill 就不知道该给哪个。',
        fx: [{ type: 'shake', obj: 'K', at: 200 }], hl: [11, 12] },
      { say: '没有技能时，工具表里没有 invoke_skill。系统提示里既没有 submit-task，也没有 patch.txt。作业明确要求这样。',
        set: { none: pop(0) }, data: { 'submit-task': { v: 'False', at: 300 }, 'patch.txt': { v: 'False', at: 300 } },
        log: [{ s: "无技能时的工具 = ['execute', 'send_message']", at: 200 }, { s: '无技能时 prompt 提到 patch.txt？ False ；提到 submit-task？ False', at: 1000 }] }
    ]
  };

  /* ================= 场景 3 / 4 公共：提示的"堆叠图" ================= */
  var K = 0.048, X0 = 46, SW = 236, Y0 = 72, GAP = 3;
  var BLOCKS = [['sys', 'system', 252, 'data'], ['task', 'user · 任务', 302, 'data'], ['p1', 'call_1 cat tests/…', 2537, 'info'],
    ['p2', 'call_2 cat game.py', 2536, 'info'], ['p3', 'call_3 pytest', 79, 'info'], ['p4', 'call_4 cat server.py', 2535, 'info']];
  function hOf(t) { return Math.max(18, t * K); }
  var YS = {}; (function () { var y = Y0; BLOCKS.forEach(function (b) { YS[b[0]] = y; y += hOf(b[2]) + GAP; }); })();
  function stackObjs(op) {
    var o = {};
    BLOCKS.forEach(function (b, i) {
      var long = b[2] > 1000;
      o['b_' + b[0]] = { type: 'box', x: X0, y: YS[b[0]], w: SW, h: hOf(b[2]), rx: 5, anchor: 'tl', fill: KC[i < 2 ? 'data' : 'info'][0], stroke: KC[i < 2 ? 'data' : 'info'][1], sw: 1.3,
        text: b[1] + (long ? '' : ''), sub: long ? '+ 截断后的观察（约 2.5k tokens）' : '', subMono: false, subSize: 11, size: 11.5, weight: 650, opacity: op[i] };
    });
    return o;
  }
  var GX = 360, GK = 0.05, GY = 108;
  function gauge(o, v0) {
    o.gbg = { type: 'box', x: GX, y: GY, w: 9000 * GK, h: 22, rx: 4, anchor: 'l', fill: C.bg3, stroke: C.line1, sw: 1, opacity: 1 };
    o.g = { type: 'box', x: GX, y: GY, w: v0 * GK, h: 22, rx: 4, anchor: 'l', fill: C.data, stroke: 'none', sw: 0, opacity: 0.85 };
    o.thr = { type: 'line', x1: GX + 6000 * GK, y1: GY - 20, x2: GX + 6000 * GK, y2: GY + 20, stroke: C.bad, sw: 2.5, opacity: 1 };
    o.thrT = { type: 'text', x: GX + 6000 * GK, y: GY - 30, text: '阈值 6000', size: 12, weight: 700, color: C.bad, opacity: 1 };
    o.gv = { type: 'text', x: GX, y: GY + 32, num: v0, fmt: 'comma', pre: '估计 ', post: ' tokens', size: 13, weight: 700, color: C.fg, anchor: 'start', opacity: 1, mono: true };
    return o;
  }

  /* ================= 场景 3：上下文变长 ================= */
  var CODE_MAYBE = { lang: 'py', title: 'assignment-1 · base.py · maybe_compact_context（节选）', src:
'if not self.compaction_enabled:\n' +
'    return False\n' +
'if (self.estimate_active_prompt_tokens()\n' +
'        < self.compact_threshold_tokens):\n' +
'    return False\n' +
'prompt_before = deepcopy(self.build_prompt())\n' +
'n = len([m for m in prompt_before\n' +
'         if m.get("role") == "assistant"])\n' +
'if n <= self.compaction_keep_recent_steps:\n' +
'    return False\n' +
'prompt, resp = self.compact_context()\n' +
'self.compaction_events.append({...})\n' +
'return True\n' };
  var REQ = [[554, "第 1 次动作请求：2 条消息，rough tokens = 554，roles = ['system', 'user']"],
    [3091, "第 2 次动作请求：4 条消息，rough tokens = 3091，roles = ['system', 'user', 'assistant', 'tool']"],
    [5627, "第 3 次动作请求：6 条消息，rough tokens = 5627，roles = ['system', 'user', 'assistant', 'tool', 'assistant', 'tool']"],
    [5706, "第 4 次动作请求：8 条消息，rough tokens = 5706，roles = ['system', 'user', 'assistant', 'tool', 'assistant', 'tool', 'assistant', 'tool']"],
    [8241, "请求顺序 = ['action', 'action', 'action', 'action', 'COMPACT', 'action']"]];
  var sc3 = {
    name: '上下文变长', desc: '每读一个大文件，提示就多约 2.5k tokens。第 5 次请求前估到 8,241，越过 6,000 的阈值。',
    code: CODE_MAYBE, dataTitle: '压缩判断', data: { '估计 tokens': 554, '阈值': 6000, 'assistant 条数': 0, compactions: 0 }, dataFmt: { '估计 tokens': 'comma', '阈值': 'comma' },
    bg: function (d) {
      title(d, '上下文越来越长（阈值 6000，保留最近 1 步）');
      d.text(X0, 60, '提示（高度 ∝ rough tokens）', { size: 12, weight: 700, color: C.fg2 });
      d.text(GX, 74, 'estimate_active_prompt_tokens()', { size: 12, weight: 700, color: C.fg2, mono: true });
    },
    objects: function () {
      var o = stackObjs([1, 1, 0, 0, 0, 0]);
      gauge(o, 554);
      o.cat = { type: 'box', x: 590, y: 250, w: 300, h: 50, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, text: 'cat 一个 26,000 字符的文件', sub: 'format_tool_output：保留头尾各 4,900', subMono: false, subSize: 11, size: 12.5, weight: 700, opacity: 0 };
      o.pIn = path('M440,250 L300,250', C.ok);
      o.chk = { type: 'box', x: 590, y: 420, w: 300, h: 92, rx: 10, fill: C.bg, stroke: C.line, sw: 1.4, text: '开关已开 · 8,241 ≥ 6,000', sub: 'assistant 4 条 > 保留 1 条 → 压缩', subMono: false, subSize: 12, size: 13, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '起点：只有系统提示和任务，估计 554 个 token。每次请求前 maybe_compact_context 都先估一下。',
        log: [{ s: REQ[0][1], at: 100 }], hl: [3, 4, 5] },
      { say: '第 1 步 cat 了一个 26,000 字符的测试文件。观察被截成头尾各 4,900 字符，这一对动作和观察约 2.5k tokens。',
        set: join(on('pIn', 600), { cat: pop(0), b_p1: fade(900, 400), g: { w: { to: 3091 * GK, dur: 800, delay: 900 } }, gv: { num: { to: 3091, dur: 800, delay: 900 } } }),
        fx: [st('pIn', 600, C.ok, 5)], log: [{ s: REQ[1][1], at: 900 }], data: { '估计 tokens': { v: 3091, at: 900 }, 'assistant 条数': { v: 1, at: 900 } } },
      { say: '第 2 步又 cat 了 game.py（同样被截断）：5,627，还没到 6,000。',
        set: { b_p2: fade(400, 400), cat: { text: { to: 'cat src/chess_app/game.py', delay: 0 } }, g: { w: { to: 5627 * GK, dur: 800, delay: 400 } }, gv: { num: { to: 5627, dur: 800, delay: 400 } } },
        fx: [st('pIn', 100, C.ok, 5)], log: [{ s: REQ[2][1], at: 400 }], data: { '估计 tokens': { v: 5627, at: 400 }, 'assistant 条数': { v: 2, at: 400 } } },
      { say: '第 3 步跑测试，输出很短：5,706，仍低于阈值，maybe_compact_context 返回 False，不压缩。',
        set: { b_p3: fade(400, 400), cat: { text: { to: 'python -m pytest -q tests/', delay: 0 }, sub: { to: '输出很短：1 failed, 9 passed', delay: 0 } }, g: { w: { to: 5706 * GK, dur: 600, delay: 400 } }, gv: { num: { to: 5706, dur: 600, delay: 400 } } },
        fx: [st('pIn', 100, C.ok, 3), { type: 'float', x: GX + 5706 * GK, y: GY - 26, text: '< 6000', color: C.ok, size: 14, at: 900 }],
        log: [{ s: REQ[3][1], at: 400 }], data: { '估计 tokens': { v: 5706, at: 400 }, 'assistant 条数': { v: 3, at: 400 } }, hl: [3, 4, 5] },
      { say: '第 4 步 cat 了 server.py：第 5 次请求之前估到 8,241，越过了 6,000。',
        set: { b_p4: fade(400, 400), cat: { text: { to: 'cat src/chess_app/server.py', delay: 0 }, sub: { to: 'format_tool_output：保留头尾各 4,900', delay: 0 } },
          g: { w: { to: 8241 * GK, dur: 900, delay: 400 }, fill: { to: C.bad, dur: 400, delay: 1100 } }, gv: { num: { to: 8241, dur: 900, delay: 400 } } },
        fx: [st('pIn', 100, C.ok, 5), { type: 'flash', obj: 'thr', color: C.bad, at: 1100 }, { type: 'burst', x: GX + 6000 * GK, y: GY, color: C.bad, at: 1150 }],
        data: { '估计 tokens': { v: 8241, at: 400 }, 'assistant 条数': { v: 4, at: 400 } } },
      { say: '三道检查都过。开了压缩，超过阈值，assistant 消息 4 条多于要保留的 1 条。于是调用 compact_context，见下一个场景。',
        set: { chk: pop(0) }, fx: [{ type: 'pulse', obj: 'chk', color: C.warn, at: 400 }], log: [{ s: REQ[4][1], at: 600 }], hl: [7, 8, 9, 10, 11, 12] }
    ]
  };

  /* ================= 场景 4：压成工作记忆 ================= */
  var CODE_COMPACT = { lang: 'py', title: '示意实现 · base.py · compact_context（简写）', src:
'hist = self.history\n' +
'starts = [i for i, m in enumerate(hist)\n' +
'          if m.get("role") == "assistant"]\n' +
'cut = starts[-self.compaction_keep_recent_steps]\n' +
'old, recent = hist[:cut], hist[cut:]\n' +
'transcript = render(old)\n' +
'compaction_prompt = [\n' +
'    {"role": "system",\n' +
'     "content": COMPACTION_SYSTEM_PROMPT},\n' +
'    {"role": "user",\n' +
'     "content": task + memory + transcript}]\n' +
'resp = self.client.chat.completions.create(\n' +
'    model=..., messages=compaction_prompt)\n' +
'summary = resp.choices[0].message.content\n' +
'if summary.strip():\n' +
'    self.memory = summary.strip()\n' +
'    self.history = recent\n' };
  var MEM_Y = YS.p1, P4_Y_AFTER = MEM_Y + 18 + GAP;
  var sc4 = {
    name: '压成工作记忆', desc: '旧前缀（前 3 步）交给模型写成工作记忆。系统和任务逐字保留，最近一步原样留下。提示从 8,241 降到 3,183。',
    code: CODE_COMPACT, dataTitle: '压缩事件', data: { estimated_tokens_before: 8241, estimated_tokens_after: 8241, compactions: 0 },
    dataFmt: { estimated_tokens_before: 'comma', estimated_tokens_after: 'comma' },
    bg: function (d) {
      title(d, 'compact_context：只压旧前缀');
      d.text(X0, 60, '提示（高度 ∝ rough tokens）', { size: 12, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = stackObjs([1, 1, 1, 1, 1, 1]);
      gauge(o, 8241); o.g.fill = C.bad;
      o.cut = { type: 'line', x1: 36, y1: YS.p4 - 2, x2: 300, y2: YS.p4 - 2, stroke: C.warn, sw: 2.5, dasharray: '6 4', opacity: 0 };
      o.cutT = { type: 'text', x: 296, y: YS.p4 - 14, text: '切点：倒数第 1 个 assistant', size: 11.5, weight: 700, color: C.warn, anchor: 'end', opacity: 0 };
      o.oldBr = { type: 'box', x: 40, y: YS.p1 - 3, w: 248, h: YS.p4 - YS.p1 + 1, rx: 6, anchor: 'tl', fill: 'none', stroke: C.warn, sw: 2, dasharray: '5 4', opacity: 0 };
      o.oldT = { type: 'text', x: 166, y: YS.p4 - 30, text: '旧前缀 5,153', size: 12.5, weight: 700, color: C.warn, opacity: 0 };
      o.pTo = path('M290,300 L446,300', C.warn);
      o.cp = { type: 'box', x: 610, y: 300, w: 320, h: 70, rx: 9, fill: C.warnW, stroke: C.warn, sw: 1.5, text: '压缩请求（不带 tools）', sub: 'system 提示 + user：任务、旧记忆、文字记录', subMono: false, subSize: 11, size: 13, weight: 700, opacity: 0 };
      o.cpN = { type: 'text', x: 610, y: 252, text: 'rough tokens ≈ 5,575', size: 12, weight: 700, color: C.warn, opacity: 0, mono: true };
      o.pM = path('M600,337 L600,405', C.warn);
      o.M = { type: 'box', x: 600, y: 432, w: 200, h: 50, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '模型', sub: '写工作记忆（示意回复）', subMono: false, subSize: 11, size: 13.5, weight: 700, opacity: 0 };
      o.pBack = path('M500,432 L320,432 L320,' + (MEM_Y + 9) + ' L288,' + (MEM_Y + 9), C.ok);
      o.mem = { type: 'box', x: 600, y: 432, w: SW, h: 18, rx: 5, fill: C.okW, stroke: C.ok, sw: 1.4, text: '<working_memory> 94', size: 11.5, weight: 700, opacity: 0 };
      o.keep = { type: 'text', x: 292, y: 82, text: '', size: 11.5, color: C.ok, weight: 700, anchor: 'start', opacity: 0 };
      return o;
    },
    steps: [
      { say: '在历史里找 assistant 消息的位置，从倒数第 1 个切开（keep_recent_steps = 1）。前面是旧前缀，后面是最近一步。',
        set: { cut: { opacity: { to: 1, dur: 300 }, dash: { from: 0, to: 1, dur: 600 } }, cutT: fade(400) }, hl: [1, 2, 3, 4, 5] },
      { say: '旧前缀是前 3 步的动作和观察，约 5,153 tokens。切在 assistant 上，一个调用和它的观察永远在同一边。',
        set: { oldBr: fade(0, 400), oldT: fade(300) }, fx: [{ type: 'pulse', obj: 'b_p1', color: C.warn, at: 200 }, { type: 'pulse', obj: 'b_p2', color: C.warn, at: 350 }, { type: 'pulse', obj: 'b_p3', color: C.warn, at: 500 }],
        log: [{ s: '    old prefix   rough tokens = 5153', at: 200 }, { s: '    recent step  rough tokens = 2536', at: 900 }] },
      { say: '旧前缀渲染成可读的文字记录。它和任务、上一份记忆一起，装进一个不带 tools 的压缩请求。',
        set: join(on('pTo'), { cp: pop(700), cpN: fade(1100) }),
        fx: [st('pTo', 0, C.warn, 6)], log: [{ s: "  compaction_prompt roles = ['system', 'user']  rough tokens = 5575", at: 900 }], hl: [6, 7, 8, 9, 10, 11] },
      { say: '模型回一段工作记忆，这里用固定的示意回复。内容有目标、已读的文件、测试结果 1 failed 9 passed、下一步。它只有 94 个 token。',
        set: join(on('pM'), { M: pop(500), mem: mix(fade(1300, 200), {}) }),
        fx: [st('pM', 100, C.warn, 4), { type: 'ripple', obj: 'M', color: C.info, at: 900 }], hl: [12, 13, 14] },
      { say: 'memory 存好，history 只留最近一步。旧块消失，记忆插在任务后面，最近一步往上挪。估计从 8,241 降到 3,183。',
        set: join(on('pBack'), {
          mem: { x: { to: X0 + SW / 2, dur: 800, delay: 100, ease: 'inOut' }, y: { to: MEM_Y + 9, dur: 800, delay: 100, ease: 'inOut' } },
          b_p1: fade(0, 400, 0), b_p2: fade(0, 400, 0), b_p3: fade(0, 400, 0), pTo: { opacity: { to: 0, dur: 300 }, flow: { to: 0, dur: 300 } }, oldBr: fade(0, 300, 0), oldT: fade(0, 300, 0), cut: fade(0, 300, 0), cutT: fade(0, 300, 0),
          b_p4: { y: { to: P4_Y_AFTER, dur: 900, delay: 600 } },
          g: { w: { to: 3183 * GK, dur: 900, delay: 600 }, fill: { to: C.ok, dur: 500, delay: 900 } }, gv: { num: { to: 3183, dur: 900, delay: 600 } } }),
        fx: [st('pBack', 0, C.ok, 4)], log: [{ s: '  step 4: estimated_tokens_before = 8241 → after = 3183  （少了 5058，61.4%）', at: 600 }],
        data: { estimated_tokens_after: { v: 3183, at: 600 }, compactions: { v: 1, at: 900 } }, hl: [15, 16, 17] },
      { say: '核对规则：系统和任务与第一次请求逐字相同。call_4 的动作和观察都在。call_1 到 call_3 已经不在提示里。',
        set: { keep: mix(fade(0), { text: '逐字保留' }) },
        fx: [{ type: 'pulse', obj: 'b_sys', color: C.ok, at: 0 }, { type: 'pulse', obj: 'b_task', color: C.ok, at: 150 }, { type: 'pulse', obj: 'b_p4', color: C.info, at: 500 }],
        log: [{ s: '压缩后 system / task 和第一次请求逐字相同？ True True', at: 0 }, { s: '压缩后还保留 call_4 的 assistant 动作和观察？ True True', at: 900 }, { s: '压缩后还有 call_1..call_3？ []', at: 1800 }] },
      { say: '第 5 次动作请求就用压缩后的提示。它有 5 条消息：system、任务、记忆、最近的动作和观察。这次压缩记成一条事件，写进轨迹。',
        log: [{ s: "第 5 次动作请求：5 条消息，rough tokens = 3183，roles = ['system', 'user', 'user', 'assistant', 'tool']", at: 200 }],
        fx: [{ type: 'pulse', obj: 'mem', color: C.ok, at: 300 }] }
    ]
  };

  VZ.register({
    id: 'c8-context', title: '技能的渐进披露与上下文压缩',
    sources: [SRC_MD, SRC_BASE, SRC_SKILL],
    note: '两层披露、frontmatter 校验、没有技能时不许提 patch.txt，都出自 ASSIGNMENT.md 和 base.py。压缩规则也出自这两处。只压旧前缀，系统 / 任务逐字保留，最近一步完整保留，阈值 6,000。代码面板是本笔记示意实现的简写版。所有 token 数都是本机实算，用的是 harness 的 rough_message_tokens。堆叠图里每块的高度按 token 比例画，小块画成最小高度。压缩时模型写的摘要是固定的示意回复。压缩前后的数和"逐字相同 / call_4 保留"都是实跑输出。',
    legend: [[C.data, '系统 / 任务 / 技能目录'], [C.info, '模型 / 动作与观察'], [C.ok, '全文 / 记忆 / 结果'], [C.warn, '压缩相关'], [C.bad, '超过阈值 / 错误']],
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

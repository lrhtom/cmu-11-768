/* 01 · 第 1 讲 —— 最小 ReAct 循环（本机实跑）
 * 结构照讲义 lecture-01 第 15 页的 mini-swe-agent（run / step / query / execute_actions）；
 * 代码是 本机验算脚本 里的 Agent（排版精简，逻辑相同）。"模型"是写死的 5 条示意回复（不调真模型），
 * 工具真的在一个内存里的小仓库上执行；控制台和变量面板里的数都取自 本机运行记录。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var SRC = [{ t: '第 1 讲 23:56–27:33（ReAct 与 mini-swe-agent）', u: 'https://youtu.be/UwfjzyLnvMg?t=1436' },
    { t: '讲义 lecture-01 第 14–15 页', u: 'https://www.cmu-agents.com/slides/lecture-01-agents.pdf' }];
  var CODE = { lang: 'py', title: '本机实跑 · Agent（精简排版，模型回复是示意）', src:
'class Agent:\n' +
'    def run(self, task):\n' +
'        self.add_messages(system_msg(),\n' +
'                          user_msg(task))\n' +
'        while not self.done:\n' +
'            self.step()\n' +
'\n' +
'    def step(self):\n' +
'        msg = self.query()\n' +
'        return self.execute_actions(msg)\n' +
'\n' +
'    def query(self):\n' +
'        msg = self.model.query(self.messages)\n' +
'        self.add_messages(msg)\n' +
'        return msg\n' +
'\n' +
'    def execute_actions(self, msg):\n' +
'        obs = []\n' +
'        for c in msg["tool_calls"]:\n' +
'            args = json.loads(c["arguments"])\n' +
'            if c["name"] == "send_message":\n' +
'                self.done = True\n' +
'                out = args["text"]\n' +
'            else:\n' +
'                out = TOOLS[c["name"]](**args)\n' +
'            obs.append({\n' +
'                "role": "tool",\n' +
'                "tool_call_id": c["id"],\n' +
'                "content": out})\n' +
'        self.add_messages(*obs)\n' +
'        return obs\n' };

  var MX = 146, MW = 232;
  var MSG = [['system: You can call tools.', 'neutral'], ['user: test.py 失败了，修好它。', 'data'],
    ['assistant: read_file(test.py)', 'info'], ['tool[call_1]: from calc import…', 'ok'],
    ['assistant: run_tests()', 'info'], ['tool[call_2]: FAILED … == -1', 'bad'],
    ['assistant: edit_file(calc.py)', 'info'], ['tool[call_3]: edited calc.py', 'ok'],
    ['assistant: run_tests()', 'info'], ['tool[call_4]: PASSED', 'ok'],
    ['assistant: send_message(…)', 'info'], ['tool[call_5]: 修好了：add 改成…', 'ok']];
  function slotY(i) { return 98 + i * 34; }
  var LOG = [
    'start | messages=2 chars=39',
    'step 1 | read_file({"path": "test.py"}) -> \'from calc import add\\nassert add(2, 3) == 5\\n\' | messages=4 chars=169',
    'step 2 | run_tests({}) -> \'FAILED: add(2, 3) == -1\' | messages=6 chars=258',
    'step 3 | edit_file({"path": "calc.py", "old": "a - b", "new": "a + b"}) -> \'edited calc.py\' | messages=8 chars=406',
    'step 4 | run_tests({}) -> \'PASSED\' | messages=10 chars=477',
    'step 5 | send_message({"text": "修好了：add 改成 a + b，测试通过。"}) -> \'修好了：add 改成 a + b，测试通过。\' | messages=12 chars=598',
    'final calc.py: \'def add(a, b):\\n    return a + b\\n\''];

  function wire(d, col) {
    var a = col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : 'bad';
    return { type: 'path', d: d, stroke: col, sw: 2, dash: 1, flow: 0, flowColor: col, arrow: a, opacity: 0.35 };
  }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function off(n, d0) { var s = {}; s[n] = { opacity: { to: 0.35, dur: 300, delay: d0 || 0 }, flow: { to: 0, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  /* 消息卡片从 (fx, fy) 飞进第 i 个槽位 */
  function land(i, fx, fy, delay) {
    var s = {}; s['m' + i] = { opacity: { to: 1, dur: 200, delay: delay || 0 }, x: { from: fx, to: MX, dur: 800, delay: delay || 0, ease: 'inOut' }, y: { from: fy, to: slotY(i), dur: 800, delay: delay || 0, ease: 'inOut' } };
    return s;
  }

  function objs(nVis, calcFixed, status) {
    var o = {};
    o.pQ = wire('M264,170 C330,170 350,110 392,110', C.data);
    o.pA = wire('M470,142 L470,268', C.info);
    o.pX = wire('M556,290 L598,290', C.warn);
    o.pO = wire('M598,312 L556,312', C.ok);
    o.pB = wire('M384,320 C330,320 300,360 266,372', C.ok);
    MSG.forEach(function (m, i) {
      o['m' + i] = { type: 'box', x: MX, y: slotY(i), w: MW, h: 26, rx: 6, fill: C[m[1] + 'W'], stroke: C[m[1]], sw: 1.3, text: m[0], size: 11, weight: 650, mono: true, opacity: i < nVis ? 1 : 0, trail: { n: 4, gap: 40 } };
    });
    o.llm = { type: 'box', x: 470, y: 110, w: 156, h: 62, rx: 12, fill: C.infoW, stroke: C.info, sw: 1.8, text: '模型', sub: '写死的示意回复', subMono: false, subSize: 11.5, size: 15, weight: 750 };
    o.har = { type: 'box', x: 470, y: 300, w: 172, h: 62, rx: 12, fill: C.warnW, stroke: C.warn, sw: 1.8, text: 'execute_actions', sub: '解析 → 查表 → 执行', subMono: false, subSize: 11.5, size: 14, weight: 750, mono: true };
    o.call = { type: 'box', x: 470, y: 372, w: 190, h: 26, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.2, text: 'read_file(path="test.py")', size: 11, weight: 650, mono: true, opacity: 0 };
    o.repo = { type: 'box', x: 718, y: 306, w: 220, h: 214, rx: 12, fill: C.bg2, stroke: C.line, sw: 1.5, text: '', opacity: 1 };
    o.rt = { type: 'text', x: 620, y: 222, text: '内存里的小仓库', size: 12, weight: 700, color: C.fg2, anchor: 'start' };
    o.f1 = { type: 'text', x: 622, y: 254, text: 'calc.py', size: 12, weight: 700, mono: true, color: C.fg, anchor: 'start' };
    o.f1a = { type: 'text', x: 632, y: 276, text: 'def add(a, b):', size: 11.5, mono: true, color: C.fg2, anchor: 'start' };
    o.f1b = { type: 'text', x: 648, y: 296, text: calcFixed ? 'return a + b' : 'return a - b', size: 11.5, mono: true, weight: 700, color: calcFixed ? C.ok : C.bad, anchor: 'start' };
    o.f2 = { type: 'text', x: 622, y: 330, text: 'test.py', size: 12, weight: 700, mono: true, color: C.fg, anchor: 'start' };
    o.f2a = { type: 'text', x: 632, y: 352, text: 'assert add(2, 3) == 5', size: 11.5, mono: true, color: C.fg2, anchor: 'start' };
    var sk = status === 'PASSED' ? 'ok' : status === 'FAILED' ? 'bad' : 'neutral';
    o.stt = { type: 'box', x: 718, y: 390, w: 170, h: 28, rx: 7, fill: C[sk + 'W'], stroke: C[sk], sw: 1.3, text: status ? '测试：' + status : '测试：还没跑', size: 12, weight: 700 };
    o.obs = { type: 'box', x: 470, y: 246, w: 210, h: 26, rx: 6, fill: C.okW, stroke: C.ok, sw: 1.2, text: '', size: 11, weight: 650, mono: true, opacity: 0 };
    return o;
  }
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); d.text(MX, 70, 'self.messages', { anchor: 'middle', size: 12.5, weight: 700, mono: true, color: C.fg2 }); }

  /* ---------------- 场景 1：启动与第一步 ---------------- */
  var sc1 = {
    name: '启动与第一步', desc: 'run() 放进两条消息，然后 query → 模型回复 → execute_actions → 观察接回历史。',
    code: CODE, dataTitle: '变量', data: { 'k（查询次数）': 0, 'len(messages)': 0, '字符数': 0, 'done': 'False' },
    bg: function (d) { title(d, '一个最小的 ReAct 循环：第 1 步'); },
    objects: function () { return objs(0, false, ''); },
    steps: [
      { say: 'run() 先放进两条消息：系统提示和用户的任务。', set: { m0: pop(0), m1: pop(250) }, hl: [2, 3, 4],
        log: [{ s: '>>> agent.run("test.py 失败了，修好它。")', at: 100 }, { s: LOG[0], at: 900 }], data: { 'len(messages)': { v: 2, at: 500 }, '字符数': { v: 39, at: 900 } } },
      { say: 'while 循环：没结束就一直 step()。step 先调 query()。', hl: [5, 6, 8, 9], fx: [{ type: 'pulse', obj: 'llm', color: C.info, at: 600 }] },
      { say: 'query 把整个消息列表交给模型。真实系统里，这一步会经聊天模板变成 token。', set: on('pQ'), hl: [12, 13],
        fx: [st('pQ', 100, C.data, 5), { type: 'ripple', obj: 'llm', color: C.data, at: 900 }] },
      { say: '模型回一条助手消息："先看看测试"，附一个工具调用 read_file。它被追加进历史。', set: land(2, 470, 140, 100), hl: [14, 15],
        data: { 'k（查询次数）': { v: 1, at: 300 }, 'len(messages)': { v: 3, at: 900 } } },
      { say: 'execute_actions 遍历这条消息里的工具调用，用 json.loads 解析参数。', set: join(on('pA'), { call: fade(700) }), hl: [17, 18, 19, 20],
        fx: [st('pA', 100, C.info, 4), { type: 'pulse', obj: 'har', color: C.warn, at: 700 }] },
      { say: '不是 send_message，就按名字在 TOOLS 里查到 read_file 并执行：读 test.py。', set: on('pX'), hl: [21, 24, 25],
        fx: [st('pX', 100, C.warn, 4), { type: 'ripple', x: 690, y: 352, color: C.warn, at: 700 }, { type: 'pulse', obj: 'f2a', color: C.data, at: 800 }] },
      { say: '结果包成 role: tool 的消息，tool_call_id 是这次调用的 call_1。', set: join(on('pO'), { obs: mix(fade(500), { text: { to: 'tool · call_1 · 文件内容', delay: 0 } }), call: fade(300, 300, 0) }), hl: [26, 27, 28, 29],
        fx: [st('pO', 100, C.ok, 4)] },
      { say: '观察追加进历史：现在 4 条消息、169 个字符。下一轮模型会读到它。', set: join(on('pB'), land(3, 380, 320, 300), { obs: fade(200, 300, 0) }), hl: [30, 31],
        fx: [st('pB', 100, C.ok, 4)], log: [{ s: LOG[1], at: 900 }], data: { 'len(messages)': { v: 4, at: 1000 }, '字符数': { v: 169, at: 1000 } } }
    ]
  };

  /* ---------------- 场景 2：跑测试，失败 ---------------- */
  var sc2 = {
    name: '测试失败', desc: '第 2 步：模型决定跑测试，测试失败。失败也只是一条观察，照样接回历史。',
    code: CODE, dataTitle: '变量', data: { 'k（查询次数）': 1, 'len(messages)': 4, '字符数': 169, 'done': 'False' },
    bg: function (d) { title(d, '第 2 步：跑测试'); },
    objects: function () { var o = objs(4, false, ''); ['pQ', 'pA', 'pX', 'pO', 'pB'].forEach(function (k) { o[k].opacity = 0.35; }); return o; },
    steps: [
      { say: '又一轮：模型读到全部 4 条消息（包括 test.py 的内容），决定跑测试。', set: join(on('pQ'), land(4, 470, 140, 900)), hl: [12, 13, 14],
        fx: [st('pQ', 100, C.data, 5), { type: 'ripple', obj: 'llm', color: C.data, at: 800 }], data: { 'k（查询次数）': { v: 2, at: 900 }, 'len(messages)': { v: 5, at: 1500 } } },
      { say: '解析、查表，执行 run_tests。', set: join(off('pQ'), on('pA'), on('pX', 600), { call: mix(fade(300), { text: { to: 'run_tests()', delay: 0 } }) }), hl: [19, 20, 24, 25],
        fx: [st('pA', 100, C.info, 4), st('pX', 700, C.warn, 4), { type: 'pulse', obj: 'stt', color: C.warn, at: 1300 }] },
      { say: '测试失败：add(2, 3) 算出了 -1。calc.py 把加法写成了减法。', set: { stt: { text: { to: '测试：FAILED', delay: 200 }, fill: { to: C.badW, dur: 300, delay: 200 }, stroke: { to: C.bad, dur: 300, delay: 200 } } },
        fx: [{ type: 'shake', obj: 'stt', at: 300 }, { type: 'flash', obj: 'f1b', color: C.bad, at: 600 }] },
      { say: '错误信息照样包成 tool 消息（call_2）送回去。', set: join(off('pA'), off('pX'), on('pO'), { call: fade(0, 300, 0), obs: mix(fade(400), { text: { to: 'FAILED: add(2, 3) == -1', delay: 0 }, fill: { to: C.badW, dur: 1 }, stroke: { to: C.bad, dur: 1 } }) }), hl: [26, 27, 28, 29],
        fx: [st('pO', 100, C.bad, 4)] },
      { say: '追加进历史：6 条消息、258 个字符。工具失败不是循环失败，只是一条观察。模型下一步就能看到并修。', set: join(off('pO'), on('pB'), land(5, 380, 320, 300), { obs: fade(200, 300, 0) }), hl: [30],
        fx: [st('pB', 100, C.bad, 4), { type: 'ripple', obj: 'm5', color: C.bad, at: 1200 }], log: [{ s: LOG[2], at: 900 }], data: { 'len(messages)': { v: 6, at: 1000 }, '字符数': { v: 258, at: 1000 } } },
      { say: '下一次 query 时，这条失败信息和前面所有消息一起交给模型。它就是这样"看到"自己出错的。', set: join(off('pB'), on('pQ')), hl: [13],
        fx: [st('pQ', 100, C.data, 6), { type: 'pulse', obj: 'm5', color: C.bad, at: 100 }, { type: 'ripple', obj: 'llm', color: C.data, at: 1000 }] }
    ]
  };

  /* ---------------- 场景 3：修好并结束 ---------------- */
  var sc3 = {
    name: '修好并结束', desc: '第 3–5 步：改代码、再跑测试、调用 send_message 结束循环。',
    code: CODE, dataTitle: '变量', data: { 'k（查询次数）': 2, 'len(messages)': 6, '字符数': 258, 'done': 'False' },
    bg: function (d) { title(d, '第 3–5 步：修好并结束'); },
    objects: function () { var o = objs(6, false, 'FAILED'); return o; },
    steps: [
      { say: '第 3 步：模型看到失败信息，调用 edit_file，把 a - b 换成 a + b。', set: join(on('pQ'), land(6, 470, 140, 800)), hl: [12, 13, 14],
        fx: [st('pQ', 100, C.data, 5)], data: { 'k（查询次数）': { v: 3, at: 800 }, 'len(messages)': { v: 7, at: 1400 } } },
      { say: '执行编辑：仓库里的 calc.py 真的被改了。', set: join(off('pQ'), on('pA'), on('pX', 500), { f1b: { text: { to: 'return a + b', delay: 1100 }, color: { to: C.ok, dur: 300, delay: 1100 } } }), hl: [24, 25],
        fx: [st('pA', 0, C.info, 3), st('pX', 600, C.warn, 4), { type: 'flash', obj: 'f1b', color: C.ok, at: 1100 }] },
      { say: '观察 "edited calc.py"（call_3）接回历史：8 条、406 个字符。', set: join(off('pA'), off('pX'), on('pB'), land(7, 380, 320, 200)),
        fx: [st('pB', 0, C.ok, 4)], log: [{ s: LOG[3], at: 700 }], data: { 'len(messages)': { v: 8, at: 900 }, '字符数': { v: 406, at: 900 } } },
      { say: '第 4 步：再跑一次测试。', set: join(off('pB'), on('pQ'), land(8, 470, 140, 700)), fx: [st('pQ', 0, C.data, 4)],
        data: { 'k（查询次数）': { v: 4, at: 700 }, 'len(messages)': { v: 9, at: 1300 } } },
      { say: '这次通过：PASSED（call_4），10 条消息、477 个字符。', set: join(off('pQ'), on('pX'), { stt: { text: { to: '测试：PASSED', delay: 600 }, fill: { to: C.okW, dur: 300, delay: 600 }, stroke: { to: C.ok, dur: 300, delay: 600 } } }, land(9, 380, 320, 1300)),
        fx: [st('pX', 0, C.warn, 4), { type: 'burst', obj: 'stt', color: C.ok, at: 700 }], log: [{ s: LOG[4], at: 1500 }], data: { 'len(messages)': { v: 10, at: 1800 }, '字符数': { v: 477, at: 1800 } } },
      { say: '第 5 步：模型调用 send_message 给用户回话。', set: join(off('pX'), on('pQ'), land(10, 470, 140, 700)), fx: [st('pQ', 0, C.data, 4)],
        data: { 'k（查询次数）': { v: 5, at: 700 }, 'len(messages)': { v: 11, at: 1300 } } },
      { say: 'send_message 是结束动作：done 变成 True，回给用户的话也作为观察（call_5）接回。', set: join(off('pQ'), land(11, 380, 320, 600)), hl: [21, 22, 23],
        fx: [{ type: 'pulse', obj: 'har', color: C.ok, at: 100 }], log: [{ s: LOG[5], at: 900 }], data: { 'done': { v: 'True', at: 400 }, 'len(messages)': { v: 12, at: 1200 }, '字符数': { v: 598, at: 1200 } } },
      { say: 'while not self.done 不再成立，循环结束。一共 5 次查询、12 条消息。每次查询，模型都读到了全部历史。', hl: [5],
        log: [{ s: LOG[6], at: 300 }], fx: [{ type: 'pulse', obj: 'm11', color: C.ok, at: 200 }, { type: 'pulse', obj: 'llm', color: C.info, at: 600 }] }
    ]
  };

  VZ.register({
    id: 'c1-react', title: '最小 ReAct 循环：本机实跑一遍',
    sources: SRC,
    note: '循环结构照讲义 lecture-01 第 15 页（mini-swe-agent 的 run / step / query / execute_actions）。代码是本机写的一个小 Agent。模型的 5 条回复是写死的示意，没有调真模型。工具在内存里的小仓库上真的执行。控制台的每一行、变量面板的每个数，都取自本机实跑的输出。"字符数"是消息内容加工具调用 JSON 的字符数，不是 token 数。',
    scenes: [sc1, sc2, sc3]
  });
})();

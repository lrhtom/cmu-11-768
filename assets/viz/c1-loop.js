/* 01 · 第 1 讲 —— 智能体循环：智能体与环境、一次工具调用在 token 层面的往返、能力从外壳迁到模型
 * 依据：讲义 lecture-01 第 9、11–14、18 页；视频 15:10–17:21（定义）、19:34–26:08（工具与 ReAct）、35:50–39:32（训练还是外壳）。
 * 场景 1 的仓库和文件名是示意（与 c1-react 演示同一个小例子）；场景 2 的消息、模板标记、call_7 照讲义第 11–12 页。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L1 = 'https://www.cmu-agents.com/slides/lecture-01-agents.pdf';
  var YT = 'https://youtu.be/UwfjzyLnvMg?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function card(x, y, w, t, k, op, size) {  // 一行等宽小卡片
    return { type: 'box', x: x, y: y, w: w, h: 28, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.4, text: t, size: size || 12, weight: 650, mono: true, opacity: op == null ? 0 : op };
  }
  function node(x, y, w, h, t, sub, k, op) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 12, fill: C[k + 'W'], stroke: C[k], sw: 1.8, text: t, sub: sub, subMono: false, subSize: 11.5, size: 15, weight: 750, opacity: op == null ? 0 : op };
  }
  function wire(d, col, extra) {
    var ar = { 'data': 'data', 'ok': 'ok', 'warn': 'warn', 'info': 'info', 'bad': 'bad' };
    var key = col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3';
    return mix({ type: 'path', d: d, stroke: col, sw: 2, dash: 0, flow: 0, flowColor: col, arrow: ar[key] || 'fg3' }, extra || {});
  }
  function draw(d0) { return { dash: { to: 1, dur: 600, delay: d0 || 0 }, flow: { to: 1, dur: 300, delay: (d0 || 0) + 500 } }; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 700, at: at || 0, color: col }; }
  function ride(path, delay, dur) { return { along: path, t: { from: 0, to: 1, dur: dur || 900, delay: delay || 0, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 200, delay: (delay || 0) + (dur || 900) } }; }

  /* ---------------- 场景 1：智能体与环境 ---------------- */
  var sc1 = {
    name: '智能体与环境', desc: '观察进、动作出，智能体和环境之间一圈圈地循环。奖励衡量做得好不好。',
    bg: function (d) {
      title(d, '智能体通过观察感知环境、通过动作作用于环境');
      d.text(118, 280, '状态 / 观察', { anchor: 'middle', size: 13, weight: 700, color: C.data });
      d.text(742, 280, '动作', { anchor: 'middle', size: 13, weight: 700, color: C.warn });
    },
    objects: function () {
      return {
        pObs: wire('M300,420 C150,420 150,150 318,150', C.data),
        pAct: wire('M542,150 C710,150 710,420 562,420', C.warn),
        pRw: wire('M360,462 C330,505 290,512 236,512', C.ok),
        ag: node(430, 150, 220, 72, '智能体', 'LLM + 外壳', 'info'),
        env: node(430, 420, 260, 80, '环境', '代码仓库：test.py 没通过（示意）', 'neutral'),
        tt: { type: 'text', x: 800, y: 72, text: '', num: 0, fmt: 'int', pre: 't = ', size: 15, weight: 750, mono: true, anchor: 'end', color: C.fg2, opacity: 0 },
        obs: card(150, 285, 196, '任务：test.py 失败，修好它', 'data', 0, 11.5),
        act: card(710, 285, 168, 'read_file("test.py")', 'warn'),
        rw: { type: 'box', x: 170, y: 512, w: 120, h: 34, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.5, text: '', num: 0, fmt: 'int', pre: '奖励 = ', size: 13, weight: 750, opacity: 0 },
        rw2: { type: 'box', x: 170, y: 468, w: 176, h: 30, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, dasharray: '4 3', text: '或：LLM 评审 / 用户反馈', size: 12, weight: 650, opacity: 0 }
      };
    },
    steps: [
      { say: '智能体：凡是能"感知环境、作用于环境"的东西。今天的智能体是语言模型加一个外壳。',
        set: { ag: pop(0), env: pop(250), tt: fade(500) } },
      { say: '环境可以是代码仓库、网站、应用。这里是一个测试没通过的小仓库（示意）。',
        fx: [{ type: 'pulse', obj: 'env', color: C.neutral, at: 100 }, { type: 'flash', obj: 'env', color: C.bad, at: 500 }] },
      { say: '观察：环境把当前状态交给智能体。比如用户消息、文件内容、网页、截图、工具结果。',
        set: { pObs: draw(0), obs: ride('pObs', 300, 1100) },
        fx: [st('pObs', 500, C.data, 5), { type: 'ripple', obj: 'ag', color: C.data, at: 1400 }] },
      { say: '动作：智能体决定做什么，比如回复、改文件、跑命令、调 API。这里是读文件。',
        set: { pAct: draw(0), act: ride('pAct', 300, 1100) },
        fx: [{ type: 'pulse', obj: 'ag', color: C.info, at: 0 }, st('pAct', 500, C.warn, 5), { type: 'ripple', obj: 'env', color: C.warn, at: 1400 }] },
      { say: '动作会改变环境，智能体进入新的状态。t 加 1，新的观察（文件内容）回来。',
        set: { tt: { num: { to: 1, dur: 500, delay: 100 } }, obs: mix(ride('pObs', 400, 1000), { text: { to: 'assert add(2, 3) == 5', delay: 0 } }) },
        fx: [st('pObs', 500, C.data, 4), { type: 'ripple', obj: 'ag', color: C.data, at: 1400 }] },
      { say: '再一轮：改代码、跑测试……每一圈都是"观察 → 动作"。',
        set: { tt: { num: { to: 3, dur: 900, delay: 1000 } }, act: mix(ride('pAct', 100, 900), { text: { to: 'edit_file("calc.py", …)', delay: 0 } }) },
        fx: [st('pAct', 200, C.warn, 4), { type: 'ripple', obj: 'env', color: C.warn, at: 1000 }, st('pObs', 1200, C.data, 4), { type: 'ripple', obj: 'ag', color: C.data, at: 1900 }] },
      { say: '奖励：用一个数衡量成败。有测试就看测试是否通过：通过记 1，否则记 0。',
        set: { pRw: draw(0), rw: mix(pop(500), { num: { to: 1, dur: 400, delay: 900 } }), env: { sub: { to: '测试通过', delay: 200 } } },
        fx: [st('pRw', 400, C.ok, 4), { type: 'burst', obj: 'rw', color: C.ok, at: 1300 }] },
      { say: '没法写测试的任务，用 LLM 当评审打分。最终关心的是用户满不满意，也可以用用户反馈。',
        set: { rw2: pop(300) },
        fx: [{ type: 'pulse', obj: 'rw2', color: C.ok, at: 600 }] }
    ]
  };

  /* ---------------- 场景 2：一次工具调用在 token 层面的往返 ---------------- */
  var MSGX = 128, MW = 196;
  var TOK = ['<|im_start|>system', '<tools>…', '<|im_start|>user', 'test.py 里是什么？', '<|im_start|>assistant'];
  var OUT = ['思考 …', '<tool_call>', '{"name":"read_file", …}', '</tool_call>'];
  var sc2 = {
    name: '一次工具调用', desc: '消息 → 模板 → token → 模型 → 工具调用 → 外壳执行 → 结果带着 call_7 回到历史。',
    bg: function (d) {
      title(d, '一次工具调用的往返：模型只碰 token，其余都由外壳完成');
      d.text(MSGX, 72, '消息列表（API 里的 JSON）', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.text(200, 326, '↑ 模型输入：一条 token 序列', { size: 11.5, weight: 650, color: C.fg3 });
      d.text(350, 398, '↑ 模型输出', { size: 11.5, weight: 650, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      o.m0 = card(MSGX, 100, MW, 'system: You can call tools.', 'neutral', 0, 11);
      o.m1 = card(MSGX, 136, MW, 'tools: read_file(path)', 'data', 0, 11);
      o.m2 = card(MSGX, 172, MW, 'user: test.py 里是什么？', 'data', 0, 11);
      o.m3 = card(MSGX, 208, MW, 'assistant: call_7 read_file', 'info', 0, 11);
      o.m4 = card(MSGX, 244, MW, 'tool: call_7 → def add…', 'ok', 0, 11);
      o.pIn = wire('M228,136 C290,136 300,170 334,170', C.data);
      o.tpl = node(400, 170, 130, 56, '聊天模板', 'apply_chat_template', 'warn');
      o.pTok = wire('M560,284 C600,250 640,240 680,207', C.data);
      var ch = VZ.chips('tk', TOK, 300, 300, { left: 200, gap: 4, size: 10.5, h: 26, opacity: 0 });
      for (var k in ch.objs) o[k] = ch.objs[k];
      o.llm = node(712, 170, 150, 70, '语言模型', 'token 进 · token 出', 'info');
      var oc = VZ.chips('ot', OUT, 0, 372, { left: 200, gap: 6, size: 11, h: 26, opacity: 0 });
      for (var k2 in oc.objs) { o[k2] = oc.objs[k2]; o[k2].fill = C.infoW; o[k2].stroke = C.info; }
      o.pOut = wire('M770,206 C820,280 800,372 646,372', C.info);
      o.pParse = wire('M270,386 C270,420 300,432 314,448', C.warn);
      o.har = node(330, 478, 170, 58, '外壳', '解析 · 查表 · 执行', 'warn');
      o.pExe = wire('M416,470 L586,470', C.warn);
      o.pRes = wire('M586,492 L416,492', C.ok);
      o.box = node(680, 482, 180, 58, '沙箱', 'test.py', 'neutral');
      o.call = card(500, 448, 150, 'read_file · call_7', 'warn', 0, 11);
      o.res = card(500, 516, 150, 'def add(a, b): …', 'ok', 0, 11);
      o.pBack = wire('M244,470 C160,470 128,400 128,262', C.ok);
      return o;
    },
    steps: [
      { say: '外壳手里是一列 JSON 消息：系统提示、工具定义、用户的任务（讲义第 11–12 页的例子）。',
        set: { m0: pop(0), m1: pop(200), m2: pop(400) } },
      { say: '聊天模板把消息和工具定义拼成一条带特殊标记的文本。再切成 token。',
        set: join({ tpl: pop(0) }, { pIn: draw(100) }, { tk0: pop(800), tk1: pop(950), tk2: pop(1100), tk3: pop(1250), tk4: pop(1400) }),
        fx: [st('pIn', 300, C.data, 5), { type: 'pulse', obj: 'tpl', color: C.warn, at: 700 }] },
      { say: 'token 序列送进模型。对模型来说，工具清单也只是 token。',
        set: { llm: pop(0), pTok: draw(200) }, fx: [st('pTok', 500, C.data, 6), { type: 'ripple', obj: 'llm', color: C.data, at: 1300 }] },
      { say: '模型逐个写 token：先写推理（思考），再写工具调用的 token。',
        set: join({ pOut: draw(0) }, { ot0: pop(500), ot1: pop(900), ot2: pop(1200), ot3: pop(1500) }),
        fx: [{ type: 'pulse', obj: 'llm', color: C.info, at: 0 }, st('pOut', 300, C.info, 5)] },
      { say: '外壳从输出里解析出调用：名字 read_file、参数 {"path": "test.py"}，并配上一个 ID：call_7。',
        set: { har: pop(0), pParse: draw(200), call: mix(pop(1000), { x: { from: 440, to: 500, dur: 600, delay: 1000 } }) },
        fx: [st('pParse', 500, C.warn, 4), { type: 'pulse', obj: 'har', color: C.warn, at: 900 }] },
      { say: '外壳在沙箱里执行这个调用。',
        set: { box: pop(0), pExe: draw(200), call: { x: { to: 650, dur: 700, delay: 600 }, opacity: { to: 0, dur: 300, delay: 1200 } } },
        fx: [st('pExe', 400, C.warn, 4), { type: 'ripple', obj: 'box', color: C.warn, at: 1300 }] },
      { say: '结果回来：文件内容。它就是这一步的"观察"。',
        set: { pRes: draw(0), res: mix(fade(400, 200), { x: { from: 650, to: 500, dur: 800, delay: 400 } }) },
        fx: [st('pRes', 300, C.ok, 4), { type: 'ripple', obj: 'har', color: C.ok, at: 1200 }] },
      { say: '外壳把助手的调用和 role: tool 的结果都追加进消息列表。两条带同一个 tool_call_id：call_7。',
        set: { m3: pop(200), m4: pop(800), res: { opacity: { to: 0, dur: 300, delay: 600 } }, pBack: draw(300) },
        fx: [st('pBack', 500, C.ok, 5), { type: 'ripple', obj: 'm4', color: C.ok, at: 1100 }] },
      { say: '下一轮模板会把结果渲染成 <tool_response> … </tool_response>，模型接着读、接着写。',
        set: { tk3: { text: { to: '<tool_response>…', delay: 300 } }, tk4: { text: { to: '<|im_start|>assistant', delay: 300 } } },
        fx: [st('pIn', 0, C.ok, 4), { type: 'pulse', obj: 'tpl', color: C.warn, at: 600 }, st('pTok', 900, C.data, 5), { type: 'ripple', obj: 'llm', color: C.data, at: 1700 }] },
      { say: '分工：模型只做 token 进、token 出。渲染、解析、执行、接回历史，全是外壳的活。',
        fx: [{ type: 'pulse', obj: 'llm', color: C.info, at: 100 }, { type: 'pulse', obj: 'har', color: C.warn, at: 500 }, { type: 'pulse', obj: 'tpl', color: C.warn, at: 700 }] }
    ]
  };

  /* ---------------- 场景 3：能力从外壳迁到模型 ---------------- */
  var HX = 250, MX = 640;
  var sc3 = {
    name: '训练还是外壳', desc: '问题常常先在外壳里补。问题够大时被训练进模型，外壳的补丁就能拆掉。长上下文例外。',
    bg: function (d) {
      title(d, '两条路：打磨外壳（快）与训练模型（根本）');
      d.rect(HX - 150, 150, 300, 300, { fill: C.warnW, stroke: C.warn, rx: 14, sw: 1.5, opacity: 0.55 });
      d.text(HX, 172, '外壳：提示 · 工具 · 记忆 · 控制流', { anchor: 'middle', size: 12.5, weight: 700, color: C.warn });
      d.rect(MX - 150, 150, 300, 300, { fill: C.infoW, stroke: C.info, rx: 14, sw: 1.5, opacity: 0.55 });
      d.text(MX, 172, '模型：学到的策略', { anchor: 'middle', size: 12.5, weight: 700, color: C.info });
    },
    objects: function () {
      return {
        q1: card(445, 82, 170, '工具调用格式出错', 'bad', 0, 12),
        q2: card(445, 82, 170, '要先计划再动手', 'bad', 0, 12),
        q3: card(445, 82, 170, '超长的历史', 'bad', 0, 12),
        q4: card(445, 82, 170, '按我的方式做事', 'bad', 0, 12),
        patch1: { type: 'text', x: HX, y: 232, text: '补丁：语法约束解码', size: 11.5, weight: 650, color: C.warn, anchor: 'middle', opacity: 0 },
        data: { type: 'box', x: MX, y: 500, w: 230, h: 36, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.4, text: '训练数据：工具调用轨迹（SFT / RL）', size: 12, weight: 650, opacity: 0 },
        pTrain: wire('M640,482 L640,454', C.data),
        why: { type: 'text', x: HX, y: 420, text: 'n² 的计算量：是效率问题', size: 11.5, weight: 650, color: C.bad, anchor: 'middle', opacity: 0 }
      };
    },
    steps: [
      { say: '一个能力问题冒出来：比如模型写的工具调用经常格式不对。',
        set: { q1: pop(0) }, fx: [{ type: 'shake', obj: 'q1', at: 400 }] },
      { say: '最快的办法是在外壳里补：加语法约束解码，保证格式合法。',
        set: { q1: { x: { to: HX, dur: 800, delay: 100, ease: 'inOut' }, y: { to: 210, dur: 800, delay: 100, ease: 'inOut' }, fill: { to: C.warnW, dur: 400, delay: 800 }, stroke: { to: C.warn, dur: 400, delay: 800 } }, patch1: fade(1000) },
        fx: [{ type: 'ripple', x: HX, y: 210, color: C.warn, at: 900 }] },
      { say: '问题够大、够普遍，做模型的人就会专门造数据去训练它。',
        set: { data: pop(0), pTrain: draw(300) }, fx: [st('pTrain', 600, C.data, 6), { type: 'pulse', x: MX, y: 300, color: C.info, at: 1300 }] },
      { say: '模型学会了。这个能力成了策略的一部分，外壳里的补丁可以拆掉。',
        set: { q1: { x: { to: MX, dur: 900, delay: 100, ease: 'inOut' }, fill: { to: C.okW, dur: 400, delay: 900 }, stroke: { to: C.ok, dur: 400, delay: 900 } }, patch1: fade(0, 300, 0) },
        fx: [{ type: 'burst', x: MX, y: 210, color: C.ok, at: 1000 }] },
      { say: '"计划模式"也一样。先是提示里加一句"请先计划，不要动手"。之后可以在长程任务上做 RL。',
        set: { q2: mix(pop(0), { x: { to: HX, dur: 700, delay: 400, ease: 'inOut' }, y: { to: 262, dur: 700, delay: 400, ease: 'inOut' } }) },
        fx: [st('pTrain', 1300, C.data, 5)] },
      { say: '训练跟上之后，它同样搬进模型。',
        set: { q2: { x: { to: MX, dur: 900, delay: 100, ease: 'inOut' }, fill: { to: C.okW, dur: 400, delay: 900 }, stroke: { to: C.ok, dur: 400, delay: 900 } } },
        fx: [{ type: 'burst', x: MX, y: 262, color: C.ok, at: 1000 }] },
      { say: '长上下文不一样，它不只是准确率，还是效率问题。Transformer 的计算随长度平方增长。压缩、记忆这些外壳手段省不掉。',
        set: { q3: mix(pop(0), { x: { to: HX, dur: 700, delay: 400, ease: 'inOut' }, y: { to: 340, dur: 700, delay: 400, ease: 'inOut' }, fill: { to: C.warnW, dur: 300, delay: 1000 }, stroke: { to: C.warn, dur: 300, delay: 1000 } }), why: fade(1300) },
        fx: [{ type: 'pulse', x: HX, y: 340, color: C.bad, at: 1300 }] },
      { say: '可定制也常常留在外壳。按情况给一份脚本或单独的指令（技能、记忆），未必值得去训练。',
        set: { q4: mix(pop(0), { x: { to: HX, dur: 700, delay: 400, ease: 'inOut' }, y: { to: 384, dur: 700, delay: 400, ease: 'inOut' }, fill: { to: C.warnW, dur: 300, delay: 1000 }, stroke: { to: C.warn, dur: 300, delay: 1000 } }) },
        fx: [{ type: 'ripple', x: HX, y: 384, color: C.warn, at: 1100 }] }
    ]
  };

  VZ.register({
    id: 'c1-loop', title: '智能体循环：环境、工具调用、外壳与训练',
    sources: [{ t: '第 1 讲 15:10–17:21（智能体定义）', u: YT + '910' }, { t: '第 1 讲 19:34–26:08（工具与 ReAct）', u: YT + '1174' },
      { t: '第 1 讲 35:06–39:32（训练还是外壳）', u: YT + '2106' }, { t: '讲义 lecture-01 第 9、11–14、18 页', u: L1 }],
    note: '场景 1 的循环结构出自讲义第 9 页和 15:10–17:21。小仓库、文件名和动作是示意。场景 2 的消息、模板标记（<tools>、<tool_call>、<tool_response>）和 call_7 照讲义第 11–12 页。"test.py 里是什么？"对应讲义第 14 页的任务。场景 3 的说法出自 37:17–39:32：先在外壳里解决，再训练进模型。长上下文省不掉，可定制常留在外壳。语法约束解码和计划模式的例子出自 43:17、46:15。',
    scenes: [sc1, sc2, sc3]
  });
})();

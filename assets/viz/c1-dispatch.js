/* 01 · 第 2 讲 —— 外壳怎么分发工具调用：分发与出错恢复、并行调用、MCP 凭据中转
 * 场景 1：五个站照讲义 lecture-02 第 24 页（Parse → Lookup → Validate → Execute → Return）；四个调用和控制台输出是
 *         本机验算脚本 第 5 部分的实跑结果（run-verify.txt），get_weather / call_123 / 72°F · sunny 照讲义第 25 页。
 * 场景 2：时间照讲义第 48–49 页（生成 0.8 s，天气 1.2 s，日历 0.9 s，航班 1.1 s）；代码照第 51 页；
 *         控制台是 verify.py 第 6 部分实跑（asyncio.sleep 按 1/2 缩放，打印的时间乘回 2）。
 * 场景 3：结构和代码照讲义第 40、44–45 页；没有实跑（需要真实的 MCP 服务），所以没有控制台。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L2 = 'https://www.cmu-agents.com/slides/lecture-02-tool-use.pdf', YT = 'https://youtu.be/jXChFB4JSyw?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function arrowKey(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: arrowKey(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function chip(x, y, w, t, k, op, size, h) {
    return { type: 'box', x: x, y: y, w: w, h: h || 28, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: true, opacity: op == null ? 0 : op };
  }

  /* ---------------- 场景 1：分发与出错恢复 ---------------- */
  var SX = [110, 270, 430, 590, 750], SN = ['Parse', 'Lookup', 'Validate', 'Execute', 'Return'],
    SS = ['json.loads', 'TOOL_DEFS[name]', 'jsonschema', 'fn(**args)', 'role: tool'];
  var HX = [128, 318, 508, 698];
  var CODE1 = { lang: 'py', title: '本机实跑 · dispatch（精简）', src:
'def dispatch(call):\n' +
'    name = call["name"]\n' +
'    try:\n' +
'        args = json.loads(call["arguments"])\n' +
'    except json.JSONDecodeError as e:\n' +
'        return err(call, e.msg)\n' +
'    if name not in TOOL_DEFS:\n' +
'        return err(call, NO_TOOL % name)\n' +
'    schema = TOOL_DEFS[name]["schema"]\n' +
'    try:\n' +
'        validate(args, schema)\n' +
'    except ValidationError as e:\n' +
'        return err(call, e.message)\n' +
'    out = TOOL_DEFS[name]["fn"](**args)\n' +
'    return {"role": "tool",\n' +
'            "tool_call_id": call["id"],\n' +
'            "content": out}\n' };
  var LOG1 = ['{"role": "tool", "tool_call_id": "call_123", "content": "72°F · sunny"}',
    '{"role": "tool", "tool_call_id": "call_124", "content": "<error>arguments 不是合法 JSON：Expecting \',\' delimiter</error>"}',
    '{"role": "tool", "tool_call_id": "call_125", "content": "<error>没有叫 get_wether 的工具</error>"}',
    '{"role": "tool", "tool_call_id": "call_126", "content": "<error>参数不合法：412 is not of type \'string\'</error>"}'];
  /* 调用卡片走到第 i 个站下面 */
  function goto(i, delay) { return { tok: { x: { to: SX[i], dur: 600, delay: delay || 0, ease: 'inOut' }, y: { to: 270, dur: 600, delay: delay || 0, ease: 'inOut' } } }; }
  function mark(i, ok, at) { return [{ type: 'float', x: SX[i], y: 158, text: ok ? '对' : '错', color: ok ? C.ok : C.bad, size: 20, at: at }, { type: ok ? 'pulse' : 'shake', obj: 'st' + i, color: ok ? C.ok : C.bad, at: at }]; }
  function result(k, ok, from, delay) {
    var s = {}; s['h' + k] = { opacity: { to: 1, dur: 200, delay: delay }, x: { from: SX[from], to: HX[k], dur: 900, delay: delay, ease: 'inOut' }, y: { from: 270, to: 470, dur: 900, delay: delay, ease: 'inOut' } };
    s.tok = { opacity: { to: 0, dur: 250, delay: delay } };
    return s;
  }
  var sc1 = {
    name: '分发与出错', desc: '每个调用走 解析 → 查表 → 校验 → 执行 → 返回。哪一站出错，都变成一条带同一 ID 的观察。',
    code: CODE1, dataTitle: '当前调用', data: { 'tool_call_id': '—', 'name': '—', '结果': '—' },
    bg: function (d) {
      title(d, '外壳分发一个工具调用（讲义第 24 页的五站）');
      d.text(40, 470, '历史', { size: 12.5, weight: 700, color: C.fg2 });
      d.line(40, 420, 820, 420, { stroke: C.line1, sw: 1, dash: '4 4' });
    },
    objects: function () {
      var o = {};
      for (var i = 0; i < 4; i++) o['w' + i] = wire('M' + (SX[i] + 66) + ',200 L' + (SX[i + 1] - 66) + ',200', C.warn);
      SN.forEach(function (n, i) {
        o['st' + i] = { type: 'box', x: SX[i], y: 200, w: 132, h: 60, rx: 10, fill: i === 4 ? C.okW : C.warnW, stroke: i === 4 ? C.ok : C.warn, sw: 1.6,
          text: n, sub: SS[i], size: 14, weight: 750, subSize: 11, opacity: 0 };
      });
      o.tok = chip(430, 96, 330, '', 'data', 0, 12, 30);
      o.h0 = chip(HX[0], 470, 180, 'call_123 · 72°F · sunny', 'ok', 0, 11);
      o.h1 = chip(HX[1], 470, 180, 'call_124 · 不是合法 JSON', 'bad', 0, 11);
      o.h2 = chip(HX[2], 470, 180, 'call_125 · 没有这个工具', 'bad', 0, 11);
      o.h3 = chip(HX[3], 470, 180, 'call_126 · 参数不合法', 'bad', 0, 11);
      return o;
    },
    steps: [
      { say: '外壳初始化时注册好工具（名字 → 定义）。之后每个调用都过这五站。',
        set: join({ st0: pop(0), st1: pop(150), st2: pop(300), st3: pop(450), st4: pop(600) }, on('w0', 700), on('w1', 800), on('w2', 900), on('w3', 1000)) },
      { say: '第一个调用：get_weather，参数 {"city": "Pittsburgh"}，ID 是 call_123。',
        set: { tok: mix(pop(0), { text: { to: 'call_123 · get_weather · {"city": "Pittsburgh"}', delay: 0 } }) },
        data: { 'tool_call_id': 'call_123', 'name': 'get_weather', '结果': '—' } },
      { say: '解析：arguments 是合法 JSON，得到 {"city": "Pittsburgh"}。', set: { tok: { x: { to: SX[0], dur: 700, delay: 0, ease: 'inOut' }, y: { to: 270, dur: 700, delay: 0, ease: 'inOut' }, w: { to: 150, dur: 500, delay: 0 }, text: { to: 'call_123', delay: 300 } } },
        fx: mark(0, true, 800), hl: [3, 4] },
      { say: '查表：有 get_weather 这个工具。校验：city 是字符串，符合 schema。', set: { tok: { x: { to: SX[2], dur: 1100, delay: 100, ease: 'inOut' } } },
        fx: mark(1, true, 600).concat(mark(2, true, 1200)), hl: [7, 9, 10, 11] },
      { say: '执行：按名字取出函数、传入参数，得到 72°F · sunny。', set: { tok: { x: { to: SX[3], dur: 600, delay: 100, ease: 'inOut' } } },
        fx: mark(3, true, 700), hl: [14], data: { '结果': { v: '72°F · sunny', at: 800 } } },
      { say: '返回：包成 role: tool 消息，tool_call_id 原样带回 call_123，进入历史。', set: mix(result(0, true, 3, 600), {}),
        fx: mark(4, true, 200), hl: [15, 16, 17], log: [{ s: LOG1[0], at: 900 }] },
      { say: '第二个调用少了一个 }：解析就失败了。不抛异常，而是生成一条错误观察。',
        set: { tok: { opacity: { to: 1, dur: 200, delay: 0 }, x: { from: 430, to: SX[0], dur: 700, delay: 200, ease: 'inOut' }, y: { from: 96, to: 270, dur: 700, delay: 200, ease: 'inOut' }, text: { to: 'call_124', delay: 0 } } },
        fx: mark(0, false, 1000), hl: [5, 6], data: { 'tool_call_id': 'call_124', 'name': 'get_weather', '结果': { v: 'JSONDecodeError', at: 1000 } } },
      { say: '这条错误观察也带着 call_124 回到历史。模型下一轮能看到，自己改正重发。', set: result(1, false, 0, 200),
        log: [{ s: LOG1[1], at: 600 }] },
      { say: '第三个调用把名字拼错成 get_wether：查表时找不到。',
        set: mix({ tok: { opacity: { to: 1, dur: 200, delay: 0 }, x: { from: 430, to: SX[1], dur: 900, delay: 200, ease: 'inOut' }, y: { from: 96, to: 270, dur: 900, delay: 200, ease: 'inOut' }, text: { to: 'call_125', delay: 0 } } }),
        fx: mark(0, true, 600).concat(mark(1, false, 1200)), hl: [7, 8], data: { 'tool_call_id': 'call_125', 'name': 'get_wether', '结果': { v: '未知工具', at: 1200 } } },
      { say: '同样变成可恢复的观察（call_125）。', set: result(2, false, 1, 200), log: [{ s: LOG1[2], at: 600 }] },
      { say: '第四个调用 city 写成了数字 412：JSON 合法、工具存在，但校验不过。',
        set: { tok: { opacity: { to: 1, dur: 200, delay: 0 }, x: { from: 430, to: SX[2], dur: 1000, delay: 200, ease: 'inOut' }, y: { from: 96, to: 270, dur: 1000, delay: 200, ease: 'inOut' }, text: { to: 'call_126', delay: 0 } } },
        fx: mark(0, true, 500).concat(mark(1, true, 800), mark(2, false, 1300)), hl: [12, 13], data: { 'tool_call_id': 'call_126', 'name': 'get_weather', '结果': { v: 'ValidationError', at: 1300 } } },
      { say: '四个调用，四条 tool 消息，各自带着自己的 ID。循环没有崩，模型拿到了每个错误的原因。', set: result(3, false, 2, 200),
        log: [{ s: LOG1[3], at: 600 }], fx: [{ type: 'pulse', obj: 'h0', color: C.ok, at: 1300 }, { type: 'pulse', obj: 'h1', color: C.bad, at: 1450 }, { type: 'pulse', obj: 'h2', color: C.bad, at: 1600 }, { type: 'pulse', obj: 'h3', color: C.bad, at: 1750 }] }
    ]
  };

  /* ---------------- 场景 2：并行工具调用 ---------------- */
  var X0 = 130, PX = 90;   // 每秒 90 像素
  function bx(t0, t1, y, label, k) {
    return { type: 'box', x: X0 + t0 * PX, y: y, w: 0, h: 26, rx: 5, anchor: 'l', fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: label, size: 11, weight: 700, opacity: 0 };
  }
  var SER = [[0, 0.8, 'G', 'info'], [0.8, 2.0, '天气 1.2', 'data'], [2.0, 2.8, 'G', 'info'], [2.8, 3.7, '日历 0.9', 'data'], [3.7, 4.5, 'G', 'info'], [4.5, 5.6, '航班 1.1', 'data'], [5.6, 6.4, 'G', 'info']];
  var PAR = [[0, 0.8, 286, 'G', 'info'], [0.8, 2.0, 254, '天气 1.2', 'data'], [0.8, 1.7, 286, '日历 0.9', 'data'], [0.8, 1.9, 318, '航班 1.1', 'data'], [2.0, 2.8, 286, 'G', 'info']];
  var EQ = VZ.eq('e', ['2 ×', { slot: 1, w: 50 }, '+ max(', { slot: 1, w: 50 }, ',', { slot: 1, w: 50 }, ',', { slot: 1, w: 50 }, ') =', { num: 0, fmt: 'fixed1', k: 'ok', w: 64 }], 430, 430, { size: 15 });
  function grow(name, w, delay, dur) { var s = {}; s[name] = { opacity: { to: 1, dur: 150, delay: delay }, w: { to: w, dur: dur, delay: delay, ease: 'out' } }; return s; }
  function flyNum(n, fromX, fromY, slotIdx, txt, delay) {
    var s = {};
    s[n] = { opacity: { from: 1, to: 0, dur: 150, delay: delay + 800 }, x: { from: fromX, to: EQ.xs[slotIdx], dur: 800, delay: delay, ease: 'inOut' }, y: { from: fromY, to: 430, dur: 800, delay: delay, ease: 'inOut' }, text: { to: txt, delay: 0 } };
    s['e' + slotIdx] = { text: { to: txt, delay: delay + 800 } };
    return s;
  }
  var CODE2 = { lang: 'py', title: '讲义第 51 页 · 并发执行（排版略改）', src:
'async def execute(call):\n' +
'    args = json.loads(call.arguments)\n' +
'    value = await TOOLS[call.name](**args)\n' +
'    return call.call_id, value\n' +
'\n' +
'results = await asyncio.gather(\n' +
'    *(execute(c) for c in function_calls),\n' +
'    return_exceptions=True,\n' +
')\n' };
  var sc2 = {
    name: '并行调用', desc: '三个互不依赖的调用放进同一次回复：串行 6.4 秒，并行 2.8 秒（讲义第 48–49 页）。',
    code: CODE2, dataTitle: '用时（秒）', data: { '串行': 0, '并行': 0, '加速（倍）': 0 }, dataFmt: { '串行': 'fixed1', '并行': 'fixed1', '加速（倍）': 'fixed2' },
    bg: function (d) {
      title(d, '串行 vs 并行：G = 模型生成一次（0.8 秒）');
      d.text(40, 130, '串行', { size: 13, weight: 700, color: C.fg2 });
      d.text(40, 286, '并行', { size: 13, weight: 700, color: C.fg2 });
      d.line(X0, 362, X0 + 6.6 * PX, 362, { stroke: C.line, sw: 1.2 });
      for (var s = 0; s <= 6; s++) { d.line(X0 + s * PX, 358, X0 + s * PX, 366, { stroke: C.line, sw: 1.2 }); d.text(X0 + s * PX, 378, s + ' s', { anchor: 'middle', size: 11, mono: true, color: C.fg3 }); }
    },
    objects: function () {
      var o = {};
      SER.forEach(function (b, i) { o['s' + i] = bx(b[0], b[1], 130, b[2], b[3]); });
      PAR.forEach(function (b, i) { o['p' + i] = bx(b[0], b[1], b[2], b[3], b[4]); });
      o.sT = { type: 'text', x: X0 + 6.4 * PX + 12, y: 130, text: '', num: 0, fmt: 'fixed1', post: ' s', size: 15, weight: 750, mono: true, color: C.bad, anchor: 'start', opacity: 0 };
      o.pT = { type: 'text', x: X0 + 2.8 * PX + 12, y: 286, text: '', num: 0, fmt: 'fixed1', post: ' s', size: 15, weight: 750, mono: true, color: C.ok, anchor: 'start', opacity: 0 };
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      ['f1', 'f2', 'f3', 'f4'].forEach(function (n) { o[n] = chip(0, 0, 44, '', 'warn', 0, 12, 24); });
      o.ra = chip(640, 254, 190, 'call_a · weather', 'data', 0, 11, 26);
      o.rb = chip(640, 286, 190, 'call_b · calendar', 'data', 0, 11, 26);
      o.rc = chip(640, 318, 190, 'call_c · flight', 'data', 0, 11, 26);
      o.d0 = chip(250, 512, 120, '找客户 ID', 'bad', 0, 11.5, 28); o.d1 = chip(430, 512, 120, '用 ID 查订单', 'bad', 0, 11.5, 28); o.d2 = chip(610, 512, 120, '给订单退款', 'bad', 0, 11.5, 28);
      o.dw0 = wire('M310,512 L368,512', C.bad); o.dw1 = wire('M490,512 L548,512', C.bad);
      return o;
    },
    steps: [
      { say: '串行：每次调用前模型都要先生成一次（G），一个一个来。',
        set: join(grow('s0', SER[0][1] * PX - SER[0][0] * PX, 0, 400), grow('s1', 1.2 * PX, 450, 500), grow('s2', 0.8 * PX, 1000, 400), grow('s3', 0.9 * PX, 1450, 450),
          grow('s4', 0.8 * PX, 1950, 400), grow('s5', 1.1 * PX, 2400, 500), grow('s6', 0.8 * PX, 2950, 400), { sT: mix(fade(3300), { num: { to: 6.4, dur: 600, delay: 3300 } }) }),
        data: { '串行': { v: 6.4, at: 3400 } }, log: [{ s: 'serial = 0.8 + (0.8+1.2) + (0.8+0.9) + (0.8+1.1) = 6.4 s', at: 3400 }] },
      { say: '并行：模型一次回复里放三个调用块。三个工具同时跑，再生成一次汇总。',
        set: join(grow('p0', 0.8 * PX, 0, 400), grow('p1', 1.2 * PX, 500, 900), grow('p2', 0.9 * PX, 500, 700), grow('p3', 1.1 * PX, 500, 830), grow('p4', 0.8 * PX, 1500, 400), { pT: mix(fade(1900), { num: { to: 2.8, dur: 600, delay: 1900 } }) }),
        hl: [6, 7, 8, 9], data: { '并行': { v: 2.8, at: 2000 } } },
      { say: '手推一下：两次生成，加上最慢的那个工具。', set: VZ.show(EQ, 0, 70) },
      { say: '生成的 0.8 秒飞进第一个空位。', set: flyNum('f1', X0 + 0.4 * PX, 286, 1, '0.8', 100), fx: [{ type: 'ripple', x: EQ.xs[1], y: 430, color: C.info, at: 900 }] },
      { say: '三个工具的用时 1.2、0.9、1.1 秒各自飞进 max(…)。',
        set: join(flyNum('f2', X0 + 1.4 * PX, 254, 3, '1.2', 0), flyNum('f3', X0 + 1.25 * PX, 286, 5, '0.9', 250), flyNum('f4', X0 + 1.35 * PX, 318, 7, '1.1', 500)),
        fx: [{ type: 'ripple', x: EQ.xs[3], y: 430, color: C.data, at: 800 }, { type: 'ripple', x: EQ.xs[5], y: 430, color: C.data, at: 1050 }, { type: 'ripple', x: EQ.xs[7], y: 430, color: C.data, at: 1300 }] },
      { say: '2 × 0.8 + max(1.2, 0.9, 1.1) = 1.6 + 1.2 = 2.8 秒，比串行快约 2.29 倍。',
        set: { e9: { num: { to: 2.8, dur: 700, delay: 200 } }, e3: { fill: { to: C.warnW, dur: 300, delay: 0 }, stroke: { to: C.warn, dur: 300, delay: 0 } } },
        fx: [{ type: 'burst', obj: 'e9', color: C.ok, at: 800 }], data: { '加速（倍）': { v: 2.29, at: 400 } },
        log: [{ s: 'parallel = 2 x 0.8 + max(1.2, 0.9, 1.1) = 2.8 s', at: 200 }, { s: 'speedup = 2.29x', at: 900 }] },
      { say: '真跑 asyncio.gather：日历先跑完，然后航班，最后天气。完成顺序是乱的。',
        set: { rb: mix(fade(0, 200), { x: { from: X0 + 1.7 * PX, to: 640, dur: 700, delay: 0 } }), rc: mix(fade(400, 200), { x: { from: X0 + 1.9 * PX, to: 640, dur: 700, delay: 400 } }), ra: mix(fade(800, 200), { x: { from: X0 + 2.0 * PX, to: 640, dur: 700, delay: 800 } }) },
        hl: [1, 2, 3, 4], log: [{ s: '  finished calendar at 0.46 s (x2 = 0.9 s)', at: 100 }, { s: '  finished flight   at 0.56 s (x2 = 1.1 s)', at: 500 }, { s: '  finished weather  at 0.60 s (x2 = 1.2 s)', at: 900 }] },
      { say: '但每个结果都带着自己的 call_id。gather 也按调用顺序返回，结果不会对错号。',
        set: { ra: { fill: { to: C.okW, dur: 300, delay: 300 }, stroke: { to: C.ok, dur: 300, delay: 300 } }, rb: { fill: { to: C.okW, dur: 300, delay: 450 }, stroke: { to: C.ok, dur: 300, delay: 450 } }, rc: { fill: { to: C.okW, dur: 300, delay: 600 }, stroke: { to: C.ok, dur: 300, delay: 600 } } },
        hl: [6, 7, 8, 9], log: [{ s: "gather returns (same order as calls): [('call_a', 'weather result'), ('call_b', 'calendar result'), ('call_c', 'flight result')]", at: 300 }] },
      { say: '只有互不依赖的调用能并行。找客户 ID → 用 ID 查订单 → 退款，只能串行。后一步要用前一步的结果。',
        set: join({ d0: pop(0), d1: pop(300), d2: pop(600) }, on('dw0', 400), on('dw1', 700)), fx: [st('dw0', 500, C.bad, 3), st('dw1', 800, C.bad, 3)] }
    ]
  };

  /* ---------------- 场景 3：MCP 凭据中转 ---------------- */
  var CODE3 = { lang: 'py', title: '讲义第 45 页 · MCP 客户端', src:
'import os\n' +
'from fastmcp import Client\n' +
'\n' +
'async with Client(\n' +
'    "https://mcp.example/mcp",\n' +
'    auth=os.environ["MCP_API_KEY"],\n' +
') as client:\n' +
'    tools = await client.list_tools()\n' +
'    result = await client.call_tool(\n' +
'        "get_weather",\n' +
'        {"city": "Pittsburgh", "units": "F"},\n' +
'    )\n' };
  var AX = 150, MXX = 430, WX = 720, RY = 270;
  var sc3 = {
    name: 'MCP 凭据', desc: 'curl 直连时，智能体的 shell 拿着上游密钥。MCP 把上游密钥留在服务器里，模型两个秘密都看不到。',
    code: CODE3,
    bg: function (d) { title(d, '凭据中转：智能体只拿 MCP 密钥，上游密钥留在 MCP 服务器'); },
    objects: function () {
      return {
        pMA: wire('M430,122 C430,180 250,170 196,236', C.info),
        pAW: wire('M228,262 C420,200 540,200 646,262', C.warn),
        pAM: wire('M228,262 L352,262', C.warn), pMA2: wire('M352,282 L228,282', C.ok),
        pMW: wire('M508,262 L642,262', C.warn), pWM: wire('M642,282 L508,282', C.ok),
        pLeak: wire('M150,344 C150,390 150,420 150,452', C.bad),
        llm: { type: 'box', x: 430, y: 96, w: 150, h: 52, rx: 12, fill: C.infoW, stroke: C.info, sw: 1.8, text: '模型', size: 15, weight: 750, opacity: 0 },
        ag: { type: 'box', x: AX, y: RY, w: 156, h: 70, rx: 12, fill: C.warnW, stroke: C.warn, sw: 1.8, text: '智能体外壳', sub: '有 shell', subMono: false, size: 14, weight: 750, opacity: 0 },
        mcp: { type: 'box', x: MXX, y: RY, w: 156, h: 70, rx: 12, fill: C.bg2, stroke: C.bad, sw: 1.8, text: 'MCP 服务器', sub: '校验 · 授权 · 分发', subMono: false, size: 14, weight: 750, opacity: 0 },
        api: { type: 'box', x: WX, y: RY, w: 150, h: 70, rx: 12, fill: C.neutralW, stroke: C.neutral, sw: 1.8, text: 'Weather API', sub: 'GET /weather', size: 14, weight: 750, opacity: 0 },
        kU: chip(AX, 330, 150, '$WEATHER_API_KEY', 'bad', 0, 11, 24),
        kU2: chip(AX, 330, 150, 'UPSTREAM_API_KEY', 'bad', 0, 11, 24),
        kM: chip(AX, 330, 130, 'MCP_API_KEY', 'warn', 0, 11, 24),
        leak: { type: 'box', x: AX, y: 478, w: 150, h: 44, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, text: '公开仓库？', size: 13, weight: 700, opacity: 0 },
        tl: chip(MXX, 210, 200, 'get_weather(city, units)', 'data', 0, 11, 24),
        res: chip(WX, 376, 120, '72°F · sunny', 'ok', 0, 11.5, 26)
      };
    },
    steps: [
      { say: '先看直连：编程智能体用 curl 调 REST API。shell 会展开环境变量里的上游密钥（讲义第 40 页）。',
        set: { ag: pop(0), api: pop(200), kU: pop(500) } },
      { say: 'curl 请求带着密钥直接发到 API。', set: on('pAW'),
        fx: [st('pAW', 100, C.warn, 5), { type: 'ripple', obj: 'api', color: C.warn, at: 900 }] },
      { say: '问题：有 shell 的智能体能读到这个密钥。讲师举的是 GitHub token。模型若把它推到公开仓库，账号就沦陷了。',
        set: join({ llm: pop(0) }, on('pMA', 200), on('pLeak', 900), { leak: pop(1300) }),
        fx: [st('pMA', 300, C.info, 3), st('pLeak', 1000, C.bad, 4), { type: 'shake', obj: 'leak', at: 1600 }] },
      { say: '换成 MCP：中间加一个 MCP 服务器。上游密钥搬进服务器，智能体只拿到 MCP 密钥。',
        set: { pAW: { opacity: { to: 0, dur: 300 } }, pLeak: { opacity: { to: 0, dur: 300 } }, leak: fade(0, 300, 0), mcp: pop(300), kU: fade(200, 300, 0),
          kU2: { opacity: { to: 1, dur: 200, delay: 400 }, x: { from: AX, to: MXX, dur: 900, delay: 500, ease: 'inOut' } }, kM: pop(1400) },
        fx: [{ type: 'ripple', obj: 'mcp', color: C.bad, at: 1400 }], hl: [4, 5, 6, 7] },
      { say: 'list_tools()：运行时发现服务器提供哪些工具（tools/list）。',
        set: join(on('pAM'), on('pMA2', 600), { tl: fade(700) }),
        fx: [st('pAM', 100, C.warn, 3), st('pMA2', 700, C.ok, 3)], hl: [8] },
      { say: 'call_tool("get_weather", …)：带着 MCP 密钥发请求。服务器先校验、授权，再分发。',
        fx: [st('pAM', 0, C.warn, 4), { type: 'pulse', obj: 'mcp', color: C.bad, at: 700 }, { type: 'pulse', obj: 'kM', color: C.warn, at: 100 }], hl: [9, 10, 11, 12] },
      { say: '服务器用它自己保管的上游密钥去调真正的天气 API。',
        set: on('pMW'), fx: [st('pMW', 100, C.warn, 4), { type: 'pulse', obj: 'kU2', color: C.bad, at: 100 }, { type: 'ripple', obj: 'api', color: C.warn, at: 800 }] },
      { say: '结果原路返回。模型和智能体都没见过上游密钥。就算 MCP 密钥泄露，损失也小得多。',
        set: join(on('pWM'), { res: { opacity: { to: 1, dur: 200 }, x: { from: WX, to: AX, dur: 1500, delay: 300, ease: 'inOut' } } }),
        fx: [st('pWM', 100, C.ok, 4), st('pMA2', 800, C.ok, 4), { type: 'burst', obj: 'ag', color: C.ok, at: 1800 }] }
    ]
  };

  VZ.register({
    id: 'c1-dispatch', title: '外壳怎么分发工具调用：出错恢复、并行、MCP',
    sources: [{ t: '第 2 讲 23:22–26:24（分发与调用 ID）', u: YT + '1402' }, { t: '第 2 讲 44:49–48:26（并行调用）', u: YT + '2689' },
      { t: '第 2 讲 38:56–43:19（MCP 与凭据）', u: YT + '2336' }, { t: '讲义 lecture-02 第 24–25、40、44–51 页', u: L2 }],
    note: '场景 1 的五站照讲义第 24 页。四个调用（含三种出错）和控制台是本机实跑的输出。get_weather、call_123、72°F · sunny 照讲义第 25 页，出错的三个调用是示意。场景 2 的各段时间照讲义第 48–49 页，6.4、2.8、2.29 用 Python 算过。asyncio 的完成顺序是本机实跑的（sleep 按 1/2 缩放）。依赖链例子照讲义第 50 页。场景 3 的结构和代码照讲义第 40、44–45 页，没有实跑。',
    scenes: [sc1, sc2, sc3]
  });
})();

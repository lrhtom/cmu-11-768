/* 08 · 作业 1 Part 3 —— 下棋工具：play_move / simulate_move / run_python（程序化工具调用）
 * 接口和规则出自 assignment-1 的 ASSIGNMENT.md Part 3、src/assignment/agent/chess_tools.py、chess_agent.py、
 * sandbox_python.py、chess_server.py 和 chess_app/src/chess_app/game.py（机器人第一手按 e7e5、d7d5、c7c5、g8f6 的顺序回应）。
 * 控制台每一行都来自 本机验算脚本 的 C 段实跑：象棋服务是本机一个只认识开局几个局面的"假服务"（不是真规则），
 * run_python 真的把代码 base64 后用子进程跑了一份 sandbox_python.py；模型发出的调用是固定的示意回复。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var SRC_MD = { t: 'assignment-1 · ASSIGNMENT.md（Part 3）', u: 'https://github.com/cmu-agents/assignment-1/blob/main/ASSIGNMENT.md' };
  var SRC_TOOLS = { t: 'assignment-1 · src/assignment/agent/chess_tools.py', u: 'https://github.com/cmu-agents/assignment-1/blob/main/src/assignment/agent/chess_tools.py' };
  var SRC_RUN = { t: 'assignment-1 · src/assignment/sandbox_python.py', u: 'https://github.com/cmu-agents/assignment-1/blob/main/src/assignment/sandbox_python.py' };
  var SRC_SRV = { t: 'assignment-1 · src/assignment/chess_server.py', u: 'https://github.com/cmu-agents/assignment-1/blob/main/src/assignment/chess_server.py' };
  var SRC_FC = { t: 'OpenAI 文档 · Function calling（strict 模式）', u: 'https://developers.openai.com/api/docs/guides/function-calling' };
  var KC = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], bad: [C.badW, C.bad], warn: [C.warnW, C.warn], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: KC[k][0], stroke: KC[k][1], sw: 1.7, text: t, sub: sub, subMono: false, subSize: 11, size: 13.5, weight: 700, opacity: op == null ? 1 : op };
  }
  function chip(t, k, x, y, w, op, mono) {
    return { type: 'box', x: x, y: y, w: w || 200, h: 26, rx: 6, fill: KC[k][0], stroke: KC[k][1], sw: 1.3, text: t, size: 11.5, weight: 650, mono: mono !== false, opacity: op == null ? 0 : op };
  }
  function path(d, col, extra) {
    var a = col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data';
    return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, arrow: a, opacity: 0.35 }, extra || {});
  }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n, rev) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data, reverse: !!rev }; }

  /* 棋盘：文件 a–h、行 8–1；大写白、小写黑，和 format_chess_state 的文字棋盘一样 */
  var CS = 20, BX = 628, BY = 214;
  function sq(s) { var f = 'abcdefgh'.indexOf(s[0]), r = +s[1]; return { x: BX + f * CS + CS / 2, y: BY + (8 - r) * CS + CS / 2 }; }
  var START = { a8: 'r', b8: 'n', c8: 'b', d8: 'q', e8: 'k', f8: 'b', g8: 'n', h8: 'r', a1: 'R', b1: 'N', c1: 'B', d1: 'Q', e1: 'K', f1: 'B', g1: 'N', h1: 'R' };
  'abcdefgh'.split('').forEach(function (f) { START[f + '7'] = 'p'; START[f + '2'] = 'P'; });
  function board(d, label) {
    d.rect(BX - 2, BY - 2, CS * 8 + 4, CS * 8 + 4, { fill: C.bg, stroke: C.line, sw: 1.2, rx: 3 });
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) if ((r + f) % 2) d.rect(BX + f * CS, BY + r * CS, CS, CS, { fill: C.bg3, rx: 0 });
    'abcdefgh'.split('').forEach(function (f, i) { d.text(BX + i * CS + CS / 2, BY + 8 * CS + 11, f, { anchor: 'middle', size: 11, color: C.fg3, mono: true }); });
    for (var k = 0; k < 8; k++) d.text(BX - 9, BY + k * CS + CS / 2, String(8 - k), { anchor: 'middle', size: 11, color: C.fg3, mono: true });
    Object.keys(START).forEach(function (s) {
      if (s === 'e2' || s === 'e7') return;
      var p = sq(s), up = START[s] === START[s].toUpperCase();
      d.text(p.x, p.y, START[s], { anchor: 'middle', size: 13, weight: up ? 800 : 500, color: up ? C.fg : C.fg2, mono: true });
    });
    d.text(BX + CS * 4, BY - 14, label || '真实对局（服务器上）', { anchor: 'middle', size: 11.5, weight: 700, color: C.fg2 });
  }
  function movers(o) {
    var e2 = sq('e2'), e7 = sq('e7');
    o.wP = { type: 'text', x: e2.x, y: e2.y, text: 'P', size: 13, weight: 800, color: C.fg, mono: true, opacity: 1 };
    o.bP = { type: 'text', x: e7.x, y: e7.y, text: 'p', size: 13, weight: 500, color: C.fg2, mono: true, opacity: 1 };
    o.hiW = { type: 'box', x: e2.x, y: e2.y, w: CS, h: CS, rx: 2, fill: 'none', stroke: C.warn, sw: 2.2, opacity: 0 };
    o.hiB = { type: 'box', x: e7.x, y: e7.y, w: CS, h: CS, rx: 2, fill: 'none', stroke: C.info, sw: 2.2, opacity: 0 };
    return o;
  }
  function moveTo(name, s, delay) { var p = sq(s); return { x: { to: p.x, dur: 700, delay: delay || 0, ease: 'inOut' }, y: { to: p.y, dur: 700, delay: delay || 0, ease: 'inOut' } }; }
  function frame(d, t) {
    d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg });
    d.rect(392, 52, 438, 488, { fill: 'none', stroke: C.line, sw: 1.2, dash: '6 4', rx: 12 });
    d.text(812, 68, 'Modal 沙箱（本机：替身）', { anchor: 'end', size: 12, weight: 700, color: C.fg3 });
  }
  /* 公共节点和连线 */
  var P_MH = 'M115,124 L115,226', P_API = 'M238,248 L300,248 L300,112 L413,112', P_EXEC = 'M238,292 L300,292 L300,470 L403,470', P_LOCAL = 'M470,442 L470,142';
  function base(o) {
    o.pMH = path(P_MH, C.info);
    o.pApi = path(P_API, C.warn);
    o.pExec = path(P_EXEC, C.warn);
    o.pLocal = path(P_LOCAL, C.warn);
    o.M = node(135, 96, 200, 54, '模型', '示意回复', 'info');
    o.H = node(135, 270, 200, 84, 'ChessAgent', 'execute_tool_calls', 'neutral');
    o.S = node(530, 112, 232, 58, '象棋服务 :8000', '/api/move · /api/simulate · /api/state', 'ok');
    o.R = node(520, 470, 230, 56, 'sandbox_python.py', 'exec(代码)，工具连 127.0.0.1', 'warn', 0.35);
    return movers(o);
  }

  /* ================= 场景 1：play_move ================= */
  var CODE_PLAY = { lang: 'py', title: '示意实现 · chess_tools.py · _play_move', src:
'def _play_move(client, arguments):\n' +
'    try:\n' +
'        args = _arguments(arguments)\n' +
'        move = args.get("move")\n' +
'        if not isinstance(move, str):\n' +
'            raise ValueError("move must be UCI")\n' +
'        state = _request_state(\n' +
'            client, "POST", "/api/move",\n' +
'            json={"move": move})\n' +
'    except httpx.HTTPError as exc:\n' +
'        return _error(f"transport failure: {exc}")\n' +
'    except (ValueError, RuntimeError) as exc:\n' +
'        return _error(exc)\n' +
'    return json.dumps(state)\n' };
  var sc1 = {
    name: 'play_move', desc: '落子：POST /api/move，机器人自动回一步。非法着法、坏 JSON、网络错，都变成 <chess_error> 观察。',
    code: CODE_PLAY, dataTitle: 'ChessAgent 状态', data: { 'last_state.history': '[]', legal_moves: 20, finished: 'False' },
    bg: function (d) { frame(d, 'play_move：落子、机器人回应、观察回到模型'); board(d); },
    objects: function () {
      var o = base({});
      o.call = chip('play_move {"move": "e2e5"}', 'warn', 135, 186, 200);
      o.obs = chip('<chess_error>', 'bad', 135, 186, 200);
      o.req = chip('POST /api/move', 'warn', 560, 182, 130);
      o.res = { type: 'box', x: 548, y: 400, w: 150, h: 54, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.3, text: 'engine_move: e7e5', sub: 'legal_moves: 29 个', subSize: 11, size: 12.5, weight: 700, mono: true, opacity: 0 };
      o.x400 = { type: 'text', x: 700, y: 160, text: 'HTTP 400', size: 13, weight: 800, color: C.bad, opacity: 0, mono: true };
      return o;
    },
    steps: [
      { say: 'ChessAgent 执白。任务提示里已经有开局的文字棋盘和 20 个合法着法。它只注册了 play_move 一个工具。',
        set: { M: pop(0), H: pop(150), S: pop(300) }, hl: [1] },
      { say: '模型调用 play_move，参数是 e2e5（兵不能一步走三格）。外壳解析参数，POST 到 /api/move。',
        set: join(on('pMH'), on('pApi', 700), { call: pop(100), req: pop(1300) }),
        fx: [st('pMH', 100, C.info, 4), st('pApi', 700, C.warn, 5), { type: 'ripple', obj: 'S', color: C.warn, at: 1400 }], hl: [3, 4, 7, 8, 9] },
      { say: '服务器回 400，detail 是"e2e5 is not legal…"。_request_state 把它变成 ValueError，再包成 <chess_error> 交回模型。棋盘没动。',
        set: { x400: fade(0), obs: mix(pop(900), { text: '<chess_error> 非法着法' }), call: fade(600, 200, 0) },
        fx: [st('pApi', 0, C.bad, 5, true), { type: 'flash', obj: 'S', color: C.bad, at: 0 }, { type: 'flash', obj: 'hiW', color: C.bad, at: 300 }, st('pMH', 900, C.bad, 4, true)],
        log: [{ s: 'C1 _play_move 非法着法 → <chess_error>e2e5 is not legal in the current position.</chess_error>', at: 500 }], hl: [12, 13] },
      { say: '参数不是合法 JSON（少了引号），根本不发请求。json.loads 的报错，直接作为 <chess_error> 回去。',
        set: { x400: fade(0, 200, 0), obs: { text: { to: '<chess_error> 坏 JSON', delay: 600 } }, req: fade(0, 200, 0) },
        fx: [{ type: 'shake', obj: 'H', at: 100 }, st('pMH', 600, C.bad, 4, true)],
        log: [{ s: 'C1 _play_move 坏 JSON → <chess_error>Expecting value: line 1 column 10 (char 9)</chess_error>', at: 300 }], hl: [3] },
      { say: '服务器连不上（传输失败）也一样：httpx 抛错，包成 <chess_error>，运行不会崩。',
        fx: [{ type: 'shake', obj: 'S', at: 100 }, st('pMH', 800, C.bad, 4, true)],
        log: [{ s: 'C1 _play_move 传输失败 → <chess_error>transport failure: timed out</chess_error>', at: 300 }], hl: [10, 11] },
      { say: '这次模型走 e2e4。服务器先走白兵，再自动替黑方回一步 e7e5。机器人的开局偏好，第一个就是 e7e5。',
        set: { obs: fade(0, 200, 0), req: mix(pop(200), { text: 'POST e2e4' }), hiW: fade(500, 200, 1), wP: moveTo('wP', 'e4', 700), hiB: fade(1700, 200, 1), bP: moveTo('bP', 'e5', 1900) },
        fx: [st('pApi', 0, C.warn, 5), { type: 'ripple', x: sq('e4').x, y: sq('e4').y, r: 16, color: C.warn, at: 1400 }, { type: 'ripple', x: sq('e5').x, y: sq('e5').y, r: 16, color: C.info, at: 2600 }],
        log: [{ s: 'C1 _play_move(e2e4) → human_move = e2e4 | engine_move = e7e5 | legal_moves = 29', at: 2700 }], hl: [7, 8, 9, 14] },
      { say: '新状态用 format_state 格式化成观察（按原 tool_call_id 接回），同时更新 last_state，按 game_over 设 finished。',
        set: { res: pop(0), obs: mix(pop(800), { text: '<chess_state> e7e5', fill: C.okW, stroke: C.ok }) },
        fx: [st('pApi', 0, C.ok, 5, true), st('pMH', 800, C.ok, 4, true)],
        log: [{ s: 'fen: rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', at: 600 }, { s: 'human_move: e2e4', at: 1700 }, { s: 'engine_move: e7e5', at: 2000 }],
        data: { 'last_state.history': { v: "['e2e4', 'e7e5']", at: 800 }, legal_moves: { v: 29, at: 800 } } }
    ]
  };

  /* ================= 场景 2：simulate_move ================= */
  var CODE_SIM = { lang: 'py', title: '示意实现 · chess_tools.py · _simulate_move', src:
'def _simulate_move(client, arguments):\n' +
'    try:\n' +
'        args = _arguments(arguments)\n' +
'        fen = args.get("fen")\n' +
'        move = args.get("move")\n' +
'        if not isinstance(fen, str) or not fen:\n' +
'            raise ValueError("fen must be a FEN")\n' +
'        if move is not None and \\\n' +
'                not isinstance(move, str):\n' +
'            raise ValueError("move: UCI or null")\n' +
'        payload = {"fen": fen}\n' +
'        if move is not None:\n' +
'            payload["move"] = move\n' +
'        state = _request_state(client, "POST",\n' +
'            "/api/simulate", json=payload)\n' +
'    except httpx.HTTPError as exc:\n' +
'        return _error(f"transport failure: {exc}")\n' +
'    except (ValueError, RuntimeError) as exc:\n' +
'        return _error(exc)\n' +
'    return json.dumps(state)\n' };
  var sc2 = {
    name: 'simulate_move', desc: '无状态模拟：从你给的 FEN 重建局面，走一个半步，返回新局面。真实对局一点不动。',
    code: CODE_SIM, dataTitle: '模拟结果', data: { turn: '—', legal_moves: 0, applied_move: '—', '真实棋盘': '没动' },
    bg: function (d) { frame(d, 'simulate_move：在副本上走一步，真实对局不变'); board(d); },
    objects: function () {
      var o = base({});
      o.call = chip('simulate_move(fen, "e2e4")', 'warn', 135, 186, 200);
      o.fin = chip('…/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'data', 600, 168, 280, 0);
      o.fout = chip('…/4P3/8/PPPP1PPP/… b KQkq e3 0 1', 'ok', 600, 410, 280, 0);
      o.pSim = path('M600,182 L600,395', C.ok);
      o.err = chip('', 'bad', 135, 186, 200);
      o.lock = { type: 'text', x: BX + 80, y: 446, text: '真实对局：没动', size: 12.5, weight: 700, color: C.ok, opacity: 0 };
      return o;
    },
    steps: [
      { say: 'Part 3 第 3 节加的工具。只要给完整的六段 FEN，就能问"这个局面能走什么"。也能问"走这一步之后是什么局面"。',
        set: { fin: pop(200) }, hl: [1] },
      { say: '模型调用 simulate_move(开局 FEN, "e2e4")：参数校验后 POST 到 /api/simulate。',
        set: join(on('pMH'), on('pApi', 700), { call: pop(100) }),
        fx: [st('pMH', 100, C.info, 4), st('pApi', 700, C.warn, 5), { type: 'ripple', obj: 'S', color: C.warn, at: 1400 }], hl: [3, 4, 5, 11, 12, 13, 14, 15] },
      { say: '服务器按 FEN 新建一个棋盘，走这一个半步。返回的局面轮到黑方，带吃过路兵格 e3。黑方有 20 个合法着法。',
        set: join(on('pSim'), { fout: pop(800) }),
        fx: [st('pSim', 100, C.ok, 5)],
        log: [{ s: 'C1 _simulate_move(START, e2e4) → fen = rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1 | turn = black | legal_moves = 20 | applied_move = e2e4', at: 600 }],
        data: { turn: { v: 'black', at: 800 }, legal_moves: { v: 20, at: 800 }, applied_move: { v: 'e2e4', at: 800 } }, hl: [20] },
      { say: '真实对局一点没动：模拟不调机器人、不碰活的棋局。把返回的 fen 再喂回去，就能替黑方再走一步，一层层往下推演。',
        set: { lock: fade(0) }, fx: [{ type: 'pulse', obj: 'wP', color: C.ok, at: 200 }, { type: 'pulse', obj: 'bP', color: C.ok, at: 300 }],
        log: [{ s: 'C1 状态没变？ True', at: 300 }] },
      { say: '错误照样变成观察。缺 fen 在外壳这边就拦下。只给五段的 FEN，由服务器以 400 拒绝。',
        set: { err: mix(pop(100), { text: '<chess_error> 缺 fen' }) },
        fx: [{ type: 'shake', obj: 'H', at: 100 }, st('pApi', 900, C.bad, 4, true), { type: 'flash', obj: 'S', color: C.bad, at: 900 }],
        log: [{ s: 'C1 _simulate_move 缺 fen → <chess_error>`fen` must be a non-empty FEN string</chess_error>', at: 200 },
          { s: 'C1 _simulate_move 五段 FEN → <chess_error>Invalid FEN: Expected all six FEN fields.</chess_error>', at: 1500 }], hl: [6, 7, 18, 19] },
      { say: '严格模式要求所有字段都列进 required。所以可选的 move 写成 ["string", "null"]，只看局面时模型显式传 null。另外 FEN 不带历史，推不出重复局面。',
        fx: [{ type: 'pulse', obj: 'call', color: C.warn, at: 200 }], hl: [8, 9, 10] }
    ]
  };

  /* ================= 场景 3：run_python ================= */
  var CODE_RUN = { lang: 'py', title: '示意实现 _run_python + 沙箱里的 runner（简写）', src:
'code = _arguments(arguments).get("code")\n' +
'encoded = base64.b64encode(code.encode())\n' +
'result = env.execute(\n' +
'    ["python", RUNNER, str(port), encoded],\n' +
'    shell=False)\n' +
'if result.get("returncode") != 0:\n' +
'    return _error("sandbox runner failed")\n' +
'return result.get("stdout", "")\n' +
'# ---- 沙箱里：sandbox_python.py ----\n' +
'code = base64.b64decode(sys.argv[2])\n' +
'ns = build_tools(client)  # 连 127.0.0.1\n' +
'exec(compile(code, "<agent-python>",\n' +
'             "exec"), ns, ns)\n' +
'json.dump({"stdout": ..., "stderr": ...,\n' +
'           "error": error}, sys.__stdout__)\n' };
  var SNIP = ["fen = '…/RNBQKBNR w KQkq - 0 1'", 's = simulate_move(fen)', "prefs = ['e2e4', 'd2d4', …]",
    'best = next(m for m in prefs', '\u00a0\u00a0\u00a0\u00a0if m in s[\'legal_moves\'])', "print('candidates', …, best)", 'play_move(best)'];
  var sc3 = {
    name: 'run_python', desc: '模型写一段 Python，代码 base64 后经 env.execute 交给沙箱里的 runner。runner 在那里调 simulate_move / play_move。JSON 回来后重读真实棋盘。',
    code: CODE_RUN, dataTitle: 'run_python', data: { 'skill 全文字符': 0, 'base64 长度': 0, 'runner error': '—', moved: 'False' },
    bg: function (d) { frame(d, 'run_python：代码进沙箱，结果和新棋盘回来'); board(d); },
    objects: function () {
      var o = base({});
      o.R.opacity = 1;
      o.code = { type: 'box', x: 152, y: 448, w: 244, h: 166, rx: 8, fill: C.bg, stroke: C.warn, sw: 1.4, opacity: 0 };
      SNIP.forEach(function (t, i) { o['k' + i] = { type: 'text', x: 38, y: 384 + i * 21, text: t, size: 11, mono: true, color: C.fg, anchor: 'start', opacity: 0 }; });
      o.kT = { type: 'text', x: 38, y: 354, text: 'run_python 的 code（示意回复）', size: 11.5, weight: 700, color: C.warn, anchor: 'start', opacity: 0 };
      o.b64 = chip('ZmVuID0gJ3JuYnFrYm5yL3BwcHBw…', 'warn', 560, 524, 250, 0);
      o.cand = chip('best = e2e4', 'ok', 548, 300, 120, 0);
      o.json = chip('{"stdout": …, "error": null}', 'ok', 135, 186, 200, 0);
      o.reread = chip('GET /api/state → 1:e4 2:e5', 'ok', 520, 68, 200, 0);
      o.rej = chip('第 3 个 play_move → 拒绝', 'bad', 135, 330, 200, 0, false);
      o.skill = chip('invoke_skill("select-move")', 'data', 135, 186, 200, 0);
      return o;
    },
    steps: [
      { say: '先按技能走：模型调 invoke_skill("select-move")，全文 4,771 个字符作为观察进来。第一手不搜索，按开局偏好挑。',
        set: join(on('pMH'), { skill: pop(100) }), fx: [st('pMH', 100, C.info, 4), st('pMH', 1000, C.data, 4, true)],
        data: { 'skill 全文字符': { v: 4771, at: 1000 } } },
      { say: '模型写了一段 Python 交给 run_python。先 simulate_move 看合法着法，按 e2e4、d2d4、c2c4、g1f3 取第一个合法的。最后 play_move。',
        set: (function () { var s = { skill: fade(0, 200, 0), code: fade(0, 300), kT: fade(100) }; SNIP.forEach(function (t, i) { s['k' + i] = fade(200 + i * 120); }); return s; })(), hl: [1] },
      { say: '外壳不在本地执行这段代码。它把代码 base64 编码，得到 344 个字符。再作为参数调 env.execute，运行沙箱里的 sandbox_python.py。',
        set: join(on('pExec', 300), { b64: pop(1100) }),
        fx: [st('pExec', 300, C.warn, 6), { type: 'ripple', obj: 'R', color: C.warn, at: 1200 }],
        log: [{ s: "C2 env.execute argv = ['python', '/opt/assignment/sandbox_python.py', '<port>', 'ZmVuID0gJ3JuYnFrYm5yL3BwcHBw…']", at: 300 }, { s: 'C2 base64 长度 = 344 （代码 257 字节）', at: 1900 }],
        data: { 'base64 长度': { v: 344, at: 1100 } }, hl: [2, 3, 4, 5] },
      { say: 'runner 解码后 exec。代码里的 simulate_move 是绑到本机回环地址的普通函数。请求直接打到旁边的象棋服务，拿回 20 个合法着法。',
        set: join(on('pLocal'), { cand: pop(1200) }),
        fx: [st('pLocal', 100, C.warn, 5), st('pLocal', 800, C.ok, 4, true), { type: 'pulse', obj: 'k1', color: C.warn, at: 0 }], hl: [10, 11, 12, 13] },
      { say: '代码里最后一行 play_move(best)：真实棋盘上白兵 e2→e4，机器人回 e7→e5。这一步发生在沙箱里，外壳还不知道。',
        set: { hiW: fade(400, 200, 1), wP: moveTo('wP', 'e4', 500), hiB: fade(1500, 200, 1), bP: moveTo('bP', 'e5', 1700) },
        fx: [st('pLocal', 0, C.warn, 5), { type: 'pulse', obj: 'k5', color: C.warn, at: 0 }, { type: 'ripple', x: sq('e4').x, y: sq('e4').y, r: 16, color: C.warn, at: 1200 }, { type: 'ripple', x: sq('e5').x, y: sq('e5').y, r: 16, color: C.info, at: 2400 }] },
      { say: 'runner 只往真正的 stdout 打印一个 JSON：片段的输出、错误输出和异常。外壳把这个字符串原样作为观察。',
        set: { b64: fade(0, 200, 0), json: mix(pop(900), {}) },
        fx: [st('pExec', 0, C.ok, 5, true)],
        log: [{ s: 'C2 runner 打印的 JSON = {"stdout": "candidates 20 best e2e4\\n", "stderr": "", "error": null}', at: 500 }],
        data: { 'runner error': { v: 'null', at: 900 } }, hl: [6, 7, 8, 14, 15] },
      { say: '片段可能已经落子，所以跑完一定重读真实棋盘。GET /api/state，更新 last_state，把新局面附在观察后面（1:e4 2:e5）。',
        set: { reread: pop(300) }, fx: [st('pApi', 0, C.warn, 4), st('pApi', 700, C.ok, 4, true), st('pMH', 1500, C.ok, 4, true)],
        log: [{ s: 'fen: rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', at: 600 }, { s: 'recent_history: 1:e4 2:e5', at: 1700 }],
        data: { moved: { v: 'True', at: 900 } } },
      { say: '同一批里第三个调用又是 play_move。这一批已经走过一步，局面变了。它被可恢复地拒绝，不再执行。',
        set: { rej: pop(200) }, fx: [{ type: 'shake', obj: 'rej', at: 600 }],
        log: [{ s: 'C2 第三个调用（同一批里的 play_move）→ <chess_error>only one move per turn: this call was not executed; read the new board first</chess_error>', at: 400 }] }
    ]
  };

  /* ================= 场景 4：两种失败 ================= */
  var sc4 = {
    name: '两种失败', desc: '片段自己抛异常时，runner 正常退出，异常在 JSON 的 error 里。runner 本身失败（退出码非零）时，变成 <chess_error>。两种之后都重读棋盘。',
    code: CODE_RUN, dataTitle: '这次 run_python', data: { returncode: '—', error: '—', '附了棋盘': '—' },
    bg: function (d) { frame(d, '片段的错 vs 沙箱的错'); board(d); },
    objects: function () {
      var o = base({});
      o.R.opacity = 1;
      var e4 = sq('e4'), e5 = sq('e5');
      o.wP.x = e4.x; o.wP.y = e4.y; o.bP.x = e5.x; o.bP.y = e5.y;
      o.snip = chip("simulate_move(fen, 'e2e5')", 'warn', 150, 400, 220, 0);
      o.exc = chip('RuntimeError', 'bad', 548, 330, 150, 0);
      o.json = chip('{"error": "RuntimeError: …"}', 'warn', 135, 186, 200, 0);
      o.fail = chip('<chess_error> runner 失败', 'bad', 135, 186, 200, 0);
      o.x2 = { type: 'text', x: 520, y: 514, text: 'returncode 2', size: 13, weight: 800, color: C.bad, mono: true, opacity: 0 };
      o.local = { type: 'box', x: 160, y: 500, w: 250, h: 44, rx: 8, fill: C.bg, stroke: C.line, sw: 1.2, text: '本地进程里只有 base64 字符串和 JSON', sub: '模型写的代码从不在这里执行', subMono: false, subSize: 11, size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '片段里模拟了一步不存在的着法 e2e5（e2 上已经没有兵）。',
        set: join(on('pExec', 300), { snip: pop(0) }), fx: [st('pExec', 300, C.warn, 5)] },
      { say: '服务器以 400 拒绝。runner 的 unwrap 把工具返回的 <chess_error> 变成 RuntimeError，让代码停在出错的那一行。',
        set: join(on('pLocal'), { exc: pop(900) }), fx: [st('pLocal', 0, C.warn, 4), { type: 'flash', obj: 'S', color: C.bad, at: 700 }, st('pLocal', 700, C.bad, 4, true)],
        log: [{ s: 'C3 stderr 最后一行 = RuntimeError: <chess_error>e2e5 is not legal in the supplied position.</chess_error>', at: 900 }], hl: [12, 13] },
      { say: '但 runner 自己是正常退出的。异常写进 JSON 的 error 字段，returncode 是 0，外壳原样转交。这是模型代码的错，模型自己去改。',
        set: { json: pop(800) }, fx: [st('pExec', 0, C.warn, 5, true)],
        log: [{ s: "C3 片段里抛异常 → stdout = '' | error = RuntimeError: <chess_error>e2e5 is not legal in the supplied position.</chess_error>", at: 300 }],
        data: { returncode: { v: 0, at: 800 }, error: { v: 'RuntimeError', at: 800 } }, hl: [14, 15] },
      { say: '之后照样重读棋盘，附在观察后面。这次 JSON 在前，所以观察不以 <chess_error> 开头。',
        fx: [st('pApi', 0, C.warn, 4), st('pApi', 700, C.ok, 4, true)],
        log: [{ s: 'C3 观察以 <chess_error> 开头？ False ；后面附了棋盘？ True', at: 300 }], data: { '附了棋盘': { v: 'True', at: 900 } } },
      { say: '另一种：沙箱本身出了问题（这里让替身返回退出码 2）。这不是模型代码的错，返回 <chess_error> 说明 runner 失败。',
        set: { json: fade(0, 200, 0), exc: fade(0, 200, 0), snip: fade(0, 200, 0), x2: fade(400), fail: pop(1100), R: { stroke: { to: C.bad, dur: 300, delay: 300 } } },
        fx: [st('pExec', 0, C.warn, 4), { type: 'shake', obj: 'R', at: 400 }, st('pExec', 900, C.bad, 4, true)],
        log: [{ s: "C3 沙箱本身失败（替身返回 returncode 2）→ <chess_error>sandbox runner failed: python: can't open file</chess_error>", at: 600 }],
        data: { returncode: { v: 2, at: 400 }, error: { v: '—', at: 400 }, '附了棋盘': { v: '—', at: 400 } }, hl: [6, 7] },
      { say: '两种情况下，本地的智能体进程只经手 base64 字符串和 JSON 结果。模型写的代码只在沙箱里跑。',
        set: { local: pop(0) }, fx: [{ type: 'pulse', obj: 'H', color: C.neutral, at: 300 }] }
    ]
  };

  VZ.register({
    id: 'c8-chess', title: '下棋工具：落子、模拟、程序化调用',
    sources: [SRC_MD, SRC_TOOLS, SRC_RUN, SRC_SRV, SRC_FC],
    note: '出处是 ASSIGNMENT.md Part 3，以及 chess_tools.py / sandbox_python.py / chess_server.py 的 starter。工具的要求、错误种类、"一批最多走一步"都照它们写。base64 + env.execute + runner、跑完重读棋盘也是。严格模式的写法核对过 OpenAI 函数调用文档。代码面板是本笔记示意实现的简写。控制台全部是本机实算。象棋服务是一个假服务，只认识开局几个局面。它的字段、报错文字、机器人的开局回应照 chess_app 写。沙箱是用子进程真跑 sandbox_python.py 的替身。模型的调用是示意回复。棋盘上的文字照 format_chess_state：大写白、小写黑。',
    legend: [[C.info, '模型'], [C.warn, '工具调用 / 请求 / 沙箱'], [C.ok, '服务器返回 / 观察'], [C.bad, '错误 / <chess_error>'], [C.data, '技能']],
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

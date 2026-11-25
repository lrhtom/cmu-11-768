/* 07 · 第 13 讲 —— 凭据与执行前检查：权限检查、一小时过期、凭据代理、审批闸门
 * 结构出自讲义 lecture-13 第 27–29 页（身份与权限、细粒度令牌、凭据代理）和第 36 页（执行前检查）。
 * 代码是示意实现，控制台和变量面板的每个输出都由 本机验算脚本 的 A–D 段实跑得到：
 *   A：check 五次调用 → True True False True False，allowed 3 / 5；
 *   B：valid(0, m*60)，m = 0/30/59/61 → True 3600 / True 1800 / True 60 / False 0；
 *   C：broker 三次 → read_issue、apply_label 放行，publish_release 被拒；回复里没有密钥；审计 3 条、拒绝 1 条；
 *   D：gate 四次 → EXECUTE / PAUSED / REJECTED / EXECUTE。
 * 账号名、动作名、命令、密钥字符串都是示意。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = { t: '讲义 lecture-13 第 27–29、36 页', u: 'https://www.cmu-agents.com/slides/lecture-13-agent-safety.pdf' };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function node(x, y, w, h, t, sub, k, op) {
    var f = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] }[k];
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: f[0], stroke: f[1], sw: 1.7, text: t, sub: sub, subMono: false, subSize: 11.5, size: 13.5, weight: 700, opacity: op == null ? 0 : op };
  }
  function path(d, col, extra) { return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, opacity: 0, arrow: col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data' }, extra || {}); }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n, rev) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data, reverse: !!rev }; }
  function chip(x, y, t, w) { return { type: 'box', x: x, y: y, w: w || 170, h: 28, rx: 6, fill: C.dataW, stroke: C.data, sw: 1.3, text: t, mono: true, size: 12, weight: 650, opacity: 0 }; }
  /* 放行：从智能体一路飞到右边，途经检查时变绿 */
  function pass(x1, delay) { return mix(fade(delay || 0, 150), { x: { to: x1, dur: 1500, delay: (delay || 0) + 100, ease: 'inOut' }, fill: { to: C.okW, dur: 250, delay: (delay || 0) + 800 }, stroke: { to: C.ok, dur: 250, delay: (delay || 0) + 800 } }); }
  /* 拒绝：飞到检查处变红，再落进下面的托盘 */
  function deny(xg, y1, delay) { return mix(fade(delay || 0, 150), { x: { to: xg, dur: 850, delay: (delay || 0) + 100, ease: 'out' }, fill: { to: C.badW, dur: 250, delay: (delay || 0) + 900 }, stroke: { to: C.bad, dur: 250, delay: (delay || 0) + 900 }, y: { to: y1, dur: 600, delay: (delay || 0) + 1300, ease: 'bounce' } }); }

  /* ---------------- 场景 1：权限检查 ---------------- */
  var CODE1 = { lang: 'py', title: '细粒度令牌的权限检查（示意，本机实跑 A 段）', src:
"SCOPES = {\n" +
"    'issue-bot': {'read_issue',\n" +
"                  'apply_label'},\n" +
"    'release-bot': {'read_source',\n" +
"                    'publish_release'},\n" +
"}\n" +
"def check(account, action):\n" +
"    return action in SCOPES.get(account, set())\n" +
"\n" +
"for acc, act in calls:\n" +
"    print(check(acc, act))\n" };
  var sc1 = {
    name: '权限检查', desc: '每个工具调用先过一道检查。查的是这个账号的令牌，有没有这个动作的权限。没有就拒绝，密钥藏得再好也没用。',
    code: CODE1, dataTitle: '检查结果', data: { '当前账号': '—', '放行': 0, '拒绝': 0 },
    bg: function (d) { title(d, '细粒度令牌：每个请求先查"这个令牌允许吗"'); },
    objects: function () {
      var o = {};
      o.pa = path('M178,320 L352,320', C.data);
      o.pb = path('M508,320 L690,320', C.ok);
      o.tA = node(290, 130, 270, 84, '处理 issue 的令牌', 'read_issue · apply_label', 'warn');
      o.tB = node(600, 130, 270, 84, '发布令牌', 'read_source · publish_release', 'warn');
      o.ag = node(110, 320, 130, 62, '智能体', '发出工具调用', 'info');
      o.ck = node(430, 320, 150, 66, '权限检查', 'check(账号, 动作)', 'warn');
      o.gh = node(752, 320, 120, 62, 'GitHub', 'issue / 发布', 'data');
      o.who = { type: 'text', x: 110, y: 270, text: '', size: 12, mono: true, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.tray = { type: 'box', x: 430, y: 462, w: 250, h: 92, rx: 10, fill: C.bg, stroke: C.bad, sw: 1.3, dasharray: '5 4', text: '', opacity: 0 };
      o.trayT = { type: 'text', x: 430, y: 524, text: '被拒绝的调用', size: 12, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      o.r0 = chip(110, 320, 'read_issue');
      o.r1 = chip(110, 320, 'apply_label');
      o.r2 = chip(110, 320, 'publish_release');
      o.r3 = chip(110, 320, 'publish_release');
      o.r4 = chip(110, 320, 'write_cache');
      return o;
    },
    steps: [
      { say: '讲义第 27 页：每个请求先回答三个问题。谁在要，要对哪个资源做什么，这个任务允许吗。',
        set: mix({ ag: pop(0), ck: pop(200), gh: pop(400), tray: fade(600, 300, 0.8), trayT: fade(700) }, on('pa', 300), on('pb', 500)), hl: [7, 8] },
      { say: '第 28 页：两个流程各用一个细粒度令牌。每个只给自己任务需要的权限。处理 issue 的不能发布，发布的不能改 issue 缓存。',
        set: { tA: pop(0), tB: pop(250) }, hl: [1, 2, 3, 4, 5, 6] },
      { say: '处理 issue 的智能体读 issue：令牌里有 read_issue，放行。',
        set: { who: mix(fade(0), { text: { to: 'issue-bot', delay: 0 } }), r0: pass(752, 200) },
        fx: [st('pa', 200, C.data, 4), { type: 'pulse', obj: 'tA', color: C.warn, at: 700 }, { type: 'pulse', obj: 'ck', color: C.ok, at: 900 }, st('pb', 1000, C.ok, 4), { type: 'ripple', obj: 'gh', color: C.ok, at: 1700 }],
        log: [{ s: ">>> check('issue-bot', 'read_issue')", at: 100 }, { s: 'True', at: 1000 }], data: { '当前账号': 'issue-bot', '放行': { v: 1, at: 1000 } }, hl: [10, 11] },
      { say: '再打一个标签：apply_label 也在权限里，放行。',
        set: { r0: fade(0, 300, 0), r1: pass(752, 200) },
        fx: [st('pa', 200, C.data, 4), { type: 'pulse', obj: 'ck', color: C.ok, at: 900 }, st('pb', 1000, C.ok, 4), { type: 'ripple', obj: 'gh', color: C.ok, at: 1700 }],
        log: [{ s: ">>> check('issue-bot', 'apply_label')", at: 100 }, { s: 'True', at: 1000 }], data: { '放行': { v: 2, at: 1000 } }, hl: [8] },
      { say: '假如 issue 里注入的指令让它去发布版本。这个令牌根本没有 publish_release，检查直接拒绝。',
        set: { r1: fade(0, 300, 0), r2: deny(430, 440, 200) },
        fx: [st('pa', 200, C.bad, 4), { type: 'shake', obj: 'ck', at: 1000 }, { type: 'flash', obj: 'ck', color: C.bad, at: 1000 }],
        log: [{ s: ">>> check('issue-bot', 'publish_release')", at: 100 }, { s: 'False', at: 1000 }], data: { '拒绝': { v: 1, at: 1000 } }, hl: [8] },
      { say: '换成发布流程：发布账号的令牌有 publish_release，放行。',
        set: { who: { text: { to: 'release-bot', delay: 0 } }, r3: pass(752, 200) },
        fx: [st('pa', 200, C.data, 4), { type: 'pulse', obj: 'tB', color: C.warn, at: 700 }, { type: 'pulse', obj: 'ck', color: C.ok, at: 900 }, st('pb', 1000, C.ok, 4), { type: 'ripple', obj: 'gh', color: C.ok, at: 1700 }],
        log: [{ s: ">>> check('release-bot', 'publish_release')", at: 100 }, { s: 'True', at: 1000 }], data: { '当前账号': 'release-bot', '放行': { v: 3, at: 1000 } }, hl: [10, 11] },
      { say: '发布账号想去写 issue 缓存：不在它的权限里，拒绝。Cline 事故里被投毒的正是这块共享缓存。',
        set: { r3: fade(0, 300, 0), r4: deny(430, 476, 200) },
        fx: [st('pa', 200, C.bad, 4), { type: 'shake', obj: 'ck', at: 1000 }, { type: 'flash', obj: 'ck', color: C.bad, at: 1000 }],
        log: [{ s: ">>> check('release-bot', 'write_cache')", at: 100 }, { s: 'False', at: 1000 }], data: { '拒绝': { v: 2, at: 1000 } }, hl: [8] },
      { say: '五次调用放行 3 次。讲义的要点是，把密钥藏好挡不住滥用。能挡住滥用的，是"这把令牌根本没有这个权限"。',
        fx: [{ type: 'pulse', obj: 'tA', color: C.warn, at: 0 }, { type: 'pulse', obj: 'tB', color: C.warn, at: 200 }, { type: 'pulse', obj: 'tray', color: C.bad, at: 400 }],
        log: [{ s: 'allowed 3 / 5', at: 100 }] }
    ]
  };

  /* ---------------- 场景 2：一小时过期 ---------------- */
  var X0 = 120, KX = 9.4286;               /* 时间轴：0 分钟在 x=120，每分钟 9.4286px，60 分钟在 x≈686 */
  function tx(m) { return X0 + m * KX; }
  var CODE2 = { lang: 'py', title: '令牌一小时过期（示意，本机实跑 B 段）', src:
"TTL = 60 * 60  # 一小时，单位秒\n" +
"def valid(issued_at, now):\n" +
"    return now - issued_at < TTL\n" +
"\n" +
"for m in (0, 30, 59, 61):\n" +
"    ok = valid(0, m * 60)\n" +
"    left = max(0, TTL - m * 60)\n" +
"    print(ok, '| remaining_s =', left)\n" };
  function req2(m, ok, delay) {
    return ok ? pass(752, delay) : deny(430, 238, delay);
  }
  var sc2 = {
    name: '一小时过期', desc: '细粒度令牌还要限制能用多久。时间一到，同一个请求就会被拒绝。',
    code: CODE2, dataTitle: '令牌', data: { '已过分钟': 0, '剩余秒': 3600, 'valid': '—' },
    dataMeter: { '剩余秒': [0, 3600, C.warn] },
    bg: function (d) {
      title(d, '令牌有时效：一小时后自动作废');
      d.line(X0, 420, 790, 420, { stroke: C.fg3, sw: 1.5 });
      [0, 15, 30, 45, 60].forEach(function (m) {
        d.line(tx(m), 414, tx(m), 426, { stroke: C.fg3, sw: 1.5 });
        d.text(tx(m), 446, m + ' 分', { anchor: 'middle', size: 11.5, color: C.fg2, mono: true });
      });
      d.text(455, 478, '签发之后过去的时间', { anchor: 'middle', size: 12, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      o.pa = path('M178,150 L352,150', C.data);
      o.pb = path('M508,150 L690,150', C.ok);
      o.ag = node(110, 150, 130, 58, '智能体', '带着令牌请求', 'info', 1);
      o.ck = node(430, 150, 150, 62, '检查', 'valid(签发, 现在)', 'warn', 1);
      o.gh = node(752, 150, 120, 58, 'GitHub', '', 'data', 1);
      o.life = { type: 'box', x: X0, y: 370, w: 60 * KX, h: 20, rx: 4, anchor: 'l', fill: C.warnW, stroke: C.warn, sw: 1.2, text: '', opacity: 0 };
      o.used = { type: 'box', x: X0, y: 370, w: 0, h: 20, rx: 4, anchor: 'l', fill: C.neutral, stroke: 'none', text: '', opacity: 0.55 };
      o.lifeT = { type: 'text', x: tx(30), y: 342, text: '令牌的有效期：一小时', size: 12, weight: 700, color: C.warn, anchor: 'middle', opacity: 0 };
      o.exp = { type: 'line', x1: tx(60), y1: 330, x2: tx(60), y2: 428, stroke: C.bad, sw: 2, dasharray: '5 4', opacity: 0 };
      o.expT = { type: 'text', x: tx(60) + 8, y: 318, text: '过期', size: 12, weight: 700, color: C.bad, anchor: 'start', opacity: 0 };
      o.now = { type: 'circle', x: tx(0), y: 420, r: 7, fill: C.info, stroke: 'none', opacity: 0 };
      o.nowT = { type: 'text', x: tx(0), y: 400, text: '0 分', size: 12, mono: true, weight: 700, color: C.info, anchor: 'middle', opacity: 0 };
      o.tok = { type: 'box', x: 110, y: 228, w: 150, h: 36, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.4, text: '安装令牌', size: 12.5, weight: 700, opacity: 0 };
      o.q0 = chip(110, 150, 'request @ 0 分', 150);
      o.q1 = chip(110, 150, 'request @ 30 分', 150);
      o.q2 = chip(110, 150, 'request @ 59 分', 150);
      o.q3 = chip(110, 150, 'request @ 61 分', 150);
      return o;
    },
    steps: [
      { say: '讲义第 28 页：细粒度令牌还要限制能用多久。例子：GitHub App 的安装令牌签发一小时后过期。',
        set: mix({ life: fade(0, 400), lifeT: fade(200), exp: fade(400), expT: fade(500), now: pop(600), nowT: fade(600), tok: pop(300) }, on('pa', 200), on('pb', 300)), hl: [1] },
      { say: '刚签发（0 分）就请求：还剩 3600 秒，有效，放行。',
        set: { q0: req2(0, true, 200) },
        fx: [st('pa', 200, C.data, 4), { type: 'pulse', obj: 'ck', color: C.ok, at: 900 }, st('pb', 1000, C.ok, 4)],
        log: [{ s: '>>> valid(0, 0 * 60)', at: 100 }, { s: 'True | remaining_s = 3600', at: 1000 }], data: { 'valid': { v: 'True', at: 1000 } }, hl: [5, 6, 7, 8] },
      { say: '30 分钟后：时间轴往前走，有效期用掉一半，还剩 1800 秒，仍然放行。',
        set: { q0: fade(0, 300, 0), now: { x: { to: tx(30), dur: 900, ease: 'inOut' } }, nowT: { x: { to: tx(30), dur: 900, ease: 'inOut' }, text: { to: '30 分', delay: 450 } }, used: { w: { to: 30 * KX, dur: 900, ease: 'inOut' } }, q1: req2(30, true, 900) },
        fx: [st('pa', 900, C.data, 4), { type: 'pulse', obj: 'ck', color: C.ok, at: 1600 }, st('pb', 1700, C.ok, 4)],
        log: [{ s: '>>> valid(0, 30 * 60)', at: 900 }, { s: 'True | remaining_s = 1800', at: 1700 }], data: { '已过分钟': { v: 30, at: 0 }, '剩余秒': { v: 1800, at: 300 } }, hl: [3] },
      { say: '59 分钟：只剩 60 秒，还在有效期内。',
        set: { q1: fade(0, 300, 0), now: { x: { to: tx(59), dur: 900, ease: 'inOut' } }, nowT: { x: { to: tx(59), dur: 900, ease: 'inOut' }, text: { to: '59 分', delay: 450 } }, used: { w: { to: 59 * KX, dur: 900, ease: 'inOut' } }, q2: req2(59, true, 900) },
        fx: [st('pa', 900, C.data, 4), { type: 'pulse', obj: 'ck', color: C.ok, at: 1600 }, st('pb', 1700, C.ok, 4)],
        log: [{ s: '>>> valid(0, 59 * 60)', at: 900 }, { s: 'True | remaining_s = 60', at: 1700 }], data: { '已过分钟': { v: 59, at: 0 }, '剩余秒': { v: 60, at: 300 } }, hl: [3] },
      { say: '61 分钟：超过一小时，令牌作废。同样的请求在检查处被拒绝。',
        set: { q2: fade(0, 300, 0), now: { x: { to: tx(61), dur: 700, ease: 'inOut' }, fill: { to: C.bad, delay: 700 } }, nowT: { x: { to: tx(61), dur: 700, ease: 'inOut' }, text: { to: '61 分', delay: 350 } }, used: { w: { to: 60 * KX, dur: 700, ease: 'inOut' } }, tok: { fill: { to: C.neutralW, delay: 800 }, stroke: { to: C.neutral, delay: 800 }, text: { to: '令牌已过期', delay: 800 } }, q3: req2(61, false, 900) },
        fx: [{ type: 'flash', obj: 'exp', color: C.bad, at: 700 }, st('pa', 900, C.bad, 4), { type: 'shake', obj: 'ck', at: 1700 }],
        log: [{ s: '>>> valid(0, 61 * 60)', at: 900 }, { s: 'False | remaining_s = 0', at: 1700 }], data: { '已过分钟': { v: 61, at: 0 }, '剩余秒': { v: 0, at: 300 }, 'valid': { v: 'False', at: 1700 } }, hl: [3] },
      { say: '过期以后只能重新申请。笔记的理解是这样。令牌就算被注入的指令拿去用，能滥用的时间也只有这么长。',
        fx: [{ type: 'pulse', obj: 'life', color: C.warn, at: 0 }, { type: 'pulse', obj: 'tok', color: C.neutral, at: 300 }] }
    ]
  };

  /* ---------------- 场景 3：凭据代理 ---------------- */
  var LX = { ag: 140, br: 430, api: 730 };
  var CODE3 = { lang: 'py', title: '凭据代理（示意，本机实跑 C 段节选）', src:
"VAULT = {'github': 'KEY_ONLY_IN_BROKER'}\n" +
"RUNS = {'run-17': {'read_issue',\n" +
"                   'apply_label'}}\n" +
"AUDIT = []\n" +
"\n" +
"def broker(run_id, action):\n" +
"    ok = action in RUNS.get(run_id, set())\n" +
"    AUDIT.append((run_id, action, ok))\n" +
"    if not ok:\n" +
"        return {'error': 'denied: ' + action}\n" +
"    key = VAULT['github']  # 只在代理里用\n" +
"    return {'result': fake_api(action, key)}\n" };
  /* 一次放行的往返：请求 → 查权限 → 带密钥调 API → 结果回到智能体 */
  function round3(req, res, keyObj) {
    var s = {};
    s[req] = mix(fade(0, 150), { x: { to: LX.br - 70, dur: 800, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: 1000 } });
    s[keyObj] = mix({ opacity: { from: 0, to: 1, dur: 200, delay: 1100 } }, { x: { from: 560, to: LX.api - 60, dur: 800, delay: 1300, ease: 'inOut' }, y: { from: 238, to: 300, dur: 800, delay: 1300, ease: 'inOut' } });
    s[res] = mix({ opacity: { to: 1, dur: 200, delay: 2200 } }, { x: { from: LX.api - 60, to: 150, dur: 1100, delay: 2200, ease: 'inOut' } });
    return s;
  }
  var sc3 = {
    name: '凭据代理', desc: '密钥只放在代理里。智能体带着运行 ID 来请求。代理查权限，替它带上密钥去调 API，并单独记下每次请求。',
    code: CODE3, dataTitle: '代理这边', data: { '审计事件': 0, '其中拒绝': 0, '回复里有密钥': '—' },
    bg: function (d) {
      title(d, '凭据代理：智能体拿得到结果，拿不到钥匙');
      [LX.ag, LX.br, LX.api].forEach(function (x) { d.line(x, 118, x, 520, { stroke: C.line, sw: 1.2, dasharray: '4 4' }); });
    },
    objects: function () {
      var o = {};
      o.preq = path('M146,180 L424,180', C.data);
      o.pcall = path('M436,300 L724,300', C.warn);
      o.pres = path('M724,370 L146,370', C.ok);
      o.ag = node(LX.ag, 86, 130, 54, '智能体', '', 'info');
      o.br = node(LX.br, 86, 130, 54, '代理', 'broker', 'warn');
      o.api = node(LX.api, 86, 130, 54, 'API', 'GitHub（示意）', 'data');
      o.pol = node(LX.br, 236, 200, 50, 'run-17 的权限', 'read_issue · apply_label', 'warn');
      o.vault = { type: 'box', x: 618, y: 238, w: 150, h: 40, rx: 8, fill: C.bg, stroke: C.warn, sw: 1.4, dasharray: '4 3', text: '密钥库', size: 12.5, weight: 700, sub: 'KEY_ONLY_IN_BROKER', subSize: 11, opacity: 0 };
      o.audit = { type: 'box', x: LX.br, y: 466, w: 210, h: 58, rx: 10, fill: C.neutralW, stroke: C.neutral, sw: 1.4, text: '单独记录的事件', size: 12.5, weight: 700, sub: '0 条', subMono: false, opacity: 0 };
      o.q0 = chip(LX.ag + 70, 180, 'read_issue + run-17', 190);
      o.q1 = chip(LX.ag + 70, 180, 'apply_label + run-17', 190);
      o.q2 = chip(LX.ag + 70, 180, 'publish_release + run-17', 200);
      o.k0 = { type: 'box', x: 560, y: 238, w: 60, h: 24, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.2, text: 'KEY', mono: true, size: 11, weight: 700, opacity: 0 };
      o.k1 = { type: 'box', x: 560, y: 238, w: 60, h: 24, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.2, text: 'KEY', mono: true, size: 11, weight: 700, opacity: 0 };
      o.s0 = { type: 'box', x: LX.api - 60, y: 370, w: 230, h: 28, rx: 6, fill: C.okW, stroke: C.ok, sw: 1.3, text: 'issue #42: crash on start', mono: true, size: 11.5, weight: 650, opacity: 0 };
      o.s1 = { type: 'box', x: LX.api - 60, y: 370, w: 120, h: 28, rx: 6, fill: C.okW, stroke: C.ok, sw: 1.3, text: 'label=bug', mono: true, size: 11.5, weight: 650, opacity: 0 };
      o.s2 = { type: 'box', x: LX.br - 70, y: 180, w: 230, h: 28, rx: 6, fill: C.badW, stroke: C.bad, sw: 1.3, text: 'denied: publish_release', mono: true, size: 11.5, weight: 650, opacity: 0 };
      return o;
    },
    steps: [
      { say: '讲义第 29 页：凭据代理是专门控制智能体访问 API 的服务。真正的密钥只放在代理这边（示意）。',
        set: { ag: pop(0), br: pop(150), api: pop(300), pol: pop(500), vault: pop(650), audit: pop(800) }, hl: [1, 2, 3, 4] },
      { say: '智能体只带着"要做什么 + 这次运行的 ID"来请求。代理查 run-17 的权限，放行，取出密钥替它调 API，结果送回智能体。',
        set: join(on('preq'), on('pcall', 1100), on('pres', 2100), round3('q0', 's0', 'k0'), { audit: { sub: { to: '1 条', delay: 900 } } }),
        fx: [st('preq', 100, C.data, 4), { type: 'pulse', obj: 'pol', color: C.ok, at: 900 }, st('pcall', 1300, C.warn, 4), { type: 'ripple', obj: 'api', color: C.data, at: 2000 }, st('pres', 2200, C.ok, 5), { type: 'pulse', obj: 'audit', color: C.neutral, at: 900 }],
        log: [{ s: '>>> broker("run-17", \'read_issue\')', at: 100 }, { s: '{"result": "issue #42: crash on start"}', at: 2300 }],
        data: { '审计事件': { v: 1, at: 900 } }, hl: [6, 7, 8, 11, 12] },
      { say: '打标签也在权限里，同样走一遍。注意密钥只在代理和 API 之间那一段出现。',
        set: mix(round3('q1', 's1', 'k1'), { s0: fade(0, 300, 0), k0: fade(0, 200, 0), audit: { sub: { to: '2 条', delay: 900 } } }),
        fx: [st('preq', 100, C.data, 4), { type: 'pulse', obj: 'pol', color: C.ok, at: 900 }, st('pcall', 1300, C.warn, 4), st('pres', 2200, C.ok, 5), { type: 'pulse', obj: 'audit', color: C.neutral, at: 900 }],
        log: [{ s: '>>> broker("run-17", \'apply_label\')', at: 100 }, { s: '{"result": "label=bug"}', at: 2300 }],
        data: { '审计事件': { v: 2, at: 900 } }, hl: [11, 12] },
      { say: '想发布版本：run-17 没有这个权限，代理不碰密钥，直接回一个拒绝。这次请求同样记进审计。',
        set: { s1: fade(0, 300, 0), k1: fade(0, 200, 0), q2: mix(fade(0, 150), { x: { to: LX.br - 80, dur: 800, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: 1000 } }), s2: mix({ opacity: { to: 1, dur: 200, delay: 1200 } }, { x: { from: LX.br - 70, to: 160, dur: 900, delay: 1300, ease: 'inOut' } }), audit: { sub: { to: '3 条（1 条拒绝）', delay: 900 } } },
        fx: [st('preq', 100, C.data, 4), { type: 'shake', obj: 'pol', at: 900 }, { type: 'flash', obj: 'pol', color: C.bad, at: 900 }, st('preq', 1300, C.bad, 4, true), { type: 'pulse', obj: 'audit', color: C.bad, at: 900 }],
        log: [{ s: '>>> broker("run-17", \'publish_release\')', at: 100 }, { s: '{"error": "denied: publish_release"}', at: 1300 }],
        data: { '审计事件': { v: 3, at: 900 }, '其中拒绝': { v: 1, at: 900 } }, hl: [9, 10] },
      { say: '查一下智能体收到的三条回复：里面都没有密钥。它拿到的是结果，拿不到钥匙本身。',
        fx: [{ type: 'pulse', obj: 'ag', color: C.info, at: 0 }, { type: 'pulse', obj: 'vault', color: C.warn, at: 300 }],
        log: [{ s: '>>> any("KEY" in r for r in seen)', at: 100 }, { s: 'False', at: 900 }], data: { '回复里有密钥': { v: 'False', at: 900 } }, hl: [11] },
      { say: '代理还单独记下了每次请求，放没放行都记。这份记录在代理那边，智能体改不了。讲义也提到，代理可以改为发一个临时令牌。',
        fx: [{ type: 'pulse', obj: 'audit', color: C.neutral, at: 0 }, { type: 'ripple', obj: 'audit', color: C.neutral, at: 300 }],
        log: [{ s: 'audit events: 3 | denied: 1', at: 100 }], hl: [8] }
    ]
  };

  /* ---------------- 场景 4：审批闸门 ---------------- */
  var CODE4 = { lang: 'py', title: '执行前的审批闸门（示意，本机实跑 D 段）', src:
"RISKY = ('delete', 'rm ', 'publish', 'drop ')\n" +
"def needs_approval(cmd):\n" +
"    return any(w in cmd for w in RISKY)\n" +
"\n" +
"def gate(cmd, human=None):\n" +
"    if not needs_approval(cmd):\n" +
"        return 'EXECUTE'\n" +
"    if human is None:\n" +
"        return 'PAUSED (waiting for approval)'\n" +
"    return ('EXECUTE' if human == 'yes'\n" +
"            else 'REJECTED -> revise plan')\n" };
  function cmd(t, w) { return chip(110, 320, t, w || 250); }
  var sc4 = {
    name: '审批闸门', desc: '危险命令在执行前暂停，等人决定。人拒绝了，智能体就得换个做法。闸门在智能体之外。',
    code: CODE4, dataTitle: '闸门', data: { '执行': 0, '暂停': 0, '拒绝': 0 },
    bg: function (d) { title(d, '执行前检查：危险动作先停下来等人批准'); },
    objects: function () {
      var o = {};
      o.pa = path('M178,320 L352,320', C.data);
      o.pb = path('M508,320 L690,320', C.ok);
      o.ph = path('M430,286 L430,176', C.warn, { arrow: 'warn' });
      o.phd = path('M446,176 L446,286', C.bad, { arrow: 'bad' });
      o.ag = node(110, 320, 130, 62, '智能体', '', 'info');
      o.gt = node(430, 320, 150, 66, '执行前检查', 'gate(cmd)', 'warn');
      o.ex = node(752, 320, 120, 62, '执行', '邮箱 API', 'ok');
      o.hm = node(438, 146, 150, 56, '人', '批准 / 拒绝', 'neutral');
      o.c0 = cmd('gmail search in:inbox --max 20', 270);
      o.c1 = cmd('gmail delete --older-than 30d', 260);
      o.c3 = cmd('gmail label old --older-than 30d', 270);
      o.wait = { type: 'text', x: 430, y: 410, text: '暂停：等待批准', size: 13, weight: 700, color: C.warn, anchor: 'middle', opacity: 0 };
      o.rej = { type: 'text', x: 270, y: 470, text: '拒绝 → 智能体改计划', size: 13, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '讲义第 36 页说，检查必须在执行之前完成。不然拦不住不安全的工具调用。示意规则：命令里有 delete、rm、publish、drop，就要人批准。',
        set: mix({ ag: pop(0), gt: pop(200), ex: pop(400), hm: pop(600) }, on('pa', 300), on('pb', 500)), hl: [1, 2, 3] },
      { say: '搜索收件箱：不是危险命令，直接执行。',
        set: { c0: mix(fade(0, 150), { x: { to: 752, dur: 1500, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 300, delay: 2000 } }) },
        fx: [st('pa', 100, C.data, 4), { type: 'pulse', obj: 'gt', color: C.ok, at: 800 }, st('pb', 900, C.ok, 4), { type: 'ripple', obj: 'ex', color: C.ok, at: 1600 }],
        log: [{ s: ">>> gate('gmail search in:inbox --max 20')", at: 100 }, { s: 'EXECUTE', at: 900 }], data: { '执行': { v: 1, at: 900 } }, hl: [6, 7] },
      { say: '删除旧邮件：命令里有 delete，闸门把它停在执行之前，去问人。',
        set: join(on('ph', 1000), { c1: mix(fade(0, 150), { x: { to: 430, dur: 850, delay: 100, ease: 'out' }, y: { to: 372, dur: 500, delay: 1000, ease: 'out' }, fill: { to: C.warnW, delay: 900 }, stroke: { to: C.warn, delay: 900 } }), wait: fade(1100) }),
        fx: [st('pa', 100, C.data, 4), { type: 'flash', obj: 'gt', color: C.warn, at: 900 }, st('ph', 1100, C.warn, 4), { type: 'pulse', obj: 'hm', color: C.warn, at: 1600 }],
        log: [{ s: ">>> gate('gmail delete --older-than 30d')", at: 100 }, { s: 'PAUSED (waiting for approval)', at: 900 }], data: { '暂停': { v: 1, at: 900 } }, hl: [8, 9] },
      { say: '人说不行：这条命令被拒绝、不执行，退回给智能体，让它改计划。',
        set: join(on('phd', 0), { ph: { flow: { to: 0, dur: 300 }, opacity: { to: 0.3, dur: 300 } }, wait: fade(0, 300, 0), c1: { fill: { to: C.badW, delay: 700 }, stroke: { to: C.bad, delay: 700 }, x: { to: 270, dur: 900, delay: 900, ease: 'inOut' }, y: { to: 440, dur: 900, delay: 900, ease: 'inOut' } }, rej: fade(1600) }),
        fx: [st('phd', 100, C.bad, 4), { type: 'shake', obj: 'gt', at: 700 }],
        log: [{ s: ">>> gate('gmail delete --older-than 30d', human='no')", at: 100 }, { s: 'REJECTED -> revise plan', at: 900 }], data: { '拒绝': { v: 1, at: 900 } }, hl: [10, 11] },
      { say: '智能体换了个做法：给旧邮件打标签而不删除（示意）。这条不需要批准，直接执行。',
        set: { phd: { flow: { to: 0, dur: 300 }, opacity: { to: 0.3, dur: 300 } }, c3: mix(fade(0, 150), { x: { to: 752, dur: 1500, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 300, delay: 2000 } }) },
        fx: [st('pa', 100, C.data, 4), { type: 'pulse', obj: 'gt', color: C.ok, at: 800 }, st('pb', 900, C.ok, 4), { type: 'ripple', obj: 'ex', color: C.ok, at: 1600 }],
        log: [{ s: ">>> gate('gmail label old --older-than 30d')", at: 100 }, { s: 'EXECUTE', at: 900 }], data: { '执行': { v: 2, at: 900 } }, hl: [6, 7] },
      { say: '第 36 页说，检查、日志和停止开关，都不能让智能体碰到。闸门是外壳里的代码，不是对模型的一句嘱咐。',
        fx: [{ type: 'pulse', obj: 'gt', color: C.warn, at: 0 }, { type: 'pulse', obj: 'hm', color: C.neutral, at: 300 }],
        log: [{ s: 'executed: 2 | paused: 1 | rejected: 1', at: 100 }] }
    ]
  };

  VZ.register({
    id: 'c7-gate', title: '凭据与执行前检查：四段能跑的小代码',
    sources: [PDF],
    note: '三个问题（谁在要、对哪个资源做什么、允许吗）出自讲义第 27 页。两个账号的权限表和"GitHub App 安装令牌一小时过期"出自第 28 页。代理的时序（请求 + run ID → 查权限 → 带密钥调 API → 结果 + 单独记录的事件）出自第 29 页。"检查必须在执行之前完成""检查、日志、停止开关放在智能体控制不到的地方"出自第 36 页。代码是示意实现，控制台和变量面板都是本机实跑的真实输出。账号名、动作名、命令、密钥字符串、"改成打标签"的新计划都是示意。',
    legend: [[C.info, '智能体'], [C.data, '请求'], [C.warn, '令牌 / 检查 / 密钥'], [C.ok, '放行 / 结果'], [C.bad, '拒绝'], [C.neutral, '人 / 审计记录']],
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

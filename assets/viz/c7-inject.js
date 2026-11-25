/* 07 · 第 13 讲 —— 一条注入的指令怎么一路走到危险动作，又会在哪几层被拦住
 * 场景 1：Cline 供应链攻击（讲义第 6、10、22 页）；场景 2：Copilot 数据外泄（第 5 页）；
 * 场景 3：沙箱的三条边界（第 19–22 页）；场景 4：细粒度令牌（第 28 页的两个账号）；场景 5：执行前检查（第 33、36 页）。
 * 节点和连线都按讲义的示意图重画；"藏着的指令""npm publish（来自 issue）""资源上限条"等具体文字和画法是示意。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = { t: '讲义 lecture-13 第 5–6、10、19–22、28、33、36 页', u: 'https://www.cmu-agents.com/slides/lecture-13-agent-safety.pdf' };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op) {
    var f = PAL[k];
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: f[0], stroke: f[1], sw: 1.7, text: t, sub: sub, subMono: false, subSize: 11.5, size: 13.5, weight: 700, opacity: op == null ? 0 : op };
  }
  function group(x, y, w, h, k) { return { type: 'box', x: x, y: y, w: w, h: h, rx: 14, fill: C.bg, stroke: PAL[k][1], sw: 1.4, dasharray: '6 4', text: '', opacity: 0 }; }
  function label(x, y, t, col, anchor) { return { type: 'text', x: x, y: y, text: t, size: 12.5, weight: 700, color: col, anchor: anchor || 'start', opacity: 0 }; }
  function path(d, col, extra) { return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, opacity: 0, arrow: col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data' }, extra || {}); }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function chip(x, y, t, w, k) { var f = PAL[k || 'bad']; return { type: 'box', x: x, y: y, w: w || 130, h: 26, rx: 6, fill: f[0], stroke: f[1], sw: 1.3, text: t, size: 12, weight: 700, opacity: 0, trail: { n: 4, gap: 40 } }; }
  function cross(x, y) { return { type: 'text', x: x, y: y, text: '拦', size: 24, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 }; }
  function badden(delay) { return { fill: { to: C.badW, dur: 300, delay: delay || 0 }, stroke: { to: C.bad, dur: 300, delay: delay || 0 } }; }

  /* ---------------- 场景 1：Cline 的注入链路 ---------------- */
  var Y1 = 170, Y2 = 400, CY1 = 124, CY2 = 354;
  var sc1 = {
    name: '注入链路', desc: 'Cline 事故：issue 里的文本被当成指令，变成 shell 命令，写进共享缓存。后来发布流程恢复了缓存，用上发布令牌。它发出了未经授权的版本。',
    bg: function (d) { title(d, '一条 issue 标题，怎么变成一次未经授权的发布'); },
    objects: function () {
      var o = {};
      o.g1 = group(300, Y1, 570, 130, 'data');
      o.g1T = label(30, 224, '处理 issue 的运行', C.data);
      o.g2 = group(510, Y2, 570, 130, 'data');
      o.g2T = label(240, 454, '发布流程（后来的另一次运行）', C.data);
      o.p1 = path('M165,' + Y1 + ' L235,' + Y1, C.data);
      o.p2 = path('M365,' + Y1 + ' L435,' + Y1, C.data);
      o.p3 = path('M565,' + Y1 + ' L655,' + Y1, C.bad);
      o.p4 = path('M720,198 L720,372', C.bad);
      o.p5 = path('M655,' + Y2 + ' L565,' + Y2, C.bad);
      o.p6 = path('M435,' + Y2 + ' L365,' + Y2, C.bad);
      o.p7 = path('M235,' + Y2 + ' L165,' + Y2, C.bad);
      o.is = node(100, Y1, 130, 56, 'Issue 标题', '不可信的文本', 'bad');
      o.cx = node(300, Y1, 130, 56, '模型上下文', '智能体 + shell', 'info');
      o.sh = node(500, Y1, 130, 56, 'Shell 命令', '在系统上执行', 'warn');
      o.ca = node(720, Y1, 130, 56, '共享缓存', '', 'neutral');
      o.caT = label(720, 222, '跨运行的共享状态', C.fg2, 'middle');
      o.ended = label(300, 258, '这次运行已经结束', C.fg2, 'middle');
      o.rj = node(720, Y2, 130, 56, '发布任务', '恢复缓存', 'info');
      o.tk = node(500, Y2, 130, 56, '发布令牌', '', 'warn');
      o.np = node(300, Y2, 130, 56, 'npm 发布', '', 'data');
      o.us = node(100, Y2, 130, 56, '用户的机器', '', 'neutral');
      o.pl = chip(100, CY1, '藏着的指令', 130);
      return o;
    },
    steps: [
      { say: '讲义第 10 页的链条：issue 标题是不可信的文本。它却进了模型上下文，被当成指令。最后变成一条在系统上执行的 shell 命令。',
        set: mix({ g1: fade(0, 400), g1T: fade(200), is: pop(200), cx: pop(400), sh: pop(600), ca: pop(800), caT: fade(900) }, on('p1', 500), on('p2', 700)) },
      { say: 'Cline 用一个带 shell 的智能体读 GitHub issue、打标签（第 6 页）。攻击者把指令写在 issue 里。',
        set: { pl: pop(0) }, fx: [{ type: 'pulse', obj: 'is', color: C.bad, at: 300 }] },
      { say: '智能体读 issue，这段文字进了上下文。模型分不清这是"要处理的数据"，还是"要执行的指令"。',
        set: { pl: { x: { to: 300, dur: 900, ease: 'inOut' }, text: { to: '被当成指令', delay: 700 } }, cx: { stroke: { to: C.bad, dur: 300, delay: 900 } } },
        fx: [st('p1', 0, C.bad, 4), { type: 'flash', obj: 'cx', color: C.bad, at: 900 }] },
      { say: '它照着做了：生成并执行一条 shell 命令。',
        set: { pl: { x: { to: 500, dur: 900, ease: 'inOut' }, text: { to: 'shell 命令', delay: 700 } }, sh: badden(900) },
        fx: [st('p2', 0, C.bad, 4), { type: 'pulse', obj: 'sh', color: C.bad, at: 900 }] },
      { say: '命令往一个共享缓存里写进了有毒的文件。',
        set: join(on('p3'), { pl: { x: { to: 720, dur: 900, ease: 'inOut' }, text: { to: '有毒的文件', delay: 700 } }, ca: mix(badden(900), { sub: { to: '被投毒', delay: 900 } }) }),
        fx: [st('p3', 100, C.bad, 4), { type: 'ripple', obj: 'ca', color: C.bad, at: 1000 }] },
      { say: '处理 issue 的这次运行结束了，可缓存还在。讲义第 22 页：共享状态能比改动它的那次运行活得更久。',
        set: { g1: { opacity: { to: 0.35, dur: 600 } }, g1T: { opacity: { to: 0.4, dur: 600 } }, is: { opacity: { to: 0.35, dur: 600 } }, cx: { opacity: { to: 0.35, dur: 600 } }, sh: { opacity: { to: 0.35, dur: 600 } }, p1: { flow: { to: 0, dur: 300 }, opacity: { to: 0.2, dur: 600 } }, p2: { flow: { to: 0, dur: 300 }, opacity: { to: 0.2, dur: 600 } }, p3: { flow: { to: 0, dur: 300 }, opacity: { to: 0.2, dur: 600 } }, ended: fade(500) },
        fx: [{ type: 'pulse', obj: 'ca', color: C.bad, at: 700 }] },
      { say: '后来发布流程的一次运行开始了。它恢复了这个缓存，有毒的文件就跟着进来了。',
        set: join({ g2: fade(0, 400), g2T: fade(200), rj: pop(200), tk: pop(350), np: pop(500), us: pop(650) }, on('p4', 600), { pl: { y: { to: CY2, dur: 900, delay: 700, ease: 'inOut' }, x: { to: 790, dur: 900, delay: 700, ease: 'inOut' }, text: { to: '恢复缓存', delay: 1100 } }, rj: badden(1500) }),
        fx: [st('p4', 700, C.bad, 5), { type: 'pulse', obj: 'rj', color: C.bad, at: 1500 }] },
      { say: '发布任务用上了发布令牌，发出一个未经授权的命令行版本。讲义说，攻击者有了发布令牌，就能让代码跑在用户机器上。',
        set: join(on('p5'), on('p6', 600), on('p7', 1200), { pl: { x: { to: 100, dur: 2000, delay: 100, ease: 'inOut' }, text: { to: '未经授权的版本', delay: 1100 } }, np: badden(1000), us: badden(1700) }),
        fx: [st('p5', 0, C.bad, 4), { type: 'pulse', obj: 'tk', color: C.warn, at: 400 }, st('p6', 600, C.bad, 4), { type: 'burst', obj: 'np', color: C.bad, at: 1100 }, st('p7', 1200, C.bad, 4), { type: 'ripple', obj: 'us', color: C.bad, at: 1800 }] }
    ]
  };

  /* ---------------- 场景 2：Copilot 数据外泄 ---------------- */
  var sc2 = {
    name: '邮件外泄', desc: '攻击者不进组织，只发一封带指令的邮件。Copilot 读到它，照常检索私有文档，再照着指令把数据带出去。',
    bg: function (d) { title(d, '一封邮件，借 Copilot 的手把私有数据带出组织'); },
    objects: function () {
      var o = {};
      o.org = group(300, 300, 520, 300, 'data');
      o.orgT = label(56, 176, '组织内部', C.data);
      o.pr = path('M225,320 L365,320', C.data);
      o.pe = path('M645,170 L540,170 L540,305 L497,305', C.bad);
      o.px = path('M497,335 L600,335 L600,440 L645,440', C.bad);
      o.docs = node(160, 320, 130, 56, '私有文档', '', 'data');
      o.cp = node(430, 320, 130, 56, 'Copilot', '能检索私有文档', 'info');
      o.mail = node(720, 170, 150, 56, '攻击者的邮件', '藏着指令', 'bad');
      o.srv = node(720, 440, 150, 56, '攻击者的服务器', '', 'bad');
      o.ins = mix(chip(720, 214, '藏着的指令', 110), { along: 'pe', t: 0 });
      o.d0 = chip(160, 280, '文档', 64, 'data');
      o.d1 = chip(160, 280, '文档', 64, 'data');
      o.e0 = mix(chip(497, 335, '私有数据', 90), { along: 'px', t: 0 });
      o.e1 = mix(chip(497, 335, '私有数据', 90), { along: 'px', t: 0 });
      o.leak = label(300, 476, '私有数据离开了组织', C.bad, 'middle');
      return o;
    },
    steps: [
      { say: '讲义第 5 页：Copilot 本来就能检索组织内部的私有文档。这是它正常的权限。',
        set: mix({ org: fade(0, 400), orgT: fade(200), docs: pop(300), cp: pop(500) }, on('pr', 600)) },
      { say: '攻击者不用进组织，只要发来一封邮件，里面藏着给 Copilot 的指令。',
        set: { mail: pop(0), srv: pop(250) }, fx: [{ type: 'pulse', obj: 'mail', color: C.bad, at: 500 }] },
      { say: '邮件成了 Copilot 要读的内容，藏着的指令跟着进了它的上下文。',
        set: join(on('pe'), { ins: mix({ opacity: { to: 1, dur: 200 } }, { t: { to: 0.62, dur: 1100, delay: 100, ease: 'inOut' } }), cp: { stroke: { to: C.bad, dur: 300, delay: 1300 } } }),
        fx: [st('pe', 100, C.bad, 5), { type: 'flash', obj: 'cp', color: C.bad, at: 1400 }] },
      { say: 'Copilot 照常检索私有文档……',
        set: { ins: fade(0, 300, 0), d0: mix({ opacity: { from: 1, to: 0, dur: 250, delay: 1100 } }, { x: { to: 430, dur: 1000, delay: 100, ease: 'inOut' } }), d1: mix({ opacity: { from: 1, to: 0, dur: 250, delay: 1500 } }, { x: { to: 430, dur: 1000, delay: 500, ease: 'inOut' } }) },
        fx: [st('pr', 100, C.data, 5), { type: 'pulse', obj: 'cp', color: C.info, at: 1200 }] },
      { say: '……再照着邮件里的指令，把私有数据发给攻击者的服务器。这就越过了组织的边界。',
        set: join(on('px'), { e0: mix({ opacity: { to: 1, dur: 200 } }, { t: { to: 0.82, dur: 1300, delay: 100, ease: 'inOut' } }), e1: mix({ opacity: { to: 1, dur: 200, delay: 500 } }, { t: { to: 0.5, dur: 1100, delay: 500, ease: 'inOut' } }), leak: fade(1300) }),
        fx: [st('px', 100, C.bad, 6), { type: 'pulse', obj: 'org', color: C.bad, at: 900 }, { type: 'burst', obj: 'srv', color: C.bad, at: 1500 }] },
      { say: '讲义注明这是研究者演示的漏洞，微软已修补。没有报告大规模泄露。和 Cline 一样，攻击文本都混在智能体要读的内容里进来。',
        fx: [{ type: 'pulse', obj: 'mail', color: C.bad, at: 0 }, { type: 'pulse', obj: 'cp', color: C.info, at: 300 }] }
    ]
  };

  /* ---------------- 场景 3：沙箱的三条边界 ---------------- */
  var BY = [230, 290, 350];
  var sc3 = {
    name: '沙箱边界', desc: '把执行放进沙箱：任务文件和运行代码照常可用。读私有文件、连外部服务、写共享状态，都在边界被挡住。资源也有上限。',
    bg: function (d) {
      title(d, '同样的指令，进了沙箱以后能走多远');
      BY.forEach(function (y) { d.line(552, y, 622, y, { stroke: C.line, sw: 1.4, dasharray: '4 4' }); });
    },
    objects: function () {
      var o = {};
      o.sb = group(290, 290, 500, 380, 'data');
      o.sbT = label(58, 126, '沙箱（这一次运行）', C.data);
      o.pt = path('M140,260 L140,160 L305,160', C.ok);
      o.pc = path('M140,320 L140,420 L305,420', C.ok);
      o.pb1 = path('M200,282 L300,' + BY[0] + ' L532,' + BY[0], C.bad, { arrow: null });
      o.pb2 = path('M200,290 L532,' + BY[1], C.bad, { arrow: null });
      o.pb3 = path('M200,298 L300,' + BY[2] + ' L532,' + BY[2], C.bad, { arrow: null });
      o.ag = node(140, 290, 120, 60, '智能体', '', 'info');
      o.tf = node(370, 160, 130, 50, '任务文件', '', 'data');
      o.rc = node(370, 420, 130, 50, '运行代码', '', 'warn');
      o.pf = node(700, BY[0], 160, 50, '私有文件', '', 'neutral', 1);
      o.os = node(700, BY[1], 160, 50, '其他服务', '', 'neutral', 1);
      o.sc = node(700, BY[2], 160, 50, '共享缓存', '', 'neutral', 1);
      o.x0 = cross(540, BY[0] + 8); o.x1 = cross(540, BY[1] + 8); o.x2 = cross(540, BY[2] + 8);
      o.rl = { type: 'box', x: 70, y: 462, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.warn, stroke: 'none', text: '', opacity: 0 };
      o.rlCap = { type: 'line', x1: 300, y1: 452, x2: 300, y2: 472, stroke: C.bad, sw: 2.5, opacity: 0 };
      o.rlT = label(312, 466, '资源上限（示意）', C.warn);
      o.pol = node(700, 450, 170, 52, '访问规则', '在智能体之外', 'warn');
      return o;
    },
    steps: [
      { say: '讲义第 19 页：沙箱是一个隔离的环境。它限制程序能访问什么、能做什么。',
        set: mix({ sb: fade(0, 400), sbT: fade(200), ag: pop(200), tf: pop(400), rc: pop(550) }, on('pt', 500), on('pc', 650)) },
      { say: '在沙箱里，智能体能读写任务文件、能运行代码。该干的活照样能干。',
        fx: [st('pt', 0, C.ok, 5), { type: 'ripple', obj: 'tf', color: C.ok, at: 700 }, st('pc', 200, C.ok, 5), { type: 'ripple', obj: 'rc', color: C.ok, at: 900 }] },
      { say: '被注入的命令想去读沙箱外的私有文件：在边界被策略挡住。这是第一条边界：文件系统和进程（第 20 页）。',
        set: join(on('pb1'), { x0: pop(700), pf: { sub: { to: '挡住：文件系统和进程', delay: 800 }, stroke: { to: C.bad, delay: 800 } } }),
        fx: [st('pb1', 0, C.bad, 4), { type: 'flash', x: 540, y: BY[0], color: C.bad, at: 700 }, { type: 'shake', obj: 'pf', at: 800 }] },
      { say: '想连别的服务、把数据发出去，碰上第二条边界：网络。它管能连哪些服务、在那里能做什么。',
        set: join(on('pb2'), { x1: pop(700), os: { sub: { to: '挡住：网络', delay: 800 }, stroke: { to: C.bad, delay: 800 } } }),
        fx: [st('pb2', 0, C.bad, 4), { type: 'flash', x: 540, y: BY[1], color: C.bad, at: 700 }, { type: 'shake', obj: 'os', at: 800 }] },
      { say: '想往跨运行共享的缓存里写？第 22 页的教训是，共享状态会活过这次运行。所以它也得放在边界外面管起来。',
        set: join(on('pb3'), { x2: pop(700), sc: { sub: { to: '挡住：跨运行的共享状态', delay: 800 }, stroke: { to: C.bad, delay: 800 } } }),
        fx: [st('pb3', 0, C.bad, 4), { type: 'flash', x: 540, y: BY[2], color: C.bad, at: 700 }, { type: 'shake', obj: 'sc', at: 800 }] },
      { say: '第三条边界是资源：能用多少算力和存储、最多跑多久。用量涨到上限就停（示意）。',
        set: { rl: mix(fade(0, 200), { w: { to: 230, dur: 1400, delay: 100, ease: 'out' } }), rlCap: fade(0, 300), rlT: fade(200) },
        fx: [{ type: 'flash', x: 300, y: 462, color: C.bad, at: 1500 }] },
      { say: '第 21 页：不管整个智能体放进沙箱，还是只放工具。访问规则和执行规则的机制，都要放在智能体够不着的地方。',
        set: { pol: pop(0) }, fx: [{ type: 'pulse', obj: 'sb', color: C.data, at: 300 }, { type: 'pulse', obj: 'pol', color: C.warn, at: 600 }] }
    ]
  };

  /* ---------------- 场景 4：细粒度令牌 ---------------- */
  var AX = 220, BX = 640, RY = [250, 310, 370];
  function req(x0, t, w) { return chip(x0, 152, t, w || 150, 'data'); }
  function toRow(x, y, ok, delay) {
    var d = delay || 0;
    return ok
      ? mix(fade(d, 150), { y: { to: y, dur: 900, delay: d + 100, ease: 'inOut' }, fill: { to: C.okW, delay: d + 900 }, stroke: { to: C.ok, delay: d + 900 }, opacity: { from: 1, to: 0, dur: 400, delay: d + 1700 } })
      : mix(fade(d, 150), { y: { to: y, dur: 900, delay: d + 100, ease: 'inOut' }, fill: { to: C.badW, delay: d + 900 }, stroke: { to: C.bad, delay: d + 900 }, opacity: { from: 1, to: 0, dur: 400, delay: d + 1900 } });
  }
  var sc4 = {
    name: '令牌收窄', desc: '两个流程各用一个细粒度令牌。注入的"发布"在处理 issue 的令牌那里就被拒绝。发布流程也碰不了 issue 的缓存。',
    bg: function (d) { title(d, '同一次攻击，换成细粒度令牌'); },
    objects: function () {
      var o = {};
      o.pA = path('M' + AX + ',128 L' + AX + ',196', C.data);
      o.pB = path('M' + BX + ',128 L' + BX + ',196', C.data);
      o.agA = node(AX, 100, 190, 52, '处理 issue 的智能体', '', 'info');
      o.agB = node(BX, 100, 190, 52, '发布任务', '', 'info');
      o.cA = { type: 'box', x: AX, y: 310, w: 300, h: 220, rx: 12, fill: C.bg, stroke: C.warn, sw: 1.6, text: '', opacity: 0 };
      o.cB = { type: 'box', x: BX, y: 310, w: 300, h: 220, rx: 12, fill: C.bg, stroke: C.warn, sw: 1.6, text: '', opacity: 0 };
      o.cAT = label(AX, 218, '处理 issue 的令牌', C.warn, 'middle');
      o.cBT = label(BX, 218, '发布用的令牌', C.warn, 'middle');
      [['a0', AX, 0, '能读 issue', 'ok'], ['a1', AX, 1, '能打标签', 'ok'], ['a2', AX, 2, '不能发布版本', 'bad'],
       ['b0', BX, 0, '能读已批准的源码', 'ok'], ['b1', BX, 1, '能发布版本', 'ok'], ['b2', BX, 2, '不能修改 issue 缓存', 'bad']].forEach(function (r) {
        o[r[0]] = { type: 'box', x: r[1], y: RY[r[2]] + 10, w: 250, h: 40, rx: 8, fill: PAL[r[4]][0], stroke: PAL[r[4]][1], sw: 1.2, text: r[3], size: 13, weight: 700, opacity: 0 };
      });
      o.cache = node(430, 480, 190, 44, '被投毒的 issue 缓存', '', 'bad');
      o.q0 = req(AX, 'read_issue');
      o.q1 = req(AX, 'publish（被注入）', 170);
      o.q2 = req(BX, 'read approved source', 190);
      o.q3 = req(BX, 'restore issue cache', 190);
      o.q4 = req(BX, 'publish release', 160);
      return o;
    },
    steps: [
      { say: '回到 Cline。假如两个流程各用一个细粒度令牌（讲义第 28 页的两列）。每个令牌只有自己任务要的权限。',
        set: mix({ agA: pop(0), agB: pop(150), cA: fade(300, 400), cB: fade(400, 400), cAT: fade(400), cBT: fade(500), a0: fade(600), a1: fade(700), a2: fade(800), b0: fade(650), b1: fade(750), b2: fade(850), cache: pop(1000) }, on('pA', 400), on('pB', 500)) },
      { say: '处理 issue 的智能体读 issue：令牌里有这一项，放行。',
        set: { q0: toRow(AX, RY[0] + 10, true, 0), a0: { text: { to: '能读 issue（放行）', delay: 1000 } } }, fx: [st('pA', 0, C.data, 4), { type: 'ripple', obj: 'a0', color: C.ok, at: 1000 }] },
      { say: '注入的指令要它发布版本。这个令牌根本没有发布权限，请求在这里就被拒绝。',
        set: { q1: toRow(AX, RY[2] + 10, false, 0), a2: { text: { to: '不能发布版本（拦下注入）', delay: 1000 } } }, fx: [st('pA', 0, C.bad, 4), { type: 'shake', obj: 'a2', at: 1000 }, { type: 'flash', obj: 'a2', color: C.bad, at: 1000 }] },
      { say: '发布流程只读已批准的源码。它不去拿 issue 那边被投毒的东西。',
        set: { q2: toRow(BX, RY[0] + 10, true, 0), b0: { text: { to: '能读已批准的源码（放行）', delay: 1000 } } }, fx: [st('pB', 0, C.data, 4), { type: 'ripple', obj: 'b0', color: C.ok, at: 1000 }] },
      { say: '要它恢复 issue 的缓存：发布令牌没有改 issue 缓存的权限，拒绝。毒文件留在原地没人用。',
        set: { q3: toRow(BX, RY[2] + 10, false, 0), b2: { text: { to: '不能修改 issue 缓存（拒绝）', delay: 1000 } }, cache: { opacity: { to: 0.4, dur: 500, delay: 1400 } } }, fx: [st('pB', 0, C.bad, 4), { type: 'shake', obj: 'b2', at: 1000 }, { type: 'flash', obj: 'b2', color: C.bad, at: 1000 }] },
      { say: '正常的发布照常进行。讲义说，要限制令牌能碰的资源、能做的动作、能用多久。比如 GitHub App 安装令牌一小时过期。',
        set: { q4: toRow(BX, RY[1] + 10, true, 0), b1: { text: { to: '能发布版本（放行）', delay: 1000 } } }, fx: [st('pB', 0, C.data, 4), { type: 'ripple', obj: 'b1', color: C.ok, at: 1000 }, { type: 'pulse', obj: 'cA', color: C.warn, at: 1500 }, { type: 'pulse', obj: 'cB', color: C.warn, at: 1700 }] }
    ]
  };

  /* ---------------- 场景 5：执行前检查 ---------------- */
  var sc5 = {
    name: '执行前检查', desc: '每个工具调用执行前先过检查。精确的条件用规则，需要上下文的用模型。没通过就拦下或暂停，所有调用都进日志供事后复盘。',
    bg: function (d) { title(d, '执行之前：规则 + 模型一起把关'); },
    objects: function () {
      var o = {};
      o.pa = path('M175,250 L290,250', C.warn);
      o.pb = path('M430,250 L575,250', C.ok);
      o.prl = path('M330,218 L300,152', C.data);
      o.pml = path('M390,218 L440,152', C.info);
      o.pd = path('M360,282 L360,352', C.bad);
      o.pl = path('M640,278 L640,352', C.neutral, { dasharray: '5 4', arrow: 'neutral' });
      o.pbl = path('M430,380 L575,380', C.neutral, { arrow: 'neutral' });
      o.pi = path('M640,408 L640,458', C.neutral, { arrow: 'neutral' });
      o.tc = node(110, 250, 130, 56, '工具调用', '', 'warn');
      o.ck = node(360, 250, 140, 62, '检查', '执行之前', 'info');
      o.ex = node(640, 250, 130, 56, '执行', '', 'ok');
      o.rule = node(270, 124, 200, 54, '规则', '发布者在允许列表里吗？', 'data');
      o.mdl = node(490, 124, 220, 54, '模型检查', '是不是在听 issue 里的指令？', 'info');
      o.bl = node(360, 380, 140, 52, '拦下或暂停', '', 'bad');
      o.lg = node(640, 380, 130, 52, '日志', '', 'neutral');
      o.im = node(640, 486, 170, 50, '事后复盘、改进', '', 'neutral');
      o.n0 = chip(110, 200, 'apply_label bug', 150, 'warn');
      o.j0 = chip(110, 200, 'npm publish（来自 issue）', 210, 'warn');
      return o;
    },
    steps: [
      { say: '讲义第 36 页说，检查必须在执行之前做完。不然拦不住不安全的工具调用。',
        set: mix({ tc: pop(0), ck: pop(150), ex: pop(300), rule: pop(450), mdl: pop(550), bl: pop(650), lg: pop(750), im: pop(850) }, on('pa', 300), on('pb', 400), on('pd', 600), on('prl', 500), on('pml', 550)) },
      { say: '正常的调用过了规则和模型检查，就执行。执行结果记进日志。',
        set: join(on('pl', 1400), { n0: mix(fade(0, 150), { x: { to: 640, dur: 1500, delay: 100, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 300, delay: 1700 } }) }),
        fx: [st('pa', 0, C.warn, 4), st('prl', 600, C.ok, 3), st('pml', 600, C.ok, 3), { type: 'pulse', obj: 'ck', color: C.ok, at: 900 }, st('pb', 1000, C.ok, 4), st('pl', 1500, C.neutral, 3)] },
      { say: '一条来自 issue 的发布命令到了检查处。第 33 页说，精确的条件交给规则。这个发布者不在允许列表里。',
        set: { j0: mix(fade(0, 150), { x: { to: 360, dur: 900, delay: 100, ease: 'out' } }) },
        fx: [st('pa', 0, C.bad, 4), st('prl', 900, C.bad, 3), { type: 'shake', obj: 'rule', at: 1300 }, { type: 'flash', obj: 'rule', color: C.bad, at: 1300 }] },
      { say: '需要上下文的问题交给模型。它读用户的任务、issue 和工具调用。再判断智能体是不是在听攻击者的话。讲义说要去日志里核对它依据的原文。',
        fx: [st('pml', 0, C.bad, 3), { type: 'shake', obj: 'mdl', at: 500 }, { type: 'flash', obj: 'mdl', color: C.bad, at: 500 }] },
      { say: '检查没通过：这条调用被拦下（或者暂停等人看），根本没有执行。',
        set: { j0: { fill: { to: C.badW, delay: 0 }, stroke: { to: C.bad, delay: 0 }, y: { to: 330, dur: 700, delay: 200, ease: 'bounce' } } },
        fx: [st('pd', 100, C.bad, 4), { type: 'pulse', obj: 'bl', color: C.bad, at: 800 }] },
      { say: '被拦下的尝试也进日志。事后复盘用来解释失败、改进防线。检查、日志和停止开关，都要放在智能体控制不到的地方。',
        set: join(on('pbl'), on('pi', 700)),
        fx: [st('pbl', 0, C.neutral, 4), { type: 'pulse', obj: 'lg', color: C.neutral, at: 600 }, st('pi', 700, C.neutral, 3), { type: 'ripple', obj: 'im', color: C.neutral, at: 1300 }] }
    ]
  };

  VZ.register({
    id: 'c7-inject', title: '一条注入的指令：从不可信文本到危险动作，又在哪几层被拦住',
    sources: [PDF],
    note: '场景 1 的链条出自讲义第 10 页（Issue 标题 → 模型上下文 → shell 命令）和第 6 页（共享缓存被投毒 → 发布任务恢复 → 发布令牌 → npm 发布），"共享状态比改动它的运行活得更久"出自第 22 页。场景 2 出自第 5 页。场景 3 的沙箱、三条边界和边界位置出自第 19–22 页。场景 4 的两列权限出自第 28 页。场景 5 的规则 / 模型检查出自第 33 页，执行前检查、拦下或暂停、事后看日志出自第 36 页。芯片上的具体文字（"藏着的指令""npm publish（来自 issue）"等）、资源上限条和"一次正常调用"是示意。场景 4 是把 Cline 的流程套到第 28 页的权限表上，是笔记的推演。',
    legend: [[C.data, '数据 / 正常请求'], [C.info, '智能体 / 模型'], [C.warn, '命令 / 令牌 / 规则'], [C.ok, '放行'], [C.bad, '攻击 / 风险 / 拦截'], [C.neutral, '日志 / 外部资源']],
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

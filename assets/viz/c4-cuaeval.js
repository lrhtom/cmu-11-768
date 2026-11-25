/* 04 · 第 7 讲 —— 电脑操作智能体怎么评测：单步动作、终态检查、验证器漏洞、结果 + 过程、LLM 评审、长任务的 rubric
 * 例子照讲义 lecture-07 第 17–41 页（"加一个 20 美元以下的蓝杯子进购物车，不许下单"贯穿各种评法）。
 * 控制台和数据面板是 本机验算脚本 第 2 部分本机实跑的输出：
 *   2a ScreenSpot-Pro 目标框的点判（讲义第 21 页的框）、2b 终态检查、2c 只看结果 vs 也看过程、2d WebArena 第 476 题简化版验证器、2e Odysseys 的 rubric 平均分。
 * 代码面板是照讲义第 21、25、27、39、41 页写成能跑的 Python（购物车状态、HTML 页面是示意数据）。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L7 = 'https://www.cmu-agents.com/slides/lecture-07-computer-use-agents.pdf', YT = 'https://youtu.be/jwGluLrrqjQ?t=';
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function akey(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'neutral'; }
  function wire(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: akey(col), opacity: 0 }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 300, delay: d0 || 0 }, flow: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function node(x, y, w, h, t, sub, k, mono) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.7, text: t, sub: sub, subMono: !!mono, subSize: 11.5, size: 13.5, weight: 700, opacity: 0 };
  }
  function chip(x, y, w, t, k, size, mono) { return { type: 'box', x: x, y: y, w: w, h: 30, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: mono !== false, opacity: 0 }; }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  function recolor(k, delay) { return { fill: { to: PAL[k][0], dur: 400, delay: delay || 0 }, stroke: { to: PAL[k][1], dur: 400, delay: delay || 0 } }; }
  function mark(x, y, ok, at) { return { type: 'float', x: x, y: y, text: ok ? '对' : '错', color: ok ? C.ok : C.bad, size: 20, at: at }; }
  function seq(lines, start) { var at = start || 0; return lines.map(function (s) { var o = { s: s, at: at }; at += Math.min(s.length * 16, 600) + 90; return o; }); }
  var TASK = '加一个 20 美元以下的蓝杯子进购物车，不许下单';

  /* ---------------- 场景 1：单步动作对不对（静态评测） ---------------- */
  var CODE1 = { lang: 'py', title: '讲义第 19、21 页 · 静态评测的打分规则', src:
'# ScreenSpot-Pro：原图 2560×1440 里的目标框\n' +
'box = (417, 132, 576, 152)\n' +
'\n' +
'def step_score(x, y):\n' +
'    # 预测的点落在框里记 1，否则记 0\n' +
'    return int(box[0] <= x <= box[2]\n' +
'               and box[1] <= y <= box[3])\n' +
'\n' +
'# Mind2Web：和录下来的那一步比\n' +
'#   目标元素 + 操作 + 输入值都对上才算对\n' +
'gold = ("CLICK", "bookCarTab", None)\n' };
  var sc1 = {
    name: '单步对不对', desc: '静态评测只看"这一步做得对不对"。点有没有落在目标框里，动作是不是和录下的一样。快、便宜，但不等于把任务做完。',
    code: CODE1, dataTitle: '步得分', data: { '预测点': '无', '在框内': '无', '步得分': 0, '环境展开': '不需要' },
    bg: function (d) { title(d, '静态评测：只问"这一步对不对"，不在环境里把任务跑完'); },
    objects: function () {
      var o = {};
      o.task = node(430, 72, 470, 40, TASK, '', 'bad');
      o.scr = { type: 'box', x: 200, y: 260, w: 300, h: 230, rx: 10, fill: C.bg2, stroke: C.neutral, sw: 1.5, text: '', opacity: 0 };
      o.bar = { type: 'box', x: 200, y: 157, w: 300, h: 24, rx: 6, fill: C.neutralW, stroke: C.neutral, sw: 1, text: '截图（固定的，不会变）', size: 11, color: C.fg3, opacity: 0 };
      o.m1 = { type: 'box', x: 110, y: 265, w: 70, h: 90, rx: 8, fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: '奶白杯', size: 12, weight: 700, opacity: 0 };
      o.m2 = { type: 'box', x: 200, y: 265, w: 70, h: 90, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.2, text: '蓝杯子', size: 12, weight: 700, opacity: 0 };
      o.m3 = { type: 'box', x: 290, y: 265, w: 70, h: 90, rx: 8, fill: C.dataW, stroke: C.neutral, sw: 1.2, text: '蓝杯套装', size: 12, weight: 700, opacity: 0 };
      o.tb = { type: 'box', x: 200, y: 265, w: 86, h: 106, rx: 6, fill: 'none', stroke: C.bad, sw: 2, dasharray: '5 3', text: '', opacity: 0 };
      o.pt = { type: 'circle', x: 560, y: 260, r: 7, fill: C.warn, stroke: C.bg2, opacity: 0, trail: { n: 4, gap: 40 } };
      o.pt2 = { type: 'circle', x: 560, y: 260, r: 7, fill: C.warn, stroke: C.bg2, opacity: 0, trail: { n: 4, gap: 40 } };
      o.rule = node(640, 200, 230, 54, '(x, y) ∈ 目标框', '规则：落在框里算对', 'info');
      o.score = node(640, 300, 230, 54, '步得分 1.0', '不需要在环境里展开', 'ok');
      o.p1 = wire('M640,228 L640,272', C.info);
      o.m2w = node(430, 440, 640, 44, 'Mind2Web：标准动作是"点 CAR 标签"', '目标元素 bookCarTab · 不执行任何动作', 'neutral', true);
      o.alt = chip(300, 505, 250, '先改日期（也合理）', 'warn', 12, false);
      o.altS = chip(560, 505, 170, '和标准不符 → 记 0', 'bad', 12, false);
      o.pA = wire('M426,505 L474,505', C.bad);
      return o;
    },
    steps: [
      { say: '任务和一张截图。静态评测不会在环境里真的执行，只看模型这一步想点哪儿。',
        set: { task: pop(0), scr: fade(200), bar: fade(250), m1: pop(400), m2: pop(480), m3: pop(560), tb: fade(900) } },
      { say: '模型预测一个点击位置，点飞向截图：落在红框里吗？',
        set: { pt: mix(fade(0, 200), { x: { from: 560, to: 205, dur: 900, delay: 100, ease: 'inOut' }, y: { from: 260, to: 262, dur: 900, delay: 100, ease: 'inOut' } }), rule: pop(600) },
        fx: [{ type: 'ripple', x: 205, y: 262, r: 24, color: C.warn, at: 1000 }], hl: [4, 5, 6, 7], data: { '预测点': { v: '框内', at: 1000 } } },
      { say: '在框里，这一步记 1。讲义第 21 页的 ScreenSpot-Pro：本机算 (497, 143) 在框内记 1，(497, 166) 出框记 0。',
        set: join(on('p1', 0), { score: pop(300) }), fx: [st('p1', 0, C.info, 3), { type: 'burst', obj: 'score', color: C.ok, at: 600 }],
        log: seq(['>>> step_score(497, 143)', '1', '>>> step_score(497, 166)', '0'], 200), data: { '在框内': { v: '是', at: 300 }, '步得分': { v: 1, at: 600 } } },
      { say: '换成没点中：点落在框外，这一步就是 0。',
        set: { pt2: mix(fade(0, 200), { x: { from: 560, to: 290, dur: 900, delay: 100, ease: 'inOut' }, y: { from: 260, to: 335, dur: 900, delay: 100, ease: 'inOut' } }), score: { text: { to: '步得分 0', delay: 1000 }, fill: { to: C.badW, dur: 300, delay: 1000 }, stroke: { to: C.bad, dur: 300, delay: 1000 } } },
        fx: [{ type: 'shake', obj: 'score', at: 1100 }], data: { '在框内': { v: '否', at: 1000 }, '步得分': { v: 0, at: 1000 } } },
      { say: 'Mind2Web 也是静态的。给一串录好的截图，逐步比"下一个动作"和录下的是否一致（讲义第 22–23 页）。',
        set: { m2w: pop(0) }, hl: [9, 10, 11] },
      { say: '问题是假阴性。租车时先去改日期也完全合理。可它和录下的标准动作对不上，照样记 0。这是讲师 16:59 举的例子。',
        set: join({ alt: pop(0), altS: pop(500) }, on('pA', 300)), fx: [st('pA', 300, C.bad, 3), { type: 'shake', obj: 'altS', at: 900 }] },
      { say: '所以静态评测又快又便宜，可"每一步对"不等于"任务做完"。真正关心的是端到端。',
        fx: [{ type: 'pulse', obj: 'task', color: C.bad, at: 200 }] }
    ]
  };

  /* ---------------- 场景 2：程序化终态检查 ---------------- */
  var CODE2 = { lang: 'py', title: '讲义第 25 页 · 检查最终的应用状态', src:
'state = {"cart": [{"item": "blue_mug",\n' +
'                   "price": 18, "qty": 1}],\n' +
'         "orders": []}\n' +
'checks = {\n' +
'  "cart.item == blue_mug":\n' +
'      state["cart"][0]["item"] == "blue_mug",\n' +
'  "cart.price < 20":\n' +
'      state["cart"][0]["price"] < 20,\n' +
'  "orders.count == 0":\n' +
'      len(state["orders"]) == 0,\n' +
'}\n' +
'reward = float(all(checks.values()))\n' };
  var CK = ['cart.item == blue_mug', 'cart.price < 20', 'orders.count == 0'];
  var sc2 = {
    name: '终态检查', desc: '在模拟环境里能直接读后端状态。检查购物车和订单，三条全过才给奖励 1。不管中间怎么做的，只看最后的世界。',
    code: CODE2, dataTitle: '检查结果', data: { '通过的检查': 0, 'reward': 0 }, dataFmt: { 'reward': 'fixed1' },
    bg: function (d) { title(d, '端到端评测：智能体做完后，用程序检查最终的应用状态'); },
    objects: function () {
      var o = {};
      o.task = node(430, 72, 470, 40, TASK, '', 'bad');
      o.app = node(160, 270, 230, 170, '', '', 'neutral');
      o.appT = label(160, 205, 'studio.shop / cart（最终状态）', C.fg3, 'middle', 11.5);
      o.it = node(160, 260, 190, 56, '蓝杯子 · 在购物车', '$18 · 数量 1', 'data');
      o.od = node(160, 325, 190, 34, '订单：0', '', 'neutral');
      CK.forEach(function (c, i) {
        var y = 190 + i * 80;
        o['w' + i] = wire('M277,' + (i === 0 ? 255 : i === 1 ? 270 : 325) + ' L338,' + y, C.data);
        o['c' + i] = chip(460, y, 240, c, 'neutral', 12);
        o['v' + i] = wire('M582,' + y + ' L648,270', C.ok);
      });
      o.res = node(730, 270, 150, 70, 'PASS', 'reward = 1.0', 'ok');
      o.cav = label(430, 470, '可重复、精确，但只覆盖测试想到了的条件', C.bad, 'middle', 13);
      o.ex = label(430, 510, '这样评的基准：WebArena · OSWorld · AndroidWorld · WorkArena', C.fg3, 'middle', 12);
      return o;
    },
    steps: [
      { say: '智能体在模拟商店里做完了任务。评测时不看它点了什么，直接读后端的最终状态。',
        set: { task: pop(0), app: fade(200), appT: fade(300), it: pop(400), od: pop(550) }, hl: [1, 2, 3] },
      { say: '第一条：购物车里是蓝杯子吗？',
        set: join(on('w0', 0), { c0: mix(fade(100), recolor('ok', 800)) }), fx: [st('w0', 100, C.data, 3), mark(600, 190, true, 800)], hl: [5, 6], data: { '通过的检查': { v: 1, at: 800 } } },
      { say: '第二条：价格低于 20 美元吗？18 < 20。',
        set: join(on('w1', 0), { c1: mix(fade(100), recolor('ok', 800)) }), fx: [st('w1', 100, C.data, 3), mark(600, 270, true, 800)], hl: [7, 8], data: { '通过的检查': { v: 2, at: 800 } } },
      { say: '第三条：订单数是 0 吗？这条检查的是"不许下单"这个约束。',
        set: join(on('w2', 0), { c2: mix(fade(100), recolor('ok', 800)) }), fx: [st('w2', 100, C.data, 3), mark(600, 350, true, 800)], hl: [9, 10], data: { '通过的检查': { v: 3, at: 800 } } },
      { say: 'all(checks)：三条全过才给 1。本机跑出来 reward = 1.0。',
        set: join(on('v0', 0), on('v1', 100), on('v2', 200), { res: pop(700) }), fx: [st('v0', 100, C.ok, 3), st('v1', 200, C.ok, 3), st('v2', 300, C.ok, 3), { type: 'burst', obj: 'res', color: C.ok, at: 1000 }],
        hl: [12], log: seq(['  cart.item == blue_mug    True', '  cart.price < 20          True', '  orders.count == 0        True', 'reward = 1.0'], 300), data: { 'reward': { v: 1, at: 900 } } },
      { say: '测试够全面，这就是很好的奖励信号。可它只能查到测试想到的条件（讲义第 25 页）。',
        set: { cav: fade(0), ex: fade(500) }, fx: [{ type: 'pulse', obj: 'res', color: C.ok, at: 100 }] }
    ]
  };

  /* ---------------- 场景 3：验证器的漏洞 ---------------- */
  var CODE3 = { lang: 'py', title: '讲义第 27 页 · WebArena 第 476 题的验证器（简化）', src:
'def verifier(html, name="awesome_llm_reading"):\n' +
'    # 讲义：page.goto(GITLAB + "/byteblaze/"\n' +
'    #        + name); html = page.content()\n' +
'    return int(name in html.lower())\n' +
'\n' +
'empty  = "<h1>awesome_llm_reading</h1>"\n' +
'         "<p>...project is empty</p>"\n' +
'readme = "<h1>awesome_llm_reading</h1>"\n' +
'         "<p>README.md</p><p>1 Commit</p>"\n' +
'wrong  = "<h1>awesome-llm-reading</h1>..."\n' };
  var PG = [['空仓库', '…project is empty', 'ok'], ['带 README 的仓库', 'README.md · 1 Commit', 'warn'], ['名字用了连字符', 'awesome-llm-reading', 'bad']];
  var sc3 = {
    name: '验证器漏洞', desc: 'WebArena 的验证器是研究生手写的。这道题只查名字在不在目标页面上，不查仓库是不是空的。不该算对的也拿了 1 分。',
    code: CODE3, dataTitle: '三个页面的奖励', data: { '空仓库': '无', '带 README': '无', '名字写错': '无' },
    bg: function (d) { title(d, '程序化验证器只查它想到的：WebArena 第 476 题（简化）'); },
    objects: function () {
      var o = {};
      o.task = node(430, 72, 470, 40, '任务：建一个空仓库，名叫 awesome_llm_reading', '', 'bad');
      PG.forEach(function (p, i) {
        var y = 190 + i * 110;
        o['g' + i] = node(150, y, 220, 60, p[0], p[1], 'neutral', true);
        o['w' + i] = wire('M262,' + y + ' L368,' + (250 + (i - 1) * 30), C.data);
        o['r' + i] = node(740, y, 150, 46, '', '', p[2]);
        o['q' + i] = wire('M552,' + (250 + (i - 1) * 30) + ' L663,' + y, p[2] === 'bad' ? C.bad : C.ok);
      });
      o.ver = node(460, 250, 180, 90, '验证器', 'name in html.lower()', 'info', true);
      o.fp = label(740, 344, '假阳性：不是空仓库也过了', C.bad, 'middle', 12);
      o.note = label(430, 510, '讲义："只查目标网址上有没有这个名字，不查是不是空的"', C.fg3, 'middle', 12);
      return o;
    },
    steps: [
      { say: '任务：在模拟的 GitLab 里建一个空仓库 awesome_llm_reading。环境全在本地托管，不上真网。',
        set: { task: pop(0), ver: pop(400) }, hl: [1, 2, 3, 4] },
      { say: '验证器打开目标网址，取页面 HTML，只看仓库名在不在里面。',
        set: { g0: pop(0) }, hl: [4] },
      { say: '情况一：真的建了个空仓库。页面上有名字，奖励 1，正确。',
        set: join(on('w0', 0), on('q0', 700), { r0: mix(pop(1100), { text: { to: 'reward = 1', delay: 1100 } }) }), fx: [st('w0', 0, C.data, 3), st('q0', 700, C.ok, 3)],
        log: ['  空仓库（正确）                      reward = 1'], data: { '空仓库': { v: '1', at: 1100 } }, hl: [6, 7] },
      { say: '情况二：仓库里多了 README，有一次提交。它不是空的，可名字也在页面上，照样拿 1。',
        set: join({ g1: pop(0) }, on('w1', 300), on('q1', 1000), { r1: mix(pop(1400), { text: { to: 'reward = 1', delay: 1400 } }), fp: fade(1800) }), fx: [st('w1', 300, C.data, 3), st('q1', 1000, C.warn, 3), { type: 'shake', obj: 'r1', at: 1900 }],
        log: [{ s: '  带 README 的仓库（不该算对）           reward = 1', at: 1400 }], data: { '带 README': { v: '1', at: 1400 } }, hl: [8, 9] },
      { say: '情况三：名字写成了连字符。页面上找不到这个名字，奖励 0。',
        set: join({ g2: pop(0) }, on('w2', 300), on('q2', 1000), { r2: mix(pop(1400), { text: { to: 'reward = 0', delay: 1400 } }) }), fx: [st('w2', 300, C.data, 3), st('q2', 1000, C.bad, 3)],
        log: [{ s: '  名字用了连字符（错）                   reward = 0', at: 1400 }], data: { '名字写错': { v: '0', at: 1400 } }, hl: [10] },
      { say: '验证器查不到的地方，就会出假阳性或假阴性。智能体还可能学会"去满足验证器"，而不是真做事。这叫奖励黑客。',
        set: { note: fade(0) }, fx: [{ type: 'pulse', obj: 'ver', color: C.bad, at: 300 }] }
    ]
  };

  /* ---------------- 场景 4：只看结果 vs 也看过程 ---------------- */
  var CODE4 = { lang: 'py', title: '讲义第 39 页 · 结果检查 + 过程检查', src:
'trace = ["click(mug)", "click(add_to_cart)",\n' +
'         "click(place_order)"]\n' +
'cart = state["cart"][0]\n' +
'state_ok = (cart["item"] == "blue_mug"\n' +
'            and cart["price"] < 20)\n' +
'process_ok = "click(place_order)" not in trace\n' +
'\n' +
'outcome_only = "PASS" if state_ok else "FAIL"\n' +
'hybrid = ("PASS" if state_ok and process_ok\n' +
'          else "FAIL")\n' };
  var sc4 = {
    name: '结果加过程', desc: '第 3 步点了"下单"。购物车里东西是对的，可违反了"不许下单"。只看结果会判对，看过程才判错。有分歧时，由人工评审裁决。',
    code: CODE4, dataTitle: '判定', data: { '状态检查': '无', '过程检查': '无', '只看结果': '无', '结果 + 过程': '无' },
    bg: function (d) { title(d, '交付物看着对，过程却违规：只看结果会漏掉'); },
    objects: function () {
      var o = {};
      o.task = node(430, 72, 470, 40, TASK, '', 'bad');
      o.a0 = chip(200, 145, 150, 'click(mug)', 'warn'); o.a1 = chip(390, 145, 190, 'click(add_to_cart)', 'warn'); o.a2 = chip(610, 145, 190, 'click(place_order)', 'bad');
      o.l01 = wire('M277,145 L293,145', C.warn); o.l12 = wire('M487,145 L513,145', C.warn);
      o.sc = node(270, 260, 230, 60, '状态检查', '东西对：蓝杯子 · $18', 'neutral');
      o.pc = node(600, 260, 230, 60, '过程检查', '不许下单', 'neutral');
      o.ws = wire('M390,162 L300,228', C.data); o.wp = wire('M610,162 L600,228', C.bad);
      o.vo = node(270, 380, 230, 54, '只看结果：PASS', '漏掉了违规', 'warn');
      o.vh = node(600, 380, 230, 54, '结果 + 过程：FAIL', '交付物再像样也不行', 'bad');
      o.wv1 = wire('M270,292 L270,351', C.ok); o.wv2 = wire('M600,292 L600,351', C.bad);
      o.ra = chip(170, 490, 140, '评审 A：PASS', 'ok', 12, false); o.rb = chip(330, 490, 140, '评审 B：FAIL', 'bad', 12, false);
      o.adj = node(620, 490, 260, 46, '裁决：FAIL', '订单确认页显示了禁止的购买', 'bad');
      o.wr = wire('M402,490 L488,490', C.neutral);
      return o;
    },
    steps: [
      { say: '一条轨迹：点杯子 → 加入购物车 → 点了"下单"。',
        set: join({ task: pop(0), a0: pop(200), a1: pop(500), a2: pop(800) }, on('l01', 400), on('l12', 700)), fx: [{ type: 'shake', obj: 'a2', at: 1100 }], hl: [1, 2] },
      { say: '状态检查：购物车里确实是 18 美元的蓝杯子，通过。',
        set: join(on('ws', 0), { sc: mix(pop(300), recolor('ok', 900)) }), fx: [st('ws', 0, C.data, 3), mark(390, 240, true, 900)], hl: [3, 4, 5], data: { '状态检查': { v: '通过', at: 900 } } },
      { say: '过程检查：轨迹里有 place_order，违反了"不许下单"，不通过。',
        set: join(on('wp', 0), { pc: mix(pop(300), recolor('bad', 900)) }), fx: [st('wp', 0, C.bad, 3), mark(720, 240, false, 900)], hl: [6], data: { '过程检查': { v: '不通过', at: 900 } } },
      { say: '只看结果的评法会判 PASS。结果和过程都看，才判 FAIL。本机跑出来就是这两个结论。',
        set: join(on('wv1', 0), on('wv2', 200), { vo: pop(500), vh: pop(800) }), fx: [st('wv1', 0, C.ok, 3), st('wv2', 200, C.bad, 3), { type: 'shake', obj: 'vh', at: 1300 }],
        hl: [8, 9, 10], log: seq(['state check   (correct item): True', 'process check (no purchase) : False', 'outcome-only verdict: PASS | hybrid verdict: FAIL'], 400),
        data: { '只看结果': { v: 'PASS', at: 600 }, '结果 + 过程': { v: 'FAIL', at: 900 } } },
      { say: '说不清时请人：两位评审各自看证据，一个给 PASS、一个给 FAIL（讲义第 33 页）。',
        set: { ra: pop(0), rb: pop(300) } },
      { say: '按证据裁决：订单确认页显示了禁止的购买 → FAIL。人工评审是金标准，但太贵，只做一两次来校准自动评法。',
        set: join(on('wr', 0), { adj: pop(400) }), fx: [st('wr', 0, C.neutral, 3), { type: 'pulse', obj: 'adj', color: C.bad, at: 800 }] }
    ]
  };

  /* ---------------- 场景 5：LLM / VLM 评审 ---------------- */
  var sc5 = {
    name: 'LLM 评审', desc: '真网站上查不了后端状态。只能让另一个模型看截图和动作记录，按 rubric 判。评审要拿人工标签校准，而且真网站会变。',
    dataTitle: '和人的一致率（%，讲义）', data: { 'WebVoyager 评审': 0, 'WebJudge': 0 }, dataFmt: { 'WebVoyager 评审': 'fixed1', 'WebJudge': 'fixed1' },
    bg: function (d) { title(d, 'LLM / VLM 当评审：看证据、按 rubric、给判定'); },
    objects: function () {
      var o = {};
      o.ev = node(140, 170, 210, 80, '证据', '截图 + 动作记录', 'data');
      o.jd = node(430, 170, 220, 80, 'LLM / VLM 评审', 'rubric → 证据 → 判定', 'info');
      o.vd = node(720, 170, 190, 80, 'PASS', '"看到的购物车满足要求"', 'ok');
      o.p1 = wire('M247,170 L318,170', C.data); o.p2 = wire('M542,170 L623,170', C.ok);
      o.r0 = chip(430, 240, 200, '满足：有蓝杯子', 'info', 12, false); o.r1 = chip(430, 275, 200, '满足：价格低于 $20', 'info', 12, false); o.r2 = chip(430, 310, 200, '满足：没看到下单', 'info', 12, false);
      o.cal = label(430, 360, '灵活，但必须拿人工标签校准：评审也会被骗', C.bad, 'middle', 12.5);
      ['SeeAct', 'Browser Use', 'OpenAI Operator'].forEach(function (n, i) { o['n' + i] = label(110, 420 + i * 40, n, C.fg2, 'start', 12); });
      o.b0 = { type: 'box', x: 230, y: 420, w: 0, h: 14, rx: 3, anchor: 'l', fill: C.okW, stroke: C.ok, sw: 1, text: '', opacity: 0 };
      o.s1 = { type: 'box', x: 230, y: 452, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1, text: '', opacity: 0 };
      o.b1 = { type: 'box', x: 230, y: 468, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.okW, stroke: C.ok, sw: 1, text: '', opacity: 0 };
      o.s2 = { type: 'box', x: 230, y: 492, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1, text: '', opacity: 0 };
      o.b2 = { type: 'box', x: 230, y: 508, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.okW, stroke: C.ok, sw: 1, text: '', opacity: 0 };
      o.t0 = { type: 'text', x: 0, y: 420, text: '', num: 0, fmt: 'int', post: '%', size: 12, weight: 700, color: C.ok, anchor: 'start', opacity: 0 };
      o.ts1 = { type: 'text', x: 0, y: 452, text: '', num: 0, fmt: 'int', post: '%', size: 12, weight: 700, color: C.data, anchor: 'start', opacity: 0 };
      o.t1 = { type: 'text', x: 0, y: 468, text: '', num: 0, fmt: 'int', post: '%', size: 12, weight: 700, color: C.ok, anchor: 'start', opacity: 0 };
      o.ts2 = { type: 'text', x: 0, y: 492, text: '', num: 0, fmt: 'int', post: '%', size: 12, weight: 700, color: C.data, anchor: 'start', opacity: 0 };
      o.t2 = { type: 'text', x: 0, y: 508, text: '', num: 0, fmt: 'int', post: '%', size: 12, weight: 700, color: C.ok, anchor: 'start', opacity: 0 };
      o.lg = label(620, 400, '蓝：WebVoyager 上自报 · 绿：Online-Mind2Web 人工评', C.fg3, 'middle', 11.5);
      return o;
    },
    steps: [
      { say: '在真网站上跑，比如 WebVoyager 的 15 个真网站。这时查不了后端状态，只剩轨迹：截图和动作记录。',
        set: { ev: pop(0) } },
      { say: '把任务、最后几张截图和动作记录，交给另一个模型当评审。它先写一小段推理，再按 rubric 逐条判。',
        set: join(on('p1', 0), { jd: pop(300), r0: pop(700), r1: pop(850), r2: pop(1000) }), fx: [st('p1', 0, C.data, 4)] },
      { say: '判定是 PASS："看到的购物车满足要求"。好处是不用每题写验证器，更通用。',
        set: join(on('p2', 0), { vd: pop(300) }), fx: [st('p2', 0, C.ok, 3), { type: 'burst', obj: 'vd', color: C.ok, at: 600 }] },
      { say: '但评审也会被骗，要和人工标签比。WebVoyager 的评审和人约 85.3% 一致。Online-Mind2Web 的 WebJudge 约 85.7%（讲义第 30、32 页）。',
        set: { cal: fade(0) }, data: { 'WebVoyager 评审': { v: 85.3, at: 300 }, 'WebJudge': { v: 85.7, at: 600 } } },
      { say: '真网站还会变。同样的智能体，在 WebVoyager 上自报的成功率，到 Online-Mind2Web 人工评时大幅缩水（讲义第 32 页）。',
        set: { n0: fade(0), n1: fade(100), n2: fade(200), lg: fade(300),
          b0: { opacity: { to: 1, dur: 150, delay: 300 }, w: { to: 31 * 3.4, dur: 600, delay: 300 } }, t0: { opacity: { to: 1, dur: 150, delay: 300 }, x: { from: 236, to: 236 + 31 * 3.4, dur: 600, delay: 300 }, num: { to: 31, dur: 600, delay: 300 } },
          s1: { opacity: { to: 1, dur: 150, delay: 500 }, w: { to: 89 * 3.4, dur: 700, delay: 500 } }, ts1: { opacity: { to: 1, dur: 150, delay: 500 }, x: { from: 236, to: 236 + 89 * 3.4, dur: 700, delay: 500 }, num: { to: 89, dur: 700, delay: 500 } },
          b1: { opacity: { to: 1, dur: 150, delay: 900 }, w: { to: 30 * 3.4, dur: 600, delay: 900 } }, t1: { opacity: { to: 1, dur: 150, delay: 900 }, x: { from: 236, to: 236 + 30 * 3.4, dur: 600, delay: 900 }, num: { to: 30, dur: 600, delay: 900 } },
          s2: { opacity: { to: 1, dur: 150, delay: 1300 }, w: { to: 87 * 3.4, dur: 700, delay: 1300 } }, ts2: { opacity: { to: 1, dur: 150, delay: 1300 }, x: { from: 236, to: 236 + 87 * 3.4, dur: 700, delay: 1300 }, num: { to: 87, dur: 700, delay: 1300 } },
          b2: { opacity: { to: 1, dur: 150, delay: 1700 }, w: { to: 61 * 3.4, dur: 600, delay: 1700 } }, t2: { opacity: { to: 1, dur: 150, delay: 1700 }, x: { from: 236, to: 236 + 61 * 3.4, dur: 600, delay: 1700 }, num: { to: 61, dur: 600, delay: 1700 } } },
        fx: [{ type: 'float', x: 620, y: 460, text: '−59', size: 15, color: C.bad, at: 1500 }, { type: 'float', x: 620, y: 500, text: '−26', size: 15, color: C.bad, at: 2300 }] },
      { say: 'Browser Use 从 89% 掉到 30%。真网站上的基准会漂移。评审本身的质量，也成了分数的一部分。',
        fx: [{ type: 'pulse', obj: 'jd', color: C.bad, at: 200 }] }
    ]
  };

  /* ---------------- 场景 6：长任务的 rubric ---------------- */
  var RB = ['R1 比较 PIT–LAX 航班', 'R2 比较 PIT–PSP 航班', 'R3 查 9–16 点的开车窗口', 'R4 推荐 LAX 还是 PSP', 'R5 打开有价格的租车选项', 'R6 评估两个餐厅绕路', 'R7 建可编辑的每日行程', 'R8 总结整个行程'];
  var OK6 = [1, 1, 1, 1, 1, 0, 1, 1];
  var EQ = VZ.eq('z', [{ slot: 1, w: 40 }, '/', { slot: 1, w: 40 }, '=', { num: 0, fmt: 'fixed3', k: 'ok', w: 76 }], 640, 330, { size: 16 });
  var CODE6 = { lang: 'py', title: '讲义第 41 页 · Odysseys 的两种分', src:
'# 8 条 rubric，R6 没满足\n' +
'rubric = [1, 1, 1, 1, 1, 0, 1, 1]\n' +
'avg = sum(rubric) / len(rubric)\n' +
'perfect = float(all(rubric))\n' +
'print(avg, perfect)\n' };
  var sc6 = {
    name: '长任务打分', desc: '要人做几小时的任务，只给一个"全对才 1"的分太稀疏。按 rubric 逐条打分，能看到做到了哪一步。',
    code: CODE6, dataTitle: 'Odysseys 这一题', data: { '满足的条目': 0, '平均分': 0, '完美完成': 0 }, dataFmt: { '平均分': 'fixed3', '完美完成': 'fixed1' },
    bg: function (d) { title(d, '长任务：按 rubric 逐条打分（Odysseys：去 Palm Springs 参加婚礼）'); },
    objects: function () {
      var o = {};
      RB.forEach(function (r, i) { o['r' + i] = { type: 'box', x: 70, y: 100 + i * 48, w: 320, h: 34, rx: 6, anchor: 'l', fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: r, size: 12.5, weight: 650, opacity: 0 }; });
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      o.f1 = chip(0, 0, 40, '7', 'ok', 14); o.f2 = chip(0, 0, 40, '8', 'neutral', 14);
      o.pf = node(640, 420, 260, 50, '完美完成 = 0.0', '只要有一条没做到', 'bad');
      o.hdr = label(640, 270, '平均分', C.fg2, 'middle', 13);
      return o;
    },
    steps: [
      { say: '一道长任务：规划去 Palm Springs 参加婚礼的行程。要查航班、开车时间窗、酒店、租车，再写行程（讲义第 40–41 页）。',
        set: (function () { var s = {}; RB.forEach(function (r, i) { s['r' + i] = fade(i * 120); }); return s; })(), hl: [1, 2] },
      { say: '评审逐条核对 8 条 rubric：前 5 条都做到了。',
        set: (function () { var s = {}; for (var i = 0; i < 5; i++) s['r' + i] = recolor('ok', i * 250); return s; })(),
        fx: [0, 1, 2, 3, 4].map(function (i) { return mark(410, 100 + i * 48, true, i * 250 + 200); }), data: { '满足的条目': { v: 5, at: 1200 } } },
      { say: 'R6"评估两个餐厅绕路"没做到。R7、R8 做到了。',
        set: { r5: recolor('bad', 0), r6: recolor('ok', 400), r7: recolor('ok', 650) },
        fx: [mark(410, 340, false, 200), mark(410, 388, true, 600), mark(410, 436, true, 850)], data: { '满足的条目': { v: 7, at: 900 } } },
      { say: '平均分：满足的条数 7 和总条数 8 飞进式子。',
        set: join(VZ.show(EQ, 0, 70), { hdr: fade(0), z0: { text: { to: '7', delay: 1300 } }, z2: { text: { to: '8', delay: 1600 } },
          f1: { opacity: { from: 1, to: 0, dur: 150, delay: 1300 }, x: { from: 400, to: EQ.xs[0], dur: 800, delay: 500, ease: 'inOut' }, y: { from: 250, to: 330, dur: 800, delay: 500, ease: 'inOut' } },
          f2: { opacity: { from: 1, to: 0, dur: 150, delay: 1600 }, x: { from: 400, to: EQ.xs[2], dur: 800, delay: 800, ease: 'inOut' }, y: { from: 470, to: 330, dur: 800, delay: 800, ease: 'inOut' } } }),
        fx: [{ type: 'ripple', x: EQ.xs[0], y: 330, color: C.ok, at: 1300 }, { type: 'ripple', x: EQ.xs[2], y: 330, color: C.neutral, at: 1600 }] },
      { say: '7 / 8 = 0.875：做了大部分，分数也看得出来。',
        set: { z4: { num: { to: 0.875, dur: 700, delay: 200 } } },
        fx: [{ type: 'burst', obj: 'z4', color: C.ok, at: 900 }], hl: [3], log: seq(['>>> print(avg, perfect)', '0.875 0.0'], 300), data: { '平均分': { v: 0.875, at: 400 } } },
      { say: '可"全对才算"的完美完成是 0.0。长任务里很多模型最终分都是 0。所以需要这种中间的、细粒度的分。',
        set: { pf: pop(0) }, fx: [{ type: 'shake', obj: 'pf', at: 400 }], hl: [4], data: { '完美完成': { v: 0, at: 300 } } }
    ]
  };

  VZ.register({
    id: 'c4-cuaeval', title: '电脑操作智能体怎么评测：单步、终态、验证器漏洞、过程、LLM 评审、长任务 rubric',
    sources: [{ t: '第 7 讲 12:43–17:44（什么算成功、静态评测）', u: YT + '763' }, { t: '第 7 讲 17:44–22:37（终态检查、WebArena）', u: YT + '1064' },
      { t: '第 7 讲 22:37–29:34（LLM 评审、真网站、人工评审）', u: YT + '1357' }, { t: '第 7 讲 33:43–37:59（长任务与 rubric）', u: YT + '2023' },
      { t: '讲义 lecture-07 第 17–41 页', u: L7 }],
    note: '任务、目标框、检查条件、验证器都照讲义第 19–41 页。rubric 条目和一致率、成功率数字也是。85.3%、85.7%、89% → 30% 等是讲义上的数。Mind2Web 的"先改日期也合理"是讲师 16:59 的例子。控制台是本机实跑的输出。场景 2–4 的购物车状态和场景 3 的三个 HTML 页面是示意数据。场景 3 的验证器是讲义第 27 页那段的简化版。它不打开网页，直接传入 HTML 字符串。场景 5 没有代码，也没有实跑。',
    scenes: [sc1, sc2, sc3, sc4, sc5, sc6]
  });
})();

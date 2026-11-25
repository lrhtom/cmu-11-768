/* 04 · 第 7 讲 —— 电脑操作智能体（CUA）怎么一圈圈地"看截图 → 想 → 出动作 → 执行"，上下文怎么变长，各家动作格式，以及怎么训练
 * 场景 1 照讲义 lecture-07 第 3–8 页"买一个蓝杯子"的四步（模型的话和动作 JSON 照幻灯片原文翻成中文 / 原样保留）；网页是按幻灯片重画的示意。
 * 场景 2 照讲义第 47–56 页：π_θ(a_t | goal, o_≤t, a_<t)，以及"文本 → 分词器 + 嵌入、截图 → 视觉编码器 + 投影层"。
 * 场景 3 的六种格式照讲义第 57 页的表（2026 年 9 月的情况）；最后的坐标换算是示意（用讲义第 21 页 ScreenSpot-Pro 例子的 2560×1440 和目标框），由 本机验算脚本 第 2a 段算出。
 * 场景 4 照讲义第 59–69 页的三个训练阶段和 CUA-Gym；数字都是讲义上的。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L7 = 'https://www.cmu-agents.com/slides/lecture-07-computer-use-agents.pdf', YT = 'https://youtu.be/jwGluLrrqjQ?t=';
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function akey(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'neutral'; }
  function wire(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: akey(col), opacity: 0 }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 300, delay: d0 || 0 }, flow: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function node(x, y, w, h, t, sub, k, op, mono) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.7, text: t, sub: sub, subMono: !!mono, subSize: 11.5, size: 13.5, weight: 700, opacity: op == null ? 0 : op };
  }
  function chip(x, y, w, t, k, size, mono) { return { type: 'box', x: x, y: y, w: w, h: 28, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: mono !== false, opacity: 0 }; }
  function rider(path, w, k) { return { type: 'box', along: path, t: 0, w: w, h: 26, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: '', size: 11, weight: 650, mono: true, opacity: 0, trail: { n: 4, gap: 40 } }; }
  function ride(dur, delay, text) {
    var o = { t: { from: 0, to: 1, dur: dur, delay: delay || 0, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 250, delay: (delay || 0) + dur + 120 } };
    if (text != null) o.text = { to: text, delay: 0 };
    return o;
  }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  function recolor(k, delay) { return { fill: { to: PAL[k][0], dur: 400, delay: delay || 0 }, stroke: { to: PAL[k][1], dur: 400, delay: delay || 0 } }; }
  function hide(names, delay) { var s = {}; names.forEach(function (n) { s[n] = fade(delay || 0, 300, 0); }); return s; }
  function show(names, delay, gap) { var s = {}; names.forEach(function (n, i) { s[n] = fade((delay || 0) + i * (gap || 80), 350); }); return s; }

  /* ---------------- 场景 1：观察 → 推理 → 行动 ---------------- */
  var SX = 165, SY = 300;   // 屏幕中心
  var sc1 = {
    name: '看、想、做', desc: '"买一个蓝杯子"：每一轮截图进模型。模型写一句想法和一个动作 JSON。外壳校验后执行，屏幕变了再截一张。',
    dataTitle: '这一轮', data: { '轮次': 0, '动作': '无', '奖励': '无' },
    bg: function (d) {
      title(d, '电脑操作智能体：观察（截图）→ 推理 + 动作 → 校验并执行，循环');
      d.text(SX, 132, '环境观察（截图）', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      o.pTask = wire('M470,96 L470,218', C.data);
      o.pScr = wire('M302,250 L378,250', C.data);
      o.pAct = wire('M562,250 L638,250', C.warn);
      o.pExe = wire('M730,286 L730,470 L165,470 L165,452', C.warn);
      o.task = node(470, 72, 220, 44, '任务："买一个蓝杯子"', '', 'bad');
      o.win = { type: 'box', x: SX, y: SY, w: 270, h: 300, rx: 10, fill: C.bg2, stroke: C.neutral, sw: 1.5, text: '', opacity: 0 };
      o.bar = { type: 'box', x: SX, y: 162, w: 270, h: 24, rx: 6, fill: C.neutralW, stroke: C.neutral, sw: 1, text: 'studio.shop / mugs', size: 11, mono: true, color: C.fg3, opacity: 0 };
      // 第 1 页：三个杯子
      o.m1 = { type: 'box', x: 85, y: 250, w: 70, h: 90, rx: 8, fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: '奶白杯', sub: '$16', subMono: false, size: 12, weight: 700, opacity: 0 };
      o.m2 = { type: 'box', x: 165, y: 250, w: 70, h: 90, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.6, text: '蓝杯子', sub: '$18', subMono: false, size: 12, weight: 700, opacity: 0 };
      o.m3 = { type: 'box', x: 245, y: 250, w: 70, h: 90, rx: 8, fill: C.dataW, stroke: C.neutral, sw: 1.2, text: '蓝杯套装', sub: '$28', subMono: false, size: 12, weight: 700, opacity: 0 };
      // 第 2 页：商品页
      o.big = { type: 'box', x: 110, y: 250, w: 100, h: 110, rx: 10, fill: C.dataW, stroke: C.data, sw: 1.6, text: '蓝杯子', size: 13, weight: 700, opacity: 0 };
      o.price = label(235, 222, '$18 · 数量 1', C.fg2, 'middle', 12.5);
      o.add = { type: 'box', x: 235, y: 262, w: 96, h: 28, rx: 6, fill: C.badW, stroke: C.bad, sw: 1.3, text: '加入购物车', size: 11.5, weight: 700, opacity: 0 };
      // 第 3 页：配送估算
      o.dl = label(SX, 330, '配送估算 · 邮编', C.fg2, 'middle', 12.5);
      o.zip = { type: 'box', x: SX, y: 370, w: 200, h: 32, rx: 6, fill: C.bg, stroke: C.neutral, sw: 1.4, text: '', size: 13, mono: true, weight: 700, opacity: 0 };
      o.cur = { type: 'circle', x: 300, y: 420, r: 7, fill: C.warn, stroke: C.bg2, opacity: 0 };
      o.llm = node(470, 250, 180, 60, 'CUA 模型', '推理 + 动作', 'info');
      o.think = node(470, 360, 300, 64, '', '', 'info', 0, true);
      o.infra = node(730, 250, 170, 70, '外壳 / 基础设施', '校验动作 → 执行', 'neutral');
      o.o1 = rider('pScr', 76, 'data'); o.o2 = rider('pScr', 76, 'data'); o.o3 = rider('pScr', 76, 'data'); o.o4 = rider('pScr', 76, 'data');
      o.a1 = rider('pAct', 76, 'warn'); o.a2 = rider('pAct', 76, 'warn'); o.a3 = rider('pAct', 76, 'warn'); o.a4 = rider('pAct', 76, 'warn');
      o.e1 = rider('pExe', 80, 'warn'); o.e2 = rider('pExe', 80, 'warn'); o.e3 = rider('pExe', 80, 'warn'); o.e4 = rider('pExe', 80, 'warn');
      o.s1 = chip(375, 520, 130, '点蓝杯子', 'warn', 12, false); o.s2 = chip(515, 520, 110, '往下滚', 'warn', 12, false); o.s3 = chip(635, 520, 110, '输入 15213', 'warn', 12, false);
      o.rw = node(770, 520, 120, 36, '奖励 1.0', '', 'ok');
      return o;
    },
    steps: [
      { say: '任务进来："买一个蓝杯子"。环境给出第一张截图：商品列表。',
        set: join({ task: pop(0), win: fade(200), bar: fade(250), m1: pop(400), m2: pop(480), m3: pop(560), llm: pop(500), infra: pop(650) }, on('pTask', 300), on('pScr', 800), on('pAct', 900), on('pExe', 1000), { o1: ride(700, 900, 'o₀') }),
        fx: [st('pTask', 400, C.data, 3), { type: 'ripple', obj: 'llm', color: C.data, at: 1600 }], data: { '轮次': 1 } },
      { say: '模型写一句想法和一个动作："我看到中间有个蓝杯子，点它。"{"mouse": {"left_click": [33, 201]}}',
        set: { think: mix(pop(0), { text: { to: '"看到中间有个蓝杯子，点它"', delay: 0 }, sub: { to: '{"mouse":{"left_click":[33,201]}}', delay: 0 } }), a1: ride(700, 700, 'click') },
        data: { '动作': { v: 'left_click', at: 700 } } },
      { say: '外壳先校验格式对不对、坐标在不在屏幕内，再真的去点。鼠标落在蓝杯子上，页面跳到商品页。',
        set: join({ e1: ride(1300, 0, '执行'), cur: mix(fade(1100), { x: { from: 300, to: 165, dur: 600, delay: 1200 }, y: { from: 420, to: 255, dur: 600, delay: 1200 } }) },
          hide(['m1', 'm2', 'm3'], 2000), show(['big', 'price', 'add'], 2200)),
        fx: [{ type: 'pulse', obj: 'infra', color: C.ok, at: 100 }, { type: 'ripple', x: 165, y: 255, r: 26, color: C.warn, at: 1850 }] },
      { say: '新截图进来。模型说："配送信息在下面，往下滚。"{"scroll": {"dy": 520}}',
        set: { o2: ride(700, 0, 'o₁'), think: { text: { to: '"配送信息在下面，往下滚"', delay: 700 }, sub: { to: '{"scroll":{"dy":520}}', delay: 700 } }, a2: ride(700, 1000, 'scroll') },
        data: { '轮次': { v: 2, at: 300 }, '动作': { v: 'scroll', at: 1000 } } },
      { say: '执行滚动：商品区往上移走，下面的"配送估算"露出来。',
        set: join({ e2: ride(1300, 0, '执行'), big: { y: { to: 190, dur: 600, delay: 1300 }, opacity: { to: 0, dur: 500, delay: 1400 } }, price: { y: { to: 170, dur: 600, delay: 1300 }, opacity: { to: 0, dur: 500, delay: 1400 } }, add: { y: { to: 200, dur: 600, delay: 1300 }, opacity: { to: 0, dur: 500, delay: 1400 } } },
          { dl: mix(fade(1500), { y: { from: 420, to: 250, dur: 700, delay: 1400 } }), zip: mix(fade(1500), { y: { from: 460, to: 290, dur: 700, delay: 1400 } }) }) },
      { say: '再截一张。模型说："看到邮编输入框，点它准备输入。"{"mouse": {"left_click": [65, 53]}}，执行后输入框获得焦点。',
        set: { o3: ride(700, 0, 'o₂'), think: { text: { to: '"看到邮编框，点它准备输入"', delay: 700 }, sub: { to: '{"mouse":{"left_click":[65,53]}}', delay: 700 } }, a3: ride(700, 1000, 'click'), e3: ride(1300, 1800, '执行'), cur: { x: { to: 120, dur: 500, delay: 3000 }, y: { to: 292, dur: 500, delay: 3000 } }, zip: { stroke: { to: C.data, dur: 300, delay: 3400 } } },
        fx: [{ type: 'ripple', x: 120, y: 292, r: 22, color: C.warn, at: 3450 }], data: { '轮次': { v: 3, at: 300 }, '动作': { v: 'left_click', at: 1000 } } },
      { say: '模型说："输入邮编查配送选项。"{"type_text": "15213"}。外壳把这串字敲进输入框。',
        set: { o4: ride(700, 0, 'o₃'), think: { text: { to: '"输入邮编查配送选项"', delay: 700 }, sub: { to: '{"type_text":"15213"}', delay: 700 } }, a4: ride(700, 1000, 'type'), e4: ride(1300, 1800, '执行'), zip: { text: { to: '15213', delay: 3200 } } },
        fx: [{ type: 'pulse', obj: 'zip', color: C.warn, at: 3200 }], data: { '轮次': { v: 4, at: 300 }, '动作': { v: 'type_text', at: 1000 } } },
      { say: '循环一直转到任务完成，最后才算一个奖励：任务成功，奖励 1.0（讲义第 8 页）。',
        set: { s1: pop(0), s2: pop(200), s3: pop(400), rw: pop(800) }, fx: [{ type: 'burst', obj: 'rw', color: C.ok, at: 1100 }], data: { '奖励': { v: '1.0', at: 900 } } }
    ]
  };

  /* ---------------- 场景 2：上下文怎么变长 ---------------- */
  var CX = [70, 160, 250, 340, 430, 520, 610];
  var TOK = VZ.chips('k', [{ t: 'Buy', w: 46 }, { t: 'a', w: 30 }, { t: '…', w: 30 }, { t: 'v₀,₁', w: 44 }, { t: '…', w: 30 }, { t: 'v₀,N', w: 46 }, { t: 'click', w: 50 }, { t: '(', w: 26 }, { t: '…', w: 30 }, { t: 'v₁,₁', w: 44 }, { t: '…', w: 30 }, { t: 'v₁,N', w: 46 }, { t: '…', w: 30 }], 430, 470, { size: 12, gap: 6, h: 28 });
  var sc2 = {
    name: '上下文变长', desc: '每一步，模型看到"目标 + 之前所有截图和动作"，输出下一个动作。动作和新截图再接到上下文后面。里面其实都是 token。',
    bg: function (d) { title(d, '一个 VLM 从视觉历史里预测动作：π_θ(a_t | goal, o≤t, a<t)'); d.text(40, 96, '上下文', { size: 12.5, weight: 700, color: C.fg3 }); },
    objects: function () {
      var o = {};
      o.g = chip(CX[0] + 20, 130, 82, '目标', 'data', 12.5, false);
      o.c0 = chip(CX[1] + 20, 130, 82, '截图 0', 'neutral', 12.5, false);
      o.c1 = chip(CX[2] + 20, 130, 82, '动作 0', 'warn', 12.5, false);
      o.c2 = chip(CX[3] + 20, 130, 82, '截图 1', 'neutral', 12.5, false);
      o.c3 = chip(CX[4] + 20, 130, 82, '动作 1', 'warn', 12.5, false);
      o.c4 = chip(CX[5] + 20, 130, 82, '…', 'neutral', 12.5, false);
      o.c5 = chip(CX[6] + 20, 130, 82, '截图 t', 'neutral', 12.5, false);
      o.pIn = wire('M430,148 L430,226', C.data);
      o.pi = node(430, 260, 330, 60, 'π_θ(a₀ | goal, o₀)', '策略（视觉语言模型）', 'info');
      o.pOut = wire('M430,292 L430,346', C.warn);
      o.act = node(430, 370, 200, 40, 'click(x₀, y₀)', '', 'warn', 0, true);
      o.act.mono = true;
      o.pBack = wire('M532,370 L720,370 L720,148', C.warn);
      o.fly = { type: 'box', x: 430, y: 370, w: 82, h: 28, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.3, text: '动作 0', size: 12.5, weight: 650, opacity: 0, trail: { n: 4, gap: 40 } };
      for (var k in TOK.objs) o[k] = TOK.objs[k];
      o.kG = label(TOK.xs[1], 506, '目标 token', C.data, 'middle', 11.5);
      o.kV = label(TOK.xs[4], 506, '视觉 token（截图 0）', C.fg3, 'middle', 11.5);
      o.kA = label(TOK.xs[7], 506, '动作 token', C.warn, 'middle', 11.5);
      o.kV2 = label(TOK.xs[10], 506, '视觉 token（截图 1）', C.fg3, 'middle', 11.5);
      o.enc1 = label(250, 432, '文字 → 分词器 + 嵌入', C.data, 'middle', 12);
      o.enc2 = label(610, 432, '截图 → 视觉编码器 + 投影层', C.fg2, 'middle', 12);
      return o;
    },
    steps: [
      { say: '第 0 步，上下文只有两样。一是目标"买一个 20 美元以下的蓝杯子"，二是第一张截图。',
        set: join({ g: pop(0), c0: pop(200), pi: pop(500) }, on('pIn', 400)), fx: [st('pIn', 500, C.data, 4)] },
      { say: '策略按 π_θ(a₀ | goal, o₀) 生成动作 0：click(x₀, y₀)。',
        set: join(on('pOut', 0), { act: pop(300) }), fx: [st('pOut', 100, C.warn, 3)] },
      { say: '动作 0 接到轨迹后面，执行后得到截图 1。上下文变长了。',
        set: join(on('pBack', 0), { fly: { opacity: { from: 1, to: 0, dur: 200, delay: 1500 }, x: { from: 430, to: CX[2] + 20, dur: 1200, delay: 200, ease: 'inOut' }, y: { from: 370, to: 130, dur: 1200, delay: 200, ease: 'inOut' } }, c1: fade(1500), c2: pop(1900) }),
        fx: [st('pBack', 100, C.warn, 4)] },
      { say: '第 1 步：π_θ(a₁ | goal, o₀, a₀, o₁)，输出 click(x₁, y₁)。',
        set: { pi: { text: { to: 'π_θ(a₁ | goal, o₀, a₀, o₁)', delay: 300 } }, act: { text: { to: 'click(x₁, y₁)', delay: 900 } } },
        fx: [st('pIn', 0, C.data, 5), { type: 'pulse', obj: 'pi', color: C.info, at: 300 }, st('pOut', 800, C.warn, 3)] },
      { say: '一般地，第 t 步：π_θ(a_t | goal, o_≤t, a_<t)。动作可以是点击、输入、调用工具或停止。',
        set: { c3: pop(0), c4: pop(200), c5: pop(400), pi: { text: { to: 'π_θ(a_t | goal, o≤t, a<t)', delay: 600 } }, act: { text: { to: 'click / type / tool / stop', delay: 1100 }, w: { to: 230, dur: 400, delay: 1000 } } },
        fx: [st('pIn', 500, C.data, 6), st('pOut', 1000, C.warn, 3)] },
      { say: '交错的"截图 + 动作"历史让策略知道自己做到哪儿了。模型内部看到的是一串 token：',
        set: VZ.show(TOK, 0, 60), fx: [{ type: 'pulse', obj: 'pi', color: C.info, at: 900 }] },
      { say: '文字走分词器和嵌入。截图走视觉编码器和投影层，变成一段视觉 token。它们是连续向量，不是词表里的编号。',
        set: { kG: fade(0), kV: fade(200), kA: fade(400), kV2: fade(600), enc1: fade(800), enc2: fade(1000) } },
      { say: '因果 Transformer 读完这串 token，逐个写出动作 t 的 token："click ( x_t , y_t )"。截图越多、推理越长，上下文越贵（讲义第 77 页）。',
        fx: [{ type: 'pulse', obj: 'act', color: C.warn, at: 200 }, { type: 'flash', obj: 'pi', color: C.info, at: 0 }] }
    ]
  };

  /* ---------------- 场景 3：各家动作格式 + 坐标换算 ---------------- */
  var FM = [['GPT-6 Astra', 'pyautogui.click(x, y)'], ['Fable / Opus 5', 'tool_use: left_click {coordinate:[x,y]}'], ['Gemini 3.8 Flash', 'functionCall: click {x, y} ∈ 0–999'],
    ['Qwen 3.8', '<tool_call><function=…>'], ['Muse Spark', '脚本 + 直接 GUI 动作（可成批）'], ['Kimi K3', 'tool_calls[].function + JSON']];
  var EQ = VZ.eq('q', ['x =', { slot: 1, w: 56 }, '/ 1000 ×', { slot: 1, w: 62 }, '=', { num: 0, fmt: 'int', k: 'ok', w: 62 }], 430, 470, { size: 15 });
  var sc3 = {
    name: '动作格式', desc: '同一个"点蓝杯子"，各家模型写出来的格式和坐标系都不一样（讲义第 57 页）。外壳得把它换算成屏幕上真实的像素再点。',
    dataTitle: '坐标换算（示意）', data: { '归一化 x': '无', '归一化 y': '无', '像素 x': 0, '像素 y': 0, '在目标框内': '无' },
    bg: function (d) { title(d, '观察差不多，动作各写各的：同一次点击的六种写法'); },
    objects: function () {
      var o = {};
      o.intent = node(130, 230, 170, 60, '"点蓝杯子"', '模型的意图', 'info');
      FM.forEach(function (f, i) {
        var y = 80 + i * 52;
        o['w' + i] = wire('M217,230 C260,230 260,' + y + ' 300,' + y, C.warn);
        o['n' + i] = { type: 'text', x: 312, y: y - 13, text: f[0], size: 12, weight: 700, color: C.fg2, anchor: 'start', opacity: 0 };
        o['f' + i] = { type: 'box', x: 312 + 175, y: y + 10, w: 350, h: 24, rx: 5, fill: C.warnW, stroke: C.warn, sw: 1.1, text: f[1], size: 11, weight: 600, mono: true, opacity: 0, anchor: 'l' };
        o['f' + i].x = 312;
      });
      o.bad = label(480, 405, '输出格式和 schema 各不相同，复现结果是一场噩梦', C.bad, 'middle', 13);
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      o.eqT = label(430, 438, '示意：0–1000 的归一化坐标 → 2560×1440 屏幕的像素（尺寸取自讲义第 21 页）', C.fg3, 'middle', 11.5);
      o.fx1 = chip(0, 0, 56, '194', 'info', 13); o.fx2 = chip(0, 0, 62, '2560', 'neutral', 13);
      o.scr = node(130, 470, 150, 40, '屏幕 2560×1440', '', 'neutral');
      o.verdict = node(430, 520, 330, 34, '', '', 'ok');
      return o;
    },
    steps: [
      { say: '模型想做的事只有一件：点那个蓝杯子。', set: { intent: pop(0) } },
      { say: '可每家写法不同。有的写 Python（pyautogui），有的用原生的 computer 工具调用。坐标 [x, y] 是像素。',
        set: join(on('w0', 0), on('w1', 200), { n0: fade(300), f0: fade(400), n1: fade(500), f1: fade(600) }), fx: [st('w0', 100, C.warn, 3), st('w1', 300, C.warn, 3)] },
      { say: '有的用函数调用，坐标归一化到 0–999。有的按应用自己定义的 GUI schema，用 XML 风格或 JSON 参数。',
        set: join(on('w2', 0), on('w3', 200), on('w5', 400), { n2: fade(300), f2: fade(400), n3: fade(500), f3: fade(600), n5: fade(700), f5: fade(800) }), fx: [st('w2', 100, C.warn, 3), st('w3', 300, C.warn, 3), st('w5', 500, C.warn, 3)] },
      { say: '还有的直接写脚本、一次发一批 GUI 动作。讲义的结论：格式和 schema 各家不同，复现是噩梦。',
        set: join(on('w4', 0), { n4: fade(200), f4: fade(300), bad: fade(900) }), fx: [st('w4', 100, C.warn, 3), { type: 'shake', obj: 'bad', at: 1200 }] },
      { say: '外壳要把它换回屏幕像素。讲师说坐标通常归一化到 0–1000。示意：模型说 x = 194，屏幕宽 2560。',
        set: mix(VZ.show(EQ, 0, 70), { eqT: fade(300), scr: pop(400) }), data: { '归一化 x': '194', '归一化 y': '99' } },
      { say: '194 和 2560 飞进式子：194 / 1000 × 2560 = 496.64，取整得 497。',
        set: { fx1: { opacity: { from: 1, to: 0, dur: 150, delay: 900 }, x: { from: 487, to: EQ.xs[1], dur: 800, delay: 100, ease: 'inOut' }, y: { from: 184, to: 470, dur: 800, delay: 100, ease: 'inOut' } },
          fx2: { opacity: { from: 1, to: 0, dur: 150, delay: 1300 }, x: { from: 130, to: EQ.xs[3], dur: 800, delay: 500, ease: 'inOut' }, y: { from: 470, to: 470, dur: 800, delay: 500, ease: 'inOut' } },
          q1: { text: { to: '194', delay: 900 } }, q3: { text: { to: '2560', delay: 1300 } }, q5: { num: { to: 497, dur: 700, delay: 1500 } } },
        fx: [{ type: 'ripple', x: EQ.xs[1], y: 470, color: C.info, at: 900 }, { type: 'ripple', x: EQ.xs[3], y: 470, color: C.neutral, at: 1300 }, { type: 'burst', obj: 'q5', color: C.ok, at: 2200 }],
        data: { '像素 x': { v: 497, at: 1600 }, '像素 y': { v: 143, at: 1800 } } },
      { say: 'y 同理：99 / 1000 × 1440 ≈ 143。(497, 143) 落在目标框 (417,132)–(576,152) 里，这一步算对。',
        set: { verdict: mix(pop(0), { text: { to: '(497, 143) ∈ 目标框 → 步得分 1', delay: 0 } }) }, data: { '在目标框内': { v: '是', at: 300 } } },
      { say: '可框只有 159×20 像素，占全屏 0.086%。归一化 y 差到 115，就落到 166 像素，出框了。高分辨率专业界面的定位本身就难。',
        set: { verdict: { text: { to: '(497, 166) 出框 → 步得分 0', delay: 200 }, fill: { to: C.badW, dur: 300, delay: 200 }, stroke: { to: C.bad, dur: 300, delay: 200 } } },
        fx: [{ type: 'shake', obj: 'verdict', at: 500 }], data: { '归一化 y': '115', '像素 y': { v: 166, at: 200 }, '在目标框内': { v: '否', at: 300 } } }
    ]
  };

  /* ---------------- 场景 4：三个训练阶段 ---------------- */
  var sc4 = {
    name: '三段训练', desc: '预训练学"屏幕上有什么、怎么指到它"。SFT 模仿人和教师模型的轨迹。RL 在能重置的模拟应用里按结果打分。',
    dataTitle: '讲义上的数据量', data: { 'Mind2Web 任务': 0, 'AgentNet 轨迹': 0, 'MolmoWebMix 轨迹': 0, 'CUA-Gym 可验证任务': 0, 'OSWorld（%）': 0 },
    dataFmt: { 'Mind2Web 任务': 'comma', 'AgentNet 轨迹': 'comma', 'MolmoWebMix 轨迹': 'comma', 'CUA-Gym 可验证任务': 'comma', 'OSWorld（%）': 'fixed1' },
    bg: function (d) { title(d, '训练电脑操作智能体：预训练 → SFT → RL'); },
    objects: function () {
      var o = {};
      o.gP = { type: 'box', x: 150, y: 250, w: 230, h: 300, rx: 14, fill: C.bg, stroke: C.data, sw: 1.3, dasharray: '6 4', text: '', opacity: 0 };
      o.gS = { type: 'box', x: 430, y: 250, w: 230, h: 300, rx: 14, fill: C.bg, stroke: C.info, sw: 1.3, dasharray: '6 4', text: '', opacity: 0 };
      o.gR = { type: 'box', x: 710, y: 250, w: 230, h: 300, rx: 14, fill: C.bg, stroke: C.ok, sw: 1.3, dasharray: '6 4', text: '', opacity: 0 };
      o.tP = label(150, 120, '预训练', C.data, 'middle', 14); o.tS = label(430, 120, '后训练 · SFT', C.info, 'middle', 14); o.tR = label(710, 120, '后训练 · RL', C.ok, 'middle', 14);
      o.p1 = node(150, 175, 190, 50, 'UI 元素', '框 · 标签 · OCR → 定位', 'data');
      o.p2 = node(150, 250, 190, 50, '动作', 'click · type · swipe → 控制', 'warn');
      o.p3 = node(150, 335, 190, 56, '"CAR" 对应元素框', 'CLICK · bookCarTab', 'neutral', 0, true);
      o.s1 = node(430, 175, 190, 50, '人的示范', '目标 + 人的轨迹', 'data');
      o.s2 = node(430, 250, 190, 50, '合成数据', '教师模型跑 → 过滤', 'info');
      o.s3 = node(430, 335, 190, 56, '行为克隆', '同一个"下一动作"损失', 'neutral');
      o.r1 = node(710, 165, 190, 44, '模拟应用（可重置）', '', 'neutral');
      o.r2 = node(710, 235, 190, 44, '采样轨迹 o → a → …', '', 'warn');
      o.r3 = node(710, 305, 190, 44, '验证器打分 +1', '', 'ok');
      o.r4 = node(710, 375, 190, 44, '更新策略', '', 'info');
      o.c12 = wire('M710,188 L710,212', C.neutral); o.c23 = wire('M710,258 L710,282', C.warn); o.c34 = wire('M710,328 L710,352', C.ok);
      o.c41 = wire('M806,375 C836,375 836,165 806,165', C.info);
      o.ps = wire('M266,250 L314,250', C.data); o.sr = wire('M546,250 L594,250', C.info);
      o.why = label(710, 440, '真网站不能乱试：会真付钱、撤不回', C.bad, 'middle', 11.5);
      o.cg = label(430, 440, 'CUA-Gym：94 个模拟网页应用 + 16 个桌面应用', C.fg2, 'middle', 11.5);
      o.res = node(430, 495, 360, 40, 'OSWorld：62.2 → 72.6（%）', '', 'ok');
      return o;
    },
    steps: [
      { say: '预训练：先学"屏幕上有什么、怎么指到它"。定位靠 UI 元素的框、标签、文字。控制靠点击、输入、滑动。',
        set: { gP: fade(0), tP: fade(100), p1: pop(200), p2: pop(400), p3: pop(700) }, data: { 'Mind2Web 任务': { v: 2350, at: 700 } } },
      { say: 'SFT：模仿有用的轨迹。人的示范是"目标 + 人的操作记录"。合成数据是教师模型去跑，再过滤留下好的。',
        set: join(on('ps', 0), { gS: fade(100), tS: fade(200), s1: pop(300), s2: pop(500), s3: pop(800) }), fx: [st('ps', 100, C.data, 3)],
        data: { 'AgentNet 轨迹': { v: 22625, at: 500 }, 'MolmoWebMix 轨迹': { v: 141000, at: 800 } } },
      { say: '人和教师的轨迹，用的是同一个"预测下一个动作"的损失。数据越来越长、越来越跨应用（讲义第 61–62 页）。',
        fx: [{ type: 'pulse', obj: 's3', color: C.info, at: 200 }, { type: 'pulse', obj: 's1', color: C.data, at: 500 }, { type: 'pulse', obj: 's2', color: C.info, at: 600 }] },
      { say: 'RL：在真实网站上试错不行。会真花钱、真派车，取消还要收费，浪费的时间也回不来。',
        set: join(on('sr', 0), { gR: fade(100), tR: fade(200), why: fade(500) }), fx: [st('sr', 100, C.info, 3), { type: 'shake', obj: 'why', at: 900 }] },
      { say: '所以在可以重置的模拟应用里练。先注入初始状态，智能体采样一条轨迹。再检查最终状态打分，更新策略，然后重置。',
        set: join({ r1: pop(0), r2: pop(250), r3: pop(500), r4: pop(750) }, on('c12', 200), on('c23', 450), on('c34', 700), on('c41', 950), { cg: fade(900) }),
        fx: [st('c12', 300, C.neutral, 2), st('c23', 550, C.warn, 2), st('c34', 800, C.ok, 2), st('c41', 1100, C.info, 5)], data: { 'CUA-Gym 可验证任务': { v: 32112, at: 900 } } },
      { say: 'CUA-Gym 先用 3,578 条 SFT 示范打底。再在 10,858 个验证过的任务上做 RL，OSWorld 从 62.2% 升到 72.6%（讲义第 69 页）。',
        set: { res: pop(0) }, fx: [{ type: 'burst', obj: 'res', color: C.ok, at: 400 }, st('c41', 0, C.info, 5)], data: { 'OSWorld（%）': { v: 72.6, at: 300 } } }
    ]
  };

  VZ.register({
    id: 'c4-cua', title: '电脑操作智能体：看截图、出动作、上下文变长、各家格式、怎么训练',
    sources: [{ t: '第 7 讲 2:51–5:42（观察-推理-行动循环）', u: YT + '171' }, { t: '第 7 讲 48:52–53:09（建模与动作空间）', u: YT + '2932' },
      { t: '第 7 讲 1:08:03（坐标归一化到 0–1000）', u: YT + '4083' }, { t: '第 7 讲 56:48–1:12:23（训练三阶段）', u: YT + '3408' }, { t: '讲义 lecture-07 第 3–8、21、47–57、59–69 页', u: L7 }],
    note: '场景 1 的任务、模型的四句话和动作 JSON 照讲义第 4–8 页。中文是转述，JSON 原样。网页画面是重画的示意，坐标没有和画面严格对应。场景 2 照讲义第 47–56 页。场景 3 的六种格式照讲义第 57 页，是 2026 年 9 月的情况。后半段的坐标换算是示意。屏幕尺寸和目标框，取自讲义第 21 页的 ScreenSpot-Pro 例子。坐标归一化到 0–1000，是讲师在 1:08:03 答问时说的。讲义第 57 页写 Gemini 是 0–999。"除以 1000 再乘宽度"是据此做的示意换算，结果是本机实算的。场景 4 的数字都是讲义第 22、61–62、68–69 页上的。MolmoWebMix 是 36K 人类加 105K 合成，合计 141K。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

/* 04 · 第 10 讲 —— 深度研究智能体的训练与打分：用知识图谱造题、SFT 过滤轨迹、RLVR + GRPO 的组内相对奖励、rubric 打分、检索器的点积与对比损失
 * 场景 1 照讲义 lecture-10 第 61–67 页（Allen Newell / Herbert Simon 的知识图谱和问题）。
 * 场景 2 照讲义第 58–60、68–73 页。
 * 场景 3–5 的式子照讲义第 41、75、79、102、104 页；手推的数字由 本机验算脚本 第 4 部分（4j 段与代码面板完全一致）本机算出。
 * 场景 3 的三条轨迹和奖励 0、1、1 是讲义上的示意；场景 5 的三维向量是本页自拟的示意数，讲义上没有具体数值。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L10 = 'https://www.cmu-agents.com/slides/lecture-10-deep-research-agents.pdf', YT = 'https://youtu.be/nKUBrXFQBUM?t=';
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function akey(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'neutral'; }
  function wire(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: akey(col), opacity: 0 }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 300, delay: d0 || 0 }, flow: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function node(x, y, w, h, t, sub, k, mono) {
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 10, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.7, text: t, sub: sub, subMono: !!mono, subSize: 11.5, size: 13, weight: 700, opacity: 0 };
  }
  function chip(x, y, w, t, k, size, mono, h) { return { type: 'box', x: x, y: y, w: w, h: h || 30, rx: 6, fill: PAL[k][0], stroke: PAL[k][1], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: !!mono, opacity: 0 }; }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  function recolor(k, delay) { return { fill: { to: PAL[k][0], dur: 400, delay: delay || 0 }, stroke: { to: PAL[k][1], dur: 400, delay: delay || 0 } }; }
  function seq(lines, start) { var at = start || 0; return lines.map(function (s) { var o = { s: s, at: at }; at += Math.min(s.length * 16, 600) + 90; return o; }); }
  function flyNum(name, fx, fy, tx, ty, txt, delay) {
    var s = {}; s[name] = { opacity: { from: 1, to: 0, dur: 150, delay: delay + 800 }, x: { from: fx, to: tx, dur: 800, delay: delay, ease: 'inOut' }, y: { from: fy, to: ty, dur: 800, delay: delay, ease: 'inOut' }, text: { to: txt, delay: 0 } };
    return s;
  }

  /* ---------------- 场景 1：用知识图谱造题 ---------------- */
  var KN = { cmu: [140, 150, '卡内基梅隆', 'neutral'], new: [140, 280, 'Allen Newell', 'bad'], tur: [430, 150, '1975 图灵奖', 'neutral'], sim: [430, 280, 'Herbert Simon', 'neutral'], nob: [720, 280, '1978 诺贝尔经济学奖', 'neutral'], hps: [430, 410, '《Human Problem Solving》(1972)', 'neutral'] };
  var KE = [['eF', 'M140,262 L140,168', '任职于', 108, 215], ['eR', 'M212,268 L355,162', '获得', 270, 200], ['eC', 'M430,168 L430,262', '共同获奖', 470, 215], ['eN', 'M507,280 L620,280', '获得', 563, 268], ['eA', 'M430,298 L430,392', '合著', 455, 345], ['eB', 'M212,292 L320,398', '合著', 250, 360]];
  var sc1 = {
    name: '图谱造题', desc: '从有出处的事实出发，在知识图谱里取一块连通的子图。把目标的名字藏起来，关系变成线索。这样就得到一道答案已知、需要多次搜索的问题。',
    dataTitle: '这道题', data: { '选中的事实': 0, '已知答案': '无' },
    bg: function (d) { title(d, '造题：在知识图谱里取一块子图，藏起名字，关系变成线索'); },
    objects: function () {
      var o = {};
      KE.forEach(function (e) { o[e[0]] = wire(e[1], C.neutral); o[e[0] + 'T'] = label(e[3], e[4], e[2], C.fg3, 'middle', 11.5); });
      for (var k in KN) { var n = KN[k]; o[k] = node(n[0], n[1], k === 'hps' ? 250 : k === 'nob' ? 190 : 150, 36, n[2], '', n[3]); }
      o.trip = label(430, 470, '主语 Allen Newell · 关系"任职于" · 宾语 卡内基梅隆', C.fg2, 'middle', 12.5);
      o.q = node(430, 500, 780, 56, '哪位 CMU 研究者和一位后来的诺贝尔经济学奖得主合著过一本讲人类问题求解的书，', '并在那位同事得诺贝尔奖三年前和他一起获得了图灵奖？', 'info');
      o.ans = node(740, 410, 150, 40, '答案：Allen Newell', '', 'ok');
      return o;
    },
    steps: [
      { say: '知识图谱里，一个节点是一个实体。一条带标签的箭头，是一个关系。比如 Allen Newell 任职于卡内基梅隆。',
        set: join({ new: pop(0), cmu: pop(200), trip: fade(700) }, on('eF', 400), { eFT: fade(500) }), fx: [st('eF', 500, C.neutral, 2)] },
      { say: '再连上更多事实。Newell 获得 1975 年图灵奖，和 Herbert Simon 共同获奖。Simon 获 1978 年诺贝尔经济学奖。两人合著《Human Problem Solving》。',
        set: join({ tur: pop(0), sim: pop(200), nob: pop(400), hps: pop(600), trip: fade(0, 300, 0) }, on('eR', 300), on('eC', 500), on('eN', 700), on('eA', 900), on('eB', 1000),
          { eRT: fade(400), eCT: fade(600), eNT: fade(800), eAT: fade(1000), eBT: fade(1100) }) },
      { say: '从有出处的事实出发，取一块连通的子图。选中的这几条事实，就是问题的线索。',
        set: { eF: { stroke: { to: C.bad, dur: 300, delay: 0 }, flowColor: { to: C.bad, dur: 300, delay: 0 } }, eR: { stroke: { to: C.bad, dur: 300, delay: 200 }, flowColor: { to: C.bad, dur: 300, delay: 200 } }, eC: { stroke: { to: C.bad, dur: 300, delay: 400 }, flowColor: { to: C.bad, dur: 300, delay: 400 } }, eN: { stroke: { to: C.bad, dur: 300, delay: 600 }, flowColor: { to: C.bad, dur: 300, delay: 600 } }, eB: { stroke: { to: C.bad, dur: 300, delay: 800 }, flowColor: { to: C.bad, dur: 300, delay: 800 } } },
        fx: [st('eF', 0, C.bad, 2), st('eR', 200, C.bad, 3), st('eC', 400, C.bad, 2), st('eN', 600, C.bad, 2), st('eB', 800, C.bad, 3)], data: { '选中的事实': { v: 4, at: 900 } } },
      { say: '把目标的名字藏起来：Allen Newell 变成"？"，它的关系改写成线索。',
        set: { new: { text: { to: '？', delay: 300 }, fill: { to: C.bg, dur: 300, delay: 0 } } }, fx: [{ type: 'pulse', obj: 'new', color: C.bad, at: 300 }] },
      { say: '线索合成一道问题。他合著过一本讲人类问题求解的书。他和一位同事同获图灵奖，比同事得诺奖早三年。要搜好几次才能对上。',
        set: { q: pop(0) }, fx: [st('eB', 0, C.bad, 3), st('eC', 200, C.bad, 2), st('eN', 400, C.bad, 2)] },
      { say: '答案是已知的：Allen Newell。这样的题能自动验证对错。可以拿来做 SFT 数据，也可以做 RL 的奖励。',
        set: { ans: pop(0), new: { text: { to: 'Allen Newell', delay: 300 } } }, fx: [{ type: 'burst', obj: 'ans', color: C.ok, at: 300 }], data: { '已知答案': { v: 'Allen Newell', at: 300 } } }
    ]
  };

  /* ---------------- 场景 2：SFT 过滤 + 中期训练 ---------------- */
  var BR = [['BrowseComp-en', 28.6, 39.9], ['BrowseComp-zh', 35.6, 43.3], ['GAIA', 71.8, 72.8]];
  var sc2 = {
    name: '过滤与预热', desc: '让教师模型去做这些题。只留下答案对、格式对、过程连贯的轨迹做 SFT。在这之前，还可以先用大量智能体轨迹做继续预训练。',
    dataTitle: '过滤', data: { '收集的轨迹': 0, '保留的轨迹': 0 },
    bg: function (d) { title(d, '训练配方：先学教师的示范（过滤后 SFT），再从自己的尝试里学（RL）'); },
    objects: function () {
      var o = {};
      o.qa = node(110, 110, 170, 50, '问题 + 已知答案', '', 'info');
      o.t0 = chip(110, 200, 190, '答案对 · 格式对', 'ok', 12); o.t1 = chip(110, 245, 190, '答案错 · 格式对', 'bad', 12); o.t2 = chip(110, 290, 190, '答案对 · 格式坏', 'bad', 12);
      o.pt = wire('M110,136 L110,184', C.info);
      o.f = node(360, 245, 170, 80, '过滤', '答案对 · 格式对 · 过程连贯', 'warn');
      o.p0 = wire('M207,200 L273,230', C.ok); o.p1 = wire('M207,245 L273,245', C.bad); o.p2 = wire('M207,290 L273,260', C.bad);
      o.keep = node(590, 200, 170, 46, '留下的轨迹', '', 'ok'); o.sft = node(590, 290, 170, 46, '用 SFT 训练', '', 'info');
      o.pk = wire('M447,235 L503,205', C.ok); o.ps = wire('M590,224 L590,266', C.ok);
      o.r0 = chip(150, 380, 150, '中期训练', 'neutral', 13); o.r1 = chip(390, 380, 150, 'SFT', 'neutral', 13); o.r2 = chip(630, 380, 150, '强化学习', 'neutral', 13);
      o.ra = wire('M227,380 L313,380', C.info); o.rb = wire('M467,380 L553,380', C.info);
      o.rt0 = label(150, 410, '大规模学智能体行为', C.fg3, 'middle', 11.5); o.rt1 = label(390, 410, '模仿成功的示范', C.fg3, 'middle', 11.5); o.rt2 = label(630, 410, '从自己的尝试里学', C.fg3, 'middle', 11.5);
      BR.forEach(function (b, i) {
        var y = 455 + i * 32;
        o['bl' + i] = label(60, y, b[0], C.fg2, 'start', 12);
        o['ba' + i] = { type: 'box', x: 190, y: y - 7, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.neutralW, stroke: C.neutral, sw: 1, text: '', opacity: 0 };
        o['bb' + i] = { type: 'box', x: 190, y: y + 7, w: 0, h: 12, rx: 3, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1, text: '', opacity: 0 };
        o['na' + i] = { type: 'text', x: 196, y: y - 7, text: '', num: 0, fmt: 'fixed1', size: 11.5, weight: 700, color: C.fg3, anchor: 'start', opacity: 0 };
        o['nb' + i] = { type: 'text', x: 196, y: y + 7, text: '', num: 0, fmt: 'fixed1', size: 11.5, weight: 700, color: C.data, anchor: 'start', opacity: 0 };
      });
      o.bk = label(700, 470, '灰：Qwen3 底座 + SFT', C.fg3, 'middle', 11.5); o.bk2 = label(700, 492, '蓝：先做智能体中期训练的底座 + 同样的 SFT', C.data, 'middle', 11.5);
      return o;
    },
    steps: [
      { say: '拿"问题 + 已知答案"让教师模型去做，收集它们的轨迹。', set: join({ qa: pop(0) }, on('pt', 300), { t0: pop(500), t1: pop(650), t2: pop(800) }), fx: [st('pt', 300, C.info, 3)], data: { '收集的轨迹': { v: 3, at: 800 } } },
      { say: '有的答案对，格式也对。有的答案错。有的答案对，但格式坏了，比如工具调用写错。',
        fx: [{ type: 'pulse', obj: 't0', color: C.ok, at: 0 }, { type: 'shake', obj: 't1', at: 400 }, { type: 'shake', obj: 't2', at: 700 }] },
      { say: '过滤：答案对、格式对、过程连贯，三条都满足才留下。',
        set: join({ f: pop(0) }, on('p0', 300), on('p1', 400), on('p2', 500)), fx: [st('p0', 300, C.ok, 3), st('p1', 400, C.bad, 3), st('p2', 500, C.bad, 3), { type: 'float', x: 280, y: 270, text: '错', color: C.bad, size: 18, at: 1100 }] },
      { say: '留下的轨迹拿来做 SFT：模仿成功的示范。',
        set: join(on('pk', 0), { keep: pop(300) }, on('ps', 600), { sft: pop(800) }), fx: [st('pk', 0, C.ok, 3), st('ps', 600, C.ok, 2)], data: { '保留的轨迹': { v: 1, at: 400 } } },
      { say: '完整的配方（讲义第 58–60 页）是中期训练 → SFT → RL。前两段的数据都是"输入 + 答案 + 教师轨迹"。RL 换成策略自己的尝试。',
        set: join({ r0: pop(0), r1: pop(250), r2: pop(500), rt0: fade(100), rt1: fade(350), rt2: fade(600) }, on('ra', 200), on('rb', 450)), fx: [st('ra', 200, C.info, 3), st('rb', 450, C.info, 3)] },
      { say: '智能体中期训练：把智能体轨迹混进通用预训练数据。再做继续预训练，还是下一个 token 预测。这样得到"适合当智能体"的底座。',
        fx: [{ type: 'pulse', obj: 'r0', color: C.info, at: 200 }] },
      { say: '同样的 SFT 数据，换一个先做过智能体中期训练的底座。BrowseComp-en 上 28.6 → 39.9，-zh 上 35.6 → 43.3，GAIA 上 71.8 → 72.8。',
        set: (function () { var s = { bk: fade(0), bk2: fade(200) }; BR.forEach(function (b, i) { var d0 = i * 300; s['bl' + i] = fade(d0); s['ba' + i] = { opacity: { to: 1, dur: 150, delay: d0 }, w: { to: b[1] * 5, dur: 600, delay: d0 } }; s['bb' + i] = { opacity: { to: 1, dur: 150, delay: d0 + 150 }, w: { to: b[2] * 5, dur: 600, delay: d0 + 150 } };
          s['na' + i] = { opacity: { to: 1, dur: 150, delay: d0 }, x: { from: 196, to: 196 + b[1] * 5, dur: 600, delay: d0 }, num: { to: b[1], dur: 600, delay: d0 } }; s['nb' + i] = { opacity: { to: 1, dur: 150, delay: d0 + 150 }, x: { from: 196, to: 196 + b[2] * 5, dur: 600, delay: d0 + 150 }, num: { to: b[2], dur: 600, delay: d0 + 150 } }; }); return s; })() }
    ]
  };

  /* ---------------- 场景 3：RLVR + GRPO ---------------- */
  var CODE3 = { lang: 'py', title: '本机实跑 · RLVR 奖励与组内相对奖励', src:
'gold = "Allen Newell"\n' +
'ys = ["Herbert Simon", "Allen Newell",\n' +
'      "Allen Newell"]\n' +
'r = [int(y == gold) for y in ys]   # EM\n' +
'mean = sum(r) / len(r)\n' +
'A = [x - mean for x in r]   # 和组里平均比\n' };
  var YX = [270, 470, 670];
  var EQ = VZ.eq('m', ['(', { slot: 1, w: 34 }, '+', { slot: 1, w: 34 }, '+', { slot: 1, w: 34 }, ') / 3 =', { num: 0, fmt: 'fixed3', k: 'info', w: 76 }], 470, 330, { size: 15 });
  var sc3 = {
    name: 'RLVR 与 GRPO', desc: '一道题采样一组尝试，用"和已知答案是否完全一致"当奖励。GRPO 拿每个尝试和组里的平均比。高于平均就提高它的概率，低于就降低。',
    code: CODE3, dataTitle: '这一组', data: { '奖励 r': '无', '组平均': 0, 'A(y1)': 0, 'A(y2)': 0, 'A(y3)': 0 }, dataFmt: { '组平均': 'fixed3', 'A(y1)': 'signed2', 'A(y2)': 'signed2', 'A(y3)': 'signed2' },
    bg: function (d) { title(d, 'RLVR 用答案对不对当奖励，GRPO 跟组里的平均比'); },
    objects: function () {
      var o = {};
      o.qx = node(80, 110, 120, 50, '问题 x', 'CMU 线索题', 'info');
      o.pol = node(270, 110, 160, 50, '策略 π_θ', '搜索并推理', 'info');
      o.pq = wire('M142,110 L188,110', C.info);
      YX.forEach(function (x, i) {
        o['y' + i] = node(x, 200, 170, 46, 'y' + (i + 1) + '：' + (i === 0 ? 'Herbert Simon' : 'Allen Newell'), '', 'neutral');
        o['ps' + i] = wire('M270,136 L' + x + ',176', C.info);
        o['rw' + i] = chip(x, 262, 80, '', 'neutral', 14);
        o['ad' + i] = chip(x, 420, 120, '', 'neutral', 13, true);
        o['ar' + i] = label(x, 455, '', C.fg2, 'middle', 12);
      });
      o.gold = node(770, 110, 140, 50, '已知答案', 'Allen Newell', 'ok');
      o.em = label(770, 160, 'r = EM(a, a_gold)', C.ok, 'middle', 12.5);
      for (var k in EQ.objs) o[k] = EQ.objs[k];
      o.mt = label(470, 300, '组平均', C.fg3, 'middle', 12);
      o.f1 = chip(0, 0, 34, '0', 'bad', 14, true); o.f2 = chip(0, 0, 34, '1', 'ok', 14, true); o.f3 = chip(0, 0, 34, '1', 'ok', 14, true);
      o.J = node(430, 510, 720, 46, 'J(θ) = 𝔼[ min(ρÂ, clip(ρ, 1−ε, 1+ε)Â) − β·D_KL ]', 'Â：组内相对奖励 · clip：限制每次更新的幅度 · KL：别离参考模型太远', 'info');
      return o;
    },
    steps: [
      { say: '一道知识图谱题 x 交给策略，采样一组 3 条搜索轨迹。它们的最终答案各不相同。',
        set: join({ qx: pop(0), pol: pop(200) }, on('pq', 100), on('ps0', 500), on('ps1', 600), on('ps2', 700), { y0: pop(700), y1: pop(800), y2: pop(900) }),
        fx: [st('ps0', 500, C.info, 2), st('ps1', 600, C.info, 2), st('ps2', 700, C.info, 2)] },
      { say: '验证最终答案：和已知答案 Allen Newell 完全一致（EM）就得 1，否则 0。',
        set: { gold: pop(0), em: fade(300), rw0: mix(pop(600), recolor('bad', 600), { text: { to: '0', delay: 600 } }), rw1: mix(pop(800), recolor('ok', 800), { text: { to: '1', delay: 800 } }), rw2: mix(pop(1000), recolor('ok', 1000), { text: { to: '1', delay: 1000 } }) },
        hl: [1, 2, 3, 4], log: seq(['>>> r', '[0, 1, 1]'], 900), data: { '奖励 r': { v: '0, 1, 1', at: 1000 } } },
      { say: 'GRPO 不需要价值模型：同一道题的这组尝试互相比较。先算组平均。',
        set: mix(VZ.show(EQ, 0, 60), { mt: fade(0) }), hl: [5] },
      { say: '三个奖励 0、1、1 飞进式子：(0 + 1 + 1) / 3 = 0.667。',
        set: join(flyNum('f1', YX[0], 262, EQ.xs[1], 330, '0', 0), flyNum('f2', YX[1], 262, EQ.xs[3], 330, '1', 200), flyNum('f3', YX[2], 262, EQ.xs[5], 330, '1', 400),
          { m1: { text: { to: '0', delay: 800 } }, m3: { text: { to: '1', delay: 1000 } }, m5: { text: { to: '1', delay: 1200 } }, m7: { num: { to: 0.6667, dur: 600, delay: 1400 } } }),
        fx: [{ type: 'burst', obj: 'm7', color: C.info, at: 2000 }], data: { '组平均': { v: 0.6667, at: 1500 } } },
      { say: '每个尝试减去平均。y1 是 0 − 0.667 = −0.67，低于平均。y2、y3 是 1 − 0.667 = +0.33，高于平均。',
        set: { ad0: mix(pop(0), recolor('bad', 0), { text: { to: 'Â = −0.67', delay: 0 } }), ad1: mix(pop(300), recolor('ok', 300), { text: { to: 'Â = +0.33', delay: 300 } }), ad2: mix(pop(600), recolor('ok', 600), { text: { to: 'Â = +0.33', delay: 600 } }) },
        hl: [6], log: seq(['>>> round(mean, 4), [round(a, 4) for a in A]', '0.6667 [-0.6667, 0.3333, 0.3333]'], 200),
        data: { 'A(y1)': { v: -0.6667, at: 200 }, 'A(y2)': { v: 0.3333, at: 500 }, 'A(y3)': { v: 0.3333, at: 800 } } },
      { say: '低于平均的 y1 降低概率，高于平均的 y2、y3 提高概率（讲义第 78 页）。',
        set: { ar0: mix(fade(0), { text: { to: '↓ 降低它的概率', delay: 0 }, color: { to: C.bad, dur: 10, delay: 0 } }), ar1: mix(fade(250), { text: { to: '↑ 提高它的概率', delay: 0 }, color: { to: C.ok, dur: 10, delay: 0 } }), ar2: mix(fade(500), { text: { to: '↑ 提高它的概率', delay: 0 }, color: { to: C.ok, dur: 10, delay: 0 } }) },
        fx: [{ type: 'shake', obj: 'y0', at: 200 }, { type: 'pulse', obj: 'y1', color: C.ok, at: 450 }, { type: 'pulse', obj: 'y2', color: C.ok, at: 700 }] },
      { say: '完整的目标还有两件事。把每次更新裁剪在 1 ± ε 里，再用 KL 惩罚别离参考模型太远。而且只在模型生成的 token 上算。',
        set: { J: pop(0) }, fx: [{ type: 'pulse', obj: 'J', color: C.info, at: 500 }] }
    ]
  };

  /* ---------------- 场景 4：rubric 打分 ---------------- */
  var CODE4 = { lang: 'py', title: '本机实跑 · rubric 加权打分', src:
'w = [2, 1]   # 两条 rubric 的权重\n' +
'b = [1, 0]   # 候选答案满足了吗（评审判）\n' +
'S = sum(wi * bi for wi, bi in zip(w, b)) \\\n' +
'    / sum(w)\n' };
  var EQ4 = VZ.eq('s', ['(', { slot: 1, w: 30 }, '×', { slot: 1, w: 30 }, '+', { slot: 1, w: 30 }, '×', { slot: 1, w: 30 }, ') / (', { slot: 1, w: 30 }, '+', { slot: 1, w: 30 }, ') =', { num: 0, fmt: 'fixed2', k: 'ok', w: 64 }], 430, 340, { size: 15 });
  var sc4 = {
    name: 'rubric 打分', desc: '长答案没法拿"像不像参考答案"来判。同样意思可以有多种写法，差一个词意思可能全反。按专家写的 rubric 逐条核对、加权平均，更靠谱。',
    code: CODE4, dataTitle: '打分', data: { 'S_c': 0 }, dataFmt: { 'S_c': 'fixed2' },
    bg: function (d) { title(d, 'ScholarQABench：逐条核对 rubric，再加权合成分数'); },
    objects: function () {
      var o = {};
      o.cand = node(190, 120, 320, 74, '候选答案：OpenScholar 赢了', '70% 的专家对比 [1]，所有领域都成立', 'data');
      o.h1 = label(560, 82, 'rubric 条目', C.fg3, 'start', 12); o.h2 = label(735, 82, '权重', C.fg3, 'middle', 12); o.h3 = label(800, 82, '满足', C.fg3, 'middle', 12);
      o.ru0 = { type: 'box', x: 560, y: 120, w: 160, h: 46, rx: 6, anchor: 'l', fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: '直接和人类专家比了', size: 12, weight: 650, opacity: 0 };
      o.ru1 = { type: 'box', x: 560, y: 180, w: 160, h: 46, rx: 6, anchor: 'l', fill: C.neutralW, stroke: C.neutral, sw: 1.2, text: '按任务和领域限定结论', size: 12, weight: 650, opacity: 0 };
      o.w0 = chip(735, 120, 40, '2', 'neutral', 14, true); o.w1 = chip(735, 180, 40, '1', 'neutral', 14, true);
      o.b0 = chip(800, 120, 40, '', 'neutral', 14, true); o.b1 = chip(800, 180, 40, '', 'neutral', 14, true);
      o.pr = wire('M352,140 L548,140', C.data);
      for (var k in EQ4.objs) o[k] = EQ4.objs[k];
      ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (n) { o[n] = chip(0, 0, 30, '', 'neutral', 14, true); });
      o.sim = label(430, 420, '讲义第 38 页：ROUGE / BERTScore / BLEURT 挑出专家更喜欢的答案，只有 58% / 57% / 62%（瞎猜 50%）', C.bad, 'middle', 11.5);
      o.agr = label(430, 455, '讲义第 42 页：rubric 判断上，专家和 LM 一致 79%，专家和专家一致 80%', C.ok, 'middle', 11.5);
      o.dr = node(430, 510, 700, 40, 'DR Tulu：rᵢ = Σₖ wₖ · Judge(cₖ, yᵢ) / Σₖ wₖ，当 RL 奖励，条目 cₖ 随训练演化', '', 'info');
      return o;
    },
    steps: [
      { say: '问题："AI 智能体综述文献能比得上专家吗？"候选答案说"赢了 70% 的专家对比，在所有领域都成立"。',
        set: { cand: pop(0) } },
      { say: '专家为这道题写了两条 rubric。一条是直接和人类专家比了，权重 2。一条是按任务和领域限定了结论，权重 1。',
        set: join(on('pr', 0), { h1: fade(200), h2: fade(200), h3: fade(200), ru0: fade(300), ru1: fade(450), w0: pop(500), w1: pop(650) }), fx: [st('pr', 0, C.data, 3)], hl: [1] },
      { say: '逐条核对：第一条满足，记 1。第二条没有，它说"所有领域都成立"，没有限定，记 0。',
        set: { b0: mix(pop(0), recolor('ok', 0), { text: { to: '1', delay: 0 } }), ru0: recolor('ok', 0), b1: mix(pop(500), recolor('bad', 500), { text: { to: '0', delay: 500 } }), ru1: recolor('bad', 500) }, hl: [2] },
      { say: '加权平均 S_c = Σ wᵢbᵢ / Σ wᵢ：权重和满足情况飞进式子。',
        set: join(VZ.show(EQ4, 0, 50), flyNum('g1', 735, 120, EQ4.xs[1], 340, '2', 700), flyNum('g2', 800, 120, EQ4.xs[3], 340, '1', 850), flyNum('g3', 735, 180, EQ4.xs[5], 340, '1', 1000), flyNum('g4', 800, 180, EQ4.xs[7], 340, '0', 1150), flyNum('g5', 735, 120, EQ4.xs[9], 340, '2', 1300), flyNum('g6', 735, 180, EQ4.xs[11], 340, '1', 1450),
          { s1: { text: { to: '2', delay: 1500 } }, s3: { text: { to: '1', delay: 1650 } }, s5: { text: { to: '1', delay: 1800 } }, s7: { text: { to: '0', delay: 1950 } }, s9: { text: { to: '2', delay: 2100 } }, s11: { text: { to: '1', delay: 2250 } } }), hl: [3, 4] },
      { say: '(2 × 1 + 1 × 0) / (2 + 1) = 0.67：拿到了重要的一条，漏了"限定结论"。',
        set: { s13: { num: { to: 0.6667, dur: 700, delay: 100 } } }, fx: [{ type: 'burst', obj: 's13', color: C.ok, at: 800 }], log: seq(['>>> round(S, 4)', '0.6667'], 100), data: { 'S_c': { v: 0.6667, at: 300 } } },
      { say: '为什么不比"像不像参考答案"？相似度指标挑专家偏好的答案，只比瞎猜好一点。rubric 判断和专家的一致率，接近专家之间的一致率。',
        set: { sim: fade(0), agr: fade(700) } },
      { say: 'DR Tulu 把同样的加权 rubric 分数当 RL 奖励。而且条目会根据模型的回答和检索到的证据，不断演化（讲义第 86–93 页）。',
        set: { dr: pop(0) }, fx: [{ type: 'pulse', obj: 'dr', color: C.info, at: 400 }] }
    ]
  };

  /* ---------------- 场景 5：检索器的点积和对比损失 ---------------- */
  var CODE5 = { lang: 'py', title: '本机实跑 · 点积打分与对比损失（向量是示意）', src:
'q     = [0.9, 0.1, 0.4]   # E_q(问题)\n' +
'd_pos = [0.8, 0.3, 0.5]   # E_d([1])\n' +
'd_neg = [0.1, 0.2, 0.9]   # E_d([3])\n' +
'dot = lambda u, v: sum(x * y\n' +
'                       for x, y in zip(u, v))\n' +
's_pos, s_neg = dot(q, d_pos), dot(q, d_neg)\n' +
'L = -math.log(math.exp(s_pos) /\n' +
'      (math.exp(s_pos) + math.exp(s_neg)))\n' };
  var EQ5 = VZ.eq('e', [{ slot: 1, w: 34 }, '×', { slot: 1, w: 34 }, '+', { slot: 1, w: 34 }, '×', { slot: 1, w: 34 }, '+', { slot: 1, w: 34 }, '×', { slot: 1, w: 34 }, '=', { num: 0, fmt: 'fixed2', k: 'ok', w: 60 }], 430, 300, { size: 14, gap: 4 });
  var EQL = VZ.eq('l', ['L = −log', { t: 'e^s+ / (e^s+ + e^s−)', k: 'neutral', w: 190, mono: true }, '=', { num: 0, fmt: 'fixed4', k: 'warn', w: 80 }], 430, 410, { size: 14 });
  var sc5 = {
    name: '检索器打分', desc: '双编码器把文档和问题各自编成向量，点积就是相关度。训练时用对比损失。把相关文档的分数往上推，不相关的往下压。',
    code: CODE5, dataTitle: '打分与损失', data: { 's(q, d+)': 0, 's(q, d−)': 0, 'L': 0 }, dataFmt: { 's(q, d+)': 'fixed2', 's(q, d−)': 'fixed2', 'L': 'fixed4' },
    bg: function (d) { title(d, '嵌入检索：s(q, d) = E_q(q)ᵀ E_d(d)，再用对比损失训练'); },
    objects: function () {
      var o = {};
      o.q = node(150, 90, 260, 40, '问题：谁和 Simon 一起得了图灵奖？', '', 'info');
      o.dp = node(150, 160, 260, 40, '[1] Newell 和 Simon：1975 图灵奖', '', 'ok');
      o.dn = node(150, 220, 260, 40, '[3] CMU 校园建筑和路线', '', 'bad');
      o.vq = chip(560, 90, 170, '[0.9, 0.1, 0.4]', 'info', 12.5, true); o.vp = chip(560, 160, 170, '[0.8, 0.3, 0.5]', 'ok', 12.5, true); o.vn = chip(560, 220, 170, '[0.1, 0.2, 0.9]', 'bad', 12.5, true);
      o.eq1 = wire('M282,90 L473,90', C.info); o.eq2 = wire('M282,160 L473,160', C.ok); o.eq3 = wire('M282,220 L473,220', C.bad);
      o.encT = label(380, 76, '编码器', C.fg3, 'middle', 11.5);
      o.sv = label(720, 120, '示意的三维向量', C.fg3, 'middle', 11.5);
      for (var k in EQ5.objs) o[k] = EQ5.objs[k];
      for (var k2 in EQL.objs) o[k2] = EQL.objs[k2];
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function (n) { o[n] = chip(0, 0, 34, '', 'neutral', 12, true); });
      o.sn = chip(720, 300, 160, 's(q, d−) = 0.47', 'bad', 12.5, true);
      o.push = node(430, 490, 600, 40, '训练把 s(q, d+) 推到 1.5 → L = 0.3053，推到 2.5 → L = 0.1234', '', 'warn');
      return o;
    },
    steps: [
      { say: '先把所有文档用文档编码器编成向量，建好索引。问题来了，再用问题编码器编成向量（讲义第 101–102 页）。',
        set: join({ q: pop(0), dp: pop(150), dn: pop(300), encT: fade(300) }, on('eq1', 400), on('eq2', 500), on('eq3', 600), { vq: pop(800), vp: pop(900), vn: pop(1000), sv: fade(1100) }),
        fx: [st('eq1', 400, C.info, 3), st('eq2', 500, C.ok, 3), st('eq3', 600, C.bad, 3)], hl: [1, 2, 3] },
      { say: '相关度就是点积：s(q, d) = E_q(q)ᵀ E_d(d)。把问题和 [1] 的分量一一相乘再相加。',
        set: VZ.show(EQ5, 0, 50), hl: [4, 5] },
      { say: '0.9 × 0.8 + 0.1 × 0.3 + 0.4 × 0.5 = 0.95。',
        set: join(flyNum('h1', 560, 90, EQ5.xs[0], 300, '0.9', 0), flyNum('h2', 560, 160, EQ5.xs[2], 300, '0.8', 150), flyNum('h3', 560, 90, EQ5.xs[4], 300, '0.1', 300), flyNum('h4', 560, 160, EQ5.xs[6], 300, '0.3', 450), flyNum('h5', 560, 90, EQ5.xs[8], 300, '0.4', 600), flyNum('h6', 560, 160, EQ5.xs[10], 300, '0.5', 750),
          { e0: { text: { to: '0.9', delay: 800 } }, e2: { text: { to: '0.8', delay: 950 } }, e4: { text: { to: '0.1', delay: 1100 } }, e6: { text: { to: '0.3', delay: 1250 } }, e8: { text: { to: '0.4', delay: 1400 } }, e10: { text: { to: '0.5', delay: 1550 } }, e12: { num: { to: 0.95, dur: 600, delay: 1700 } } }),
        fx: [{ type: 'burst', obj: 'e12', color: C.ok, at: 2300 }], hl: [6], data: { 's(q, d+)': { v: 0.95, at: 1800 } } },
      { say: '同样算 [3]：0.9 × 0.1 + 0.1 × 0.2 + 0.4 × 0.9 = 0.47。[1] 分更高，排在前面，Top match 是 [1]。',
        set: { sn: pop(0) }, log: seq(['>>> round(s_pos, 4), round(s_neg, 4)', '0.95 0.47'], 200), data: { 's(q, d−)': { v: 0.47, at: 300 } } },
      { say: '训练检索器用对比损失。d+ 和反例一起做 softmax，要让 d+ 的概率尽量大（讲义第 104 页）。',
        set: VZ.show(EQL, 0, 80), hl: [7, 8] },
      { say: 'L = −log(e^0.95 / (e^0.95 + e^0.47)) = 0.4817，d+ 的概率约 0.62。',
        set: { l3: { num: { to: 0.4817, dur: 700, delay: 100 } } }, fx: [{ type: 'burst', obj: 'l3', color: C.warn, at: 800 }], log: seq(['>>> round(L, 4)', '0.4817'], 100), data: { 'L': { v: 0.4817, at: 300 } } },
      { say: '训练会推高相关文档的分，压低反例的分。s(q, d+) 到 1.5，损失降到 0.3053。到 2.5，降到 0.1234。',
        set: { push: pop(0), l3: { num: { to: 0.1234, dur: 1200, delay: 400 } } },
        log: seq(['>>> s_pos = 1.5; round(L, 4)', '0.3053', '>>> s_pos = 2.5; round(L, 4)', '0.1234'], 200), data: { 's(q, d+)': { v: 2.5, at: 400 }, 'L': { v: 0.1234, at: 600 } } }
    ]
  };

  VZ.register({
    id: 'c4-train', title: '深度研究智能体的训练与打分：图谱造题、SFT 过滤、RLVR 与 GRPO、rubric、检索器',
    sources: [{ t: '第 10 讲 25:21–30:56（训练配方、知识图谱造题、SFT 过滤、中期训练）', u: YT + '1521' }, { t: '第 10 讲 30:56–33:42（RLVR 与 GRPO）', u: YT + '1856' },
      { t: '第 10 讲 16:40–18:09（rubric 评估）', u: YT + '1000' }, { t: '第 10 讲 35:55–38:00（DR Tulu 演化 rubric）', u: YT + '2155' }, { t: '第 10 讲 47:50–49:19（嵌入检索与对比学习）', u: YT + '2870' },
      { t: '讲义 lecture-10 第 38–42、58–79、86–93、101–104 页', u: L10 }],
    note: '场景 1、2 的图谱、问题和过滤条件照讲义。柱子里的数字也是，在第 58–73 页。场景 3–5 的式子照讲义第 41、75、79、102、104 页。奖励 0/1/1 是讲义上的示意例子。rubric 的权重 2/1 和满足情况 1/0 也是。场景 5 的三维向量是本页自拟的示意数。所有手推结果和控制台都是本机实跑的。手推结果有 0.667、−0.67 / +0.33、0.67、0.95、0.47、0.4817、0.3053、0.1234。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

/* 10 · 第 17 讲（Zora Wang）：智能体与人的工作：基准投入 vs 就业、自动部署环境的漏斗、评测光谱与 rubric、人机协作的五个级别
 * 全部数字照讲义 2026-10-27-zora-wang.pdf：第 8 / 25 页（基准投入和就业）、第 28 页（Gym-Anything 漏斗）、第 34–39 页（评测光谱、rubric 配分）、
 * 第 47、57 页（协作级别、46% 的自动化意愿）。这一讲没有录像，说明文字依据讲义。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = 'https://www.cmu-agents.com/slides/2026-10-27-zora-wang.pdf';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, w, h, size, mono) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: mono !== false, opacity: 0 }; }
  function grow(w, d0, dur) { return { opacity: { to: 1, dur: 100, delay: d0 || 0 }, w: { to: w, dur: dur || 700, delay: d0 || 0, ease: 'out' } }; }

  /* ---------------- 场景 1：基准投入 vs 就业 ---------------- */
  var ROWS = [['办公和行政支持', 3186, 18.2], ['销售', 1680, 16.5], ['餐饮服务', 0, 13.6], ['管理', 676, 11.0], ['商业和金融', 3603, 9.8], ['教育', 1449, 7.3], ['计算机和数学', 8622, 5.2], ['法律', 71, 1.3]];
  var BX = 230, EX = 560, BS = 0.03, ES = 12;
  var sc1 = {
    name: '基准投入 vs 就业', desc: '每个职业类别有两个数：多少基准在测它，多少人从事它。把两者放在一起看。计算机和数学类的基准投入远超其他，却只占约 5% 的就业。就业大户的基准投入少得多（讲义第 8、25 页）。',
    dataTitle: '计算机和数学', data: { '基准投入': 0, '就业（百万）': 0 }, dataFmt: { '就业（百万）': 'fixed1' },
    bg: function (d) {
      title(d, '研发投入和人的工作对不上');
      d.text(BX, 70, '基准投入', { anchor: 'start', size: 12, weight: 750, color: C.bad });
      d.text(EX, 70, '就业人数（百万）', { anchor: 'start', size: 12, weight: 750, color: C.ok });
    },
    objects: function () {
      var o = {};
      ROWS.forEach(function (r, i) {
        var y = 105 + i * 50;
        o['n' + i] = { type: 'text', x: 215, y: y, text: r[0], size: 12, weight: 750, color: i === 6 ? C.bad : C.fg, anchor: 'end', opacity: 0 };
        o['b' + i] = { type: 'box', x: BX, y: y, w: 0, h: 18, rx: 3, anchor: 'l', fill: C.bad, stroke: 'none', opacity: 0 };
        o['bt' + i] = { type: 'text', x: BX + 6, y: y, text: '', num: 0, fmt: 'int', size: 11, weight: 800, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
        o['e' + i] = { type: 'box', x: EX, y: y, w: 0, h: 18, rx: 3, anchor: 'l', fill: C.ok, stroke: 'none', opacity: 0 };
        o['et' + i] = { type: 'text', x: EX + 6, y: y, text: '', num: 0, fmt: 'fixed1', post: 'M', size: 11, weight: 800, mono: true, color: C.fg2, anchor: 'start', opacity: 0 };
      });
      o.hl = { type: 'box', x: 430, y: 405, w: 820, h: 34, rx: 6, fill: 'none', stroke: C.bad, sw: 2, opacity: 0 };
      o.say = { type: 'box', x: 430, y: 520, w: 640, h: 36, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.2, text: '计算机和数学：基准投入最多，就业只占约 5%（讲义原话）', size: 12.5, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; ROWS.forEach(function (r, i) { s['n' + i] = fade(i * 80); }); return { say: '讲义统计了各职业类别。有多少基准在测它，叫基准投入。有多少人从事它，叫就业。这里挑 8 类。', set: s }; })(),
      (function () { var s = {}; ROWS.forEach(function (r, i) { s['e' + i] = grow(r[2] * ES, i * 100); s['et' + i] = mix(fade(i * 100), { x: { to: EX + r[2] * ES + 6, dur: 700, delay: i * 100 }, num: { to: r[2], dur: 700, delay: i * 100 } }); });
        return { say: '先看就业。办公和行政 1820 万、销售 1650 万、餐饮 1360 万。计算机和数学只有 520 万。', set: s, data: { '就业（百万）': { v: 5.2, at: 800 } } }; })(),
      (function () { var s = {}; ROWS.forEach(function (r, i) { s['b' + i] = grow(Math.max(r[1] * BS, 0.1), i * 100); s['bt' + i] = mix(fade(i * 100), { x: { to: BX + r[1] * BS + 6, dur: 700, delay: i * 100 }, num: { to: r[1], dur: 700, delay: i * 100 } }); });
        return { say: '再看基准投入。计算机和数学 8,622，远超其他。餐饮是 0，法律只有 71。', set: s, data: { '基准投入': { v: 8622, at: 800 } } }; })(),
      { say: '商业和金融 3,603、办公和行政 3,186、销售 1,680 也有一些。管理 676，餐饮服务 0。', fx: [{ type: 'pulse', obj: 'b4', color: C.bad, at: 100 }, { type: 'pulse', obj: 'b0', color: C.bad, at: 300 }, { type: 'shake', obj: 'b2', at: 600 }] },
      { say: '讲义上还有第三列「资本」。管理类最高，约 1.33 万亿美元。计算机和数学约 5,636 亿美元，按钱算也不是它最大。', fx: [{ type: 'pulse', obj: 'e3', color: C.ok, at: 200 }] },
      { say: '两边对不上。研发集中在只占约 5% 就业的职业上。就业大户反而很少有基准。', set: { hl: fade(0), say: pop(300) }, fx: [{ type: 'pulse', obj: 'b6', color: C.bad, at: 300 }] },
      { say: '讲义把这和"构念效度"放在一起讲。基准分数能不能支撑关于真实工作能力的结论？很多基准既没测重要的东西，也没定义清楚要测什么。', fx: [{ type: 'shake', obj: 'say', at: 200 }] }
    ]
  };

  /* ---------------- 场景 2：自动部署环境的漏斗 ---------------- */
  var FUN = [['894', '个职业（O*NET）', 'neutral'], ['~16,600', '个软件，~1,400 类', 'data'], ['~3,400', '个可选', 'info'], ['~500', '个入选（22 个职业大类）', 'warn'], ['200', '个建成环境', 'ok']];
  var FILT = ['按 GDP 映射 + LLM 和网页搜索发现', '清洗：免费、有图形界面、能自托管、不要专门硬件', '分 5 档挑选', '按算力预算构建'];
  var sc2 = {
    name: '自动搭环境', desc: '要评测"人的工作"，先要有那些工作用的软件环境。Gym-Anything 按 GDP 从职业数据库出发挑软件。编程智能体自动下载安装，最后建成 200 个环境（讲义第 28 页）。',
    dataTitle: '漏斗（讲义第 28 页）', data: { '这一层': 0 }, dataFmt: { '这一层': function (v) { return Math.round(v).toLocaleString(); } },
    bg: function (d) { title(d, '从职业到可用的软件环境'); },
    objects: function () {
      var o = {};
      FUN.forEach(function (f, i) {
        var y = 90 + i * 95, w = 640 - i * 110;
        o['f' + i] = { type: 'box', x: 430, y: y, w: w, h: 50, rx: 10, fill: C[f[2] + 'W'], stroke: C[f[2]], sw: 1.5, text: f[0] + ' ' + f[1], size: 13.5, weight: 800, mono: false, opacity: 0 };
        if (i) { o['w' + i] = wire('M430,' + (y - 70) + ' L430,' + (y - 28), C.fg3); o['t' + i] = { type: 'text', x: 760, y: y - 48, text: FILT[i - 1], size: 11, weight: 700, color: C.fg2, anchor: 'end', opacity: 0 }; }
      });
      return o;
    },
    steps: [
      { say: 'O*NET 数据库里有 894 个职业。', set: { f0: pop(0) }, data: { '这一层': { v: 894, at: 200 } } },
      { say: '按各职业对 GDP 的贡献映射。再用 LLM 和网页搜索，找出它们用的软件。约 16,600 个，约 1,400 类。', set: join(on('w1'), { t1: fade(0), f1: pop(300) }), fx: [st('w1', 0, C.data, 4)], data: { '这一层': { v: 16600, at: 500 } } },
      { say: '清洗：只留免费、有图形界面、能自托管、能进沙箱的。还要不需要专门硬件。剩约 3,400 个。', set: join(on('w2'), { t2: fade(0), f2: pop(300) }), fx: [st('w2', 0, C.info, 4)], data: { '这一层': { v: 3400, at: 500 } } },
      { say: '分 5 档挑选，约 500 个入选，覆盖 22 个职业大类。', set: join(on('w3'), { t3: fade(0), f3: pop(300) }), fx: [st('w3', 0, C.warn, 4)], data: { '这一层': { v: 500, at: 500 } } },
      { say: '按算力预算，让编程智能体自动下载、安装、配置，建成 200 个环境。', set: join(on('w4'), { t4: fade(0), f4: pop(300) }), fx: [st('w4', 0, C.ok, 4), { type: 'burst', obj: 'f4', color: C.ok, at: 900 }], data: { '这一层': { v: 200, at: 500 } } },
      { say: '另一种是手工部署，用开源替代品搭可复现的环境（讲义第 27 页）。比如用 Rocket.Chat 代替 Slack，自托管 GitLab 代替 GitHub。难点是很多工作用闭源软件，替代品界面和功能都不一样（讲义第 31 页）。', fx: [{ type: 'pulse', obj: 'f2', color: C.info, at: 200 }] },
      { say: '环境建好还要灌数据（讲义第 29 页）。可以抓真实数据。也可以为每个软件先造 5 个种子任务。再用 LLM 放大约 75 倍，执行过滤。真实、多样、有难度，三者都要。', fx: [{ type: 'pulse', obj: 'f4', color: C.ok, at: 200 }] }
    ]
  };

  /* ---------------- 场景 3：评测光谱与 rubric ---------------- */
  var EQ = VZ.eq('r', [{ slot: 1, w: 40 }, '+', { slot: 1, w: 40 }, '+', { slot: 1, w: 40 }, '+', { slot: 1, w: 40 }, '=', { num: 0, fmt: 'int', k: 'ok', w: 64 }], 430, 455, { size: 15 });
  var PART = [['正确性', 40], ['完整性', 20], ['任务要求', 25], ['技术质量', 15]];
  var sc3 = {
    name: '评测光谱', desc: '人的工作从"能执行验证"到"只能凭判断"排成一条光谱。大部分在中间和模糊一侧，要靠 rubric 和 LLM 评审（讲义第 34–39 页）。',
    dataTitle: 'LLM 生成 rubric 的配分（讲义第 39 页）', data: { '总分': 0 },
    bg: function (d) { title(d, '可验证 ← 光谱 → 模糊'); },
    objects: function () {
      var o = {};
      o.bar = { type: 'box', x: 80, y: 110, w: 0, h: 14, rx: 7, anchor: 'l', fill: C.warn, stroke: 'none', opacity: 0 };
      [['修 GitHub issue', 140, 'ok'], ['数据清洗和分析', 430, 'warn'], ['室内设计', 720, 'info']].forEach(function (p, i) { o['p' + i] = cell(p[1], 160, p[0], p[2], 170, 36, 12.5, false); });
      o.most = { type: 'box', x: 575, y: 215, w: 360, h: 30, rx: 6, fill: 'none', stroke: C.fg3, sw: 1.2, dasharray: '5 4', text: '大部分人的工作', size: 12, weight: 750, opacity: 0 };
      o.ex = cell(140, 290, '执行验证：跑测试 / 形式化证明', 'ok', 250, 40, 12, false);
      o.rb = cell(575, 290, '专家或 LLM 写 rubric + LLM 评审', 'warn', 330, 40, 12, false);
      o.rule = { type: 'text', x: 140, y: 335, text: '开放任务里只能做规则检查', size: 11, weight: 700, color: C.bad, anchor: 'middle', opacity: 0 };
      PART.forEach(function (p, i) { o['c' + i] = cell(160 + i * 180, 390, p[0] + ' ' + p[1], 'neutral', 150, 32, 12); o['f' + i] = cell(160 + i * 180, 390, String(p[1]), 'warn', 40, 26, 12); });
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      o.bias = { type: 'box', x: 430, y: 525, w: 720, h: 34, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.2, text: 'LLM 评审能扩展但有偏差（更容易高估自家模型）。rubric 因模型和用户而异。基准会饱和、被污染', size: 11.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '人的工作排成一条光谱：一头能执行验证，另一头只能凭判断。', set: { bar: grow(700, 0, 900) } },
      { say: '修 GitHub issue 在可验证一端。数据清洗和分析在中间，室内设计在模糊一端。', set: { p0: pop(0), p1: pop(200), p2: pop(400) } },
      { say: '大部分人的工作落在中间和模糊这一侧。', set: { most: fade(0) } },
      { say: '可验证的任务可以跑测试，甚至写形式化证明。开放任务里，执行脚本只能做规则检查。比如查幻灯片里有没有某个词。', set: { ex: pop(0), rule: fade(400) } },
      { say: '模糊一侧靠打分细则（rubric）。由专家写，或者让 LLM 生成再人工核验。然后让 LLM 当评审打分。', set: { rb: pop(0) }, fx: [{ type: 'pulse', obj: 'most', color: C.warn, at: 300 }] },
      (function () { var s = VZ.show(EQ, 0, 40); PART.forEach(function (p, i) { s['c' + i] = pop(i * 120); }); return { say: '讲义上让 LLM 生成 rubric 的提示规定了四类配分：', set: s }; })(),
      (function () { var s = {}; PART.forEach(function (p, i) { var sl = 'r' + (i * 2); s['f' + i] = { opacity: { from: 1, to: 0, dur: 150, delay: 1100 + i * 120 }, x: { from: 160 + i * 180, to: EQ.xs[i * 2], dur: 800, delay: 200 + i * 120, ease: 'inOut' }, y: { from: 390, to: 455, dur: 800, delay: 200 + i * 120, ease: 'inOut' } }; s[sl] = { text: { to: String(p[1]), delay: 1100 + i * 120 } }; }); s.r8 = { num: { to: 100, dur: 700, delay: 1400 } };
        return { say: '正确性 40 + 完整性 20 + 任务要求 25 + 技术质量 15 = 100 分。', set: s, fx: [{ type: 'burst', obj: 'r8', color: C.ok, at: 2000 }], data: { '总分': { v: 100, at: 1600 } } }; })(),
      { say: '但这条路也有坑。评审有偏差，rubric 很难写完美，静态基准还会饱和和被污染。', set: { bias: pop(0) } }
    ]
  };

  /* ---------------- 场景 4：人机协作的五个级别 ---------------- */
  var LV = [['H1', 'AI 独立完成', '人不参与'], ['H2', 'AI 主导', '几个关键点要人给意见'], ['H3', '平等搭档', '一起比各自都好'], ['H4', '人主导', 'AI 要人的投入才能完成'], ['H5', '完全靠人', 'AI 只是辅助']];
  var sc4 = {
    name: '协作的五个级别', desc: '从"智能体独立完成"到"完全靠人"，人和智能体的协作分五级。前两级是自动化，后三级是增强。工人在 46% 的职业任务上想要自动化（讲义第 47、57 页）。',
    dataTitle: '讲义第 57 页', data: { '想自动化的任务比例': 0 }, dataFmt: { '想自动化的任务比例': 'pct' },
    bg: function (d) { title(d, 'Human Agency Scale：人要参与多少'); },
    objects: function () {
      var o = {};
      LV.forEach(function (l, i) {
        var x = 110 + i * 160;
        o['l' + i] = { type: 'box', x: x, y: 170, w: 146, h: 110, rx: 10, fill: C[i < 2 ? 'dataW' : 'okW'], stroke: C[i < 2 ? 'data' : 'ok'], sw: 1.4, text: l[0] + ' · ' + l[1], sub: l[2], subMono: false, subSize: 10.5, size: 12.5, weight: 800, opacity: 0 };
      });
      o.au = { type: 'box', x: 190, y: 290 + 20, w: 306, h: 36, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.2, text: '自动化：AI 替代人的能力', size: 12, weight: 750, opacity: 0 };
      o.ag = { type: 'box', x: 590, y: 310, w: 466, h: 36, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '增强：AI 加强人的能力', size: 12, weight: 750, opacity: 0 };
      o.arrow = wire('M100,90 L760,90', C.fg3);
      o.at = { type: 'text', x: 430, y: 72, text: '人的参与越来越多 →', size: 11.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.des = { type: 'box', x: 430, y: 420, w: 520, h: 50, rx: 10, fill: C.warnW, stroke: C.warn, sw: 1.4, text: '', num: 0, fmt: 'pct', pre: '工人想自动化的职业任务：', size: 14, weight: 800, mono: false, opacity: 0 };
      o.zone = { type: 'box', x: 430, y: 500, w: 680, h: 36, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '不少任务"很想自动化、但 AI 发展有限"，讲义叫它研发机会区', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = join(on('arrow'), { at: fade(0) }); LV.forEach(function (l, i) { s['l' + i] = pop(200 + i * 150); }); return { say: '按人要参与多少，把人和智能体的协作分成五级：H1 到 H5。', set: s }; })(),
      { say: 'H1 智能体独立完成，人不参与。H2 主要靠智能体，但几个关键点要人给意见。这两级算自动化。', set: { au: pop(0) }, fx: [{ type: 'pulse', obj: 'l0', color: C.data, at: 200 }, { type: 'pulse', obj: 'l1', color: C.data, at: 400 }] },
      { say: 'H3 平等搭档，一起做得比各自都好。H4、H5 以人为主，智能体给不同程度的帮助。这三级算增强。', set: { ag: pop(0) }, fx: [{ type: 'pulse', obj: 'l2', color: C.ok, at: 200 }, { type: 'pulse', obj: 'l3', color: C.ok, at: 400 }, { type: 'pulse', obj: 'l4', color: C.ok, at: 600 }] },
      { say: '工人自己想不想自动化？调查里，他们在 46% 的职业任务上表达了自动化的意愿。', set: { des: mix(pop(0), { num: { to: 46, dur: 800, delay: 200 } }) }, data: { '想自动化的任务比例': { v: 46, at: 600 } } },
      { say: '再和专家评估的"AI 能不能做"对照。有不少任务工人很想自动化，AI 却还做不好。这是研发的机会，自动化不只是替代。', set: { zone: pop(0) } },
      { say: '用户的介入方式也不同（讲义第 49 页）。接管型很少介入，一介入就做到底。动手型频繁介入，放手型从不介入。协作型少量介入，很快交还控制。', fx: [{ type: 'pulse', obj: 'l2', color: C.ok, at: 200 }, { type: 'pulse', obj: 'l3', color: C.ok, at: 500 }] },
      { say: '所以评测智能体，不只看它能不能独立完成。还要看它能不能让人中途接管、纠偏。也要看它能不能适应不同用户的介入方式（讲义第 48–49 页）。', fx: [{ type: 'pulse', obj: 'l2', color: C.ok, at: 200 }] }
    ]
  };

  VZ.register({
    id: 'c10-work', title: '智能体与人的工作：基准错位、自动搭环境、评测光谱与协作级别',
    sources: [{ t: '第 17 讲讲义（Zora Wang）', u: PDF }],
    note: '数字全部照讲义。第 8 / 25 页是基准投入与就业（挑了 8 类），第 28 页是漏斗。第 39 页是 rubric 的 40 / 20 / 25 / 15。第 47 页是五个级别，第 57 页是 46%。这一讲没有录像，说明依据讲义。讲义上标的论文出处，按本站规则不搬。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

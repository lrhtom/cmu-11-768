/* 07 · 第 13 讲 —— 安全评测的几个比率，以及"告警里有多少是真的"
 * 场景 1：讲义第 39 页的示意计数（100 次正常任务运行、100 次安全测试运行）；
 * 场景 2：讲义第 42 页的示意（10,000 个决定、1% 不安全、抓住 90%、安全决定里 1% 被误标 → 189 条告警、精度 90/189）；
 * 场景 3：补充（课上没讲）：召回和误报率不变、只改不安全比例时的精度。
 * 所有数都由 本机验算脚本 的 E 段实跑：0.4762；10% → 990 条 / 0.9091，0.1% → 109 条 / 0.0826；
 * 15 = 25 − 10，75 = 100 − 25，10 = 100 − 80 − 10。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = { t: '讲义 lecture-13 第 39、42 页', u: 'https://www.cmu-agents.com/slides/lecture-13-agent-safety.pdf' };
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function nbox(x, y, w, h, num, pre, k, op, fmt) {
    var f = PAL[k];
    return { type: 'box', x: x, y: y, w: w, h: h, rx: 9, fill: f[0], stroke: f[1], sw: 1.6, num: num, fmt: fmt || 'comma', pre: pre, size: 13, weight: 700, opacity: op == null ? 0 : op };
  }
  function path(d, col) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, opacity: 0, arrow: col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : col === C.neutral ? 'neutral' : 'data' }; }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function flyer(x, y, t, k) { var f = PAL[k || 'data']; return { type: 'box', x: x, y: y, w: 46, h: 26, rx: 6, fill: f[0], stroke: f[1], sw: 1.4, text: t, mono: true, size: 13, weight: 700, opacity: 0, trail: { n: 4, gap: 40 } }; }

  /* ---------------- 场景 1：四个比率 ---------------- */
  var GX = [90, 500], GY = 150, GS = 20;      /* 两个 10×10 点阵的左上角，点间距 20 */
  function dot(g, i) { return { x: GX[g] + (i % 10) * GS, y: GY + Math.floor(i / 10) * GS }; }
  function rowEq(pre, name, k, y) {
    return VZ.eq(pre, [{ t: name, k: k, mono: false, w: 110, size: 12.5 }, '=', { slot: 1, w: 50 }, '÷', { slot: 1, w: 50 }, '=', { num: 0, fmt: 'pct', k: k, w: 64 }], 430, y, { size: 13, h: 28 });
  }
  var EA = rowEq('ea', '任务完成率', 'ok', 384), EB = rowEq('eb', '不必要的拒绝率', 'warn', 422),
    EC = rowEq('ec', '不安全尝试率', 'warn', 460), ED = rowEq('ed', '造成伤害率', 'bad', 498);
  function paint(g, from, to, col, d0) {
    var s = {}; for (var i = from; i < to; i++) s[(g ? 'R' : 'L') + i] = { fill: { to: col, dur: 260, delay: (d0 || 0) + (i - from) * 9 } }; return s;
  }
  function solve(eq, fa, fb, numV, d0) {
    var s = VZ.show(eq, d0 || 0, 50);
    s[fa] = VZ.fly(eq.xs[2], eq.objs[Object.keys(eq.objs)[2]].y, (d0 || 0) + 400, 800);
    s[fb] = VZ.fly(eq.xs[4], eq.objs[Object.keys(eq.objs)[4]].y, (d0 || 0) + 700, 800);
    var last = Object.keys(eq.objs)[6];
    var add = {}; add[last] = { num: { to: numV, dur: 700, delay: (d0 || 0) + 1600 } };
    return join(s, add);
  }
  var sc1 = {
    name: '四个比率', desc: '讲义第 39 页：正常任务和安全测试分开数，各有两个比率。"尝试"和"造成伤害"也要分开。',
    dataTitle: '计数（讲义的示意数）', data: { '完成': 0, '拒绝': 0, '尝试': 0, '伤害': 0 },
    bg: function (d) {
      title(d, '安全评测的四个比率：分母不一样');
      d.text(GX[0] + 90, 132, '100 次正常任务运行', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.text(GX[1] + 90, 132, '100 次安全测试运行', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      for (var i = 0; i < 100; i++) {
        var a = dot(0, i), b = dot(1, i);
        o['L' + i] = { type: 'circle', x: a.x, y: a.y, r: 7, fill: C.neutralW, stroke: C.line, sw: 1, opacity: 0 };
        o['R' + i] = { type: 'circle', x: b.x, y: b.y, r: 7, fill: C.neutralW, stroke: C.line, sw: 1, opacity: 0 };
      }
      [EA, EB, EC, ED].forEach(function (e) { for (var k in e.objs) o[k] = e.objs[k]; });
      o.fa1 = flyer(180, 340, '80', 'ok'); o.fb1 = flyer(180, 132, '100');
      o.fa2 = flyer(180, 340, '10', 'warn'); o.fb2 = flyer(180, 132, '100');
      o.fa3 = flyer(590, 340, '25', 'warn'); o.fb3 = flyer(590, 132, '100');
      o.fa4 = flyer(590, 340, '10', 'bad'); o.fb4 = flyer(590, 132, '100');
      o.note = { type: 'text', x: 590, y: 354, text: '', size: 12, weight: 700, color: C.warn, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '讲义第 39 页的示意：100 次正常任务运行、100 次安全测试运行。两组分开数。',
        set: (function () { var s = {}; for (var i = 0; i < 100; i++) { s['L' + i] = fade(i * 6, 200); s['R' + i] = fade(300 + i * 6, 200); } return s; })() },
      { say: '任务完成率：完成的正常任务 ÷ 所有正常任务运行 = 80 ÷ 100 = 80%。',
        set: join(paint(0, 0, 80, C.ok), solve(EA, 'fa1', 'fb1', 80, 300)), data: { '完成': { v: 80, at: 700 } } },
      { say: '不必要的拒绝率：被拒绝的正常任务 ÷ 正常任务运行数 = 10 ÷ 100 = 10%。剩下 10 次既没完成也没拒绝。',
        set: join(paint(0, 80, 90, C.warn), solve(EB, 'fa2', 'fb2', 10, 200)), data: { '拒绝': { v: 10, at: 400 } } },
      { say: '换一组分母。不安全尝试率 = 有不安全尝试的运行 ÷ 安全测试运行数。这里是 25 ÷ 100 = 25%。',
        set: join(paint(1, 0, 25, C.warn), solve(EC, 'fa3', 'fb3', 25, 300)), data: { '尝试': { v: 25, at: 500 } } },
      { say: '造成伤害率 = 真的造成有害后果的运行 ÷ 安全测试运行数。这里是 10 ÷ 100 = 10%。',
        set: join(paint(1, 0, 10, C.bad), solve(ED, 'fa4', 'fb4', 10, 300)), data: { '伤害': { v: 10, at: 400 } } },
      { say: '讲义：被拦下的尝试会拉高尝试率，却不造成伤害。这里 25 − 10 = 15 次尝试没得逞（假设造成伤害的运行都算有尝试）。',
        set: { note: mix(fade(200), { text: { to: '15 次尝试没造成伤害', delay: 0 } }) },
        fx: (function () { var f = []; for (var i = 10; i < 25; i++) { var p = dot(1, i); f.push({ type: 'ripple', x: p.x, y: p.y, r: 14, color: C.warn, at: (i - 10) * 40 }); } return f; })() }
    ]
  };

  /* ---------------- 场景 2：告警精度（手推） ---------------- */
  var EQ2 = VZ.eq('pz', [{ t: '告警精度', k: 'info', mono: false, w: 86 }, '=', { slot: 1, w: 50 }, '÷', '(', { slot: 1, w: 50 }, '+', { slot: 1, w: 50 }, ')', '=', { num: 0, fmt: 'fixed4', k: 'ok', w: 86 }], 430, 500, { size: 14, h: 30 });
  var AU = 2;                               /* 告警条：每条告警 2px */
  var sc2 = {
    name: '告警精度', desc: '讲义第 42 页：不安全的决定只占 1%，检查器抓住其中 90%。安全的决定里 1% 被误标。189 条告警里，真的只有 90 条。',
    dataTitle: '10,000 个决定', data: { '不安全': 0, '抓住': 0, '误报': 0, '告警': 0, '精度': 0 }, dataFmt: { '精度': 'fixed4' },
    dataMeter: { '精度': [0, 1, C.ok] },
    bg: function (d) { title(d, '为什么大多数告警是误报：一步步算'); },
    objects: function () {
      var o = {};
      o.p1 = path('M400,132 L250,180', C.bad); o.p2 = path('M460,132 L610,180', C.data);
      o.p3 = path('M210,222 L170,262', C.bad); o.p4 = path('M260,222 L310,262', C.neutral);
      o.p5 = path('M590,222 L550,262', C.warn); o.p6 = path('M640,222 L700,262', C.neutral);
      o.p7 = path('M170,312 L300,372', C.bad); o.p8 = path('M550,312 L480,372', C.warn);
      o.tot = nbox(430, 110, 200, 40, 0, '决定 ', 'info');
      o.uns = nbox(230, 200, 160, 40, 0, '不安全 ', 'bad');
      o.saf = nbox(630, 200, 160, 40, 0, '安全 ', 'data');
      o.cau = nbox(160, 290, 120, 40, 0, '抓住 ', 'bad');
      o.mis = nbox(310, 290, 120, 40, 0, '漏掉 ', 'neutral');
      o.fal = nbox(550, 290, 130, 40, 0, '误报 ', 'warn');
      o.cln = nbox(720, 290, 160, 40, 0, '没标记 ', 'neutral');
      o.barA = { type: 'box', x: 240, y: 394, w: 0, h: 30, rx: 3, anchor: 'l', fill: C.bad, stroke: 'none', text: '', opacity: 0.85 };
      o.barB = { type: 'box', x: 240 + 90 * AU, y: 394, w: 0, h: 30, rx: 3, anchor: 'l', fill: C.warn, stroke: 'none', text: '', opacity: 0.85 };
      o.barT = { type: 'text', x: 240 + 189 * AU + 12, y: 394, text: '要人看的告警 189 条', size: 12.5, weight: 700, color: C.fg, anchor: 'start', opacity: 0 };
      o.barL = { type: 'text', x: 230, y: 394, text: '', size: 12, weight: 700, color: C.fg2, anchor: 'end', opacity: 0 };
      for (var k in EQ2.objs) o[k] = EQ2.objs[k];
      o.f1 = flyer(285, 394, '90', 'bad'); o.f2 = flyer(285, 394, '90', 'bad'); o.f3 = flyer(470, 394, '99', 'warn');
      o.res = { type: 'text', x: 430, y: 540, text: '约 48%：告警里一半多是误报', size: 12.5, weight: 700, color: C.ok, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '讲义第 42 页的示意：一共 10,000 个决定。',
        set: { tot: mix(pop(0), { num: { to: 10000, dur: 800, delay: 200 } }) } },
      { say: '其中 1% 不安全：10,000 × 1% = 100 个。剩下 9,900 个是安全的。',
        set: join(on('p1'), on('p2'), { uns: mix(pop(300), { num: { to: 100, dur: 700, delay: 500 } }), saf: mix(pop(400), { num: { to: 9900, dur: 800, delay: 600 } }) }),
        fx: [st('p1', 0, C.bad), st('p2', 0, C.data)], data: { '不安全': { v: 100, at: 500 } } },
      { say: '检查器能抓住 90% 的不安全动作：100 × 90% = 90 个。漏掉 10 个。',
        set: join(on('p3'), on('p4'), { cau: mix(pop(300), { num: { to: 90, dur: 700, delay: 500 } }), mis: mix(pop(400), { num: { to: 10, dur: 600, delay: 600 } }) }),
        fx: [st('p3', 0, C.bad), st('p4', 0, C.neutral)], data: { '抓住': { v: 90, at: 500 } } },
      { say: '但它也会把 1% 的安全决定标成可疑：9,900 × 1% = 99 个误报。9,801 个没被标记。',
        set: join(on('p5'), on('p6'), { fal: mix(pop(300), { num: { to: 99, dur: 700, delay: 500 } }), cln: mix(pop(400), { num: { to: 9801, dur: 800, delay: 600 } }) }),
        fx: [st('p5', 0, C.warn), st('p6', 0, C.neutral)], data: { '误报': { v: 99, at: 500 } } },
      { say: '要人看的告警 = 抓住的 90 + 误报的 99 = 189 条。红色是真的，橙色是误报。',
        set: join(on('p7'), on('p8'), { barA: { w: { to: 90 * AU, dur: 800, delay: 300, ease: 'out' } }, barB: { w: { to: 99 * AU, dur: 800, delay: 900, ease: 'out' } }, barT: fade(1500), barL: mix(fade(300), { text: { to: '告警', delay: 0 } }) }),
        fx: [st('p7', 0, C.bad), st('p8', 400, C.warn)], data: { '告警': { v: 189, at: 1500 } } },
      { say: '告警里真正有问题的比例：分子是抓住的 90 条。',
        set: join(VZ.show(EQ2, 0, 50), { f1: VZ.fly(EQ2.xs[2], 500, 600, 900) }) },
      { say: '分母是所有告警：90 条真的加 99 条误报。',
        set: { f2: VZ.fly(EQ2.xs[5], 500, 0, 900), f3: VZ.fly(EQ2.xs[7], 500, 300, 900) } },
      { say: '90 ÷ 189 = 0.4762，约 48%。不安全动作很少见时，检查器抓得再准，大部分告警也是误报。',
        set: { pz10: { num: { to: 0.4762, dur: 900, delay: 100 } }, res: fade(1000) },
        fx: [{ type: 'pulse', obj: 'pz10', color: C.ok, at: 1000 }], data: { '精度': { v: 0.4762, at: 100 } } }
    ]
  };

  /* ---------------- 场景 3：换一换不安全比例（补充） ---------------- */
  var RS = [[0.10, '10%', 900, 90, 990, 0.9091], [0.01, '1%', 90, 99, 189, 0.4762], [0.001, '0.1%', 9, 100, 109, 0.0826]];
  var BX0 = 200, BU = 0.4, RY3 = [150, 240, 330];  /* 告警条：每条告警 0.4px */
  var EQ3 = VZ.eq('pw', [{ t: '精度', k: 'info', mono: false, w: 56 }, '=', { t: '0.9p', k: 'bad', w: 56 }, '÷', '(', { t: '0.9p', k: 'bad', w: 56 }, '+', { t: '0.01(1−p)', k: 'warn', w: 96 }, ')'], 430, 430, { size: 14, h: 30 });
  var sc3 = {
    name: '比例变化', desc: '补充（课上没讲，本机算过）：召回 90%、误报率 1% 都不变。只改不安全动作占的比例，告警的可信度变化很大。',
    dataTitle: '精度', data: { '10%': 0, '1%': 0, '0.1%': 0 }, dataFmt: { '10%': 'fixed4', '1%': 'fixed4', '0.1%': 'fixed4' },
    bg: function (d) {
      title(d, '补充：同一个检查器，攻击越少，告警越不可信');
      RS.forEach(function (r, i) { d.text(BX0 - 14, RY3[i], '不安全 ' + r[1], { anchor: 'end', size: 12.5, weight: 700, color: C.fg2 }); });
      d.text(785, 112, '精度', { anchor: 'middle', size: 12.5, weight: 700, color: C.ok });
      d.text(BX0, 380, '每行是一万个决定里要人看的告警：红 = 真的，橙 = 误报（长度按条数）', { anchor: 'start', size: 12, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      RS.forEach(function (r, i) {
        o['a' + i] = { type: 'box', x: BX0, y: RY3[i], w: 0, h: 30, rx: 3, anchor: 'l', fill: C.bad, stroke: 'none', text: '', opacity: 0.85 };
        o['b' + i] = { type: 'box', x: BX0 + r[2] * BU, y: RY3[i], w: 0, h: 30, rx: 3, anchor: 'l', fill: C.warn, stroke: 'none', text: '', opacity: 0.85 };
        o['t' + i] = { type: 'text', x: BX0 + r[4] * BU + 12, y: RY3[i], text: r[2] + ' + ' + r[3] + ' = ' + r[4] + ' 条', size: 12, mono: true, weight: 700, color: C.fg2, anchor: 'start', opacity: 0 };
        o['v' + i] = { type: 'box', x: 785, y: RY3[i], w: 80, h: 30, rx: 7, fill: C.okW, stroke: C.ok, sw: 1.4, num: 0, fmt: 'fixed4', size: 13, weight: 700, opacity: 0 };
      });
      for (var k in EQ3.objs) o[k] = EQ3.objs[k];
      o.pin = { type: 'text', x: 430, y: 480, text: 'p = 不安全的比例，0.9 = 召回，0.01 = 误报率', size: 12, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '补充（课上没讲）：保持"抓住 90%、安全决定里误标 1%"不变。只改不安全动作所占的比例。每个比例都按一万个决定算。',
        set: join(VZ.show(EQ3, 0, 60), { pin: fade(700) }) },
      { say: '不安全占 10%：抓住 900 条、误报 90 条，一共 990 条告警，精度 0.9091。',
        set: { a0: { w: { to: 900 * BU, dur: 900, ease: 'out' } }, b0: { w: { to: 90 * BU, dur: 500, delay: 900, ease: 'out' } }, t0: fade(1300), v0: mix(pop(1300), { num: { to: 0.9091, dur: 700, delay: 1400 } }) },
        data: { '10%': { v: 0.9091, at: 1400 } } },
      { say: '不安全占 1%（讲义的例子）：90 + 99 = 189 条，精度 0.4762。',
        set: { a1: { w: { to: 90 * BU, dur: 700, ease: 'out' } }, b1: { w: { to: 99 * BU, dur: 700, delay: 700, ease: 'out' } }, t1: fade(1300), v1: mix(pop(1300), { num: { to: 0.4762, dur: 700, delay: 1400 } }) },
        data: { '1%': { v: 0.4762, at: 1400 } } },
      { say: '不安全只占 0.1%：真的只有 9 条，误报却有 100 条，精度只有 0.0826。大约 12 条告警里才有 1 条是真的。',
        set: { a2: { w: { to: 9 * BU, dur: 500, ease: 'out' } }, b2: { w: { to: 100 * BU, dur: 700, delay: 500, ease: 'out' } }, t2: fade(1100), v2: mix(pop(1100), { num: { to: 0.0826, dur: 700, delay: 1200 } }) },
        fx: [{ type: 'pulse', obj: 'v2', color: C.bad, at: 1900 }], data: { '0.1%': { v: 0.0826, at: 1200 } } },
      { say: '公式里的分子随 p 线性变小，误报那一项却几乎不变。这就是比例越小、精度越差的原因。',
        fx: [{ type: 'pulse', obj: 'pw2', color: C.bad, at: 0 }, { type: 'pulse', obj: 'pw7', color: C.warn, at: 400 }] },
      { say: '所以讲义要求，在同样的任务、同样的模型上比较防线。正常请求和攻击都要有。比例不接近真实时，准确率会骗人。',
        fx: [{ type: 'pulse', obj: 'v0', color: C.ok, at: 0 }, { type: 'pulse', obj: 'v1', color: C.ok, at: 200 }, { type: 'pulse', obj: 'v2', color: C.bad, at: 400 }] }
    ]
  };

  VZ.register({
    id: 'c7-alert', title: '安全评测的比率与告警精度：手推一遍',
    sources: [PDF],
    note: '四个比率和 80/10/25/10 出自讲义第 39 页（讲义自己标明是示意数）。10,000 个决定、1% 不安全、抓住 90%、安全决定里 1% 被标记、189 条告警、48% 出自第 42 页（同样是示意）。"15 次尝试没造成伤害"假设造成伤害的运行都算有尝试。场景 3 是补充，课上没讲。所有算术都是本机实跑的：90/189 = 0.4762。不安全占 10% 时 990 条、0.9091，占 0.1% 时 109 条、0.0826。',
    legend: [[C.ok, '完成 / 精度'], [C.warn, '拒绝 / 尝试 / 误报'], [C.bad, '不安全 / 伤害'], [C.data, '安全的决定'], [C.info, '公式'], [C.neutral, '其余']],
    scenes: [sc1, sc2, sc3]
  });
})();

/* 03 · 第 5 讲 —— 长程任务：单步准确率怎么连乘、可完成长度怎么算、自我条件化、Vending-Bench、递归委派（RAO）
 * 场景 1、2：p^n 和 H = ln0.5 / ln p 的每个数都是 本机验算脚本 第 2 部分实算；"0.9 × 0.9 × …"出自视频 56:55–58:19；
 * 场景 3：讲义第 29–30 页的例子和结论，曲线形状是示意；场景 4：讲义第 28 页；
 * 场景 5：讲义第 31 页 + 视频 1:00:27–1:03:20，京都例子出自视频，孙结点和代码是示意；深度分布是从图上读的约数，平均深度是 verify.py 第 6 部分实算。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var PDF = 'https://www.cmu-agents.com/slides/lecture-05-planning.pdf', YT = 'https://youtu.be/S8v-dR4s29M?t=';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  var PAL = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], warn: [C.warnW, C.warn], bad: [C.badW, C.bad], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op, size) {
    var f = PAL[k];
    var o = { type: 'box', x: x, y: y, w: w, h: h, rx: 8, fill: f[0], stroke: f[1], sw: 1.6, text: t, size: size || 12.5, weight: 700, opacity: op == null ? 0 : op };
    if (sub) { o.sub = sub; o.subMono = false; o.subSize = 11.5; }
    return o;
  }
  function label(x, y, t, col, anchor, size) { return { type: 'text', x: x, y: y, text: t, size: size || 12, weight: 700, color: col || C.fg2, anchor: anchor || 'middle', opacity: 0 }; }
  var AR = {}; AR[C.ok] = 'ok'; AR[C.info] = 'info'; AR[C.warn] = 'warn'; AR[C.bad] = 'bad'; AR[C.data] = 'data'; AR[C.neutral] = 'neutral';
  function path(d, col, extra) { return mix({ type: 'path', d: d, stroke: col, sw: 1.8, flow: 0, opacity: 0, arrow: AR[col] || 'data' }, extra || {}); }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n, rev) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col || C.data, reverse: !!rev }; }
  function flyTo(name, x0, y0, x1, y1, delay) { var s = {}; s[name] = { opacity: { from: 1, to: 0, dur: 200, delay: (delay || 0) + 850 }, x: { from: x0, to: x1, dur: 800, delay: delay || 0, ease: 'inOut' }, y: { from: y0, to: y1, dur: 800, delay: delay || 0, ease: 'inOut' } }; return s; }
  function ghost(t, w, k) { var f = PAL[k || 'data']; return { type: 'box', x: 0, y: 0, w: w, h: 28, rx: 6, fill: f[0], stroke: f[1], sw: 1.4, text: t, size: 13, weight: 700, mono: true, opacity: 0, trail: { n: 4, gap: 40 } }; }

  var CODE12 = { lang: 'py', title: '本机实跑的代码（节选）', src:
'for p in [0.9, 0.95, 0.99, 0.999]:\n' +
'    row = [f"p^{n}={p ** n:.4f}"\n' +
'           for n in (10, 50, 100)]\n' +
'    h50 = math.log(0.5) / math.log(p)\n' +
'    print(f"p={p}: ", "  ".join(row),\n' +
'          f"... H=ln0.5/ln p={h50:.2f}")\n' +
'cum = [round(.9**k, 4) for k in range(1, 11)]\n' +
'print("0.9 的累乘 k=1..10:", cum)\n' };

  /* ---------------- 场景 1：p^n ---------------- */
  var CUM9 = [0.9, 0.81, 0.729, 0.6561, 0.5905, 0.5314, 0.4783, 0.4305, 0.3874, 0.3487];
  var CUM99 = [0.99, 0.9801, 0.9703, 0.9606, 0.951, 0.9415, 0.9321, 0.9227, 0.9135, 0.9044];
  function sx(i) { return 100 + i * 73; }
  var SY = 120;
  var EQ1 = VZ.eq('qa', ['P(10 步全对) =', { slot: 1, w: 70 }, '^', { slot: 1, w: 56 }, '=', { num: 0, fmt: 'fixed4', k: 'ok', w: 100 }], 430, 262, { size: 16 });
  var PX0 = 130, PW = 4.3, PY0 = 520, PH = 150;
  function curve(p) { var d = ''; for (var n = 0; n <= 100; n += 2) d += (n ? ' L' : 'M') + (PX0 + n * PW).toFixed(1) + ',' + (PY0 - Math.pow(p, n) * PH).toFixed(1); return d; }
  var sc1 = {
    name: 'p 的 n 次方', desc: '任务要连着做对 n 步，每步做对的概率是 p。全对的概率就是 p 连乘 n 次。90% 的步准确率，10 步全对只剩约 35%。',
    code: CODE12, dataTitle: '实算', data: { 'p': 0, 'n': 0, 'P(全对)': 0 }, dataFmt: { 'p': 'fixed2', 'P(全对)': 'fixed4' }, dataMeter: { 'P(全对)': [0, 1, C.ok] },
    bg: function (d) {
      title(d, '每步 90% 准，十步全对有多难');
      d.line(PX0, PY0, PX0 + 100 * PW, PY0, { stroke: C.fg3, sw: 1.2 }); d.line(PX0, PY0, PX0, PY0 - PH - 6, { stroke: C.fg3, sw: 1.2 });
      [0, 50, 100].forEach(function (n) { d.text(PX0 + n * PW, PY0 + 16, String(n), { anchor: 'middle', size: 11, mono: true, color: C.fg3 }); });
      [0, 0.5, 1].forEach(function (v) { d.text(PX0 - 8, PY0 - v * PH + 4, String(v), { anchor: 'end', size: 11, mono: true, color: C.fg3 }); });
      d.text(PX0 + 100 * PW + 12, PY0 + 4, '步数 n', { size: 11.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      o.chain = path('M50,' + SY + ' L810,' + SY, C.data, { arrow: 'data' });
      for (var i = 0; i < 10; i++) {
        o['s' + i] = node(sx(i), SY, 56, 36, '第' + (i + 1) + '步', null, 'neutral', 0, 12);
        o['c' + i] = { type: 'text', x: sx(i), y: SY + 40, text: '', num: 0, fmt: 'fixed4', size: 11.5, weight: 700, mono: true, color: C.ok, anchor: 'middle', opacity: 0 };
      }
      o.cumT = label(30, SY + 44, '累乘', C.fg3, 'start', 11.5);
      for (var k in EQ1.objs) o[k] = EQ1.objs[k];
      o.gp = ghost('0.9', 64); o.gn = ghost('10', 50, 'warn');
      o.nBox = node(800, 200, 60, 30, 'n = 10', null, 'warn', 0, 12); o.nBox.mono = true;
      o.cv9 = { type: 'path', d: curve(0.9), stroke: C.bad, sw: 2.2, dash: 0, opacity: 0 };
      o.cv99 = { type: 'path', d: curve(0.99), stroke: C.ok, sw: 2.2, dash: 0, opacity: 0 };
      o.l9 = label(PX0 + 100 * PW - 4, PY0 - 14, 'p = 0.9：0.9¹⁰⁰ ≈ 2.7×10⁻⁵', C.bad, 'end', 11.5);
      o.l99 = label(PX0 + 100 * PW + 6, PY0 - 0.366 * PH - 6, 'p = 0.99：0.366', C.ok, 'start', 11.5);
      o.pt9 = { type: 'circle', x: PX0 + 10 * PW, y: PY0 - 0.3487 * PH, r: 5, fill: C.bad, stroke: C.bad, opacity: 0 };
      o.pt99 = { type: 'circle', x: PX0 + 10 * PW, y: PY0 - 0.9044 * PH, r: 5, fill: C.ok, stroke: C.ok, opacity: 0 };
      o.pt9T = label(PX0 + 10 * PW + 10, PY0 - 0.3487 * PH + 4, '0.3487', C.bad, 'start', 11.5);
      o.pt99T = label(PX0 + 10 * PW + 10, PY0 - 0.9044 * PH + 4, '0.9044', C.ok, 'start', 11.5);
      return o;
    },
    steps: [
      { say: '一个任务要连着做对 10 步才算成功（示意）。', set: (function () { var s = on('chain'); for (var i = 0; i < 10; i++) s['s' + i] = pop(i * 70); return s; })(), data: { 'n': 10 } },
      { say: '假设每一步做对的概率都是 p = 0.9。课上举的就是"每步 90%"。',
        set: (function () { var s = {}; for (var i = 0; i < 10; i++) s['s' + i] = { text: { to: '0.9', delay: i * 80 }, fill: { to: C.dataW, dur: 300, delay: i * 80 }, stroke: { to: C.data, dur: 300, delay: i * 80 } }; return s; })(),
        fx: [st('chain', 0, C.data, 6)], data: { 'p': 0.9 } },
      { say: '全对要每一步都对：0.9 × 0.9 × 0.9 × …，一路乘下去，第 10 步只剩 0.3487。',
        set: (function () { var s = { cumT: fade(0) }; for (var i = 0; i < 10; i++) s['c' + i] = mix(fade(i * 160), { num: { to: CUM9[i], dur: 400, delay: i * 160 } }); return s; })(),
        fx: [st('chain', 0, C.ok, 10)], hl: [7, 8], log: [{ s: '0.9 的累乘 k=1..10: [0.9, 0.81, 0.729, 0.6561, 0.5905, 0.5314, 0.4783, 0.4305, 0.3874, 0.3487]', at: 1500 }],
        data: { 'P(全对)': { v: 0.3487, at: 1600 } } },
      { say: '写成公式就是 p 的 n 次方：把 p = 0.9、n = 10 填进去。',
        set: join(VZ.show(EQ1, 0, 70), { nBox: pop(200) }, flyTo('gp', sx(0), SY, EQ1.xs[1], 262, 600), flyTo('gn', 800, 200, EQ1.xs[3], 262, 800), { qa1: { text: { to: '0.9', delay: 1400 } }, qa3: { text: { to: '10', delay: 1600 } } }),
        fx: [{ type: 'ripple', x: EQ1.xs[1], y: 262, color: C.data, at: 1400 }, { type: 'ripple', x: EQ1.xs[3], y: 262, color: C.warn, at: 1600 }], hl: [2] },
      { say: '算出来 0.9¹⁰ = 0.3487：十步全对的机会只有三成多。',
        set: { qa5: { num: { to: 0.3487, dur: 900 } } }, fx: [{ type: 'burst', obj: 'qa5', color: C.ok, at: 900 }], hl: [5, 6],
        log: [{ s: 'p=0.9:  p^10=0.3487  p^50=0.0052  p^100=0.0000   50% 成功的长度 H=ln0.5/ln p=6.58', at: 600 }] },
      { say: '每步提到 0.99：一路乘下来是 0.9044。',
        set: (function () { var s = { qa1: { text: { to: '0.99', delay: 200 } }, qa5: { num: { to: 0.9044, dur: 900, delay: 1600 } } }; for (var i = 0; i < 10; i++) { s['s' + i] = { text: { to: '0.99', delay: i * 60 }, fill: { to: C.okW, dur: 300, delay: i * 60 }, stroke: { to: C.ok, dur: 300, delay: i * 60 } }; s['c' + i] = { num: { to: CUM99[i], dur: 400, delay: 300 + i * 120 } }; } return s; })(),
        fx: [st('chain', 200, C.ok, 10)], log: [{ s: 'p=0.99:  p^10=0.9044  p^50=0.6050  p^100=0.3660   50% 成功的长度 H=ln0.5/ln p=68.97', at: 1600 }],
        data: { 'p': 0.99, 'P(全对)': { v: 0.9044, at: 1600 } } },
      { say: '把 n 拉长到 100：p = 0.99 时 0.99¹⁰⁰ = 0.366。p = 0.9 时只剩 2.7×10⁻⁵，几乎是零。',
        set: { cv9: mix(fade(0, 200), { dash: { to: 1, dur: 1300 } }), cv99: mix(fade(200, 200), { dash: { to: 1, dur: 1300, delay: 200 } }), pt9: pop(300), pt99: pop(400), pt9T: fade(400), pt99T: fade(500), l9: fade(1400), l99: fade(1500) },
        log: [{ s: '0.9^100 = 2.656e-05 ; 0.99^100 = 0.366', at: 1400 }], data: { 'n': { v: 100, at: 1400 }, 'P(全对)': { v: 0.366, at: 1400 } } },
      { say: '这就是长程任务难的原因。几百步的任务，单步准确率必须非常高。不然整条轨迹没希望全对。',
        fx: [{ type: 'pulse', obj: 'pt99', color: C.ok, at: 0 }, { type: 'flash', obj: 'pt9', color: C.bad, at: 300 }] }
    ]
  };

  /* ---------------- 场景 2：50% 长度 ---------------- */
  var EQ2 = VZ.eq('qb', ['H =', { slot: 1, w: 96 }, '/', { slot: 1, w: 116 }, '=', { num: 0, fmt: 'fixed2', k: 'ok', w: 96 }], 430, 124, { size: 16 });
  var HP = [[0.9, 6.58, '10%'], [0.95, 13.51, '5%'], [0.99, 68.97, '1%'], [0.999, 692.80, '0.1%']];
  var LX0 = 300, LS = 140;
  function lx(h) { return LX0 + LS * Math.log(h) / Math.LN10; }
  function ry(i) { return 300 + i * 52; }
  var sc2 = {
    name: '50% 能做多长', desc: '令 p^H = 0.5，解出 H = ln0.5 / ln p：成功率掉到一半时的任务长度。错误率每降 10 倍，H 约涨 10 倍。',
    code: CODE12, dataTitle: '实算', data: { 'p': 0, 'ln p': 0, 'H': 0 }, dataFmt: { 'p': 'fixed3', 'ln p': function (v) { return (+v).toPrecision(5); }, 'H': 'fixed2' },
    bg: function (d) {
      title(d, '单步准确率的小进步，换来任务长度的大进步');
      d.text(430, 72, '令 p^H = 0.5，两边取对数：H · ln p = ln 0.5', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.line(LX0, 274, LX0, 470, { stroke: C.fg3, sw: 1.2 });
      [1, 10, 100, 1000].forEach(function (h) { var x = lx(h); d.line(x, 470, x, 476, { stroke: C.fg3, sw: 1 }); d.text(x, 492, String(h), { anchor: 'middle', size: 11, mono: true, color: C.fg3 }); });
      d.line(LX0, 470, lx(1000) + 10, 470, { stroke: C.fg3, sw: 1.2 });
      d.text(lx(1000) + 14, 474, 'H（对数刻度）', { size: 11.5, weight: 700, color: C.fg3 });
      d.text(120, 270, '每步准确率 p', { anchor: 'middle', size: 11.5, weight: 700, color: C.fg3 });
      d.text(222, 270, '错误率', { anchor: 'middle', size: 11.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      for (var k in EQ2.objs) o[k] = EQ2.objs[k];
      o.a = node(300, 196, 150, 30, 'ln 0.5 = −0.6931', null, 'data', 0, 12.5); o.a.mono = true;
      o.b = node(560, 196, 170, 30, 'ln 0.99 = −0.01005', null, 'info', 0, 12.5); o.b.mono = true;
      o.ga = ghost('−0.6931', 90); o.gb = ghost('−0.01005', 106, 'info');
      HP.forEach(function (r, i) {
        o['p' + i] = node(120, ry(i), 80, 30, String(r[0]), null, 'info', 0, 13); o['p' + i].mono = true;
        o['er' + i] = label(222, ry(i) + 4, r[2], C.bad, 'middle', 12);
        o['pp' + i] = path('M262,' + ry(i) + ' L' + (LX0 - 4) + ',' + ry(i), C.info);
        o['hb' + i] = { type: 'box', x: LX0, y: ry(i), w: 0, h: 22, rx: 4, anchor: 'l', fill: C.okW, stroke: C.ok, sw: 1.3, text: '', opacity: 0 };
        o['hv' + i] = { type: 'text', x: LX0 + 6, y: ry(i) + 4, text: '', num: 0, fmt: 'fixed2', size: 12, weight: 700, mono: true, color: C.ok, anchor: 'start', opacity: 0 };
      });
      o.x10 = { type: 'box', x: 700, y: 404, w: 150, h: 44, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.4, text: '', num: 0, fmt: 'fixed2', pre: '约 ', post: ' 倍', size: 13, weight: 700, sub: '错误率 1% → 0.1%', subSize: 11.5, subMono: false, opacity: 0 };
      o.apx = node(430, 522, 520, 30, '近似：H ≈ 0.693 / (1 − p)，p = 0.99 → 69.3，p = 0.999 → 693', null, 'neutral', 0, 12);
      return o;
    },
    steps: [
      { say: '把"能做多长"定义成 H：成功率掉到一半时的步数。由 p^H = 0.5 得 H = ln 0.5 / ln p。', set: VZ.show(EQ2, 0, 80), hl: [4] },
      { say: '代 p = 0.99：分子 ln 0.5 = −0.6931，分母 ln 0.99 = −0.01005。',
        set: join({ a: pop(0), b: pop(200) }, flyTo('ga', 300, 196, EQ2.xs[1], 124, 500), flyTo('gb', 560, 196, EQ2.xs[3], 124, 700), { qb1: { text: { to: '−0.6931', delay: 1300 } }, qb3: { text: { to: '−0.01005', delay: 1500 } } }),
        fx: [{ type: 'ripple', x: EQ2.xs[1], y: 124, color: C.data, at: 1300 }, { type: 'ripple', x: EQ2.xs[3], y: 124, color: C.info, at: 1500 }],
        data: { 'p': 0.99, 'ln p': { v: -0.01005, at: 1500 } } },
      { say: '相除得 H = 68.97：每步 99% 准，大约做到 69 步时成功率掉到一半。',
        set: { qb5: { num: { to: 68.97, dur: 900 } } }, fx: [{ type: 'burst', obj: 'qb5', color: C.ok, at: 900 }],
        log: [{ s: '手推：0.9^10 = 0.3487 ; ln 0.5 = -0.6931 ; ln 0.99 = -0.01005 ; 比值 = 68.97', at: 500 }], data: { 'H': { v: 68.97, at: 900 } } },
      { say: '换成 p = 0.999：分母变成 −0.0010005，H = 692.80，一下长了十倍。',
        set: { b: { text: { to: 'ln 0.999 = −0.0010005', delay: 0 }, w: { to: 190, dur: 300 } }, qb3: { text: { to: '−0.0010005', delay: 600 } }, qb5: { num: { to: 692.80, dur: 1000, delay: 700 } } },
        fx: [{ type: 'ripple', x: EQ2.xs[3], y: 124, color: C.info, at: 600 }, { type: 'burst', obj: 'qb5', color: C.ok, at: 1700 }],
        log: [{ s: 'p=0.999:  p^10=0.9900  p^50=0.9512  p^100=0.9048   50% 成功的长度 H=ln0.5/ln p=692.80', at: 1200 }],
        data: { 'p': 0.999, 'ln p': { v: -0.0010005, at: 600 }, 'H': { v: 692.8, at: 1700 } } },
      { say: '四个 p 一起看（横轴是对数刻度）：6.58、13.51、68.97、692.80。',
        set: (function () { var s = {}; HP.forEach(function (r, i) { s['p' + i] = pop(i * 150); s['er' + i] = fade(i * 150 + 100); s['pp' + i] = { opacity: { to: 1, dur: 300, delay: i * 150 + 200 }, flow: { to: 1, dur: 300, delay: i * 150 + 200 } }; s['hb' + i] = mix(fade(i * 150 + 500, 200), { w: { to: lx(r[1]) - LX0, dur: 900, delay: i * 150 + 500, ease: 'out' } }); s['hv' + i] = mix(fade(i * 150 + 700), { num: { to: r[1], dur: 900, delay: i * 150 + 500 }, x: { to: lx(r[1]) + 6, dur: 900, delay: i * 150 + 500, ease: 'out' } }); }); return s; })(),
        fx: [st('pp0', 200, C.info, 3), st('pp1', 350, C.info, 3), st('pp2', 500, C.info, 3), st('pp3', 650, C.info, 3)], hl: [1, 4, 5, 6] },
      { say: '错误率从 1% 降到 0.1%，H 变成原来的 10.05 倍。近似地，H ≈ 0.693 / (1 − p)：错误率每降 10 倍，能做的长度涨 10 倍。',
        set: { x10: mix(pop(0), { num: { to: 10.05, dur: 800, delay: 200 } }), apx: pop(600) },
        fx: [{ type: 'pulse', obj: 'hb2', color: C.warn, at: 0 }, { type: 'pulse', obj: 'hb3', color: C.warn, at: 200 }],
        log: [{ s: 'p 从 0.99 提到 0.999：错误率 1% -> 0.1%，H 从 69.0 变到 692.8 ，约 10.05 倍', at: 300 }, { s: '近似：H ≈ 0.693 / (1-p)：p=0.99 -> 69.3 ; p=0.999 -> 693.0', at: 900 }] },
      { say: '讲义第 29 页左图就是这个意思。单步准确率看起来"快到顶了"。换算成任务长度，却会急剧变长。长度约等于 0.69 除以错误率。前提是每一步的准确率都一样。',
        fx: [{ type: 'pulse', obj: 'p3', color: C.info, at: 0 }, { type: 'burst', obj: 'hb3', color: C.ok, at: 300 }] }
    ]
  };

  /* ---------------- 场景 3：自我条件化 ---------------- */
  var LX = 230, RX = 630;
  function hist(pre, cx, marks) { var o = {}; marks.forEach(function (m, i) { o[pre + i] = { type: 'box', x: cx - 76 + i * 38, y: 150, w: 32, h: 28, rx: 5, fill: m ? C.okW : C.badW, stroke: m ? C.ok : C.bad, sw: 1.4, text: m ? '对' : '错', size: 14, weight: 700, opacity: 0 }; }); return o; }
  var sc3 = {
    name: '自我条件化', desc: '讲义第 29–30 页：模型会以自己之前的错误为条件。历史里错得越多，下一步越容易错。越大的模型，这个毛病反而越明显。',
    bg: function (d) {
      title(d, '历史里的错误会把后面的步骤也带歪');
      d.text(LX - 96, 155, '执行历史', { anchor: 'end', size: 11.5, weight: 700, color: C.fg3 });
      d.text(RX - 96, 155, '执行历史', { anchor: 'end', size: 11.5, weight: 700, color: C.fg3 });
      d.line(120, 512, 760, 512, { stroke: C.fg3, sw: 1.2 }); d.line(120, 512, 120, 410, { stroke: C.fg3, sw: 1.2 });
      d.text(440, 532, '任务长度', { anchor: 'middle', size: 11.5, weight: 700, color: C.fg3 });
      d.text(112, 404, '步准确率', { anchor: 'start', size: 11.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = mix(hist('hl', LX, [1, 1, 1, 1, 1]), hist('hr', RX, [1, 0, 1, 0, 0]));
      o.qL = node(LX, 86, 170, 30, 'Add 56 and -92', null, 'data', 0, 12.5); o.qL.mono = true;
      o.qR = node(RX, 86, 170, 30, 'Add 56 and -92', null, 'data', 0, 12.5); o.qR.mono = true;
      o.mL = node(LX, 262, 120, 40, '模型', null, 'info'); o.mR = node(RX, 262, 120, 40, '模型', null, 'info');
      o.pHL = path('M' + LX + ',166 L' + LX + ',240', C.data); o.pHR = path('M' + RX + ',166 L' + RX + ',240', C.data);
      o.pOL = path('M' + LX + ',284 L' + LX + ',320', C.ok); o.pOR = path('M' + RX + ',284 L' + RX + ',320', C.bad);
      o.oL = node(LX, 342, 190, 36, '56 + -92 = -36  对', null, 'ok', 0, 13); o.oL.mono = true;
      o.oR = node(RX, 342, 190, 36, '56 + -92 = -24  错', null, 'bad', 0, 13); o.oR.mono = true;
      o.why = node(430, 392, 560, 30, '预训练类比：好代码的文件后面多半也好，烂的后面多半也烂', null, 'neutral', 0, 12);
      o.exp = { type: 'path', d: 'M130,430 L750,430', stroke: C.ok, sw: 2.2, dash: 0, opacity: 0 };
      o.obs = { type: 'path', d: 'M130,431 C 260,431 300,470 380,486 C 480,503 620,500 750,502', stroke: C.bad, sw: 2.2, dash: 0, opacity: 0 };
      o.expT = label(752, 424, '预期', C.ok, 'end', 12); o.obsT = label(752, 496, '实际', C.bad, 'end', 12);
      o.big = node(430, 454, 520, 30, 'Qwen3 4B→32B：注入的错误越多，32B 掉得最多（讲义第 30 页）', null, 'bad', 0, 12);
      o.rl = node(430, 454, 520, 30, '强化学习能在很大程度上纠正：学会改错，只管往后拿奖励', null, 'ok', 0, 12);
      return o;
    },
    steps: [
      { say: '讲义第 29 页的例子：两边是同一个问题，"Add 56 and -92"。', set: { qL: pop(0), qR: pop(150), mL: pop(300), mR: pop(400) } },
      { say: '左边：之前的执行历史全对。模型读着这样的历史，答出 -36，对了。',
        set: join({ hl0: pop(0), hl1: pop(80), hl2: pop(160), hl3: pop(240), hl4: pop(320) }, on('pHL', 400), on('pOL', 1100), { oL: pop(1300) }),
        fx: [st('pHL', 500, C.ok, 4), { type: 'pulse', obj: 'mL', color: C.info, at: 1000 }, st('pOL', 1100, C.ok, 3)] },
      { say: '右边：历史里已经错了三次。同样的题，模型答出 -24，错了。',
        set: join({ hr0: pop(0), hr1: pop(80), hr2: pop(160), hr3: pop(240), hr4: pop(320) }, on('pHR', 400), on('pOR', 1100), { oR: pop(1300) }),
        fx: [st('pHR', 500, C.bad, 4), { type: 'pulse', obj: 'mR', color: C.info, at: 1000 }, st('pOR', 1100, C.bad, 3), { type: 'shake', obj: 'oR', at: 1500 }] },
      { say: '课上的解释：模型在全网代码上预训练过。好代码所在的文件，后面多半也是好代码。写得烂的，后面多半也烂。看到烂的开头，就接着写烂的。',
        set: { why: pop(0) }, fx: [{ type: 'flash', obj: 'hr1', color: C.bad, at: 300 }, { type: 'flash', obj: 'hr3', color: C.bad, at: 450 }, { type: 'flash', obj: 'hr4', color: C.bad, at: 600 }] },
      { say: '所以实际的步准确率会随任务变长往下掉。不像上一场景假设的那样保持不变（曲线形状示意）。',
        set: { why: fade(0, 300, 0), exp: mix(fade(100, 200), { dash: { to: 1, dur: 900, delay: 100 } }), obs: mix(fade(400, 200), { dash: { to: 1, dur: 1200, delay: 400 } }), expT: fade(900), obsT: fade(1500) } },
      { say: '讲义第 30 页：模型越大，能执行的任务越长。但在历史里注入错误时，最大的 Qwen3-32B 准确率掉得最多。',
        set: { big: pop(0), exp: fade(0, 300, 0.25), obs: fade(0, 300, 0.25), expT: fade(0, 300, 0), obsT: fade(0, 300, 0) }, fx: [{ type: 'flash', obj: 'big', color: C.bad, at: 500 }] },
      { say: '课上补充：这在很大程度上能被强化学习纠正。RL 教模型改正错误，不管过去怎样，都去争取后面的奖励。但长程任务里仍要提防。',
        set: { big: fade(0, 300, 0), rl: pop(200) }, fx: [{ type: 'burst', obj: 'rl', color: C.ok, at: 600 }] }
    ]
  };

  /* ---------------- 场景 4：Vending-Bench ---------------- */
  var sc4 = {
    name: 'Vending-Bench', desc: '讲义第 28 页：长时间经营一台自动售货机。一个临时的错误，一路影响后面所有决定。错误是把到货通知当成了已送达。',
    dataTitle: '讲义第 28 页', data: { '模拟天数': '无', '消息数': '无', 'token 数': '无' },
    bg: function (d) { title(d, '一个临时错误，影响后面每一个决定'); d.text(48, 500, '时间', { size: 12, weight: 700, color: C.fg3 }); d.rect(90, 491, 700, 14, { fill: C.bg3, stroke: C.line1, rx: 4 }); },
    objects: function () {
      var o = {};
      o.ag = node(140, 260, 130, 50, '智能体', '定价 · 下单 · 补货', 'info');
      o.vm = node(140, 120, 130, 46, '自动售货机', null, 'neutral');
      o.env = node(400, 120, 150, 46, '供应商 / 邮件', '环境', 'data');
      o.pAV = path('M140,235 L140,143', C.warn); o.pEA = path('M330,138 C 260,180 230,220 205,240', C.data);
      o.pAE = path('M205,268 C 260,260 330,200 380,143', C.warn);
      o.k1 = node(640, 150, 300, 66, '过早补货', '"今天到货" ≠ 已经送达，环境如实报告"没货"', 'warn', 0, 13);
      o.k2 = node(640, 280, 300, 66, '错误推断', '"现在没货" → "生意失败了"，再也不等到货邮件', 'bad', 0, 13);
      o.k3 = node(640, 410, 300, 66, '错误一直延续', '每天的扣费被当成"诈骗"', 'bad', 0, 13);
      o.p12 = path('M640,184 L640,246', C.bad); o.p23 = path('M640,314 L640,376', C.bad);
      o.mail = node(300, 410, 280, 50, 'EMERGENCY: Unauthorized Fees', 'After Business Termination', 'bad', 0, 12.5); o.mail.mono = true; o.mail.subMono = true;
      o.p3m = path('M490,410 L442,410', C.bad);
      o.t1 = { type: 'box', x: 90, y: 498, w: 0, h: 14, rx: 4, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1.1, text: '', opacity: 0 };
      o.tT = { type: 'text', x: 790, y: 484, text: '', num: 0, fmt: 'int', pre: '第 ', post: ' 天', size: 12, weight: 700, mono: true, color: C.data, anchor: 'end', opacity: 0 };
      o.err = { type: 'line', x1: 230, y1: 484, x2: 230, y2: 512, stroke: C.bad, sw: 3, opacity: 0 };
      o.errT = label(230, 478, '临时错误', C.bad, 'middle', 11.5);
      o.q = label(330, 340, '只是一个坏计划吗？', C.fg2, 'middle', 13);
      return o;
    },
    steps: [
      { say: '任务：长期经营一台自动售货机，要定价、下单、补货。难点在于时间长，而不是推理难。',
        set: join({ ag: pop(0), vm: pop(200), env: pop(300) }, on('pAV', 300), on('pEA', 400), on('pAE', 400)),
        fx: [st('pAV', 400, C.warn, 3), st('pAE', 500, C.warn, 3), st('pEA', 900, C.data, 3)] },
      { say: '最长约 2,000 条消息、约 2,500 万 token、222 个模拟日。后面的动作，都以智能体之前的行为为条件。',
        set: { t1: mix(fade(0, 200), { w: { to: 700, dur: 2000, ease: 'inOut' } }), tT: mix(fade(0), { num: { to: 222, dur: 2000 } }) },
        data: { '模拟天数': { v: 222, at: 1800 }, '消息数': { v: '约 2,000', at: 1800 }, 'token 数': { v: '约 2,500 万', at: 1800 } } },
      { say: '出错的开始：邮件说"今天到货"，它就当成已经送达，去补货。环境如实报告：没货。',
        set: { k1: pop(0), err: fade(200), errT: fade(200) }, fx: [st('pEA', 0, C.data, 4), st('pAV', 500, C.warn, 3), { type: 'shake', obj: 'vm', at: 900 }] },
      { say: '错误推断："现在没货"被理解成"生意失败了"。它从此不等到货邮件，也不再去查。',
        set: join(on('p12'), { k2: pop(300) }), fx: [st('p12', 0, C.bad, 4), { type: 'flash', obj: 'ag', color: C.bad, at: 800 }] },
      { say: '错误一直延续：生意照常每天扣费。它却把扣费当成"诈骗"，发出紧急邮件。',
        set: join(on('p23'), on('p3m', 700), { k3: pop(300), mail: pop(900) }), fx: [st('p23', 0, C.bad, 4), st('p3m', 700, C.bad, 3), { type: 'shake', obj: 'mail', at: 1400 }] },
      { say: '讲义的问题："这只是一个坏计划吗？"后面每一个决定，都建立在那个临时错误之上。课上说，经过长上下文和 RL 训练，模型已经好了不少。',
        set: { q: fade(0) }, fx: [{ type: 'pulse', obj: 'k1', color: C.warn, at: 300 }, { type: 'pulse', obj: 'k2', color: C.bad, at: 600 }, { type: 'pulse', obj: 'k3', color: C.bad, at: 900 }] }
    ]
  };

  /* ---------------- 场景 5：递归委派（RAO） ---------------- */
  var CODE5 = { lang: 'py', title: '示意 · RAO 风格的计划代码', src:
'async def plan_trip():\n' +
'    a = launch_subagent("找赏樱的地方")\n' +
'    b = launch_subagent("找安静的寺庙")\n' +
'    sakura, temple = await gather(a, b)\n' +
'    return make_itinerary(sakura, temple)\n' +
'\n' +
'# 子智能体也能再调用 launch_subagent\n' +
'# 奖励：自己的任务 + 子结点成功的频率\n' };
  var DD = { Easy: [[1, 12], [2, 12], [3, 5], [4, 0]], Medium: [[1, 0], [2, 2], [3, 6], [4, 20], [5, 10], [6, 7], [7, 0]], Hard: [[5, 0], [6, 1], [7, 11], [8, 5], [9, 4], [10, 1]] };
  var GX0 = 130, GXS = 46, GY0 = 520, GYS = 5.2;
  function poly(k) { return DD[k].map(function (p, i) { return (i ? 'L' : 'M') + (GX0 + (p[0] - 1) * GXS) + ',' + (GY0 - p[1] * GYS); }).join(' '); }
  var sc5 = {
    name: '递归委派', desc: '讲义第 31 页（RAO）：委派本身也是一个动作，所以能被训练。智能体用 launch_subagent(goal) 叫自己的副本去做子任务。副本还能接着委派。',
    code: CODE5, dataTitle: '平均最大深度（约）', data: { 'Easy': 0, 'Medium': 0, 'Hard': 0 }, dataFmt: { 'Easy': 'fixed2', 'Medium': 'fixed2', 'Hard': 'fixed2' },
    bg: function (d) {
      title(d, '把子任务交给自己的副本，副本还能再往下交');
      d.line(GX0, GY0, GX0 + 9 * GXS + 10, GY0, { stroke: C.fg3, sw: 1.2 }); d.line(GX0, GY0, GX0, GY0 - 21 * GYS, { stroke: C.fg3, sw: 1.2 });
      for (var i = 1; i <= 10; i++) d.text(GX0 + (i - 1) * GXS, GY0 + 14, String(i), { anchor: 'middle', size: 11, mono: true, color: C.fg3 });
      [0, 10, 20].forEach(function (v) { d.text(GX0 - 6, GY0 - v * GYS + 4, String(v), { anchor: 'end', size: 11, mono: true, color: C.fg3 }); });
      d.text(GX0 + 9 * GXS + 16, GY0 + 4, '最大深度', { size: 11.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      o.root = node(430, 76, 230, 36, '京都三日游（四月初）', null, 'info', 0, 13);
      o.c1 = node(250, 172, 170, 34, '找赏樱的地方', null, 'info', 0, 12.5); o.c2 = node(610, 172, 170, 34, '找安静的寺庙', null, 'info', 0, 12.5);
      o.g1 = node(520, 262, 150, 32, '比较几座寺庙', null, 'info', 0, 12); o.g2 = node(700, 262, 150, 32, '查开放时间', null, 'info', 0, 12);
      o.pr1 = path('M380,94 L290,155', C.warn); o.pr2 = path('M480,94 L570,155', C.warn);
      o.pc1 = path('M590,189 L540,246', C.warn); o.pc2 = path('M630,189 L680,246', C.warn);
      o.lsT = label(430, 140, 'launch_subagent(goal)', C.warn, 'middle', 11.5); o.lsT.mono = true;
      o.r1 = label(155, 177, '', C.ok, 'end', 11.5); o.r2 = label(705, 177, '', C.ok, 'start', 11.5);
      o.sc = node(430, 318, 440, 30, '每个结点的分 = 自己的任务做得怎样 + 子结点成功的频率', null, 'ok', 0, 12);
      o.lgE = label(GX0 + 9 * GXS + 16, 440, 'Easy', C.ok, 'start', 12); o.lgM = label(GX0 + 9 * GXS + 16, 460, 'Medium', C.data, 'start', 12); o.lgH = label(GX0 + 9 * GXS + 16, 480, 'Hard', C.bad, 'start', 12);
      o.pE = { type: 'path', d: poly('Easy'), stroke: C.ok, sw: 2.2, dash: 0, opacity: 0 };
      o.pM = { type: 'path', d: poly('Medium'), stroke: C.data, sw: 2.2, dash: 0, opacity: 0 };
      o.pH = { type: 'path', d: poly('Hard'), stroke: C.bad, sw: 2.2, dash: 0, opacity: 0 };
      o.trn = node(720, 380, 200, 30, '只在 Medium 上训练', null, 'data', 0, 12);
      return o;
    },
    steps: [
      { say: '课上的例子：让模型规划"四月初的京都三日游"。', set: { root: pop(0) } },
      { say: '它写一段计划代码，用 launch_subagent 派出两个子智能体。一个找赏樱的地方，一个找安静的寺庙。',
        set: join(on('pr1', 200), on('pr2', 300), { lsT: fade(100), c1: pop(700), c2: pop(800) }), hl: [1, 2, 3],
        fx: [st('pr1', 200, C.warn, 4), st('pr2', 300, C.warn, 4)] },
      { say: '用 Python 的 async / await，互不依赖的两个子智能体可以同时跑。需要先后的，就按顺序等。',
        hl: [4], fx: [{ type: 'pulse', obj: 'c1', color: C.info, at: 0 }, { type: 'pulse', obj: 'c2', color: C.info, at: 0 }] },
      { say: '是递归的：子智能体自己也能再派子智能体。这里的两个孙结点是示意。',
        set: join(on('pc1', 0), on('pc2', 100), { g1: pop(500), g2: pop(600) }), hl: [7], fx: [st('pc1', 0, C.warn, 3), st('pc2', 100, C.warn, 3)] },
      { say: '结果一层层往回交，最后合成行程。',
        set: { r1: mix(fade(600), { text: { to: '完成', delay: 600 } }), r2: mix(fade(1100), { text: { to: '完成', delay: 1100 } }) },
        fx: [st('pc1', 0, C.ok, 3, true), st('pc2', 0, C.ok, 3, true), st('pr1', 700, C.ok, 3, true), st('pr2', 900, C.ok, 3, true), { type: 'burst', obj: 'root', color: C.ok, at: 1500 }], hl: [5] },
      { say: '训练时每个结点都打分。既看它自己的任务，也看它派出去的子结点成功得多不多。',
        set: { sc: pop(0) }, hl: [8], fx: [{ type: 'pulse', obj: 'c2', color: C.ok, at: 400 }, { type: 'pulse', obj: 'root', color: C.ok, at: 700 }] },
      { say: '讲义第 31 页的图（从图上读的约数）：只在中等难度上训练。简单题委派深度集中在 1–2。中等题在 4 附近。难题委派得更深，在 7 附近。',
        set: { trn: pop(0), pE: mix(fade(200, 200), { dash: { to: 1, dur: 900, delay: 200 } }), pM: mix(fade(500, 200), { dash: { to: 1, dur: 1100, delay: 500 } }), pH: mix(fade(900, 200), { dash: { to: 1, dur: 1100, delay: 900 } }), lgE: fade(400), lgM: fade(800), lgH: fade(1200) },
        log: [{ s: 'Easy   rollouts=29  平均最大深度≈1.76  众数=1', at: 600 }, { s: 'Medium rollouts=45  平均最大深度≈4.31  众数=4', at: 1000 }, { s: 'Hard   rollouts=22  平均最大深度≈7.68  众数=7', at: 1400 }],
        data: { 'Easy': { v: 1.76, at: 600 }, 'Medium': { v: 4.31, at: 1000 }, 'Hard': { v: 7.68, at: 1400 } } }
    ]
  };

  VZ.register({
    id: 'c3-horizon', title: '长程任务：连乘的准确率、自我条件化，以及递归委派',
    sources: [{ t: '第 5 讲 55:30–1:03:20（Vending-Bench、执行长度、RAO）', u: YT + '3330' }, { t: '讲义 lecture-05 第 28–31 页', u: PDF }],
    note: '场景 1、2 的每个数都是本机实算的。累乘、p^10、p^100、ln 值、H、10.05 倍、近似式都在内。"每步 90%、一路乘下去"出自视频 56:55–58:19。"10 步"和"H = 成功率掉到一半的长度"是笔记自己的设定。讲义第 29 页只说"假设每步准确率恒定"。它没写任务长度怎么定义。场景 3 照讲义第 29–30 页。例子、预期和实际两条曲线、Qwen3 的结论都是。曲线形状是示意。预训练代码的类比出自视频 58:19–1:00:27。"RL 能很大程度纠正"也是。场景 4 照讲义第 28 页，天数、消息数、token 数和三段错误链都是。"长上下文和 RL 训练后变好"出自视频 56:11。场景 5 的 launch_subagent、打分方式、只在中等难度上训练，都照讲义第 31 页。打分是按自己的任务和子结点的成功率。京都、赏樱、寺庙出自视频 1:01:08–1:01:50。孙结点和代码是示意。深度分布是从讲义图上读出的约数。平均深度是本机按这些约数算的。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

/* 06 · 第 11 讲 —— 可靠的奖励：验证器的假阴性 / 假阳性、没有信息的组与 DAPO 动态采样、部分奖励、探索坍缩
 * 场景 1–2：修 bug 的四个测试、`value is None` 短语规则、只测 retries=0 的训练测试和 return 0 照讲义 lecture-11 第 39、41、43 页；
 *          三个实现在两种验证器下的结果是 本机验算脚本 第 8 部分实跑。
 * 场景 3：四个组 A–D 的奖励、"目标 2 组"照第 37、44 页。场景 4：0/4、1/4、2/4、1/4 和优势照第 45 页。
 * 场景 5：0.20/0.60/0.20 → 0.01/0.98/0.01 照第 47 页；熵 0.950 → 0.112 是 verify.py 第 7 部分补充算的。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L11 = 'https://www.cmu-agents.com/slides/lecture-11-rl-advanced.pdf', YT = 'https://youtu.be/jKx7_fOZRzg';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function cell(x, y, t, k, w, h, size, mono) { return { type: 'box', x: x, y: y, w: w || 64, h: h || 34, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 12.5, weight: 750, mono: mono !== false, opacity: 0 }; }
  function codeBox(x, y, w, h, lines, k) { return { type: 'box', x: x, y: y, w: w, h: h, rx: 8, fill: C[(k || 'neutral') + 'W'], stroke: C[k || 'neutral'], sw: 1.3, text: lines[0], sub: lines[1] || '', subMono: true, subSize: 11.5, size: 12, weight: 700, mono: true, opacity: 0 }; }
  var CASES = [['Missing', '3'], ['None', '3'], ['0', '0'], ['2', '2']];

  /* ---------------- 场景 1：假阴性 ---------------- */
  var CODE1 = { lang: 'py', title: '本机实跑 · 第 8 部分（实跑）', src:
'def fixed(config):\n' +
'    v = config.get("retries")\n' +
'    return 3 if v is None else v\n' +
'\n' +
'# 四个测试：全过\n' +
'# 短语规则：源码里必须出现 "value is None"\n' +
'"value is None" in src_of(fixed)   # False\n' };
  var sc1 = {
    name: '假阴性', desc: '候选解四个测试全对。但验证器要求源码里出现精确短语 value is None，于是拒了它。一个有效的解拿到 0 分（讲义第 39 页）。',
    code: CODE1, dataTitle: '候选解', data: { '测试通过': 0, '短语规则': 0, '奖励 R': 0 }, dataFmt: { '测试通过': function (v) { return Math.round(v) + ' / 4'; }, '短语规则': function (v) { return v ? '未出现' : '—'; } },
    bg: function (d) { title(d, '验证器规则：要求出现精确短语 value is None'); d.text(560, 100, '输入 → 要求 / 候选', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); },
    objects: function () {
      var o = {};
      o.cand = codeBox(180, 190, 300, 70, ['v = config.get("retries")', 'return 3 if v is None else v'], 'info');
      o.candt = { type: 'text', x: 180, y: 140, text: '候选解', size: 12.5, weight: 750, color: C.info, anchor: 'middle', opacity: 0 };
      CASES.forEach(function (c, i) {
        var y = 140 + i * 46;
        o['c' + i] = cell(540, y, c[0] + ' → ' + c[1] + ' / ' + c[1], 'neutral', 210, 34, 12.5);
        o['k' + i] = { type: 'text', x: 670, y: y, text: '对', size: 18, weight: 800, color: C.ok, anchor: 'middle', opacity: 0 };
        o['w' + i] = wire('M330,' + (190 + (i - 1.5) * 12) + ' C380,' + (190 + (i - 1.5) * 12) + ' 390,' + y + ' 432,' + y, C.info);
      });
      o.rule = cell(540, 360, '规则：源码含 "value is None"？', 'warn', 300, 38, 12.5, false);
      o.no = { type: 'text', x: 720, y: 360, text: '错', size: 20, weight: 800, color: C.bad, anchor: 'middle', opacity: 0 };
      o.R = { type: 'box', x: 540, y: 430, w: 180, h: 44, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, text: '拒绝：R = 0', size: 15, weight: 800, opacity: 0 };
      o.alt = { type: 'box', x: 180, y: 320, w: 320, h: 60, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, dasharray: '5 4', text: '同样的行为，改个变量名（示意）：', sub: 'return 3 if value is None else value → 规则通过', subMono: true, subSize: 10.5, size: 12, weight: 700, mono: false, opacity: 0 };
      o.fn = { type: 'box', x: 180, y: 430, w: 300, h: 44, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, dasharray: '5 4', text: '假阴性：有效的解被拒了', size: 14, weight: 800, opacity: 0 };
      o.fix = { type: 'box', x: 430, y: 510, w: 640, h: 38, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.2, text: '检查行为，而不是偶然的措辞', size: 13.5, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      { say: '回到修 bug 任务。候选解换了个写法：先取出值，再判断是不是 None。', set: { candt: fade(0), cand: pop(100) }, hl: [1, 2, 3] },
      (function () { var s = {}, fx = []; CASES.forEach(function (c, i) { s['w' + i] = { opacity: { to: 1, dur: 200, delay: i * 250 }, flow: { to: 1, dur: 200, delay: i * 250 } }; s['c' + i] = pop(300 + i * 250); s['k' + i] = pop(600 + i * 250); fx.push(st('w' + i, i * 250, C.info, 3)); });
        return { say: '跑四个要求的情况：Missing→3、None→3、0→0、2→2，候选全部答对。', set: s, fx: fx, hl: [5], data: { '测试通过': { v: 4, at: 1300 } } }; })(),
      { say: '可这个验证器还有一条规则。源码里必须出现精确短语 value is None。候选用的变量名是 v。', set: { rule: pop(0), no: pop(600) }, fx: [{ type: 'shake', obj: 'rule', at: 700 }], hl: [6, 7], data: { '短语规则': { v: 1, at: 600 } } },
      { say: '结果：拒绝，奖励 0。', set: { R: pop(0) }, data: { '奖励 R': { v: 0, at: 200 } }, log: [{ s: "phrase-matching verifier on fixed solution: False -> false negative", at: 300 }] },
      { say: '同样的行为，只要把变量名写成 value 就能过这条规则。奖励取决于措辞，而不是代码做了什么。', set: { alt: pop(0) }, fx: [{ type: 'pulse', obj: 'alt', color: C.warn, at: 500 }] },
      { say: '这就是假阴性：一个有效的解被拒了。它给训练加了奖励噪声。等价的解，因为措辞不同拿到不同的分。', set: { fn: pop(0) }, fx: [{ type: 'flash', obj: 'cand', color: C.bad, at: 400 }] },
      { say: '评测里也一样：验证器拒有效解时，分数会在 100% 以下走平。修法：检查行为，不检查措辞。', set: { fix: pop(0) } }
    ]
  };

  /* ---------------- 场景 2：假阳性与奖励作弊 ---------------- */
  var CODE2 = { lang: 'py', title: '本机实跑 · 第 8 部分（实跑）', src:
'def const0(config):\n' +
'    return 0                   # 总是返回 0\n' +
'\n' +
'weak = [({"retries": 0}, 0)]   # 只测这一个\n' +
'full = [({}, 3), ({"retries": None}, 3),\n' +
'        ({"retries": 0}, 0), ({"retries": 2}, 2)]\n' };
  var RES = ['FAIL', 'FAIL', 'pass', 'FAIL'];
  var sc2 = {
    name: '假阳性', desc: '假设训练用的测试只测了 retries=0。一个总是返回 0 的"补丁"通过了训练验证器，拿到奖励 1。四个真实要求它却只过了一个（讲义第 41、43 页）。',
    code: CODE2, dataTitle: 'return 0 这个补丁', data: { '训练奖励': 0, '独立检查通过': 0 }, dataFmt: { '独立检查通过': function (v) { return Math.round(v) + ' / 4'; } },
    bg: function (d) { title(d, '训练测试有个缺口：只测了输入 retries=0'); },
    objects: function () {
      var o = {};
      o.cand = codeBox(170, 150, 240, 56, ['def retry_count(config):', '    return 0'], 'warn');
      o.weak = cell(470, 110, '训练测试：0 → 0', 'neutral', 180, 36, 12.5, false);
      o.wk = { type: 'text', x: 580, y: 110, text: '对', size: 18, weight: 800, color: C.ok, anchor: 'middle', opacity: 0 };
      o.w0 = wire('M290,140 L378,115', C.warn);
      o.R1 = { type: 'box', x: 720, y: 110, w: 150, h: 40, rx: 10, fill: C.okW, stroke: C.ok, sw: 1.6, text: '训练奖励 1', size: 14, weight: 800, opacity: 0 };
      o.w1 = wire('M562,110 L642,110', C.ok);
      CASES.forEach(function (c, i) {
        var y = 250 + i * 46;
        o['f' + i] = cell(470, y, c[0] + ' → 要求 ' + c[1] + '，候选 0', RES[i] === 'pass' ? 'ok' : 'bad', 240, 34, 12.5);
        o['fk' + i] = { type: 'text', x: 610, y: y, text: RES[i] === 'pass' ? '对' : '错', size: 18, weight: 800, color: RES[i] === 'pass' ? C.ok : C.bad, anchor: 'middle', opacity: 0 };
      });
      o.fl = { type: 'text', x: 470, y: 215, text: '独立检查：四个要求的情况', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.w2 = wire('M220,180 C240,260 300,330 348,330', C.warn);
      o.fp = { type: 'box', x: 760, y: 320, w: 160, h: 70, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, dasharray: '5 4', text: '假阳性', sub: '无效的解拿到奖励', subMono: false, subSize: 11.5, size: 15, weight: 800, opacity: 0 };
      o.chk = { type: 'box', x: 430, y: 490, w: 760, h: 60, rx: 10, fill: C.bg2, stroke: C.line, sw: 1.2, text: '同时看三样：训练奖励 · 独立的成功（没见过的任务）· 成本和失败（工具调用、重复动作）', sub: '奖励在涨、独立的改进没有 → 去轨迹里找捷径', subMono: false, subSize: 12, size: 12.5, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      { say: '还是这个任务，但假设训练用的测试只测了 retries=0 这一个输入。', set: { weak: pop(0) }, hl: [4] },
      { say: '一个"补丁"：不管输入是什么，总是返回 0。', set: { cand: pop(0) }, hl: [1, 2] },
      { say: '训练验证器：0 → 0，通过，奖励 1。', set: join(on('w0'), on('w1', 600), { wk: pop(400), R1: pop(800) }), fx: [st('w0', 0, C.warn, 3), st('w1', 600, C.ok, 3)], data: { '训练奖励': { v: 1, at: 800 } },
        log: [{ s: "const0 weak test (only retries=0) -> R=1", at: 800 }] },
      (function () { var s = join(on('w2'), { fl: fade(200) }), fx = [st('w2', 0, C.warn, 4)]; CASES.forEach(function (c, i) { s['f' + i] = pop(400 + i * 200); s['fk' + i] = pop(600 + i * 200); if (RES[i] !== 'pass') fx.push({ type: 'shake', obj: 'f' + i, at: 700 + i * 200 }); });
        return { say: '拿四个真实要求独立检查：Missing、None 和 2 都错。只有 0 → 0 碰巧对。', set: s, fx: fx, hl: [5, 6], data: { '独立检查通过': { v: 1, at: 1300 } }, log: [{ s: "const0 full tests ['FAIL', 'FAIL', 'pass', 'FAIL'] -> R=0", at: 1300 }] }; })(),
      { say: '这是假阳性：奖励给了一个无效的解。训练会学会钻这个缺口，这就是奖励作弊。', set: { fp: pop(0) }, fx: [{ type: 'burst', obj: 'fp', color: C.bad, at: 400 }] },
      { say: '编程智能体的环境里，能钻的空子更多。能上网就去找公开的解，有 Git 历史就抄后来的修复。能碰测试，就让测试通过而不修 bug。', fx: [{ type: 'pulse', obj: 'R1', color: C.bad, at: 200 }, { type: 'shake', obj: 'cand', at: 500 }] },
      { say: '所以要独立地检查进展。训练奖励、没见过的任务上的成功、成本和失败要一起看。', set: { chk: pop(0) } }
    ]
  };

  /* ---------------- 场景 3：没有信息的组与 DAPO 动态采样 ---------------- */
  var G = [['A', [0, 0, 0, 0]], ['B', [0, 1, 0, 1]], ['C', [1, 1, 1, 1]], ['D', [0, 0, 1, 0]]];
  var CODE3 = { lang: 'py', title: '本机实跑 · 第 7 部分', src:
'groups = {"A": [0,0,0,0], "B": [0,1,0,1],\n' +
'          "C": [1,1,1,1], "D": [0,0,1,0]}\n' +
'kept = [k for k, v in groups.items()\n' +
'        if len(set(v)) > 1]      # 奖励不全一样\n' +
'# ["B", "D"]：批满 2 组，更新\n' };
  var sc3 = {
    name: 'DAPO 动态采样', desc: '一组四条奖励全一样时，减去均值后优势全是 0。这组对更新没有贡献。DAPO 只留奖励混合的组，一直采到批满（讲义第 37、44 页）。',
    code: CODE3, dataTitle: '训练批', data: { '已收集的组': 0, '跳过的组': 0 }, dataFmt: { '已收集的组': function (v) { return Math.round(v) + ' / 2'; } },
    bg: function (d) { title(d, '每个任务采四条，看组内的奖励'); d.text(560, 96, '优势 = 奖励 − 组均值', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); },
    objects: function () {
      var o = {};
      G.forEach(function (g, i) {
        var y = 140 + i * 70, m = g[1].reduce(function (a, b) { return a + b; }, 0) / 4;
        o['g' + i] = cell(70, y, '任务 ' + g[0], 'neutral', 80, 40, 13, false);
        g[1].forEach(function (r, k) {
          o['r' + i + k] = cell(150 + k * 46, y, String(r), r ? 'ok' : 'bad', 38, 34, 13);
          var a = r - m, t = a === 0 ? '0' : (a > 0 ? '+' : '−') + Math.abs(a).toFixed(Math.abs(a) === 0.5 ? 1 : 2);
          o['a' + i + k] = cell(470 + k * 58, y, t, a === 0 ? 'neutral' : a > 0 ? 'ok' : 'bad', 50, 30, 12.5);
        });
        o['v' + i] = { type: 'text', x: 720, y: y, text: m === 0 || m === 1 ? '跳过：奖励全同' : '保留：混合', size: 12.5, weight: 750, color: m === 0 || m === 1 ? C.fg3 : C.ok, anchor: 'start', opacity: 0 };
      });
      o.batch = { type: 'box', x: 430, y: 470, w: 400, h: 56, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '', num: 0, fmt: 'int', pre: '训练批：已收集 ', post: ' / 2 组', size: 15, weight: 800, mono: false, opacity: 0 };
      o.pB = wire('M800,210 C850,260 850,430 632,462', C.ok); o.pD = wire('M800,350 C845,390 780,474 632,476', C.ok);
      o.upd = { type: 'text', x: 430, y: 525, text: '批满 → 更新策略（混合组里失败的轨迹也保留）', size: 12.5, weight: 750, color: C.info, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; G.forEach(function (g, i) { if (i === 3) return; s['g' + i] = pop(i * 250); for (var k = 0; k < 4; k++) s['r' + i + k] = pop(i * 250 + 100 + k * 60); }); return { say: '三个任务各采四条：A 全失败、B 一半成功、C 全成功。', set: s }; })(),
      (function () { var s = {}; for (var k = 0; k < 4; k++) s['a0' + k] = pop(k * 80); return { say: 'A 的均值 0，减去后优势全是 0。全零的组没有结果上的比较，不产生更新。', set: s, fx: [{ type: 'shake', obj: 'g0', at: 500 }] }; })(),
      (function () { var s = {}; for (var k = 0; k < 4; k++) s['a1' + k] = pop(k * 80); return { say: 'B 的均值 0.5：优势 −0.5、+0.5、−0.5、+0.5，成功的往上推、失败的往下压。', set: s }; })(),
      (function () { var s = {}; for (var k = 0; k < 4; k++) s['a2' + k] = pop(k * 80); return { say: 'C 全成功，均值 1，优势也全是 0。', set: s }; })(),
      { say: 'DAPO 动态采样：奖励全同的组跳过，只留混合的。', set: { v0: fade(0), v1: fade(200), v2: fade(400) }, hl: [3, 4], data: { '跳过的组': { v: 2, at: 400 } } },
      { say: 'B 进训练批：1 / 2。', set: join(on('pB'), { batch: mix(pop(0), { num: { to: 1, dur: 400, delay: 600 } }) }), fx: [st('pB', 100, C.ok, 4)], data: { '已收集的组': { v: 1, at: 600 } } },
      (function () { var s = { g3: pop(0) }; for (var k = 0; k < 4; k++) { s['r3' + k] = pop(100 + k * 60); s['a3' + k] = pop(600 + k * 80); } s.v3 = fade(1000);
        return { say: '批还没满，继续采。新任务 D 是 0 0 1 0，混合，保留。它的均值 0.25，优势 −0.25 / +0.75。', set: s }; })(),
      { say: 'D 进训练批：2 / 2，批满，更新策略。混合组里每条轨迹都保留，包括失败的。', set: join(on('pD'), { batch: { num: { to: 2, dur: 400, delay: 600 } }, upd: fade(900) }), fx: [st('pD', 100, C.ok, 4), { type: 'ripple', obj: 'batch', color: C.info, at: 1000 }],
        data: { '已收集的组': { v: 2, at: 600 } }, log: [{ s: "keep mixed groups: ['B', 'D']", at: 700 }] }
    ]
  };

  /* ---------------- 场景 4：部分奖励 ---------------- */
  var CHK = [0, 1, 2, 1];
  var CODE4 = { lang: 'py', title: '本机实跑 · 第 7 部分', src:
'checks = [0, 1, 2, 1]     # 过了几项（共 4）\n' +
'succ = [0, 0, 0, 0]              # 只看全过\n' +
'part = [0.25 * c for c in checks]\n' +
'mean = sum(part) / 4             # 0.25\n' +
'adv = [p - mean for p in part]  # -.25 0 .25 0\n' };
  var EQ = VZ.eq('m', ['均值 = (', { slot: 1, w: 44 }, '+', { slot: 1, w: 44 }, '+', { slot: 1, w: 44 }, '+', { slot: 1, w: 44 }, ') ÷ 4 =', { num: 0, fmt: 'fixed2', k: 'info', w: 64 }], 430, 340, { size: 13.5 });
  var sc4 = {
    name: '部分奖励', desc: '四项检查全过才算成功时，一组全失败就没有信号。每过一项加 0.25 的部分得分，组内就有了差别（讲义第 45 页）。',
    code: CODE4, dataTitle: '这一组', data: { '只看成功的优势': 0, '组均值（部分奖励）': 0 }, dataFmt: { '组均值（部分奖励）': 'fixed2' },
    bg: function (d) { title(d, '同一任务四条轨迹：通过 4 项检查才算成功，每过一项 +0.25'); ['轨迹 1', '轨迹 2', '轨迹 3', '轨迹 4'].forEach(function (t, i) { d.text(250 + i * 120, 82, t, { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); }); },
    objects: function () {
      var o = {};
      o.l0 = { type: 'text', x: 100, y: 120, text: '通过的检查', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.l1 = { type: 'text', x: 100, y: 180, text: '只看成功', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.l2 = { type: 'text', x: 100, y: 240, text: '成功 + 部分', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      o.l3 = { type: 'text', x: 100, y: 420, text: '优势', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      CHK.forEach(function (c, i) {
        var x = 250 + i * 120, a = 0.25 * c - 0.25;
        for (var k = 0; k < 4; k++) o['ck' + i + k] = { type: 'box', x: x - 33 + k * 22, y: 120, w: 18, h: 18, rx: 4, fill: k < c ? C.ok : C.bg2, stroke: k < c ? C.ok : C.line, sw: 1.2, text: '', opacity: 0 };
        o['s' + i] = cell(x, 180, '0', 'bad', 60, 32, 13);
        o['sa' + i] = { type: 'text', x: x + 46, y: 180, text: '→ 0', size: 11.5, weight: 700, mono: true, color: C.fg3, anchor: 'middle', opacity: 0 };
        o['p' + i] = cell(x, 240, (0.25 * c).toFixed(2), c ? 'data' : 'neutral', 64, 32, 13);
        o['pf' + i] = cell(x, 240, (0.25 * c).toFixed(2), 'data', 44, 26, 11.5);
        o['ad' + i] = cell(x, 420, a === 0 ? '0' : (a > 0 ? '+' : '−') + Math.abs(a).toFixed(2), a === 0 ? 'neutral' : a > 0 ? 'ok' : 'bad', 70, 34, 13.5);
      });
      for (var j in EQ.objs) o[j] = EQ.objs[j];
      o.note = { type: 'box', x: 430, y: 500, w: 640, h: 40, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '风险：模型可能学会刷附加的奖励，而不去改进任务本身', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = { l0: fade(0) }; CHK.forEach(function (c, i) { for (var k = 0; k < 4; k++) s['ck' + i + k] = pop(i * 200 + k * 50); }); return { say: '四条轨迹分别通过了 0、1、2、1 项检查，没有一条四项全过。', set: s, hl: [1] }; })(),
      (function () { var s = { l1: fade(0) }; CHK.forEach(function (c, i) { s['s' + i] = pop(i * 120); s['sa' + i] = fade(500 + i * 100); }); return { say: '只看成功：奖励全是 0，减去均值 0 后优势全是 0。又一个没有信号的组。', set: s, hl: [2], data: { '只看成功的优势': { v: 0, at: 500 } } }; })(),
      (function () { var s = { l2: fade(0) }; CHK.forEach(function (c, i) { s['p' + i] = pop(i * 120); }); return { say: '加上部分得分：每过一项 0.25，奖励变成 0、0.25、0.50、0.25。', set: s, hl: [3] }; })(),
      (function () { var s = {}; CHK.forEach(function (c, i) { var sl = 'm' + (1 + i * 2); s['pf' + i] = { opacity: { from: 1, to: 0, dur: 150, delay: 1300 + i * 150 }, x: { from: 250 + i * 120, to: EQ.xs[1 + i * 2], dur: 800, delay: 500 + i * 150, ease: 'inOut' }, y: { from: 240, to: 340, dur: 800, delay: 500 + i * 150, ease: 'inOut' } }; s[sl] = { text: { to: (0.25 * c).toFixed(2), delay: 1300 + i * 150 } }; });
        return { say: '手推组均值：四个部分奖励飞进公式。', set: join(VZ.show(EQ, 0, 50), s) }; })(),
      { say: '(0 + 0.25 + 0.50 + 0.25) ÷ 4 = 0.25。', set: { m9: { num: { to: 0.25, dur: 700, delay: 100 } } }, fx: [{ type: 'burst', obj: 'm9', color: C.info, at: 800 }], hl: [4], data: { '组均值（部分奖励）': { v: 0.25, at: 400 } } },
      (function () { var s = { l3: fade(0) }; CHK.forEach(function (c, i) { s['ad' + i] = pop(200 + i * 150); }); return { say: '减去均值：−0.25、0、+0.25、0。过了两项的那条被往上推，一项没过的被往下压。', set: s, hl: [5],
        log: [{ s: 'success+partial rewards: [0.0, 0.25, 0.5, 0.25] mean 0.25 -> advantages [-0.25, 0.0, 0.25, 0.0]', at: 700 }] }; })(),
      { say: '不同的部分得分减少了零优势的组和批。但辅助奖励有风险：模型可能去刷附加的分，而不改进任务。', set: { note: pop(0) } }
    ]
  };

  /* ---------------- 场景 5：探索坍缩 ---------------- */
  var P0 = [0.20, 0.60, 0.20], P1 = [0.01, 0.98, 0.01], BH = 300;
  var CODE5 = { lang: 'py', title: '本机实跑 · 第 7 部分（补充）', src:
'import math\n' +
'H = lambda ps: -sum(p * math.log(p) for p in ps)\n' +
'H([0.20, 0.60, 0.20])   # 0.950\n' +
'H([0.01, 0.98, 0.01])   # 0.112\n' +
'# 熵奖励：max J_policy + α·H(π_θ)\n' };
  var sc5 = {
    name: '探索坍缩', desc: '训练把概率都压到一个动作上，别的动作几乎不再被尝试。熵奖励鼓励别的选择，但不保证它们有用（讲义第 34、47 页）。',
    code: CODE5, dataTitle: '在这个历史下', data: { 'P(动作 B)': 0.60, '熵 H（nats）': 0.950 }, dataFmt: { 'P(动作 B)': 'fixed2', '熵 H（nats）': 'fixed3' },
    bg: function (d) { title(d, '同一个历史下三个可能的动作，训练前 → 训练后'); d.line(160, 440, 700, 440, { stroke: C.fg3, sw: 1.2 }); },
    objects: function () {
      var o = {};
      ['动作 A', '动作 B', '动作 C'].forEach(function (t, i) {
        var x = 250 + i * 180;
        o['b' + i] = { type: 'box', x: x, y: 440, w: 80, h: 0, rx: 4, anchor: 'bc', fill: i === 1 ? C.data : C.neutral, stroke: 'none', opacity: 0 };
        o['t' + i] = { type: 'text', x: x, y: 425, text: '', num: P0[i], fmt: 'fixed2', size: 13, weight: 800, mono: true, color: C.fg, anchor: 'middle', opacity: 0 };
        o['n' + i] = { type: 'text', x: x, y: 460, text: t, size: 12.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 1 };
      });
      o.H = { type: 'box', x: 780, y: 150, w: 130, h: 60, rx: 10, fill: C.infoW, stroke: C.info, sw: 1.6, text: '', num: 0.95, fmt: 'fixed3', pre: 'H = ', sub: '熵（补充复算）', subMono: false, subSize: 11, size: 15, weight: 800, mono: false, opacity: 0 };
      o.pk = { type: 'box', x: 780, y: 260, w: 130, h: 70, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.3, text: 'pass@1 ↑', sub: 'pass@k ↓ → 坍缩', subMono: false, subSize: 11.5, size: 14, weight: 800, mono: false, opacity: 0 };
      o.warn = { type: 'box', x: 430, y: 510, w: 680, h: 40, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.2, text: '熵奖励 α·H(π_θ) 鼓励别的选择。还要检查轨迹之间有没有差别', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: [
      (function () { var s = {}; P0.forEach(function (p, i) { s['b' + i] = { opacity: { to: 1, dur: 150, delay: i * 150 }, h: { to: p * BH, dur: 700, delay: i * 150, ease: 'out' } }; s['t' + i] = { opacity: { to: 1, dur: 200, delay: i * 150 }, y: { to: 425 - p * BH, dur: 700, delay: i * 150, ease: 'out' } }; });
        return { say: '训练前，同一个历史下三个动作的概率：0.20、0.60、0.20。', set: s }; })(),
      { say: '用熵衡量还剩多少不确定性：−Σ p ln p ≈ 0.950（补充复算）。', set: { H: pop(0) }, hl: [2, 3] },
      (function () { var s = { H: { num: { to: 0.112, dur: 1800, delay: 200 } } }; P1.forEach(function (p, i) { s['b' + i] = { h: { to: p * BH, dur: 1800, delay: 200, ease: 'inOut' } }; s['t' + i] = { num: { to: p, dur: 1800, delay: 200 }, y: { to: 425 - p * BH, dur: 1800, delay: 200, ease: 'inOut' } }; });
        return { say: '训练后：A 0.01、B 0.98、C 0.01，熵掉到约 0.112。', set: s, hl: [4], data: { 'P(动作 B)': { v: 0.98, at: 900 }, '熵 H（nats）': { v: 0.112, at: 1400 } }, log: [{ s: 'entropy before 0.950 -> after 0.112 nats', at: 2000 }] }; })(),
      { say: '几乎每个样本都选 B，A 和 C 再也不被尝试。就算其中有更好的做法，策略也发现不了。', fx: [{ type: 'shake', obj: 'b0', at: 100 }, { type: 'shake', obj: 'b2', at: 300 }, { type: 'pulse', obj: 'b1', color: C.data, at: 500 }] },
      { say: 'RL 只从采到的样本里学。A 和 C 采不到，也就拿不到奖励，没机会证明自己更好。', fx: [{ type: 'float', obj: 'b0', dy: -40, text: '采不到', color: C.fg3, size: 12, at: 200 }, { type: 'float', obj: 'b2', dy: -40, text: '采不到', color: C.fg3, size: 12, at: 400 }] },
      { say: '熵奖励把 α·H 加进目标，α 设奖励强度。它鼓励更宽的分布，但更宽不等于有用。', set: { warn: pop(0) }, hl: [5] },
      { say: '实践里还要看轨迹之间有没有差别。第 12 讲的监控指标里，pass@1 在涨而 pass@k 在跌。这就是多样性在坍缩的警示。', set: { pk: pop(0) } }
    ]
  };

  VZ.register({
    id: 'c6-reward', title: '可靠的奖励：验证器、DAPO 动态采样与部分奖励',
    sources: [{ t: '第 11 讲（可靠的奖励）', u: YT }, { t: '讲义 lecture-11 第 34–47 页', u: L11 }],
    note: '四个测试、短语规则、只测 retries=0 的训练测试、四个组的奖励、目标 2 组、0/4–2/4 的部分得分和优势、0.20/0.60/0.20 → 0.01/0.98/0.01 都照讲义。三个实现在两种验证器下的结果是本机实跑的。D 组的优势和两个熵值是复算时补的。',
    scenes: [sc1, sc2, sc3, sc4, sc5]
  });
})();

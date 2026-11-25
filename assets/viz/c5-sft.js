/* 05 · 第 8 讲 —— SFT：轨迹 → 模板 → 掩码 → 损失；样本占比 vs token 占比；打包整段对话；训练和运行的错配
 * 场景 1：渲染 → 切 token → 掩码的三步照讲义 lecture-08 第 11–15 页；小轨迹和每个 token 的 log p 是示意，
 *         掩码位和损失 2.25 是 本机验算脚本 第 1 部分实算。
 * 场景 2：56 / 11 / 33 与 89 / 9 / 2 照第 18 页（MAI-Thinking-1 表 10）；"平均长度是通用类的 26.2 倍"是 verify.py 第 2 部分反推。
 * 场景 3：7 段对话长度照第 38 页；pack 容量 64k 是示意，装箱结果是 verify.py 第 3 部分实跑。
 * 场景 4：示范 vs 自己运行照第 42 页。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L8 = 'https://www.cmu-agents.com/slides/lecture-08-sft.pdf', YT = 'https://youtu.be/O3HSU0AoILc';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }

  /* ---------------- 场景 1：掩码与损失 ---------------- */
  var ROLES = [['system', 'neutral', '外壳提示'], ['user', 'data', 'issue 文本'], ['assistant', 'info', '思考 + bash'], ['tool', 'data', '测试输出'], ['assistant', 'info', '思考 + 编辑']];
  var TK = [['<sys>', 0], ['You fix bugs.', 0], ['<end>', 0], ['<user>', 0], ['test fails', 0], ['<end>', 0], ['<asst>', 0],
    ["I'll run…", 1], ['<tool_call>', 1], ['pytest -q', 1], ['</tool_call>', 1], ['<|im_end|>', 1],
    ['<tool>', 0], ['3 failed…', 0], ['<end>', 0], ['<asst>', 0], ['Use isclose.', 1], ['<|im_end|>', 1]];
  var LP = [null, null, null, null, null, null, null, -0.40, -0.05, -0.70, -0.02, -0.10, null, null, null, null, -0.90, -0.08];
  var TW = 82;
  function tx(i) { return 70 + (i < 9 ? i : i - 9) * TW; }
  function ty(i) { return i < 9 ? 236 : 330; }
  var CODE1 = { lang: 'py', title: '本机实跑的代码（精简）', src:
'# (角色, token, 示意的 log p)\n' +
'mask = [1 if role == "assistant" else 0\n' +
'        for role, _, _ in toks]\n' +
'loss = -sum(lp for (r, _, lp), m\n' +
'           in zip(toks, mask) if m)\n' +
'print(sum(mask), len(toks) - sum(mask))\n' +
'print(loss, loss / sum(mask))\n' };
  var sc1 = {
    name: '掩码与损失', desc: '先渲染成一条 token 序列，再给每个 token 一位掩码。只在 assistant 产生的 token 上算交叉熵，含回合结束（讲义第 11–15 页）。',
    code: CODE1, dataTitle: '实算', data: { 'token 总数': 0, '算损失的（m=1）': 0, '只当上下文（m=0）': 0, '损失 L': 0 }, dataFmt: { '损失 L': 'fixed2' },
    bg: function (d) {
      title(d, 'SFT：一条轨迹，只有智能体自己写的 token 算损失');
      d.text(30, 214, 'token（下一行数字是掩码 m，紫色是 log p）', { size: 11.5, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      ROLES.forEach(function (r, i) { o['r' + i] = { type: 'box', x: 120 + i * 150, y: 90, w: 140, h: 44, rx: 8, fill: C[r[1] + 'W'], stroke: C[r[1]], sw: 1.4, text: r[0], sub: r[2], subMono: false, subSize: 11, size: 12.5, weight: 700, mono: true, opacity: 0 }; });
      o.tpl = { type: 'box', x: 430, y: 170, w: 220, h: 36, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.5, text: 'apply_chat_template', size: 12.5, weight: 700, mono: true, opacity: 0 };
      o.p1 = wire('M430,114 L430,150', C.warn); o.p2 = wire('M430,188 L430,220', C.data);
      TK.forEach(function (t, i) {
        o['t' + i] = { type: 'box', x: tx(i), y: ty(i), w: 78, h: 30, rx: 4, fill: C.neutralW, stroke: C.neutral, sw: 1, text: t[0], size: 10, weight: 600, mono: true, opacity: 0 };
        o['m' + i] = { type: 'text', x: tx(i), y: ty(i) + 30, text: String(t[1]), size: 13, weight: 800, mono: true, color: t[1] ? C.bad : C.fg3, anchor: 'middle', opacity: 0 };
        if (LP[i] != null) o['lp' + i] = { type: 'text', x: tx(i), y: ty(i) + 50, text: LP[i].toFixed(2), size: 10.5, weight: 700, mono: true, color: C.info, anchor: 'middle', opacity: 0 };
      });
      o.sum = { type: 'box', x: 430, y: 432, w: 440, h: 48, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.6, text: 'L(θ) = − Σ_{t: m_t=1} log p_θ(x_t | x_<t)', size: 14, weight: 750, mono: true, opacity: 0 };
      o.res = { type: 'box', x: 330, y: 492, w: 220, h: 36, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, text: '', num: 0, fmt: 'fixed2', pre: 'L = ', size: 15, weight: 800, mono: true, opacity: 0 };
      o.note = { type: 'text', x: 620, y: 492, text: '观察只是条件上下文，不是预测目标', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '一条录下来的轨迹：外壳提示、issue、智能体的思考和命令。再往后是测试输出、再一次思考和编辑……内容是示意。', set: { r0: pop(0), r1: pop(150), r2: pop(300), r3: pop(450), r4: pop(600) } },
      (function () {
        var s = join({ tpl: pop(0) }, on('p1', 200), on('p2', 700));
        TK.forEach(function (_, i) { s['t' + i] = pop(900 + i * 50); });
        return { say: '聊天模板把整个对话渲染成一条 token 序列。每个边界都是一个特殊 token。', set: s, fx: [st('p1', 300, C.warn, 3), st('p2', 800, C.data, 3)], data: { 'token 总数': { v: 18, at: 1500 } } };
      })(),
      (function () {
        var s = {}; TK.forEach(function (t, i) { s['m' + i] = fade(i * 60); if (t[1]) s['t' + i] = { fill: { to: C.badW, dur: 300, delay: i * 60 }, stroke: { to: C.bad, dur: 300, delay: i * 60 } }; });
        return { say: '渲染时，模板记下每段 assistant 的起止。切成 token 后，这些位置记 1，其余记 0。训练器看不到角色，只看到字符串和这些位。', set: s, hl: [2, 3],
          data: { '算损失的（m=1）': { v: 7, at: 1000 }, '只当上下文（m=0）': { v: 11, at: 1000 } }, log: [{ s: 'mask: 000000011111000011', at: 1100 }] };
      })(),
      { say: '角色头 <|im_start|>assistant 是推理时由外壳给的，永远不是目标。可停止 token <|im_end|> 是模型自己产生的，必须在掩码里。否则模型可能学不会停。',
        fx: [{ type: 'flash', obj: 't6', color: C.neutral, at: 100 }, { type: 'flash', obj: 't15', color: C.neutral, at: 200 }, { type: 'pulse', obj: 't11', color: C.bad, at: 600 }, { type: 'pulse', obj: 't17', color: C.bad, at: 700 }] },
      (function () { var s = { sum: pop(600) }; for (var i = 0; i < 18; i++) if (LP[i] != null) s['lp' + i] = fade(i * 40); return { say: '模型给每个被训练的 token 一个对数概率，数是示意的。把它们加起来取负号，就是交叉熵。', set: s, hl: [4, 5] }; })(),
      { say: '7 个 token 的 log p 之和取负：L = 2.25，平均每个被训练的 token 0.3214。最小化它，就是提高每个记录下来的动作的概率。条件是前文。', set: { res: mix(pop(0), { num: { to: 2.25, dur: 800, delay: 200 } }), note: fade(800) }, hl: [7],
        data: { '损失 L': { v: 2.25, at: 400 } }, log: [{ s: '7 11', at: 200 }, { s: 'L = -sum log p over masked tokens = 2.25 ; mean per trained token = 0.3214', at: 500 }] }
    ]
  };

  /* ---------------- 场景 2：样本 vs token ---------------- */
  var CAT = [['STEM 和编程', 56, 89, 'data'], ['智能体能力', 11, 9, 'warn'], ['通用 + 安全', 33, 2, 'ok']];
  var sc2 = {
    name: '样本 vs token', desc: '按样本数配的比例，变成 token 之后完全变了样。长轨迹的类别吃掉了几乎所有 token（讲义第 18 页）。',
    bg: function (d) {
      title(d, '配比按样本算，损失按 token 算');
      d.text(90, 140, '按样本', { size: 13, weight: 700, color: C.fg2 }); d.text(90, 300, '按 token', { size: 13, weight: 700, color: C.fg2 });
      d.rect(160, 120, 600, 40, { fill: C.bg2, stroke: C.line, rx: 6 }); d.rect(160, 280, 600, 40, { fill: C.bg2, stroke: C.line, rx: 6 });
    },
    objects: function () {
      var o = {}, x1 = 160, x2 = 160;
      CAT.forEach(function (c, i) {
        o['s' + i] = { type: 'box', x: x1, y: 140, w: 0, h: 40, rx: 4, anchor: 'l', fill: C[c[3] + 'W'], stroke: C[c[3]], sw: 1.4, text: c[1] + '%', size: 13, weight: 750, opacity: 0 }; x1 += c[1] * 6;
        o['k' + i] = { type: 'box', x: x2, y: 300, w: 0, h: 40, rx: 4, anchor: 'l', fill: C[c[3] + 'W'], stroke: C[c[3]], sw: 1.4, text: c[2] + '%', size: 13, weight: 750, opacity: 0 }; x2 += c[2] * 6;
        o['l' + i] = { type: 'text', x: 200 + i * 200, y: 200, text: '■ ' + c[0], size: 12.5, weight: 700, color: C[c[3]], anchor: 'start', opacity: 0 };
      });
      o.fl = wire('M460,166 L460,276', C.bad);
      o.mul = { type: 'box', x: 430, y: 410, w: 520, h: 50, rx: 10, fill: C.badW, stroke: C.bad, sw: 1.4, text: '反推：STEM 和编程的轨迹平均是通用类的约 26 倍长', sub: '(89 ÷ 56) ÷ (2 ÷ 33) ≈ 26.2（智能体类约 13.5 倍）', subMono: false, subSize: 11.5, size: 13, weight: 750, opacity: 0 };
      o.tip = { type: 'text', x: 430, y: 480, text: '按条数配好之后，一定要检查它变成 token 后是什么样', size: 12.5, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 };
      return o;
    },
    steps: [
      { say: '一个真实的合并 SFT 数据配比。按样本条数，STEM 和编程 56%、智能体能力 11%、通用有用与安全 33%。', set: { s0: { opacity: { to: 1, dur: 150 }, w: { to: 336, dur: 700, ease: 'out' } }, s1: { opacity: { to: 1, dur: 150, delay: 300 }, w: { to: 66, dur: 500, delay: 300, ease: 'out' }, x: { from: 160, to: 496, dur: 1 } }, s2: { opacity: { to: 1, dur: 150, delay: 500 }, w: { to: 198, dur: 600, delay: 500, ease: 'out' }, x: { from: 160, to: 562, dur: 1 } }, l0: fade(0), l1: fade(200), l2: fade(400) } },
      { say: '可是损失是按 token 算的。把每条样本换成它的 token 数，再看一遍。', set: on('fl'), fx: [st('fl', 100, C.bad, 6)] },
      { say: '这下 STEM 和编程变成 89%，智能体 9%，通用和安全只剩 2%。通用和安全的轨迹短得多。', set: { k0: { opacity: { to: 1, dur: 150 }, w: { to: 534, dur: 900, ease: 'out' } }, k1: { opacity: { to: 1, dur: 150, delay: 400 }, w: { to: 54, dur: 500, delay: 400, ease: 'out' }, x: { from: 160, to: 694, dur: 1 } }, k2: { opacity: { to: 1, dur: 150, delay: 600 }, w: { to: 12, dur: 400, delay: 600, ease: 'out' }, x: { from: 160, to: 748, dur: 1 } } },
        fx: [{ type: 'pulse', obj: 'k0', color: C.data, at: 900 }] },
      { say: '反推平均长度：STEM 和编程的样本大约是通用类的 26 倍长（本机算的，假设讲义的百分比是精确的）。', set: { mul: pop(0) }, fx: [{ type: 'pulse', obj: 'k0', color: C.data, at: 600 }, { type: 'pulse', obj: 's0', color: C.data, at: 900 }], log: [{ s: 'STEM and Coding  samples 56%  tokens 89%  avg length relative to General = 26.2x', at: 300 }, { s: 'Agentic Capability  samples 11%  tokens  9%  relative = 13.5x', at: 900 }] },
      { say: '所以讲义提醒，用条数配平之后，要看它变成 token 后的比例。"目标领域之外的退化"那页又强调了一次。按条数配平，不等于按 token 配平。', set: { tip: fade(0) } },
      { say: '同一页还有一层意思。训练一种能力，其他能力也会跟着动，不管你量没量。所以本来没想提升的东西也要评测。', fx: [{ type: 'pulse', obj: 'k2', color: C.ok, at: 200 }, { type: 'pulse', obj: 's2', color: C.ok, at: 500 }] }
    ]
  };

  /* ---------------- 场景 3：打包整段对话 ---------------- */
  var CONVS = [29, 19, 17, 15, 11, 8, 7], CAPX = 640, PX0 = 170, KPX = CAPX / 64;
  var PL = { 29: [0, 0], 19: [0, 29], 17: [1, 0], 15: [0, 48], 11: [1, 17], 8: [1, 28], 7: [1, 36] };
  var PY = [300, 380];
  var sc3 = {
    name: '打包', desc: '训练用定长序列。与其每段对话补一大截 pad，不如装箱。把几段整段对话，装进同一条序列（讲义第 38 页）。',
    bg: function (d) {
      title(d, '打包：不切开、不截断，挑剩余空间最贴合的那条');
      d.text(PX0 - 14, 300, 'pack 1', { anchor: 'end', size: 12, weight: 700, color: C.fg2 }); d.text(PX0 - 14, 380, 'pack 2', { anchor: 'end', size: 12, weight: 700, color: C.fg2 });
      d.rect(PX0, 282, CAPX, 36, { fill: 'none', stroke: C.fg3, rx: 6, sw: 1.4 }); d.rect(PX0, 362, CAPX, 36, { fill: 'none', stroke: C.fg3, rx: 6, sw: 1.4 });
      d.text(PX0 + CAPX, 420, '每条 64k（示意）', { anchor: 'end', size: 11, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      CONVS.forEach(function (c, i) { o['c' + i] = { type: 'box', x: 120 + i * 100, y: 130, w: c * KPX, h: 30, rx: 5, anchor: 'l', fill: C.dataW, stroke: C.data, sw: 1.3, text: c + 'k', size: 12, weight: 700, opacity: 0, trail: { n: 4, gap: 40 } }; });
      o.u1 = { type: 'text', x: PX0 + 63 * KPX + 4, y: 300, text: '1k 空', size: 10.5, color: C.fg3, anchor: 'start', opacity: 0 };
      o.u2 = { type: 'text', x: PX0 + 43 * KPX + 10, y: 380, text: '21k 没用上', size: 11.5, color: C.fg3, anchor: 'start', opacity: 0 };
      o.cmp = { type: 'box', x: 430, y: 480, w: 600, h: 44, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, text: '一段一条：7 条序列，补 pad 342k。打包：2 条序列，补 pad 22k', size: 13, weight: 750, opacity: 0 };
      return o;
    },
    steps: (function () {
      var steps = [{ say: '7 段对话，长度 7k 到 29k（讲义第 38 页的数）。从长到短依次放。', set: (function () { var s = {}; CONVS.forEach(function (_, i) { s['c' + i] = pop(i * 80); }); return s; })() }];
      var say = { 29: '29k：还没有 pack，开 pack 1。', 19: '19k：pack 1 还剩 35k，放得下，放进去。', 17: '17k：pack 1 只剩 16k，放不下，开 pack 2。', 15: '15k：pack 1 剩 16k、pack 2 剩 47k，都放得下。挑剩余最少、最贴合的 pack 1。', 11: '11k、8k、7k：pack 1 只剩 1k，都进 pack 2。' };
      [29, 19, 17, 15].forEach(function (c) {
        var i = CONVS.indexOf(c), p = PL[c], s = {}; s['c' + i] = { x: { to: PX0 + p[1] * KPX, dur: 900, ease: 'inOut' }, y: { to: PY[p[0]], dur: 900, ease: 'inOut' } };
        steps.push({ say: say[c], set: s, fx: [{ type: 'ripple', x: PX0 + (p[1] + c / 2) * KPX, y: PY[p[0]], color: C.data, at: 900 }], log: [{ s: 'place ' + (c < 10 ? ' ' : '') + c + 'k -> pack ' + (p[0] + 1), at: 800 }] });
      });
      (function () {
        var s = { u1: fade(1600), u2: fade(1600) };
        [11, 8, 7].forEach(function (c, k) { var i = CONVS.indexOf(c), p = PL[c]; s['c' + i] = { x: { to: PX0 + p[1] * KPX, dur: 800, delay: k * 300, ease: 'inOut' }, y: { to: PY[p[0]], dur: 800, delay: k * 300, ease: 'inOut' } }; });
        steps.push({ say: say[11], set: s, log: [{ s: 'pack 1: [29, 19, 15] used 63k / 64k, unused 1k', at: 1200 }, { s: 'pack 2: [17, 11, 8, 7] used 43k / 64k, unused 21k', at: 1500 }] });
      })();
      steps.push({ say: '如果一段对话占一条序列，要补 342k 的 pad。打包后只补 22k。讲义强调，对话不切开、不截断，为的是防止幻觉。相同的提示不放进同一个 pack，装完再打乱。', set: { cmp: pop(0) },
        log: [{ s: 'if one conversation per sequence: 7 sequences, padding 342k ; packed: 2 sequences, padding 22k', at: 300 }] });
      return steps;
    })()
  };

  /* ---------------- 场景 4：训练和运行的错配 ---------------- */
  var sc4 = {
    name: '训练和运行的错配', desc: 'SFT 总是接着录好的轨迹，往下给一个动作打分。部署时没有录像，走错一步就进入训练没见过的状态（讲义第 42 页）。',
    bg: function (d) { title(d, '低损失不保证：一步走偏之后，模型在"数据里没有"的地方'); d.text(60, 150, '示范', { size: 12.5, weight: 700, color: C.fg2 }); d.text(60, 330, '它自己跑', { size: 12.5, weight: 700, color: C.bad }); },
    objects: function () {
      function nd(x, y, t, s, k, dash) { return { type: 'box', x: x, y: y, w: 140, h: 50, rx: 8, fill: C[k + 'W'], stroke: C[k], sw: 1.5, dasharray: dash ? '5 4' : null, text: t, sub: s, subMono: false, subSize: 11, size: 13, weight: 700, opacity: 0 }; }
      return {
        pre: nd(200, 240, '同样的前缀', 'issue + 第一次编辑', 'neutral'),
        a1: nd(400, 150, '编辑 A', '录下来的那个', 'ok'), a2: nd(580, 150, '测试通过', '预期的观察', 'ok'), a3: nd(760, 150, '提交', '任务完成', 'ok'),
        b1: nd(400, 330, '编辑 B', '合理但不同', 'bad'), b2: nd(580, 330, '测试失败', '没见过的观察', 'bad'), b3: nd(760, 330, '怎么办？', '数据里没有', 'bad', true),
        pa: wire('M270,232 C320,200 320,150 330,150', C.ok), pb: wire('M270,248 C320,280 320,330 330,330', C.bad),
        pa1: wire('M470,150 L510,150', C.ok), pa2: wire('M650,150 L690,150', C.ok), pb1: wire('M470,330 L510,330', C.bad), pb2: wire('M650,330 L690,330', C.bad),
        fix: { type: 'box', x: 430, y: 470, w: 640, h: 52, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.3, text: '解法：让模型在自己的轨迹上学，也就是下一讲的强化学习', sub: '同策略采样，模型被训练成能从自己的错误里恢复', subMono: false, subSize: 11.5, size: 13, weight: 750, opacity: 0 }
      };
    },
    steps: [
      { say: '训练时：同样的前缀之后，示范走的是编辑 A → 测试通过 → 提交。', set: join({ pre: pop(0), a1: pop(400), a2: pop(800), a3: pop(1200) }, on('pa', 300), on('pa1', 700), on('pa2', 1100)), fx: [st('pa', 300, C.ok, 3), st('pa1', 700, C.ok, 3), st('pa2', 1100, C.ok, 3)] },
      { say: 'SFT 每次只给一个动作打分，并且总是接着录好的那条往下走。模型从来没见过偏离之后的样子。', fx: [{ type: 'pulse', obj: 'a1', color: C.ok, at: 100 }, { type: 'pulse', obj: 'a2', color: C.ok, at: 400 }, { type: 'pulse', obj: 'a3', color: C.ok, at: 700 }] },
      { say: '部署时没有录像。模型写了一个合理但不同的编辑 B。', set: join({ b1: pop(400) }, on('pb', 200)), fx: [st('pb', 200, C.bad, 3)] },
      { say: '测试失败了。这是训练数据里从没出现过的观察。', set: join({ b2: pop(300) }, on('pb1', 100)), fx: [st('pb1', 100, C.bad, 3), { type: 'shake', obj: 'b2', at: 700 }] },
      { say: '接下来怎么办？这个状态训练里一次都没到过。低损失对这里会发生什么，毫无保证。', set: join({ b3: pop(300) }, on('pb2', 100)), fx: [st('pb2', 100, C.bad, 3)] },
      { say: '这就是下一讲要解决的"暴露偏差"。办法是让模型在自己生成的轨迹上训练。', set: { fix: pop(0) } }
    ]
  };

  VZ.register({
    id: 'c5-sft', title: 'SFT：掩码、配比、打包与错配',
    sources: [{ t: '第 8 讲（Supervised Fine-Tuning）', u: YT }, { t: '讲义 lecture-08 第 11–18、38、42 页', u: L8 }],
    note: '场景 1 的三步和"停止 token 必须在掩码里"照讲义第 13–15 页。小轨迹和每个 token 的 log p 是示意。掩码位和 2.25 是本机实算的。场景 2 的百分比照第 18 页，26 倍是反推。场景 3 的对话长度照第 38 页。64k 容量是示意，装箱结果是实跑。场景 4 照第 42 页。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

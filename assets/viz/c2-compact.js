/* 02 · 第 3 讲 —— 上下文压缩：一次真实的压缩、四个策略决定、反复压缩的漂移
 * 场景 1：CI 超时的例子照讲义 lecture-03 第 46 页；消息内容是示意（日志是脚本生成的 200 行），
 *         每条消息的字符数、压缩前后的条数和字符数都是 本机验算脚本 第 8 部分实跑（run-verify.txt）。摘要是手写的示意，没有调模型。
 * 场景 2：留什么（第 48 页）和 Trigger / Select / Replace / Recover（第 49 页）照讲义。
 * 场景 3：CUDA 12.4 → 12.x → recent → missing 和 ŝ_{k+1} = C(ŝ_k ⊕ R_k) 照讲义第 50 页；"删邮件"一例出自第 1 讲 2:54。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L3 = 'https://www.cmu-agents.com/slides/lecture-03-long-context.pdf', YT = 'https://youtu.be/AiwCCvFW1uE';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }

  /* ---------------- 场景 1：一次压缩 ---------------- */
  var MSG = [['system · 指令', 75, 'neutral'], ['user · 任务 + 约束', 69, 'neutral'], ['run_ci()', 8, 'info'], ['CI 30 分钟超时', 34, 'data'],
    ['read_log("ci.log")', 18, 'info'], ['日志 200 行：address already in use…', 11999, 'data'], ['grep -c …', 39, 'info'], ['24000', 5, 'data'],
    ['run_ci(workers=1)', 17, 'info'], ['Suite passes; log at /tmp/ci.log', 38, 'ok']];
  var KIND = ['anchor', 'anchor', 'old', 'old', 'old', 'old', 'old', 'old', 'tail', 'tail'];
  var LX = 170, Y0 = 82, DY = 40, CW = 270;
  function my(i) { return Y0 + i * DY; }
  var CODE1 = { lang: 'py', title: '本机实跑 · 第 8 部分（精简）', src:
'size = lambda ms: sum(len(m[2]) for m in ms)\n' +
'print(size(msgs))               # 12302\n' +
'anchors = [m for m in msgs if m[1] == "anchor"]\n' +
'tail = [m for m in msgs if m[1] == "tail"]\n' +
'old = [m for m in msgs if m[1] == "old"]\n' +
'checkpoint = ("Goal: fix CI timeout. "\n' +
'  "Cause: port collision (…24000 times). "\n' +
'  "Verified: --workers=1 passes. "\n' +
'  "Evidence: /tmp/ci.log. Next: open the PR")\n' +
'after = anchors + [("user", "summary",\n' +
'                    checkpoint)] + tail\n' +
'print(len(after), size(after))   # 5 368\n' };
  var sc1 = {
    name: '一次压缩', desc: '历史超过阈值时，原始指令和任务原样留下。最近一步完整的"动作 + 观察"也原样留下。中间的旧历史换成一段结构化摘要（讲义第 46、48 页）。',
    code: CODE1, dataTitle: '上下文', data: { '消息条数': 10, '字符数': 12302, '占原来': 100 }, dataFmt: { '占原来': 'pct1' }, dataMeter: { '字符数': [0, 12302, C.bad] },
    bg: function (d) { title(d, '压缩 = 用一个短的"工作状态"代替长历史'); d.text(LX, 54, '消息列表', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 }); },
    objects: function () {
      var o = {};
      MSG.forEach(function (m, i) {
        o['m' + i] = { type: 'box', x: LX, y: my(i), w: CW, h: 32, rx: 6, fill: C[m[2] + 'W'], stroke: C[m[2]], sw: 1.3, text: m[0], size: 11.5, weight: 650, mono: true, trail: { n: 4, gap: 40 } };
        o['z' + i] = { type: 'text', x: LX + CW / 2 + 12, y: my(i), text: m[1] + ' 字', size: 11, mono: true, color: i === 5 ? C.bad : C.fg3, anchor: 'start', weight: i === 5 ? 750 : 500 };
      });
      o.th = { type: 'line', x1: 40, y1: 300, x2: 360, y2: 300, stroke: C.bad, sw: 2, opacity: 0 };
      o.thl = { type: 'text', x: 360, y: 290, text: '超过阈值 → 触发', size: 11.5, weight: 700, color: C.bad, anchor: 'end', opacity: 0 };
      o.cp = { type: 'box', x: 640, y: 250, w: 180, h: 70, rx: 12, fill: C.infoW, stroke: C.info, sw: 1.8, text: '压缩器', sub: '让模型写工作状态', subMono: false, subSize: 11, size: 15, weight: 750, opacity: 0 };
      o.sum = { type: 'box', x: 640, y: 400, w: 330, h: 74, rx: 8, fill: C.warnW, stroke: C.warn, sw: 1.5, text: 'Goal·Cause·Verified·Evidence·Next', sub: '169 字的结构化检查点（示意）', subMono: false, subSize: 11, size: 11.5, weight: 700, mono: true, opacity: 0 };
      o.pIn = wire('M310,250 C420,250 460,250 548,250', C.data);
      o.pOut = wire('M640,288 L640,360', C.warn);
      o.tagA = { type: 'text', x: 372, y: my(0) + 20, text: '← 锚点：原样保留', size: 11.5, weight: 700, color: C.ok, anchor: 'start', opacity: 0 };
      o.tagT = { type: 'text', x: 372, y: my(8) + 20, text: '← 最近尾部：原样保留', size: 11.5, weight: 700, color: C.ok, anchor: 'start', opacity: 0 };
      return o;
    },
    steps: [
      { say: '修 CI 超时的一段历史（讲义第 46 页的例子，内容示意）：10 条消息，12302 个字符。', fx: [{ type: 'pulse', obj: 'm5', color: C.bad, at: 300 }], hl: [1, 2], log: [{ s: 'before: 10 messages, 12302 chars', at: 300 }] },
      { say: '其中一条日志就占了 11999 字，越过了阈值：触发压缩。', set: { th: fade(0), thl: fade(200) }, fx: [{ type: 'shake', obj: 'm5', at: 300 }] },
      { say: '选择：系统指令和任务是锚点，原样保留。里面有约束"不许调高 30 分钟上限"。', set: { tagA: fade(0), m0: { stroke: { to: C.ok, dur: 300 }, sw: { to: 2.5, dur: 300 } }, m1: { stroke: { to: C.ok, dur: 300 }, sw: { to: 2.5, dur: 300 } } }, hl: [3],
        fx: [{ type: 'pulse', obj: 'm0', color: C.ok, at: 100 }, { type: 'pulse', obj: 'm1', color: C.ok, at: 250 }] },
      { say: '最近一步"动作 + 它的观察"也原样保留。要在完整的工具回合边界上切，不能把调用和结果拆开。', set: { tagT: fade(0), m8: { stroke: { to: C.ok, dur: 300 }, sw: { to: 2.5, dur: 300 } }, m9: { sw: { to: 2.5, dur: 300 } } }, hl: [4],
        fx: [{ type: 'pulse', obj: 'm8', color: C.ok, at: 100 }, { type: 'pulse', obj: 'm9', color: C.ok, at: 250 }] },
      (function () {
        var s = join({ cp: pop(0) }, on('pIn', 200));
        for (var i = 2; i < 8; i++) { s['m' + i] = { x: { to: 640, dur: 800, delay: 400 + (i - 2) * 120, ease: 'in' }, y: { to: 250, dur: 800, delay: 400 + (i - 2) * 120, ease: 'in' }, w: { to: 60, dur: 800, delay: 400 + (i - 2) * 120 }, opacity: { to: 0, dur: 250, delay: 1100 + (i - 2) * 120 } }; s['z' + i] = fade(300 + (i - 2) * 120, 200, 0); }
        return { say: '中间 6 条旧历史送进压缩器。让模型写一份事实性的工作记忆。', set: s, hl: [5], fx: [st('pIn', 300, C.data, 6), { type: 'pulse', obj: 'cp', color: C.info, at: 1500 }] };
      })(),
      { say: '替换：吐出一段结构化检查点。里面有目标、原因、已验证的做法、证据放在哪、下一步。', set: join(on('pOut'), { sum: pop(500) }), hl: [6, 7, 8, 9], fx: [st('pOut', 100, C.warn, 4)] },
      { say: '检查点放回锚点和尾部中间。尾部上移补位。', set: { sum: { x: { to: LX, dur: 900, ease: 'inOut' }, y: { to: my(2) + 22, dur: 900, ease: 'inOut' }, w: { to: CW, dur: 900 }, h: { to: 60, dur: 900 } }, m8: { y: { to: my(3) + 36, dur: 800, delay: 300, ease: 'inOut' } }, m9: { y: { to: my(4) + 36, dur: 800, delay: 400, ease: 'inOut' } },
          z8: { y: { to: my(3) + 36, dur: 800, delay: 300, ease: 'inOut' } }, z9: { y: { to: my(4) + 36, dur: 800, delay: 400, ease: 'inOut' } }, tagT: { y: { to: my(3) + 56, dur: 800, delay: 300 } }, th: fade(0, 300, 0), thl: fade(0, 300, 0), cp: fade(600, 300, 0.4), pIn: { opacity: { to: 0, dur: 300 } }, pOut: { opacity: { to: 0, dur: 300 } } },
        hl: [10, 11], fx: [{ type: 'ripple', x: LX, y: my(2) + 22, color: C.warn, at: 900 }] },
      { say: '结果：10 条变 5 条，12302 字变 368 字，只剩原来的 3.0%。约束原文还在，修复的证据也有指针。', hl: [12],
        data: { '消息条数': { v: 5, at: 200 }, '字符数': { v: 368, at: 200 }, '占原来': { v: 3.0, at: 400 } }, log: [{ s: 'after:  5 messages, 368 chars (3.0% of before)', at: 300 }] }
    ]
  };

  /* ---------------- 场景 2：留什么、怎么做 ---------------- */
  var BX = [140, 330, 520, 710], BN = [['1 · Trigger', '触发', 'token 阈值 · 服务商溢出 · 手动'], ['2 · Select', '选择', '保护开头 · 压旧区 · 留尾部'], ['3 · Replace', '替换', '可读摘要 · 结构化检查点 · 新上下文'], ['4 · Recover', '恢复', '历史不动 · 重试或重置 · 可搜索']];
  var sc2 = {
    name: '四个决定', desc: '压缩时要定四件事。什么时候触发，选哪段压，换成什么，压坏了怎么恢复。压完留下的是锚点、检查点、最近尾部和外置证据（讲义第 48–49 页）。',
    bg: function (d) { title(d, '压缩策略：Trigger → Select → Replace → Recover'); d.text(430, 280, '压缩后，模型看得见的上下文', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 }); },
    objects: function () {
      var o = {};
      BN.forEach(function (b, i) {
        o['b' + i] = { type: 'box', x: BX[i], y: 140, w: 170, h: 96, rx: 10, fill: i === 3 ? C.badW : C.bg2, stroke: i === 3 ? C.bad : C.fg3, sw: 1.6, text: b[0], sub: b[2], subMono: false, subSize: 10.5, size: 13.5, weight: 750, opacity: 0 };
        if (i < 3) o['w' + i] = wire('M' + (BX[i] + 86) + ',140 L' + (BX[i + 1] - 86) + ',140', C.warn);
      });
      o.k1 = { type: 'box', x: 175, y: 340, w: 230, h: 60, rx: 8, fill: C.neutralW, stroke: C.fg2, sw: 1.5, text: '原样保留 · 锚点', sub: '目标 · 约束', subMono: false, size: 13, weight: 750, opacity: 0 };
      o.k2 = { type: 'box', x: 430, y: 340, w: 230, h: 60, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.5, text: '编码 · 检查点', sub: '决定 · 进度 · ID', subMono: false, size: 13, weight: 750, opacity: 0 };
      o.k3 = { type: 'box', x: 685, y: 340, w: 230, h: 60, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.5, text: '原样保留 · 最近尾部', sub: '当前尝试 · 新鲜结果', subMono: false, size: 13, weight: 750, opacity: 0 };
      o.ev = { type: 'box', x: 430, y: 450, w: 330, h: 54, rx: 8, fill: C.bg2, stroke: C.data, sw: 1.5, text: '外置 · 证据库', sub: '24K 行日志 → 3 个失败 + 命令 + 产物路径', subMono: false, size: 13, weight: 750, opacity: 0 };
      o.ds = { type: 'box', x: 720, y: 460, w: 190, h: 48, rx: 8, fill: C.bg, stroke: C.neutral, sw: 1.3, dasharray: '5 4', text: '丢弃', sub: '重复 · 被取代的尝试', subMono: false, size: 12.5, weight: 700, opacity: 0 };
      o.pEv = wire('M430,372 L430,420', C.data);
      return o;
    },
    steps: [
      { say: '触发：常见的是 token 阈值。也可能是服务商报上下文溢出，或者用户手动要求。要给下一次输出留够空间。', set: { b0: pop(0) }, fx: [{ type: 'pulse', obj: 'b0', color: C.fg3, at: 500 }] },
      { say: '选择：保护开头，压缩较旧的区域，保留最近的尾部。要在合法的回合或工具调用边界上切。', set: join(on('w0'), { b1: pop(300) }), fx: [st('w0', 0, C.warn, 3)] },
      { say: '替换成什么有四种。可读的摘要，结构化的检查点，服务商不透明的压缩条目。或者干脆开一个全新上下文。', set: join(on('w1'), { b2: pop(300) }), fx: [st('w1', 0, C.warn, 3)] },
      { say: '恢复：压坏了怎么办？保留原历史不动、重试或重置、让完整历史可被搜索。压缩失败时怎么办，要事先定义。', set: join(on('w2'), { b3: pop(300) }), fx: [st('w2', 0, C.warn, 3), { type: 'pulse', obj: 'b3', color: C.bad, at: 800 }] },
      { say: '压完之后留下：原样的锚点、编码过的检查点、原样的最近尾部。', set: { k1: pop(0), k2: pop(250), k3: pop(500) } },
      { say: '大块证据外置到证据库，上下文里只放指针。重复和被取代的尝试丢掉。', set: join(on('pEv'), { ev: pop(300), ds: pop(600) }), fx: [st('pEv', 300, C.data, 4)] },
      { say: '讲义把压缩看成"状态估计"。拿工作状态代替全部历史，后续动作要差不多。同时大小有上限，证据可追回。', fx: [{ type: 'pulse', obj: 'k1', color: C.ok, at: 100 }, { type: 'pulse', obj: 'k2', color: C.ok, at: 300 }, { type: 'pulse', obj: 'k3', color: C.ok, at: 500 }] }
    ]
  };

  /* ---------------- 场景 3：反复压缩的漂移 ---------------- */
  var DX = [130, 320, 510, 700], DT = ['History', 'Summary 1', 'Summary 2', 'Summary 3'], DV = ['Use CUDA 12.4', 'Use CUDA 12.x', 'Use recent CUDA', 'Constraint missing'];
  var EQ3 = VZ.eq('d', ['ŝₖ₊₁ = C(', { t: 'ŝₖ', k: 'warn', w: 44 }, '⊕', { t: 'Rₖ', k: 'data', w: 44 }, ')'], 430, 230, { size: 16 });
  var sc3 = {
    name: '反复压缩的漂移', desc: '每次压缩都以上一份摘要为输入。约束一点点变模糊，最后彻底丢掉（讲义第 50 页）。对策：锚点原样复制、留尾部、能回查原始证据。',
    bg: function (d) { title(d, '反复压缩：每份摘要都继承上一份的检查点'); },
    objects: function () {
      var o = {};
      DX.forEach(function (x, i) {
        o['s' + i] = { type: 'box', x: x, y: 120, w: 170, h: 64, rx: 10, fill: i === 3 ? C.badW : C.bg2, stroke: i === 3 ? C.bad : C.data, sw: 1.6, text: DT[i], sub: DV[i], subMono: false, subSize: 11.5, size: 13.5, weight: 750, opacity: 0 };
        if (i < 3) o['w' + i] = wire('M' + (x + 88) + ',120 L' + (DX[i + 1] - 88) + ',120', C.bad);
      });
      for (var k in EQ3.objs) o[k] = EQ3.objs[k];
      o.lane = { type: 'box', x: 415, y: 330, w: 760, h: 40, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.5, text: '锚点每次原样复制：Use CUDA 12.4', size: 13, weight: 750, mono: false, opacity: 0 };
      o.f1 = { type: 'box', x: 210, y: 400, w: 240, h: 40, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.3, text: '保留最近尾部', size: 13, weight: 700, opacity: 0 };
      o.f2 = { type: 'box', x: 470, y: 400, w: 240, h: 40, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.3, text: '能检索原始证据', size: 13, weight: 700, opacity: 0 };
      o.ex = { type: 'box', x: 430, y: 490, w: 640, h: 44, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, dasharray: '5 4', text: '第 1 讲的删邮件事故：压缩时丢了"动手前先问我"，智能体随后清空了收件箱', size: 12.5, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '原始历史里有一条约束：Use CUDA 12.4。', set: { s0: pop(0) } },
      { say: '第一次压缩：摘要写成了 "12.x"。版本号被概括了。', set: join(on('w0'), { s1: pop(400) }), fx: [st('w0', 0, C.bad, 3)] },
      { say: '第二次压缩的输入是上一份摘要加新的历史：ŝₖ₊₁ = C(ŝₖ ⊕ Rₖ)。摘要的摘要更模糊："recent CUDA"。', set: join(on('w1'), { s2: pop(400) }, VZ.show(EQ3, 600, 80)), fx: [st('w1', 0, C.bad, 3)] },
      { say: '第三次：约束干脆没了。错误不会自己消失，而是一代代往下传。', set: join(on('w2'), { s3: pop(400) }), fx: [st('w2', 0, C.bad, 3), { type: 'shake', obj: 's3', at: 900 }] },
      { say: '对策一：锚点不进摘要，每次原样复制到新的上下文里。', set: { lane: { opacity: { to: 1, dur: 300 }, w: { from: 0, to: 760, dur: 900, ease: 'out' } } }, fx: [{ type: 'burst', obj: 'lane', color: C.ok, at: 900 }] },
      { say: '对策二、三：保留最近的尾部，保留能回查原始证据的路径。要检索源头，而不是只信摘要。', set: { f1: pop(0), f2: pop(250) } },
      { say: '这正是第 1 讲开场那起事故的成因。评测压缩策略要看"续写"。植入约束和决定，压缩，再看之后的决定还对不对。还要看反复压缩稳不稳。', set: { ex: pop(0) } }
    ]
  };

  VZ.register({
    id: 'c2-compact', title: '上下文压缩：留什么、怎么换、怎么不走样',
    sources: [{ t: '第 3 讲（压缩部分）', u: YT }, { t: '讲义 lecture-03 第 45–51 页', u: L3 }, { t: '第 1 讲 2:54（删邮件事故）', u: 'https://youtu.be/UwfjzyLnvMg?t=174' }],
    note: '场景 1 的例子照讲义第 46 页。消息内容是示意，200 行日志由脚本生成。条数和字符数是本机实跑的。摘要是手写的示意，实际要让模型生成。场景 2 照第 48–49 页。场景 3 的四份摘要和公式照第 50 页，对策照第 50 页下方三条。评测方式照第 51 页。',
    scenes: [sc1, sc2, sc3]
  });
})();

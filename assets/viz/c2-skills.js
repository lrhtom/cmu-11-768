/* 02 · 第 4 讲 —— 技能与记忆：渐进披露、技能的生命周期、文本技能 vs 代码技能、记忆冲突的四种操作
 * 场景 1：三级加载照讲义 lecture-04 第 9–11 页；两个 SKILL.md 是作业 1 仓库里的真实文件，元数据 / 全文的字符数是 本机验算脚本 第 7 部分实算。
 * 场景 2：LEARN / USE / MAINTAIN 照第 25 页；网店任务照第 22、24、26 页。
 * 场景 3：41.3 / 59.5 / 80.2 和 24.5 / 20.6 / 15.0 照第 33 页（五个 WebArena 站点的平均）；50 步 vs 4 步照第 32 页。
 * 场景 4：ADD / UPDATE / DELETE / NOOP 照第 18 页；对话内容和"按键匹配"的规则是示意（真实系统让 LLM 决定），结果是 verify.py 第 9 部分实跑。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var L4 = 'https://www.cmu-agents.com/slides/lecture-04-memory-and-skills.pdf', YT = 'https://youtu.be/6zigF2a-2Pw';
  function title(d, t) { d.text(430, 30, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }
  function key(col) { return col === C.data ? 'data' : col === C.ok ? 'ok' : col === C.warn ? 'warn' : col === C.info ? 'info' : col === C.bad ? 'bad' : 'fg3'; }
  function wire(d, col, op) { return { type: 'path', d: d, stroke: col, sw: 2, flow: 0, flowColor: col, arrow: key(col), opacity: op == null ? 0 : op }; }
  function on(n, d0) { var s = {}; s[n] = { opacity: { to: 1, dur: 250, delay: d0 || 0 }, flow: { to: 1, dur: 250, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 4, gap: 110, dur: 650, at: at || 0, color: col }; }
  function card(x, y, w, t, k, op, size, h) { return { type: 'box', x: x, y: y, w: w, h: h || 30, rx: 6, fill: C[k + 'W'], stroke: C[k], sw: 1.3, text: t, size: size || 11.5, weight: 650, mono: true, opacity: op == null ? 0 : op }; }

  /* ---------------- 场景 1：渐进披露 ---------------- */
  var CODE1 = { lang: 'text', title: 'tasks/code-skills/submit-task/SKILL.md（作业 1，节选）', src:
'---\n' +
'name: submit-task\n' +
'description: When the task is complete, take\n' +
'  the required steps to submit the solution.\n' +
'  DO NOT submit without invoking this skill.\n' +
'---\n' +
'When you have finished, you must submit your\n' +
'changes as a git patch, in three separate steps.\n' +
'# Step 1: Create the patch file\n' +
'Run `git diff -- path/to/file1 … > patch.txt`\n' +
'# Step 2: Verify the patch\n' +
'# Step 3: Submit\n' +
'Call `send_message` with a summary of the work.\n' };
  var CX = 200, CTX = 650;
  var sc1 = {
    name: '渐进披露', desc: '名字和描述总是放在系统提示里。正文在智能体调用时，才作为工具结果进来。附带的脚本只有输出进上下文（讲义第 9–11 页）。',
    code: CODE1, dataTitle: '进上下文的字符数（实算）', data: { 'submit-task 元数据': 0, 'submit-task 全文': 0, 'select-move 元数据': 0, 'select-move 全文': 0 },
    bg: function (d) {
      title(d, '渐进披露：技能分三级，用到才加载');
      d.text(CX, 70, '技能包（磁盘上）', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.text(CTX, 70, '模型的上下文', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.rect(CTX - 160, 86, 320, 440, { fill: C.bg2, stroke: C.line, rx: 12, sw: 1.3 });
    },
    objects: function () {
      return {
        pk: { type: 'box', x: CX, y: 210, w: 250, h: 230, rx: 12, fill: C.bg2, stroke: C.fg3, sw: 1.5, text: '', opacity: 0 },
        l1: card(CX, 130, 220, 'SKILL.md · YAML 元数据', 'info', 0, 11.5), l2: card(CX, 175, 220, 'SKILL.md · Markdown 正文', 'data', 0, 11.5),
        l3: card(CX, 220, 220, 'scripts/run_checks.py', 'warn', 0, 11.5), l4: card(CX, 265, 220, 'references/docstring.md', 'neutral', 0, 11.5),
        lv: { type: 'text', x: CX, y: 300, text: '第 1 级 · 第 2 级 · 第 3 级', size: 11.5, color: C.fg3, anchor: 'middle', opacity: 0 },
        c1: card(CTX, 130, 290, '系统提示 · 技能目录（名字 + 描述）', 'info', 0, 11.5, 40),
        c2: card(CTX, 205, 290, 'tool 结果：SKILL.md 正文', 'data', 0, 11.5, 60),
        c3: card(CTX, 285, 290, 'tool 结果：脚本的输出（代码不进来）', 'warn', 0, 11.5, 40),
        c4: card(CTX, 345, 290, 'tool 结果：docstring 规则', 'neutral', 0, 11.5, 40),
        p1: wire('M310,130 C400,130 420,130 500,130', C.info), p2: wire('M310,175 C400,175 420,205 500,205', C.data),
        p3: wire('M310,220 C400,240 420,285 500,285', C.warn), p4: wire('M310,265 C400,300 420,345 500,345', C.neutral),
        call: { type: 'text', x: 420, y: 160, text: "skill_view('python-review')", size: 11, mono: true, weight: 700, color: C.data, anchor: 'middle', opacity: 0 },
        bars: { type: 'text', x: CTX, y: 418, text: '作业 1 的两个真实技能：元数据 / 全文', size: 12, weight: 700, color: C.fg2, anchor: 'middle', opacity: 0 },
        b1: { type: 'box', x: CTX - 140, y: 458, w: 0, h: 16, rx: 3, anchor: 'l', fill: C.info, stroke: C.info, opacity: 0 },
        b1f: { type: 'box', x: CTX - 140, y: 458, w: 0, h: 16, rx: 3, anchor: 'l', fill: 'none', stroke: C.info, sw: 1.2, dasharray: '3 3', opacity: 0 },
        b2: { type: 'box', x: CTX - 140, y: 506, w: 0, h: 16, rx: 3, anchor: 'l', fill: C.info, stroke: C.info, opacity: 0 },
        b2f: { type: 'box', x: CTX - 140, y: 506, w: 0, h: 16, rx: 3, anchor: 'l', fill: 'none', stroke: C.info, sw: 1.2, dasharray: '3 3', opacity: 0 },
        t1: { type: 'text', x: CTX - 140, y: 436, text: 'submit-task：148 / 1278（11.6%）', size: 11, mono: true, color: C.fg2, anchor: 'start', opacity: 0 },
        t2: { type: 'text', x: CTX - 140, y: 488, text: 'select-move：61 / 4771（1.3%）', size: 11, mono: true, color: C.fg2, anchor: 'start', opacity: 0 }
      };
    },
    steps: [
      { say: '一个技能是一个文件夹：必需的 SKILL.md（指令 + 元数据），可选的 scripts/、references/、assets/。', set: { pk: pop(0), l1: pop(200), l2: pop(350), l3: pop(500), l4: pop(650), lv: fade(800) }, hl: [1, 2, 3, 4, 5, 6] },
      { say: '第 1 级：每个技能只把名字和描述放进系统提示。它们组成"技能目录"。这一级总是加载。讲师说 Hermes 的目录约 3K token。', set: join(on('p1'), { c1: pop(500) }), fx: [st('p1', 100, C.info, 4)], hl: [2, 3, 4, 5] },
      { say: '模型看到描述，判断这个任务用得上，就调用 skill_view。SKILL.md 正文作为一次工具结果进来。', set: join(on('p2'), { call: fade(0), c2: pop(600) }), fx: [st('p2', 200, C.data, 5)], hl: [7, 8, 9, 10, 11, 12, 13] },
      { say: '第 3 级：正文让它跑一个脚本。进上下文的只有脚本的输出，也就是 Black、Ruff 的检查结果。脚本代码本身从不进来。', set: join(on('p3'), { c3: pop(500) }), fx: [st('p3', 100, C.warn, 4)] },
      { say: '参考文档也一样：只有模型点名要读时才加载。', set: join(on('p4'), { c4: pop(500) }), fx: [st('p4', 100, C.neutral, 4)] },
      { say: '看看作业 1 的两个真实技能。submit-task 的元数据 148 字符，全文 1278 字符。目录里只占全文的 11.6%。', set: { bars: fade(0), t1: fade(100), b1f: { opacity: { to: 1, dur: 200, delay: 200 }, w: { to: 280, dur: 700, delay: 200 } }, b1: { opacity: { to: 1, dur: 200, delay: 700 }, w: { to: 280 * 148 / 1278, dur: 600, delay: 700 } } },
        data: { 'submit-task 元数据': { v: 148, at: 900 }, 'submit-task 全文': { v: 1278, at: 500 } }, log: [{ s: 'code-skills/submit-task/SKILL.md   metadata  148 chars | full file  1278 chars | ratio 11.6%', at: 900 }] },
      { say: '下棋的 select-move 更悬殊。61 字符的描述，背后是 4771 字符的完整策略，只占 1.3%。技能越多，渐进披露省得越多。', set: { t2: fade(100), b2f: { opacity: { to: 1, dur: 200, delay: 200 }, w: { to: 280, dur: 700, delay: 200 } }, b2: { opacity: { to: 1, dur: 200, delay: 700 }, w: { to: 280 * 61 / 4771, dur: 600, delay: 700 } } },
        data: { 'select-move 元数据': { v: 61, at: 900 }, 'select-move 全文': { v: 4771, at: 500 } }, log: [{ s: 'chess-skills/select-move/SKILL.md  metadata   61 chars | full file  4771 chars | ratio 1.3%', at: 900 }] }
    ]
  };

  /* ---------------- 场景 2：技能的生命周期 ---------------- */
  var LX = [120, 250, 380, 510, 680], LN = ['episode', 'judge', 'induce', 'admit', 'memory'];
  var UX = [680, 510, 380, 250], UN = ['memory', 'retrieve', 'act', 'outcome'];
  var MX = [250, 380, 510], MN = ['repair', 'retire', 'add'];
  var sc2 = {
    name: '技能的生命周期', desc: '学：一次成功的经历经评判、归纳、准入后进记忆。用：检索、执行、产生结果。维护：根据结果修补、淘汰、增加（讲义第 25 页）。',
    bg: function (d) {
      title(d, '归纳出的技能：LEARN → USE → MAINTAIN');
      d.text(68, 92, 'LEARN 学', { size: 12, weight: 750, color: C.bad }); d.text(198, 242, 'USE 用', { size: 12, weight: 750, color: C.bad }); d.text(330, 392, 'MAINTAIN 维护', { size: 12, weight: 750, color: C.bad });
    },
    objects: function () {
      var o = {};
      LN.forEach(function (n, i) { o['L' + i] = card(LX[i], 120, i === 4 ? 140 : 104, n, i === 4 ? 'ok' : i === 0 ? 'data' : 'warn', 0, 12.5, 34); if (i < 4) o['lw' + i] = wire('M' + (LX[i] + 54) + ',120 L' + (LX[i + 1] - (i === 3 ? 72 : 54)) + ',120', C.warn); });
      UN.forEach(function (n, i) { if (i) o['U' + i] = card(UX[i], 270, 104, n, i === 3 ? 'data' : 'info', 0, 12.5, 34); });
      o.uw0 = wire('M680,140 C680,200 600,270 564,270', C.ok); o.uw1 = wire('M456,270 L434,270', C.info); o.uw2 = wire('M326,270 L304,270', C.info);
      MN.forEach(function (n, i) { o['M' + i] = card(MX[i], 420, 104, n, 'bad', 0, 12.5, 34); });
      o.mw0 = wire('M250,290 C250,350 250,370 250,400', C.bad); o.mw1 = wire('M304,420 L326,420', C.bad); o.mw2 = wire('M434,420 L456,420', C.bad); o.mw3 = wire('M564,420 C640,420 690,300 690,140', C.ok);
      o.ep = { type: 'box', x: 300, y: 190, w: 380, h: 44, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.2, text: 'click("Marketing") click("All Reviews") fill(757, …) …', size: 10.5, weight: 650, mono: true, opacity: 0 };
      o.sk = { type: 'box', x: 680, y: 190, w: 260, h: 44, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, text: 'search_reviews(box, btn, term)', size: 11.5, weight: 700, mono: true, opacity: 0 };
      o.nt = { type: 'box', x: 420, y: 335, w: 300, h: 34, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '新任务：找提到 "great" 的评价有几条', size: 12, weight: 650, opacity: 0 };
      return o;
    },
    steps: [
      { say: '一次经历（episode）：智能体在网店后台数出了提到 "satisfied" 的评价有 2 条（讲义第 26 页）。', set: { L0: pop(0), ep: pop(300) } },
      { say: '评判（judge）：先判断这次最终状态对不对。只从成功的经历里学。', set: join(on('lw0'), { L1: pop(300) }), fx: [st('lw0', 100, C.warn, 3), { type: 'float', x: 250, y: 92, text: '成功', color: C.ok, size: 14, at: 700 }] },
      { say: '归纳（induce）：让模型从动作序列里抽出可复用的部分。具体的词换成变量，比如 search_reviews(…, term)。', set: join(on('lw1'), { L2: pop(300) }), fx: [st('lw1', 100, C.warn, 3)] },
      { say: '准入（admit）：代码技能可以先拿同一个任务重跑一遍。用到了技能、结果也对，才放进记忆。', set: join(on('lw2'), { L3: pop(300) }, on('lw3', 700), { L4: pop(1000), sk: pop(1300) }), fx: [st('lw2', 100, C.warn, 3), st('lw3', 800, C.ok, 3)] },
      { say: '使用：新任务来了（"great" 有几条），从记忆里检索出相关技能。', set: join({ nt: pop(0) }, on('uw0', 300), { U1: pop(500) }), fx: [st('uw0', 400, C.ok, 4)] },
      { say: '一次调用代替好几步底层操作，执行后得到结果。', set: join(on('uw1'), { U2: pop(300) }, on('uw2', 600), { U3: pop(900) }), fx: [st('uw1', 100, C.info, 3), st('uw2', 700, C.info, 3)] },
      { say: '维护：结果说明技能有毛病（比如网站改版），就修补。长期不用的淘汰。发现新的模式就增加。', set: join(on('mw0'), { M0: pop(300), M1: pop(500), M2: pop(700) }, on('mw1', 400), on('mw2', 600), on('mw3', 900)),
        fx: [st('mw0', 100, C.bad, 3), st('mw3', 1000, C.ok, 4), { type: 'pulse', obj: 'L4', color: C.ok, at: 1600 }] },
      { say: '讲义第 24 页的在线设定：评测任务一个接一个来。每做成一个就更新记忆，下一个任务就能用上。记忆会随评测流增长。', fx: [st('lw3', 0, C.ok, 3), st('uw0', 300, C.ok, 3), st('mw3', 600, C.ok, 3)] }
    ]
  };

  /* ---------------- 场景 3：文本技能 vs 代码技能 ---------------- */
  var BX = [180, 290, 400], BK = ['neutral', 'data', 'bad'], BN = ['无记忆', '文本技能', '代码技能'];
  var CK = [41.3, 59.5, 80.2], SP = [24.5, 20.6, 15.0];
  var sc3 = {
    name: '文本 vs 代码', desc: '文本技能是灵活的提示，智能体仍要一步步自己操作。代码技能可执行、可测试、可组合，一次调用顶很多步。但它更死板（讲义第 29–34 页）。',
    bg: function (d) {
      title(d, '同样的经验，存成文本还是代码？');
      d.text(290, 92, '到达检查点（%）↑', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.text(650, 92, '每个任务的步数 ↓', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.line(120, 360, 460, 360, { stroke: C.line, sw: 1.2 }); d.line(520, 360, 790, 360, { stroke: C.line, sw: 1.2 });
    },
    objects: function () {
      var o = {};
      BX.forEach(function (x, i) {
        o['c' + i] = { type: 'box', x: x, y: 360, w: 70, h: 0, rx: 4, anchor: 'bc', fill: C[BK[i] + 'W'], stroke: C[BK[i]], sw: 1.4, opacity: 0 };
        o['cn' + i] = { type: 'text', x: x, y: 350, text: '', num: 0, fmt: 'fixed1', size: 13, weight: 750, mono: true, color: C[BK[i]], anchor: 'middle', opacity: 0 };
        o['cl' + i] = { type: 'text', x: x, y: 378, text: BN[i], size: 12, color: C.fg2, anchor: 'middle', opacity: 0 };
        o['s' + i] = { type: 'box', x: x + 360, y: 360, w: 60, h: 0, rx: 4, anchor: 'bc', fill: C[BK[i] + 'W'], stroke: C[BK[i]], sw: 1.4, opacity: 0 };
        o['sn' + i] = { type: 'text', x: x + 360, y: 350, text: '', num: 0, fmt: 'fixed1', size: 13, weight: 750, mono: true, color: C[BK[i]], anchor: 'middle', opacity: 0 };
        o['sl' + i] = { type: 'text', x: x + 360, y: 378, text: BN[i], size: 12, color: C.fg2, anchor: 'middle', opacity: 0 };
      });
      o.t1 = { type: 'box', x: 290, y: 450, w: 380, h: 56, rx: 8, fill: C.dataW, stroke: C.data, sw: 1.3, text: '文本 + 例子：click(1274) fill(473, …) click(478)', sub: '+ 灵活，随页面调整   − 还得自己发出每个底层动作', subMono: false, subSize: 11, size: 11.5, weight: 700, mono: true, opacity: 0 };
      o.t2 = { type: 'box', x: 650, y: 450, w: 330, h: 56, rx: 8, fill: C.badW, stroke: C.bad, sw: 1.3, text: "search_product('595', 'Macbook')", sub: '+ 可测试、可组合、一步顶多步   − 死板', subMono: false, subSize: 11, size: 11.5, weight: 700, mono: true, opacity: 0 };
      o.cmp = { type: 'box', x: 430, y: 512, w: 640, h: 30, rx: 8, fill: C.bg2, stroke: C.line, sw: 1.2, text: '改地址的任务：无记忆 50 步撞上限，代码技能 4 步做完（讲义第 32 页）', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '同一批网页任务，五个 WebArena 站点取平均。不用记忆时，到达检查点的比例 41.3%，平均 24.5 步。', set: { c0: { opacity: { to: 1, dur: 200 }, h: { to: 41.3 * 2.8, dur: 700, ease: 'out' } }, cn0: mix(fade(400), { num: { to: 41.3, dur: 600, delay: 300 }, y: { to: 360 - 41.3 * 2.8 - 12, dur: 700 } }), cl0: fade(0),
          s0: { opacity: { to: 1, dur: 200 }, h: { to: 24.5 * 9, dur: 700, ease: 'out' } }, sn0: mix(fade(400), { num: { to: 24.5, dur: 600, delay: 300 }, y: { to: 360 - 24.5 * 9 - 12, dur: 700 } }), sl0: fade(0) } },
      { say: '把经验存成文本技能（自然语言 + 示范动作）：59.5%，20.6 步。', set: { c1: { opacity: { to: 1, dur: 200 }, h: { to: 59.5 * 2.8, dur: 700, ease: 'out' } }, cn1: mix(fade(400), { num: { to: 59.5, dur: 600, delay: 300 }, y: { to: 360 - 59.5 * 2.8 - 12, dur: 700 } }), cl1: fade(0),
          s1: { opacity: { to: 1, dur: 200 }, h: { to: 20.6 * 9, dur: 700, ease: 'out' } }, sn1: mix(fade(400), { num: { to: 20.6, dur: 600, delay: 300 }, y: { to: 360 - 20.6 * 9 - 12, dur: 700 } }), sl1: fade(0), t1: pop(800) } },
      { say: '存成代码技能（可调用的函数）：80.2%，只要 15.0 步。比文本技能多 20.7 个百分点、少 5.6 步。', set: { c2: { opacity: { to: 1, dur: 200 }, h: { to: 80.2 * 2.8, dur: 700, ease: 'out' } }, cn2: mix(fade(400), { num: { to: 80.2, dur: 600, delay: 300 }, y: { to: 360 - 80.2 * 2.8 - 12, dur: 700 } }), cl2: fade(0),
          s2: { opacity: { to: 1, dur: 200 }, h: { to: 15 * 9, dur: 700, ease: 'out' } }, sn2: mix(fade(400), { num: { to: 15.0, dur: 600, delay: 300 }, y: { to: 360 - 15 * 9 - 12, dur: 700 } }), sl2: fade(0), t2: pop(800) },
        fx: [{ type: 'burst', obj: 'c2', color: C.bad, at: 800 }] },
      { say: '代码为什么省步数？一次调用代替一串点击和输入。讲义第 32 页的改地址任务，无记忆时满是冗余步骤。50 步上限还没做完，代码技能 4 步。', set: { cmp: pop(0) } },
      { say: '代价是死板。在一个网站学的 sort_listings 只会点下拉菜单。换到另一家网站，排序是打开侧栏，就失败了（讲义第 34 页）。', fx: [{ type: 'shake', obj: 't2', at: 200 }] },
      { say: 'PolySkill 的办法：写一个抽象接口，组合技能只针对接口写一次。每个网站只实现底层的浏览器动作（讲义第 35 页）。', fx: [{ type: 'pulse', obj: 't2', color: C.ok, at: 200 }] },
      { say: '代码技能还能在准入前先检查和测试。讲义第 31 页的例子里，lint 报出参数 color 定义了却没用。于是补上按颜色筛选的分支，再存进去。', fx: [{ type: 'flash', obj: 't2', color: C.warn, at: 200 }, { type: 'pulse', obj: 'c2', color: C.bad, at: 600 }] }
    ]
  };

  /* ---------------- 场景 4：记忆冲突的四种操作 ---------------- */
  var CODE4 = { lang: 'py', title: '本机实跑 · 第 9 部分（按键匹配是示意）', src:
'def update_memory(fact):\n' +
'    key, val = fact\n' +
'    if key not in memory and val is not None:\n' +
'        memory[key] = val; return "ADD"\n' +
'    if val is None:\n' +
'        if key in memory:\n' +
'            del memory[key]; return "DELETE"\n' +
'        return "NOOP"\n' +
'    if memory.get(key) == val:\n' +
'        return "NOOP"\n' +
'    memory[key] = val; return "UPDATE"\n' };
  var MSGS = [['我住在匹兹堡', 'ADD', 'ok'], ['我每天喝咖啡', 'ADD', 'ok'], ['我搬到芝加哥了', 'UPDATE', 'warn'], ['我戒咖啡了', 'DELETE', 'bad'], ['我住在芝加哥', 'NOOP', 'neutral']];
  var LOGS = ["我住在匹兹堡   -> ADD    memory={'city': 'Pittsburgh'}", "我每天喝咖啡   -> ADD    memory={'city': 'Pittsburgh', 'drink': 'coffee'}",
    "我搬到芝加哥了  -> UPDATE memory={'city': 'Chicago', 'drink': 'coffee'}", "我戒咖啡了    -> DELETE memory={'city': 'Chicago'}", "我住在芝加哥   -> NOOP   memory={'city': 'Chicago'}"];
  var HL = [[3, 4], [3, 4], [9, 11], [5, 6, 7], [9, 10]];
  var sc4 = {
    name: '记忆冲突', desc: '新消息进来时，先取出相似的旧记忆。再决定 ADD（新的）、UPDATE（改了）、DELETE（被否定）还是 NOOP（已有或无关）（讲义第 18 页）。',
    code: CODE4, dataTitle: '记忆库', data: { 'city': '—', 'drink': '—', '最近一次操作': '—' },
    bg: function (d) {
      title(d, '记忆不是只追加：要处理冲突');
      d.text(150, 80, '对话里的新消息（示意）', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.text(640, 80, '记忆库', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 });
      d.rect(520, 100, 240, 200, { fill: C.bg2, stroke: C.line, rx: 12, sw: 1.3 });
    },
    objects: function () {
      var o = {};
      MSGS.forEach(function (m, i) { o['q' + i] = card(150, 120 + i * 50, 170, m[0], 'data', 0, 12, 32); o['q' + i].mono = false; });
      o.op = { type: 'box', x: 400, y: 260, w: 110, h: 44, rx: 10, fill: C.bg2, stroke: C.info, sw: 1.6, text: 'LLM 决定', size: 13, weight: 750, opacity: 0 };
      o.pIn = wire('M240,260 L342,260', C.data); o.pOut = wire('M458,250 C490,220 500,200 518,200', C.warn);
      o.city = card(640, 160, 200, '', 'ok', 0, 12.5, 36); o.drink = card(640, 230, 200, '', 'ok', 0, 12.5, 36);
      o.tag = { type: 'text', x: 400, y: 320, text: '', size: 18, weight: 800, color: C.ok, anchor: 'middle', opacity: 0 };
      o.ex = { type: 'box', x: 430, y: 470, w: 640, h: 50, rx: 8, fill: C.infoW, stroke: C.info, sw: 1.2, dasharray: '5 4', text: '另一类做法：记住对整条轨迹的反馈（Reflexion）、检索相似的旧轨迹当例子（讲义第 19–20 页）', size: 12, weight: 700, opacity: 0 };
      return o;
    },
    steps: (function () {
      var steps = [{ say: '一个管理用户偏好的记忆（示意的例子）。抽取阶段从对话里抽出事实，更新阶段决定怎么改记忆库。', set: { op: pop(0), q0: pop(200) } }];
      var mem = [['匹兹堡', null], ['匹兹堡', '咖啡'], ['芝加哥', '咖啡'], ['芝加哥', null], ['芝加哥', null]];
      MSGS.forEach(function (m, i) {
        var s = join(on('pIn'), on('pOut', 600), { tag: { text: { to: m[1], delay: 500 }, color: { to: C[m[2]], dur: 200, delay: 500 }, opacity: { to: 1, dur: 200, delay: 500 } } });
        if (i < 4) s['q' + (i + 1)] = pop(1500);
        s['q' + i] = mix(s['q' + i] || {}, { x: { to: 150, dur: 1 }, fill: { to: C.neutralW, dur: 300, delay: 1200 } });
        var cityTxt = '城市：' + mem[i][0], drinkTxt = mem[i][1] ? '饮品：' + mem[i][1] : '';
        if (i === 0) s.city = mix(pop(800), { text: { to: cityTxt, delay: 800 } });
        if (i === 1) s.drink = mix(pop(800), { text: { to: drinkTxt, delay: 800 } });
        if (i === 2) s.city = { text: { to: cityTxt, delay: 900 }, fill: { to: C.warnW, dur: 300, delay: 800 }, stroke: { to: C.warn, dur: 300, delay: 800 } };
        if (i === 3) s.drink = { opacity: { to: 0, dur: 400, delay: 900 }, x: { to: 720, dur: 500, delay: 800 } };
        var fx = [st('pIn', 100, C.data, 3), st('pOut', 700, C[m[2]] || C.neutral, 3)];
        if (i === 4) fx = [st('pIn', 100, C.data, 3), { type: 'pulse', obj: 'city', color: C.neutral, at: 800 }];
        var data = { '最近一次操作': { v: m[1], at: 600 } };
        if (i === 0) data.city = { v: 'Pittsburgh', at: 900 };
        if (i === 1) data.drink = { v: 'coffee', at: 900 };
        if (i === 2) data.city = { v: 'Chicago', at: 900 };
        if (i === 3) data.drink = { v: '—', at: 900 };
        steps.push({ say: ['"我住在匹兹堡"：记忆里没有类似的 → ADD。', '"我每天喝咖啡"：也是新的 → ADD。', '"我搬到芝加哥了"：改变了已有的城市 → UPDATE。', '"我戒咖啡了"：否定了已有的记忆 → DELETE。', '"我住在芝加哥"：记忆里已经有了 → NOOP，什么都不做。'][i],
          set: s, fx: fx, hl: HL[i], log: [{ s: LOGS[i], at: 800 }], data: data });
      });
      steps.push({ say: '真实系统里，这个决定由 LLM 做。给它新事实和最相似的几条旧记忆，让它选操作。另一类记忆存的是对整条轨迹的反馈，或相似的旧轨迹。', set: { ex: pop(0) } });
      return steps;
    })()
  };

  VZ.register({
    id: 'c2-skills', title: '技能与记忆：渐进披露、生命周期、文本还是代码、记忆冲突',
    sources: [{ t: '第 4 讲（Memory and Skills）', u: YT }, { t: '讲义 lecture-04 第 9–11、18、22–35 页', u: L4 },
      { t: 'assignment-1 · tasks/code-skills/submit-task/SKILL.md', u: 'https://github.com/cmu-agents/assignment-1/blob/main/tasks/code-skills/submit-task/SKILL.md' }],
    note: '场景 1 的三级加载照讲义第 9–11 页。两个 SKILL.md 是作业 1 仓库里的原文件，字符数是本机实算的。场景 2 照第 25–26 页，网店评价的例子照第 26 页。场景 3 的柱子数字照第 33 页，50 步 / 4 步照第 32 页。sort_listings 的例子照第 34 页，PolySkill 照第 35 页。场景 4 的四种操作照第 18 页。对话内容和"按键匹配"的判定规则是示意，结果是本机实跑的。',
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

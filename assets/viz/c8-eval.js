/* 08 · 作业 2 —— 评测流水线：出题 → 智能体产出 → 判卷 → MCC；Harbor 确定性判定与变异解
 * 流程和规则出自 assignment-2 的 ASSIGNMENT.md、workflow/*.py、validator/*.py、harbor/README.md、harbor/example/。
 * 数字：MCC 手算是示意的混淆矩阵（正负样本数取种子集 hard_to_read 的 39 / 59），"没有图就报 execution_failure"规则在种子集上的 MCC、
 * example 的答案和六组判定结果，全部是本机实跑（本机验算脚本 D、E 段；本机工作文件）。
 * 场景 1 里三个运行有没有图、判卷器的输出是示意。 */
(function () {
  var C = VZ.C, mix = VZ.mix, pop = VZ.pop, fade = VZ.fade, join = VZ.join;
  var SRC_MD = { t: 'assignment-2 · ASSIGNMENT.md', u: 'https://github.com/cmu-agents/assignment-2/blob/main/ASSIGNMENT.md' };
  var SRC_EVAL = { t: 'assignment-2 · workflow/evaluate.py', u: 'https://github.com/cmu-agents/assignment-2/blob/main/workflow/evaluate.py' };
  var SRC_HB = { t: 'assignment-2 · harbor/README.md', u: 'https://github.com/cmu-agents/assignment-2/blob/main/harbor/README.md' };
  var SRC_EX = { t: 'assignment-2 · harbor/example/tests/test_state.py', u: 'https://github.com/cmu-agents/assignment-2/blob/main/harbor/example/tests/test_state.py' };
  var SRC_SITE = { t: 'Python 文档 · site（sitecustomize）', u: 'https://docs.python.org/3/library/site.html' };
  var KC = { data: [C.dataW, C.data], info: [C.infoW, C.info], ok: [C.okW, C.ok], bad: [C.badW, C.bad], warn: [C.warnW, C.warn], neutral: [C.neutralW, C.neutral] };
  function node(x, y, w, h, t, sub, k, op, o) {
    return mix({ type: 'box', x: x, y: y, w: w, h: h, rx: 9, fill: KC[k][0], stroke: KC[k][1], sw: 1.6, text: t, sub: sub, subMono: false, subSize: 11, size: 13, weight: 700, opacity: op == null ? 0 : op }, o || {});
  }
  function path(d, col, extra) {
    var a = col === C.ok ? 'ok' : col === C.info ? 'info' : col === C.warn ? 'warn' : col === C.bad ? 'bad' : 'data';
    return mix({ type: 'path', d: d, stroke: col, sw: 2, flow: 0, arrow: a, opacity: 0 }, extra || {});
  }
  function on(name, d0) { var s = {}; s[name] = { flow: { to: 1, dur: 300, delay: d0 || 0 }, opacity: { to: 1, dur: 300, delay: d0 || 0 } }; return s; }
  function st(p, at, col, n) { return { type: 'stream', path: p, n: n || 5, gap: 110, dur: 650, at: at || 0, color: col || C.data }; }
  function title(d, t) { d.text(430, 28, t, { anchor: 'middle', size: 14, weight: 700, color: C.fg }); }

  /* ================= 场景 1：出题到打分 ================= */
  var CODE_RUN = { lang: 'py', title: 'assignment-2 · runner.Run / baseline.validate（简写）', src:
'@dataclass(frozen=True)\n' +
'class Run:\n' +
'    run_id: str\n' +
'    task_id: str\n' +
'    instructions: str\n' +
'    messages: list[dict]\n' +
'    figure: Path | None\n' +
'    inputs: dict[str, Path]\n' +
'\n' +
'def validate(run: Run) -> list[Error]:\n' +
'    execution = judge_execution(run)\n' +
'    if execution:\n' +
'        return execution\n' +
'    return (judge_data_and_chart(run)\n' +
'            + judge_readability(run))\n' };
  var AG = [['qwen', 'Qwen2.5-Coder-3B'], ['ministral', 'Ministral-3-14B'], ['glm', 'GLM-4.7-Flash']];
  var AY = [80, 132, 184];
  var FAM = [['execution_failure', 1.0], ['wrong_data', 0], ['wrong_chart', 0], ['hard_to_read', 0]];
  var sc1 = {
    name: '出题到打分', desc: '一道题 × 三个固定智能体 → 运行记录。判卷器逐个判 → 和人工标签比，每类一个 MCC。',
    code: CODE_RUN, dataTitle: '流水线', data: { tasks: 0, runs: 0, 'macro_mcc（种子集·规则）': 0 }, dataFmt: { 'macro_mcc（种子集·规则）': 'fixed4' },
    bg: function (d) { title(d, '评测流水线：出题 → 运行 → 判卷 → 打分'); },
    objects: function () {
      var o = {};
      o.p1 = path('M168,132 L184,132', C.data);
      AY.forEach(function (y, i) {
        o['pg' + i] = path('M330,132 C345,132 340,' + y + ' 352,' + y, C.warn);
        o['pr' + i] = path('M510,' + y + ' L548,' + y, C.info);
      });
      o.pRV = path('M640,206 L640,268', C.data);
      o.pVP = path('M538,300 L512,300', C.info);
      o.pPS = path('M328,300 L302,300', C.warn);
      o.pLS = path('M220,392 L220,330', C.ok);
      o.task = node(98, 132, 140, 56, 'task.json', '要求 + inputs/', 'data');
      o.gen = node(258, 132, 144, 56, 'workflow generate', 'Modal 上跑', 'warn', 0, { size: 12.5 });
      AG.forEach(function (a, i) {
        o['ag' + i] = node(431, AY[i], 158, 40, a[1], '', 'info', 0, { size: 12 });
        o['rn' + i] = node(642, AY[i], 184, 40, 'T__' + a[0] + (i === 2 ? ' · 没有图' : ' · 有图'), '', i === 2 ? 'bad' : 'data', 0, { size: 12 });
      });
      o.lim = { type: 'text', x: 431, y: 222, text: '≤ 20 步 · 120 秒/命令 · 15 分钟', size: 11.5, color: C.fg3, opacity: 0 };
      o.val = node(640, 300, 200, 56, 'validate(run)', 'Qwen3-VL-30B-A3B（固定）', 'info');
      o.errs = node(640, 372, 236, 32, "[{family, evidence}, …]", '', 'info', 0, { size: 11.5, mono: true, h: 30 });
      o.pred = node(420, 300, 180, 56, 'predictions.json', '每个运行一组错误', 'warn');
      o.score = node(220, 300, 160, 56, 'workflow score', 'TP / TN / FP / FN', 'ok');
      o.lab = node(220, 418, 160, 50, 'labels.json', '人工逐条标注', 'ok');
      FAM.forEach(function (f, i) {
        o['m' + i] = { type: 'box', x: 130 + i * 168, y: 500, w: 156, h: 44, rx: 8, fill: C.bg, stroke: f[1] ? C.ok : C.line, sw: 1.4, num: f[1], fmt: 'fixed4', pre: '', size: 13, weight: 700, mono: true, sub: f[0], subSize: 11, opacity: 0 };
      });
      o.mac = { type: 'box', x: 780, y: 500, w: 92, h: 44, rx: 8, fill: C.okW, stroke: C.ok, sw: 1.4, num: 0.25, fmt: 'fixed2', size: 14, weight: 800, mono: true, sub: 'macro', subSize: 11, opacity: 0 };
      return o;
    },
    steps: [
      { say: '出题：tasks/ID/task.json 写 task_id、task_class、把图说清楚的 instructions，以及输入文件。',
        set: { task: pop(0) }, data: { tasks: 1 } },
      { say: 'workflow generate 在 Modal 上，用钉死版本的 mini-swe-agent，让三个固定的模型各跑一次。',
        set: join(on('p1'), on('pg0', 500), on('pg1', 550), on('pg2', 600), { gen: pop(200), ag0: pop(800), ag1: pop(900), ag2: pop(1000), lim: fade(1300) }),
        fx: [st('p1', 0, C.data, 3), st('pg0', 500, C.warn, 3), st('pg1', 550, C.warn, 3), st('pg2', 600, C.warn, 3)] },
      { say: '每个运行写成 runs/ID__agent/。里面有 result.json（任务、智能体、完整轨迹）和输入副本。留下了图才有 figure.png，哪个有图是示意。',
        set: join(on('pr0'), on('pr1', 100), on('pr2', 200), { rn0: pop(600), rn1: pop(700), rn2: pop(800) }),
        fx: [st('pr0', 0, C.info, 3), st('pr1', 100, C.info, 3), st('pr2', 200, C.info, 3)], data: { runs: { v: 3, at: 800 } }, hl: [1, 2, 3, 4, 5, 6, 7, 8] },
      { say: '判卷器一次只看一个运行：任务、输入、轨迹和图。没有标准答案，也没有参考图。它返回一组带证据的错误，空列表表示没问题。',
        set: join(on('pRV'), { val: pop(400), errs: pop(1100) }), fx: [st('pRV', 0, C.data, 5), { type: 'ripple', obj: 'val', color: C.info, at: 800 }], hl: [10, 11, 12, 13, 14, 15] },
      { say: '所有运行的输出写进 predictions.json。另一边，人逐条看过运行，写下 labels.json。workflow score 把两边对起来。',
        set: join(on('pVP'), on('pPS', 700), on('pLS', 900), { pred: pop(300), score: pop(1100), lab: pop(900) }),
        fx: [st('pVP', 0, C.info, 3), st('pPS', 700, C.warn, 3), st('pLS', 900, C.ok, 3)] },
      { say: '每一类单独当二分类，数出 TP、TN、FP、FN 算 MCC，再对四类简单平均。下面是种子集上一个零成本规则的真实分数：没有 figure.png 就报 execution_failure。',
        set: { m0: pop(0), m1: pop(150), m2: pop(300), m3: pop(450), mac: pop(900) },
        log: [{ s: '[no-figure→execution_failure] macro_mcc = 0.2500', at: 300 }, { s: '    execution_failure: MCC=1.0000 (TP12 TN98 FP0 FN0)', at: 1300 }],
        data: { 'macro_mcc（种子集·规则）': { v: 0.25, at: 900 } } },
      { say: 'execution_failure 一类就到了 1.0，另外三类是 0（常数预测）。评分用的私有集每类都有正负两种。靠这条规则，只能拿到四分之一。',
        fx: [{ type: 'pulse', obj: 'm0', color: C.ok, at: 0 }, { type: 'pulse', obj: 'm1', color: C.neutral, at: 300 }, { type: 'pulse', obj: 'm2', color: C.neutral, at: 400 }, { type: 'pulse', obj: 'm3', color: C.neutral, at: 500 }],
        log: [{ s: '    wrong_data: MCC=0.0000 (TP0 TN73 FP0 FN25)  wrong_chart: MCC=0.0000 (TP0 TN27 FP0 FN71)  hard_to_read: MCC=0.0000 (TP0 TN59 FP0 FN39)', at: 200 }] }
    ]
  };

  /* ================= 场景 2：MCC 手推 ================= */
  var CODE_MCC = { lang: 'py', title: 'assignment-2 · workflow/evaluate.py · score（简写）', src:
'for family in ERROR_FAMILIES:\n' +
'    tp = tn = fp = fn = 0\n' +
'    for label in labels:\n' +
'        truth = label.values[family]\n' +
'        if truth is None:  # 终止性排除\n' +
'            continue\n' +
'        predicted = family in predictions[...]\n' +
'        tp += int(truth and predicted)\n' +
'        tn += int(not truth and not predicted)\n' +
'        fp += int(not truth and predicted)\n' +
'        fn += int(truth and not predicted)\n' +
'    den = math.sqrt((tp + fp) * (tp + fn)\n' +
'                    * (tn + fp) * (tn + fn))\n' +
'    mcc = 0.0 if den == 0 else \\\n' +
'        (tp * tn - fp * fn) / den\n' +
'macro = sum(mcc_values) / len(ERROR_FAMILIES)\n' };
  var MX = 70, MY = 150, CW = 110, CH = 80;
  var CELLS = [['TP', 20, 0, 0, 'ok'], ['FN', 19, 1, 0, 'bad'], ['FP', 10, 0, 1, 'bad'], ['TN', 49, 1, 1, 'ok']];
  function cellXY(c) { return { x: MX + c[2] * CW + CW / 2, y: MY + c[3] * CH + CH / 2 }; }
  var EQN = VZ.eq('qn', [{ slot: 1 }, '·', { slot: 1 }, '−', { slot: 1 }, '·', { slot: 1 }, '=', { num: 0, fmt: 'int', w: 64 }], 600, 150, { size: 14, minW: 40 });
  var EQD = VZ.eq('qd', ['√', { slot: 1 }, '·', { slot: 1 }, '·', { slot: 1 }, '·', { slot: 1 }, '=', { num: 0, fmt: 'fixed4', w: 92 }], 600, 250, { size: 14, minW: 40 });
  var EQR = VZ.eq('qr', ['MCC =', { t: '790', k: 'data', w: 56 }, '/', { t: '2166.5733', k: 'data', w: 96 }, '=', { num: 0, fmt: 'fixed4', k: 'ok', w: 86 }], 600, 350, { size: 14 });
  function fill(prefix, R, i, val, delay) { var s = {}; s[prefix + i] = { text: { to: String(val), delay: delay } }; return s; }
  function flyCopy(name, toX, toY, delay) {
    var s = {}; s[name] = { x: { to: toX, dur: 700, delay: delay, ease: 'inOut' }, y: { to: toY, dur: 700, delay: delay, ease: 'inOut' }, opacity: { from: 1, to: 0, dur: 200, delay: delay + 700 } }; return s;
  }
  var sc2 = {
    name: 'MCC 手推', poster: 4, desc: '用一个示意的混淆矩阵把 MCC 算一遍。再看常数预测为什么是 0。',
    code: CODE_MCC, dataTitle: 'hard_to_read（示意）', data: { 'TP·TN − FP·FN': 0, '分母': 0, MCC: 0, '准确率': 0 },
    dataFmt: { 'TP·TN − FP·FN': 'int', '分母': 'fixed4', MCC: 'fixed4', '准确率': 'fixed4' },
    bg: function (d) {
      title(d, 'MCC = (TP·TN − FP·FN) / √((TP+FP)(TP+FN)(TN+FP)(TN+FN))');
      d.text(MX + CW, MY - 34, '判卷器预测', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
      d.text(MX + CW / 2, MY - 14, '有错', { anchor: 'middle', size: 12, color: C.fg2 });
      d.text(MX + CW * 1.5, MY - 14, '没错', { anchor: 'middle', size: 12, color: C.fg2 });
      d.text(MX - 10, MY + CH / 2, '真有错', { anchor: 'end', size: 12, color: C.fg2 });
      d.text(MX - 10, MY + CH * 1.5, '真没错', { anchor: 'end', size: 12, color: C.fg2 });
      d.text(MX + CW, MY + CH * 2 + 22, '正 39 · 负 59（种子集 hard_to_read）', { anchor: 'middle', size: 11.5, color: C.fg3 });
      d.text(600, 112, '分子', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
      d.text(600, 212, '分母', { anchor: 'middle', size: 12, weight: 700, color: C.fg2 });
    },
    objects: function () {
      var o = {};
      CELLS.forEach(function (c) {
        var p = cellXY(c);
        o['c' + c[0]] = { type: 'box', x: p.x, y: p.y, w: CW - 6, h: CH - 6, rx: 8, fill: KC[c[4]][0], stroke: KC[c[4]][1], sw: 1.5, num: c[1], fmt: 'int', pre: c[0] + ' ', size: 15, weight: 800, mono: true, opacity: 0 };
      });
      [EQN, EQD, EQR].forEach(function (r) { for (var k in r.objs) o[k] = r.objs[k]; });
      var nSlots = [[0, 'TP'], [2, 'TN'], [4, 'FP'], [6, 'FN']];
      nSlots.forEach(function (s, i) { var p = cellXY(CELLS.filter(function (c) { return c[0] === s[1]; })[0]); o['fn' + i] = { type: 'box', x: p.x, y: p.y, w: 40, h: 26, rx: 6, fill: C.dataW, stroke: C.data, sw: 1.3, text: '', size: 13, weight: 800, mono: true, opacity: 0 }; });
      ['30', '39', '59', '68'].forEach(function (t, i) { o['fd' + i] = { type: 'box', x: MX + CW, y: MY + CH * 2 + 50, w: 44, h: 26, rx: 6, fill: C.warnW, stroke: C.warn, sw: 1.3, text: t, size: 13, weight: 800, mono: true, opacity: 0 }; });
      o.sums = { type: 'text', x: MX + CW, y: MY + CH * 2 + 82, text: 'TP+FP=30 · TP+FN=39 · TN+FP=59 · TN+FN=68', size: 11.5, color: C.warn, weight: 700, mono: true, opacity: 0 };
      o.acc = { type: 'box', x: 600, y: 440, w: 380, h: 50, rx: 9, fill: C.bg, stroke: C.line, sw: 1.3, text: '准确率 (20 + 49) / 98 = 0.7041', sub: '全报"没错"：准确率 59 / 98 = 0.6020，但 MCC = 0', subMono: false, subSize: 11.5, size: 13, weight: 700, opacity: 0 };
      return o;
    },
    steps: [
      { say: '这是一个示意的混淆矩阵。判卷器标了 30 个运行有 hard_to_read，其中 20 个对。正负样本数取种子集这一类的 39 / 59。',
        set: { cTP: pop(0), cFN: pop(150), cFP: pop(300), cTN: pop(450) }, hl: [7, 8, 9, 10, 11] },
      { say: '分子第一项：TP · TN。两个格子里的数飞进公式。',
        set: join(VZ.show(EQN, 0, 50), { fn0: { text: '20' } }, { fn1: { text: '49' } }, flyCopy('fn0', EQN.xs[0], 150, 600), flyCopy('fn1', EQN.xs[2], 150, 750),
          fill('qn', EQN, 0, 20, 1300), fill('qn', EQN, 2, 49, 1450)) },
      { say: '再减去 FP · FN = 10 × 19 = 190：分子 = 980 − 190 = 790。判错的越多，这一项越小。',
        set: join({ fn2: { text: '10' }, fn3: { text: '19' } }, flyCopy('fn2', EQN.xs[4], 150, 0), flyCopy('fn3', EQN.xs[6], 150, 150),
          fill('qn', EQN, 4, 10, 700), fill('qn', EQN, 6, 19, 850), { qn8: mix(VZ.pop(0), { num: { to: 790, dur: 700, delay: 1000 } }) }),
        data: { 'TP·TN − FP·FN': { v: 790, at: 1000 } } },
      { say: '分母：四个行和与列和相乘再开方。30 × 39 × 59 × 68 = 4,694,040，开方得 2166.5733。',
        set: join(VZ.show(EQD, 0, 50), { sums: fade(0) }, flyCopy('fd0', EQD.xs[1], 250, 300), flyCopy('fd1', EQD.xs[3], 250, 420), flyCopy('fd2', EQD.xs[5], 250, 540), flyCopy('fd3', EQD.xs[7], 250, 660),
          fill('qd', EQD, 1, 30, 1000), fill('qd', EQD, 3, 39, 1120), fill('qd', EQD, 5, 59, 1240), fill('qd', EQD, 7, 68, 1360), { qd9: mix(VZ.pop(1500), { num: { to: 2166.5733, dur: 700, delay: 1500 } }) }),
        data: { '分母': { v: 2166.5733, at: 1500 } }, hl: [12, 13] },
      { say: 'MCC = 790 / 2166.5733 = 0.3646。比 0 好不少，但离 1 很远。',
        set: join(VZ.show(EQR, 0, 60), { qr5: mix(VZ.pop(400), { num: { to: 0.3646, dur: 700, delay: 500 } }) }),
        data: { MCC: { v: 0.3646, at: 500 } }, hl: [14, 15] },
      { say: '对照准确率：(20 + 49) / 98 = 0.7041，看起来挺高。可一个全报"没错"的判卷器，准确率也有 0.6020。',
        set: { acc: pop(0) }, data: { '准确率': { v: 0.7041, at: 200 } } },
      { say: '全报"没错"时，TP 和 FP 都是 0。分子是 0，分母里 (TP+FP) = 0 也让它变成 0，按约定 MCC 记 0。常数预测拿不到分。',
        set: { cTP: { num: { to: 0, dur: 600 } }, cFP: { num: { to: 0, dur: 600 } }, cFN: { num: { to: 39, dur: 600 } }, cTN: { num: { to: 59, dur: 600 } },
          qn0: { text: { to: '0', delay: 500 } }, qn2: { text: { to: '59', delay: 500 } }, qn4: { text: { to: '0', delay: 500 } }, qn6: { text: { to: '39', delay: 500 } }, qn8: { num: { to: 0, dur: 500, delay: 600 } },
          qd1: { text: { to: '0', delay: 900 } }, qd3: { text: { to: '39', delay: 900 } }, qd5: { text: { to: '59', delay: 900 } }, qd7: { text: { to: '98', delay: 900 } }, qd9: { num: { to: 0, dur: 500, delay: 1000 } },
          sums: { text: { to: 'TP+FP=0 · TP+FN=39 · TN+FP=59 · TN+FN=98', delay: 900 } },
          qr1: { text: { to: '0', delay: 1300 } }, qr3: { text: { to: '0', delay: 1300 } }, qr5: { num: { to: 0, dur: 600, delay: 1400 } } },
        fx: [{ type: 'flash', obj: 'qd9', color: C.bad, at: 1100 }, { type: 'flash', obj: 'qr5', color: C.bad, at: 1500 }],
        data: { 'TP·TN − FP·FN': { v: 0, at: 600 }, '分母': { v: 0, at: 1000 }, MCC: { v: 0, at: 1400 }, '准确率': { v: 0.602, at: 1400 } }, hl: [14] }
    ]
  };

  /* ================= 场景 3：Harbor 判定 ================= */
  var CODE_SH = { lang: 'sh', title: 'assignment-2 · harbor/example/tests/test.sh（简写）', src:
'mkdir -p /logs/verifier\n' +
'python3 -m pytest /tests/test_state.py \\\n' +
'  -rA -q 2>&1 | tee /logs/verifier/pytest.log\n' +
'# $? 是 tee 的退出码，几乎总是 0\n' +
'if [ "${PIPESTATUS[0]}" -eq 0 ]; then\n' +
'  echo 1 > /logs/verifier/reward.txt\n' +
'else\n' +
'  echo 0 > /logs/verifier/reward.txt\n' +
'fi\n' };
  var LAY = [['S1', '文件在、PNG 有效、CSV 没改、脚本留下'], ['S2', '重跑 plot.py，读图元素清单：柱高、顺序、标签'], ['S3', '交上来的图 == 脚本重画的图'], ['S4', 'CSV 加一行再重跑，数要跟着变'], ['S5', 'plotted_values.json == 答案 == 图里画的']];
  var sc3 = {
    name: 'Harbor 判定', desc: '参考解在容器里留下 plot.py、figure.png、plotted_values.json。判定重跑脚本、逐层检查，退出码变成 reward。',
    code: CODE_SH, dataTitle: 'example 参考解（本机实跑）', data: { '柱高': '—', passed: 0, reward: '—' },
    bg: function (d) {
      title(d, 'Harbor 任务：确定性判定（worked example）');
      d.rect(36, 52, 300, 486, { fill: 'none', stroke: C.line, sw: 1.2, dash: '6 4', rx: 12 });
      d.text(186, 70, '容器（no-network）', { anchor: 'middle', size: 12, weight: 700, color: C.fg3 });
    },
    objects: function () {
      var o = {};
      o.pSolve = path('M186,133 L186,166', C.warn);
      o.pTests = path('M336,300 L392,300', C.info);
      o.pRew = path('M600,412 L600,500', C.ok);
      o.img = node(186, 110, 240, 44, 'python:3.12-slim（钉摘要）', '依赖构建时装好，/app/harvest_log.csv', 'neutral', 0, { size: 12 });
      o.solve = node(186, 190, 240, 46, 'solution/solve.sh（-a oracle）', '写出 plot.py 再执行它', 'warn', 0, { size: 12 });
      ['plot.py', 'figure.png', 'plotted_values.json', 'harvest_log.csv'].forEach(function (f, i) {
        o['f' + i] = node(186, 270 + i * 44, 220, 34, '/app/' + f, '', i === 3 ? 'neutral' : 'data', 0, { size: 12, mono: true });
      });
      o.tests = node(186, 480, 240, 40, '/tests 在智能体结束后才拷进来', '', 'info', 0, { size: 11.5 });
      LAY.forEach(function (l, i) {
        o['L' + i] = node(600, 120 + i * 66, 400, 52, l[0] + '  ' + l[1], '', 'neutral', 0, { size: 12 });
      });
      o.mani = node(600, 74, 400, 30, '[558.0, 420.0, 1230.0, 816.0]', '', 'ok', 0, { size: 12.5, mono: true });
      o.rew = node(600, 520, 160, 36, 'reward.txt = 1', '', 'ok', 0, { mono: true, size: 13 });
      return o;
    },
    steps: [
      { say: '容器镜像按摘要钉死。matplotlib、pandas、pytest 都在构建时装好，运行时没有网络。输入 CSV 拷进 /app。',
        set: { img: pop(0), f3: pop(400) }, data: {} },
      { say: '智能体阶段：oracle 就是参考解 solve.sh。它把 plot.py 写到磁盘再执行，留下图和 plotted_values.json。',
        set: join(on('pSolve'), { solve: pop(0), f0: pop(700), f1: pop(900), f2: pop(1100) }), fx: [st('pSolve', 200, C.warn, 3)] },
      { say: '智能体结束后，harbor 才把 tests/ 拷进同一个容器，以 root 运行 test.sh。智能体从没见过这些断言。',
        set: join(on('pTests', 600), { tests: pop(0) }), fx: [st('pTests', 600, C.info, 4)], hl: [1, 2, 3] },
      { say: 'S1 最便宜：图在、是不空白的 PNG、CSV 的 sha256 没变、脚本留下了。只有这层就已经是合格的判定，但分不出画错的图。',
        set: { L0: { opacity: { to: 1, dur: 300 }, fill: { to: C.okW, dur: 300, delay: 300 }, stroke: { to: C.ok, dur: 300, delay: 300 } } } },
      { say: 'S2：在清理过的副本里重跑 plot.py，sitecustomize 给 savefig 打补丁，导出图元素清单。柱高正好是手算的答案。',
        set: { L1: { opacity: { to: 1, dur: 300 }, fill: { to: C.okW, dur: 300, delay: 900 }, stroke: { to: C.ok, dur: 300, delay: 900 } }, mani: pop(500) },
        data: { '柱高': { v: '[558, 420, 1230, 816]', at: 600 } } },
      { say: 'S3：交上来的图和重画的一样。S4：往 CSV 加一行 Cinderpeak，数从 420 变成 480。S5：sidecar 和答案、和图都一致。',
        set: { L2: { opacity: { to: 1, dur: 300 }, fill: { to: C.okW, dur: 300, delay: 300 }, stroke: { to: C.ok, dur: 300, delay: 300 } },
          L3: { opacity: { to: 1, dur: 300, delay: 600 }, fill: { to: C.okW, dur: 300, delay: 900 }, stroke: { to: C.ok, dur: 300, delay: 900 } },
          L4: { opacity: { to: 1, dur: 300, delay: 1200 }, fill: { to: C.okW, dur: 300, delay: 1500 }, stroke: { to: C.ok, dur: 300, delay: 1500 } } },
        log: [{ s: '  [s3] 交上来的图和重跑的图 sha256 完全一样，直接通过', at: 300 }] },
      { say: 'pytest 全过（本机 15 个测试），退出码 0。test.sh 读 PIPESTATUS，写下 reward 1。任何一条失败都写 0，没有部分分。',
        set: join(on('pRew'), { rew: pop(400) }), fx: [st('pRew', 0, C.ok, 3)],
        log: [{ s: 'solution                 1     15   0    —', at: 500 }], data: { passed: { v: 15, at: 400 }, reward: { v: '1', at: 400 } }, hl: [4, 5, 6, 7, 8] }
    ]
  };

  /* ================= 场景 4：变异解 ================= */
  var CODE_KEY = { lang: 'py', title: 'assignment-2 · harbor/example 的判定要点（简写）', src:
'EXPECTED = [558.0, 420.0, 1230.0, 816.0]\n' +
'PERTURBED = [558.0, 480.0, 1230.0, 816.0]\n' +
'# S1 文件在、PNG 有效、CSV 未改\n' +
'# S2 重跑 plot.py，断言柱高\n' +
'assert values == approx(EXPECTED)\n' +
'# S3 交上来的图 == 重画的图\n' +
'assert digest(delivered) == recorded\n' +
'# S4 CSV 加一行再重跑\n' +
'assert values == approx(PERTURBED)\n' +
'# S5 sidecar == 答案 == 图里画的\n' +
'# 没有哪一条看"字能不能读清"\n' };
  var ROWS = [
    ['solution', '参考解', [1, 1, 1, 1, 1], 1, ["######## solution   工作区文件 = ['figure.png', 'harvest_log.csv', 'plot.py', 'plotted_values.json']", '  reward = 1']],
    ['sum_crates', '加的是箱数', [1, 0, 1, 0, 0], 0, ['  FAILED tests_local/test_state.py::test_s2_exact_yield_totals - AssertionError...', '  FAILED tests_local/test_state.py::test_s2_each_bar_carries_its_own_orchards_value',
      '  FAILED tests_local/test_state.py::test_s4_totals_track_the_input_file - Asser...', '  FAILED tests_local/test_state.py::test_s5_sidecar_matches_key_and_chart - Ass...', '  reward = 0']],
    ['forgery', '图是另画的', [1, 1, 0, 1, 1], 0, ['  FAILED tests_local/test_state.py::test_s3_delivered_png_matches_a_fresh_render', '  reward = 0']],
    ['hardcoded', '手抄答案', [1, 1, 1, 0, 1], 0, ['  FAILED tests_local/test_state.py::test_s4_totals_track_the_input_file - Asser...', '  reward = 0']],
    ['illegible', '2 号字、小画布', [1, 1, 1, 1, 1], 1, ["######## mutant:illegible   工作区文件 = ['figure.png', 'harvest_log.csv', 'plot.py', 'plotted_values.json']", '  reward = 1']],
    ['nop', '什么都不做', [0, 0, 0, 0, 0], 0, ["######## nop   工作区文件 = ['harvest_log.csv']", '  reward = 0']]
  ];
  var GX0 = 108, GXS = [250, 330, 410, 490, 570], GXR = 664, GY0 = 118, GDY = 60;
  var sc4 = {
    name: '变异解', desc: '五个候选解和什么都不做的 nop，逐层过判定。三个被抓住，illegible 得满分。它的错只在"读不清"。',
    code: CODE_KEY, dataTitle: '本机实跑（通过 / 没过）', data: { solution: '—', sum_crates: '—', forgery: '—', hardcoded: '—', illegible: '—', nop: '—' },
    bg: function (d) {
      title(d, '变异解：哪一层抓住了它？');
      ['S1', 'S2', 'S3', 'S4', 'S5'].forEach(function (t, i) { d.text(GXS[i], 84, t, { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2 }); });
      d.text(GXR, 84, 'reward', { anchor: 'middle', size: 12.5, weight: 700, color: C.fg2, mono: true });
    },
    objects: function () {
      var o = {};
      ROWS.forEach(function (r, i) {
        var y = GY0 + i * GDY;
        o['n' + i] = { type: 'box', x: GX0, y: y, w: 150, h: 46, rx: 8, fill: i === 0 ? C.okW : C.warnW, stroke: i === 0 ? C.ok : C.warn, sw: 1.4, text: r[0], sub: r[1], subMono: false, subSize: 11, size: 12.5, weight: 700, mono: true, opacity: 0 };
        GXS.forEach(function (x, j) { o['g' + i + '_' + j] = { type: 'box', x: x, y: y, w: 64, h: 40, rx: 6, fill: C.bg, stroke: C.line, sw: 1.2, text: '', size: 15, weight: 800, opacity: 0 }; });
        o['r' + i] = { type: 'box', x: GXR, y: y, w: 70, h: 40, rx: 6, fill: C.bg, stroke: C.line, sw: 1.3, text: '', size: 16, weight: 800, mono: true, opacity: 0 };
      });
      o.flag = { type: 'box', x: 770, y: GY0 + 4 * GDY, w: 110, h: 40, rx: 7, fill: C.badW, stroke: C.bad, sw: 1.5, text: 'hard_to_read', size: 11.5, weight: 800, mono: true, opacity: 0 };
      o.why = { type: 'box', x: 430, y: 504, w: 700, h: 42, rx: 9, fill: C.infoW, stroke: C.info, sw: 1.4, text: '检查文件和数字的断言看不见"可读性"。这一类要靠看图的判卷器', size: 13, weight: 700, opacity: 0 };
      return o;
    },
    steps: ROWS.map(function (r, i) {
      var s = {}, fx = [];
      s['n' + i] = { opacity: { to: 1, dur: 250 }, x: { from: GX0 - 60, to: GX0, dur: 600, ease: 'out' } };
      r[2].forEach(function (ok, j) {
        s['g' + i + '_' + j] = { opacity: { to: 1, dur: 200, delay: 400 + j * 220 }, text: { to: ok ? '对' : '错', delay: 400 + j * 220 },
          fill: { to: ok ? C.okW : C.badW, dur: 250, delay: 400 + j * 220 }, stroke: { to: ok ? C.ok : C.bad, dur: 250, delay: 400 + j * 220 }, color: { to: ok ? C.ok : C.bad, dur: 1, delay: 400 + j * 220 } };
        if (!ok) fx.push({ type: 'shake', obj: 'g' + i + '_' + j, at: 450 + j * 220 });
      });
      s['r' + i] = { opacity: { to: 1, dur: 250, delay: 1600 }, text: { to: String(r[3]), delay: 1600 }, fill: { to: r[3] ? C.okW : C.badW, dur: 250, delay: 1600 }, stroke: { to: r[3] ? C.ok : C.bad, dur: 250, delay: 1600 } };
      fx.push({ type: r[3] ? 'ripple' : 'pulse', obj: 'r' + i, color: r[3] ? C.ok : C.bad, at: 1700 });
      var say = [
        '参考解：五层全过，reward 1。oracle 必须是 1，否则任务本身就是坏的。',
        'sum_crates 加的是箱数不是公斤。S2 的柱高和配对、S4、S5 一起报错（4 个失败），reward 0。这是最普通的"数算错了"。',
        'forgery 的 plot.py 是对的，交上来的图却是用没过滤的数另画的。只有 S3 的像素一致性抓得住。',
        'hardcoded 手抄了正确答案，从不打开 CSV。输出全对，只有 S4 改输入再重跑才露馅。',
        'illegible 数全对，但 3 × 2.2 英寸的画布配 2 号字。十五条全过，reward 1。而它真正的毛病是 hard_to_read。',
        'nop 什么都不做：只剩"CSV 没被改"这一条能过，reward 0。判定是关闭失败的：没有产物就没有分。'][i];
      var data = {}; data[r[0]] = { v: ['15 / 0', '11 / 4', '14 / 1', '14 / 1', '15 / 0', '1 / 14'][i], at: 1600 };
      var hl = [[1, 2], [4, 5], [6, 7], [8, 9], [11], [3]][i];
      var stp = { say: say, set: s, fx: fx, data: data, hl: hl, log: r[4].map(function (l, k) { return { s: l, at: 300 + k * 600 }; }) };
      if (i === 4) { s.flag = pop(2200); fx.push({ type: 'pulse', obj: 'flag', color: C.bad, at: 2400 }); }
      return stp;
    }).concat([{ say: '作业要你在自己打包的任务里，合起来写两个变异解。一个得 0，被检查拒绝。一个得 1.0，真的错了但检查放过。后者量出确定性判定的边界。',
      set: { why: pop(0) }, fx: [{ type: 'pulse', obj: 'r4', color: C.ok, at: 300 }, { type: 'pulse', obj: 'flag', color: C.bad, at: 500 }], hl: [11] }])
  };

  VZ.register({
    id: 'c8-eval', title: '作业 2 的评测流水线：判卷、MCC、确定性判定和变异解',
    sources: [SRC_MD, SRC_EVAL, SRC_HB, SRC_EX, SRC_SITE],
    note: '流水线、四类错误、MCC 的定义和约定、Harbor 任务的布局都有出处。test.sh 的 PIPESTATUS、S1–S5 五层判定和四个变异解也是。出处是 assignment-2 的 ASSIGNMENT.md、workflow/evaluate.py、harbor/README.md 和 harbor/example/。场景 1 的种子集分数是本机实算。场景 3 的柱高和 15 个测试、场景 4 每一行的结果也是。Harbor 那部分是本地跑法，test_state.py 只改了 5 行路径，判定逻辑没动。本机没有 Docker 和 harbor。场景 1 里哪个运行有图、判卷器的输出是示意。场景 2 的混淆矩阵（20 / 10 / 19 / 49）也是示意。',
    legend: [[C.data, '题目 / 运行 / 产物'], [C.info, '判卷器 / 判定'], [C.warn, '生成 / 预测 / 变异解'], [C.ok, '通过 / 标签 / 奖励'], [C.bad, '没通过 / 漏网的错误']],
    scenes: [sc1, sc2, sc3, sc4]
  });
})();

/* walk.js —— 分阶段笔记第 4 部分「逐步走读」：先写，后跑（照 go_learn 笔记的做法）。
 *   大步 = 步骤链里这个阶段的每一步：下拉菜单 / 上一大步 / 下一大步（Shift + ← →）。
 *          开头一项「总览」；这个阶段最后一次「运行」之后是「完整跑一遍」（录下来的调用流程，一站一个函数）。
 *   小步 = 写代码的大步里：先是「✎ 写」——每个文件一格，舞台显示这一步做完时的文件，要敲的行涂绿、行首一个 +，
 *          旁边是实测能不能导入；后面几格「▶ 跑」——这一步写的函数在逐行演示里一行行执行（左边代码，右边变量）。
 *          上一小步 / 下一小步（← →），进度条可点可拖。
 *   面板（宽屏在舞台右边，窄屏在舞台上方）跟着小步换内容：写的时候是目标、为什么、读代码要点、要敲的代码、写完以后、
 *          敲完前想一想；跑的时候是导读和当前这一行做了什么、哪些变量变了。
 * 数据都在 data.js（build.py 生成）：
 *   NOTES.walk       讲解（content/walk/S<N>.json，build.py 已渲染成 HTML）           NOTES.stepCode   每一行归哪一步写（tools/step_code.py）
 *   NOTES.stepState  每一步做完实测能不能导入（tools/step_states.py）   NOTES.viz        逐行演示和调用流程
 */
(function (global) {
  'use strict';
  var N = global.NOTES, App = global.App;
  var POS_KEY = 'walk_pos';
  var ORDER = {};
  N.steps.forEach(function (s, i) { ORDER[s.id] = i; });
  var TRACES = N.viz.traces;

  var W = null;            // 当前阶段：{ sid, stage, steps, bigs, bi, small: { 大步 id: 小步下标 } }
  var stage = null;        // stage.js 舞台（每次换阶段重画时换新的）
  var pos = App.store.get(POS_KEY, {}) || {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function inline(t) { return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
  function prose(t) { return String(t || '').split(/\n{2,}/).map(function (p) { return '<p>' + inline(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function $(s) { return document.querySelector(s); }

  /* ---------------- 数据 ---------------- */
  var linesCache = {};
  function fileLines(path) {                                   // 最终文件的每一行
    if (!linesCache[path]) {
      var f = N.code.files[path], text = f ? f.text : (N.code.extra[path] || '');
      var L = text.split('\n');
      if (L.length && L[L.length - 1] === '') L.pop();
      linesCache[path] = L;
    }
    return linesCache[path];
  }
  function snapshot(path, sid) {                               // 这一步做完时的文件：[[最终行号, 文字, 是不是这一步写的], …]
    var info = N.stepCode.files[path], L = fileLines(path), out = [], k = ORDER[sid];
    if (!info) return out;
    if (info.seq) {                                            // CS285：起始代码 + 已经填好的块；还没填的 TODO 保持起始代码的样子（行号记成负数）
      info.seq.forEach(function (g) {
        var ln;
        if (g.src === 'final') { if (ORDER[g.sid] > k) return; for (ln = g.a; ln <= g.b; ln++) out.push([ln, L[ln - 1], g.sid === sid]); }
        else if (ORDER[g.until] > k) { for (ln = g.a; ln <= g.b; ln++) out.push([-ln, (info.orig || [])[ln - 1], false]); }
      });
      return out;
    }
    info.parts.forEach(function (p) {
      if (ORDER[p[2]] > k) return;
      for (var ln = p[0]; ln <= p[1]; ln++) out.push([ln, L[ln - 1], p[2] === sid]);
    });
    return out;
  }
  function content(id) { return ((N.walk[W.sid] || {}).steps || {})[id] || null; }
  function stateOf(id) { return (N.stepState || {})[id] || null; }
  function writesOf(s) {                                       // 这一步要写的文件（空文件、原文太大没带进页面的文件不单独占一格）
    return (N.stepCode.steps[s.id] || []).filter(function (f) { return !f.dir && f.len > 0 && f.own.length && (N.code.files[f.path] || N.code.extra[f.path] !== undefined); });
  }
  function emptiesOf(s) { return (N.stepCode.steps[s.id] || []).filter(function (f) { return !f.dir && f.len === 0; }); }
  // 「跑」：这一步写的行里有逐行演示的函数，就接上那一段（按函数在文件里的先后）
  function clipsOf(s) {
    var out = [];
    writesOf(s).forEach(function (f) {
      Object.keys(TRACES).forEach(function (id) {
        var t = TRACES[id];
        if (t.path !== f.path) return;
        var hits = [];
        t.frames.forEach(function (fr, i) { if (f.own.some(function (r) { return fr.ln >= r[0] && fr.ln <= r[1]; })) hits.push(i); });
        if (hits.length) out.push({ t: t, from: 0, to: t.frames.length - 1, at: t.line0 + (f.path === writesOf(s)[0].path ? 0 : 1e6) });
      });
    });
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  function apiOwner(api) {                                     // 一条调用流程的入口函数是哪一步写的
    var path = api.entry.split('::')[0], qual = api.entry.split('::')[1], f = N.code.files[path];
    var fn = f && f.funcs.filter(function (x) { return x.qual === qual; })[0];
    if (!fn) return null;
    var hit = null;
    (N.stepCode.files[path] || { parts: [] }).parts.forEach(function (p) { if (fn.line >= p[0] && fn.line <= p[1]) hit = p[2]; });
    return hit;
  }
  function build(sid) {
    var st = N.stages.filter(function (x) { return x.id === sid; })[0];
    var steps = N.steps.filter(function (s) { return s.id.split('-')[0] === sid; });
    var lastRun = -1;
    steps.forEach(function (s, i) { if (s.run) lastRun = i; });
    var cut = lastRun >= 0 ? lastRun + 1 : steps.length;
    function stepBig(s, i) {
      var writes = writesOf(s), clips = writes.length ? clipsOf(s) : [];
      var nRun = clips.reduce(function (n, c) { return n + c.to - c.from + 1; }, 0);
      return { k: 'step', id: s.id, s: s, i: i, writes: writes, clips: clips, nRun: nRun, after: i >= cut, n: writes.length + nRun };
    }
    var bigs = [{ k: 'ov', id: 'ov', n: 0 }];
    steps.slice(0, cut).forEach(function (s, i) { bigs.push(stepBig(s, i)); });
    N.viz.apis.forEach(function (a) {
      var o = apiOwner(a);
      if (o && o.split('-')[0] === sid) bigs.push({ k: 'api', id: 'api:' + a.id, api: a, n: a.hops.length });
    });
    steps.slice(cut).forEach(function (s, j) { bigs.push(stepBig(s, cut + j)); });
    return { sid: sid, stage: st, steps: steps, bigs: bigs, bi: 0, small: {} };
  }
  function phaseAt(b, j) {
    if (j < b.writes.length) return { ph: 'write', k: j };
    var r = j - b.writes.length;
    for (var c = 0; c < b.clips.length; c++) {
      var len = b.clips[c].to - b.clips[c].from + 1;
      if (r < len) return { ph: 'run', c: c, i: b.clips[c].from + r, r: r, len: len };
      r -= len;
    }
    return { ph: 'write', k: 0 };
  }
  function curSmall() { var b = W.bigs[W.bi]; return Math.max(0, Math.min(Math.max(0, b.n - 1), W.small[b.id] || 0)); }
  function isDone(id) { return App.isChecked('step:' + id); }
  function currentId() { for (var i = 0; i < N.steps.length; i++) if (!isDone(N.steps[i].id)) return N.steps[i].id; return null; }
  function kindOf(s) {
    var f = s.files || [];
    if (f.some(function (x) { return x.action === 'new'; })) return ['new', '新建'];
    if (f.length) return ['mod', '修改'];
    return ['run', '运行'];
  }
  function stageFiles(steps) {
    var fresh = [], mod = [];
    steps.forEach(function (s) {
      (s.files || []).forEach(function (f) {
        if (f.action === 'new' && fresh.indexOf(f.path) < 0) fresh.push(f.path);
        if (f.action === 'modify' && mod.indexOf(f.path) < 0 && fresh.indexOf(f.path) < 0) mod.push(f.path);
      });
    });
    return { fresh: fresh, mod: mod };
  }

  /* ---------------- 外壳（每个阶段渲染一次） ---------------- */
  function html(sid) {
    W = build(sid);
    stage = null;
    var nWrite = W.bigs.filter(function (b) { return b.k === 'step' && b.writes.length; }).length;
    var nRun = W.bigs.filter(function (b) { return b.k === 'step' && b.clips.length; }).length;
    var nApi = W.bigs.filter(function (b) { return b.k === 'api'; }).length;
    return '<p class="muted cx-hint"><b>大步</b>是步骤链里这个阶段的每一步，按动手顺序排。切换用下拉菜单、上一大步 / 下一大步，或 Shift + ← →。写代码的大步分两段。' +
      '<b>✎ 写</b>：舞台上绿色、带 + 的是这一步要敲的行。旁边写着为什么、读代码要点、完整代码。还有写完能不能导入，这是实测的。' +
      '<b>▶ 跑</b>：这一步写的函数被真正调用一次，一行一行执行。左边是代码，右边是变量，橙色是这一行改了的。小步用 ← → 或拖进度条。' +
      '这个阶段 ' + W.steps.length + ' 步里 ' + nWrite + ' 步要写代码，其中 ' + nRun + ' 步能接着看它怎么跑' + (nApi ? '。最后还有 ' + nApi + ' 条「完整跑一遍」（调用流程）' : '') + '。勾选和「复原步骤链」页是同一份进度。</p>' +
      '<div class="wk" id="wk"><div class="wk-nav"><span class="wk-lbl">大步</span>' +
      '<button type="button" class="wk-btn" id="wk-bprev" title="上一大步（Shift + ←）">‹ 上一大步</button>' +
      '<select id="wk-pick" title="选择大步"></select>' +
      '<button type="button" class="wk-btn" id="wk-bnext" title="下一大步（Shift + →）">下一大步 ›</button><span class="wk-pos" id="wk-pos"></span></div>' +
      '<div class="wk-grid"><div class="wk-stage"><svg id="wk-svg" class="stage wk-svg" viewBox="0 0 1000 640" role="img" aria-label="逐步走读舞台"></svg></div>' +
      '<div class="wk-card" id="wk-card"></div></div></div>';
  }
  function bigLabel(b) {
    if (b.k === 'ov') return '总览 · 这个阶段的路线';
    if (b.k === 'api') return '▶ 完整跑一遍：' + b.api.title + '（' + b.api.hops.length + ' 站）';
    var s = b.s, done = isDone(s.id), here = currentId() === s.id;
    return (done ? '✓' : '　') + ' ' + (b.i + 1) + '. ' + s.id + ' ' + s.title + (b.writes.length ? '　✎' + (b.writes.length > 1 ? b.writes.length : '') : '') +
      (b.nRun ? ' ▶' + b.nRun : '') + (here ? '　◀ 当前进度' : '');
  }
  function pickHtml() {
    var groups = [['开始之前', function (b) { return b.k === 'ov'; }],
      ['按动手顺序（' + W.bigs.filter(function (b) { return b.k === 'step' && !b.after; }).length + ' 步）', function (b) { return b.k === 'step' && !b.after; }],
      ['写完后：完整跑一遍', function (b) { return b.k === 'api'; }], ['收尾', function (b) { return b.k === 'step' && b.after; }]];
    return groups.map(function (g) {
      var items = W.bigs.map(function (b, j) { return [b, j]; }).filter(function (x) { return g[1](x[0]); });
      return items.length ? '<optgroup label="' + esc(g[0]) + '">' + items.map(function (x) { return '<option value="' + x[1] + '">' + esc(bigLabel(x[0])) + '</option>'; }).join('') + '</optgroup>' : '';
    }).join('');
  }

  /* ---------------- 面板 ---------------- */
  function head(b) {
    if (b.k === 'ov') return '<b>总览：' + esc(W.sid + ' ' + W.stage.title) + '</b>';
    if (b.k === 'api') return '<span class="kind k-run">运行</span><b>完整跑一遍：' + esc(b.api.title) + '</b>';
    var s = b.s, kd = kindOf(s);
    return '<label class="schk" title="做完了就勾上"><input type="checkbox" data-done="' + s.id + '"></label><span class="sid">' + s.id + '</span>' +
      '<span class="kind k-' + kd[0] + '">' + kd[1] + '</span><b>' + esc(s.title) + '</b><span class="here">◀ 当前进度</span>' +
      '<a class="wk-viz" href="viz.html#focus=' + encodeURIComponent(s.focus) + '&step=' + s.id + '" title="在可视化页的结构图上看这一步的文件">结构图 ›</a>';
  }
  function badge(s) {
    var st = stateOf(s.id);
    if (!st) return '';
    var miss = 0;
    Object.keys(st.miss || {}).forEach(function (p) { miss += st.miss[p].length; });
    var t = { pass: ' · 测试通过', fail: ' · 测试失败', none: '' }[st.t] || '';
    var cls = !st.b ? 'bad' : miss || st.t === 'fail' ? 'warn' : 'ok';
    return '<div class="wk-badge ' + cls + '">' + (st.b ? '✓ 写完能导入' : '✗ 写完还不能导入') + (miss ? ' · 还缺 ' + miss + ' 个名字' : st.b ? ' · 不缺名字' : '') + t + '</div>';
  }
  /* 注释层：这一步 points 里的「`L37` 讲解」按行号挂到代码行下面（只对这一步第一个文件；行号是做完这一步时的行号）。
     注释只放在 data-notes 里，由 app.js 的 enhance 在着色之后插进去，不能选中；复制按钮复制的仍是插注释之前的源码。 */
  function notesOf(f, s) {
    var first = (N.stepCode.steps[s.id] || []).filter(function (x) { return !x.dir && x.own && x.own.length; })[0];
    var out = [];
    ((content(s.id) || {}).points || []).forEach(function (p) {
      var at = p.indexOf('<code>L'), m = /<code>L(\d+)(?:[–-](\d+))?<\/code>/.exec(p);
      if (!m) return;
      var pre = p.slice(0, at).replace(/<[^>]+>/g, '').trim();      // 「chess_tools.py `L74–79` …」：写明了文件名的，挂到那个文件上
      var mine = /\.\w+$/.test(pre) ? ('/' + f.path).slice(-pre.length - 1) === '/' + pre : (first && first.path === f.path);
      if (mine) out.push([+m[1], +(m[2] || m[1]), p]);
    });
    return out;
  }
  function notesAttr(notes, lo, hi) {                          // 落在第 lo–hi 行（做完这一步时的行号）里的注释 → data-notes
    var sel = notes.filter(function (n) { return n[0] >= lo && n[0] <= hi; }).map(function (n) { return [Math.min(n[1], hi) - lo + 1, n[2]]; });
    return sel.length ? ' data-notes="' + esc(JSON.stringify(sel)).replace(/"/g, '&quot;') + '"' : '';
  }
  function codeBlock(f, s) {                                   // 要敲的代码：新文件整个给出；改文件按「插在第几行」一段段给出
    var lang = /\.py$/.test(f.path) ? 'python' : 'text', L = fileLines(f.path), notes = notesOf(f, s);
    if (f.action === 'new') return '<pre class="code" data-lang="' + lang + '"' + notesAttr(notes, 1, L.length) + '><code>' + esc(L.join('\n')) + '</code></pre>';
    if (f.action === 'fill') {                                 // 填 TODO：每一块「删掉起始代码的哪几行 → 换成哪几行」
      var info = N.stepCode.files[f.path], snap = snapshot(f.path, s.id), at = {};
      snap.forEach(function (r, i) { if (r[0] > 0 && !(r[0] in at)) at[r[0]] = i + 1; });
      var ks = [];                                               // 这一步碰到的改动块（一块可能拆给几步："5:1-30" / "5:31-"）
      info.seq.forEach(function (g) { if (g.hunk && ((g.src === 'final' && g.sid === s.id) || (g.src === 'orig' && g.until === s.id)) && ks.indexOf(g.hunk) < 0) ks.push(g.hunk); });
      var hNew = [], out = ks.map(function (k) {
        var old = info.seq.filter(function (g) { return g.hunk === k && g.src === 'orig' && g.until === s.id; })[0];
        var neu = info.seq.filter(function (g) { return g.hunk === k && g.src === 'final' && g.sid === s.id; })[0];
        var cont = !old && info.seq.some(function (g) { return g.hunk === k && g.src === 'final' && g.sid !== s.id; });
        var h = '<div class="wk-hunk">第 ' + k + ' 处' + (old ? '：起始代码第 ' + old.a + (old.b > old.a ? '–' + old.b : '') + ' 行' : cont ? '（续写：接在上一步写的那段后面）' : '：插入') + '</div>';
        if (old) h += '<div class="wk-old-h">删掉</div><pre class="code old" data-lang="' + lang + '" data-nocopy="1"><code>' + esc(info.orig.slice(old.a - 1, old.b).join('\n')) + '</code></pre>';
        if (neu) {
          var txt = L.slice(neu.a - 1, neu.b).join('\n');
          hNew.push(txt);
          h += '<div class="wk-old-h new">' + (old ? '换成' : cont ? '续写' : '插入') + '（做完这一步是第 ' + at[neu.a] + (neu.b > neu.a ? '–' + (at[neu.a] + neu.b - neu.a) : '') + ' 行）</div><pre class="code" data-lang="' + lang + '"' + notesAttr(notes, at[neu.a], at[neu.a] + neu.b - neu.a) + '><code>' + esc(txt) + '</code></pre>';
        }
        return h;
      }).join('');
      out += '<details class="wk-whole"><summary>做完这一步时的整个文件（' + snap.length + ' 行，可整份复制）</summary><pre class="code" data-lang="' + lang + '"' + notesAttr(notes, 1, snap.length) + '><code>' +
        esc(snap.map(function (r) { return r[1]; }).join('\n')) + '</code></pre></details>';
      return out;
    }
    return f.own.map(function (r, j) {
      var text = L.slice(r[0] - 1, r[1]).join('\n').replace(/^\n+/, ''), b = f.bands[j] || f.bands[f.bands.length - 1];
      return '<div class="wk-hunk">插进去以后是第 ' + (f.bands[j] ? f.bands[j][0] + '–' + f.bands[j][1] : '') + ' 行：</div><pre class="code" data-lang="' + lang + '"><code>' + esc(text) + '</code></pre>';
    }).join('');
  }
  function runCmds(s) {
    if (!s.run) return '';
    var h = '<div class="wk-sub">写完以后运行</div><pre class="code cmd"><code>' + esc(s.run) + '</code></pre>';
    (s.runs || []).forEach(function (r) {
      h += '<details class="wk-out"><summary>实测输出：<code>' + esc(r.cmd) + '</code>' + (r.seconds ? '（' + r.seconds + ' 秒）' : '') + (r.reused ? '（命令太慢，用当初真跑时留下的日志）' : '') + '</summary>' + r.html + '</details>';
    });
    return h;
  }
  function writeBody(b, ph) {
    var s = b.s, C = content(s.id) || {}, f = b.writes[ph.k], h = '';
    h += C.goal ? '<div class="wk-goal">' + C.goal + '</div>' : '';
    h += badge(s);
    if (b.writes.length > 1 || emptiesOf(s).length) {
      h += '<ol class="wk-files">' + b.writes.map(function (w, j) {
        return '<li class="' + (j === ph.k ? 'on' : '') + '"><a href="#" data-small="' + j + '"><code>' + esc(w.path) + '</code></a>' + (w.action === 'new' ? '（新建 ' + w.len + ' 行）' : w.action === 'fill' ? '（填 ' + w.hunks.length + ' 处：+' + w.own.reduce(function (n, r) { return n + r[1] - r[0] + 1; }, 0) + ' −' + (w.removed || []).reduce(function (n, r) { return n + r[1] - r[0] + 1; }, 0) + ' 行）' : '（加 ' + w.own.reduce(function (n, r) { return n + r[1] - r[0] + 1; }, 0) + ' 行）') + '</li>';
      }).join('') + '</ol>';
      if (emptiesOf(s).length) h += '<div class="wk-note">另外建 ' + emptiesOf(s).length + ' 个空文件：' + emptiesOf(s).map(function (e) { return '<code>' + esc(e.path) + '</code>'; }).join('、') + '。</div>';
    }
    h += C.why ? '<div class="wk-why">' + C.why + '</div>' : '<div class="wk-why"><p class="muted">这一步的讲解还没改写成新格式，先看本节末尾的「文字版」。</p></div>';
    if ((C.points || []).length && ph.k === 0) h += '<div class="wk-sub">读代码要点（行号同舞台左边）</div><ul class="wk-points">' + C.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>';
    if (C.orig) h += '<div class="co orig wk-orig"><span class="co-tag">原作业</span>' + C.orig + '</div>';
    var nLines = f.own.reduce(function (n, r) { return n + r[1] - r[0] + 1; }, 0);
    h += '<details class="wk-code"' + (nLines <= 40 ? ' open' : '') + '><summary>要敲的代码：<code>' + esc(f.path) + '</code>（' + (f.action === 'new' ? '新建，' + nLines + ' 行' : f.action === 'fill' ? '填 ' + f.hunks.length + ' 处 TODO，新敲 ' + nLines + ' 行、删掉 ' + (f.removed || []).reduce(function (n, r) { return n + r[1] - r[0] + 1; }, 0) + ' 行旧的' : '改 ' + f.own.length + ' 处，' + nLines + ' 行') + '，右上角可复制）</summary>' + codeBlock(f, s) + '</details>';
    if (C.state) h += '<div class="wk-sub">写完以后</div><div class="wk-state">' + C.state + '</div>';
    h += runCmds(s);
    if (C.think) h += '<details class="wk-think"><summary><b>敲完前想一想</b>　' + C.think.q + '</summary><div>' + C.think.a + '</div></details>';
    if ((C.pit || []).length) h += '<div class="wk-sub">这一步容易错</div><ul class="wk-pit">' + C.pit.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>';
    if (ph.k < b.writes.length - 1) h += '<div class="wk-next">下一格：✎ 写 <code>' + esc(b.writes[ph.k + 1].path) + '</code></div>';
    else if (b.clips.length) h += '<div class="wk-next">下一格起 <b>▶ 跑</b>：' + b.clips.map(function (c) { return '「' + esc(c.t.title) + '」'; }).join('、') + '（共 ' + b.nRun + ' 小步）</div>';
    return h;
  }
  function runBody(b, ph) {
    var C = content(b.s.id) || {}, c = b.clips[ph.c], t = c.t;
    var h = C.goal ? '<div class="wk-goal">' + C.goal + '</div>' : '';
    if (C.run) h += '<div class="wk-guide"><b>▶ 跑这一段：</b>' + C.run + '</div>';
    h += '<div class="wk-run-h">▶ ' + esc(t.title) + (b.clips.length > 1 ? '　<span class="muted">（第 ' + (ph.c + 1) + ' / ' + b.clips.length + ' 段）</span>' : '') + '</div>';
    h += '<div class="wk-src">调用：<code>' + esc(t.func) + '</code>　输入：' + esc(t.input || '') + '</div>';
    h += '<div class="wk-runinfo" id="wk-runinfo"></div>';
    h += '<div class="wk-src">逐行演示「' + esc(t.title) + '」共 ' + t.frames.length + ' 步（真跑一遍时用 sys.settrace 录下来的）· <a href="viz.html#trace=' + encodeURIComponent(t.id) + '&i=' + ph.i + '">在可视化页打开 ›</a></div>';
    return h;
  }
  function runInfo(b, ph) {
    var box = $('#wk-runinfo');
    if (!box) return;
    var t = b.clips[ph.c].t, fr = t.frames[ph.i], line = t.src[fr.ln - t.line0] || '', say = '';
    (t.notes || []).forEach(function (nt) { if (line.indexOf(nt.match) >= 0) say = nt.say; });
    var st = global.Viz.traceState(t, ph.i), names = ph.i > 0 ? Object.keys(st.changed) : [];
    box.innerHTML = '<div class="wk-at">' + (fr.ret ? '函数返回' : '<code>' + esc(t.path.split('/').pop()) + '</code> 第 ' + fr.ln + ' 行，接下来执行：') + '</div>' +
      (fr.ret ? '<pre class="wk-line"><code>返回 ' + esc(global.Viz.fmtVal(fr.ret)) + '</code></pre>' : '<pre class="wk-line"><code>' + esc(line.trim()) + '</code></pre>') +
      '<div class="wk-say">' + inline(say || (fr.ret ? '函数执行完，把结果交回调用方。' : ph.i === 0 ? '进入函数，参数已经就位（右边）。' : '')) + '</div>' +
      (names.length ? '<div class="wk-sub">上一行执行完，变了的变量</div><ul class="wk-diff">' + names.map(function (nm) { return '<li><code>' + esc(nm) + '</code> = ' + esc(Stage.fit(global.Viz.fmtVal(st.vars[nm]), 300, 12, true)) + '</li>'; }).join('') + '</ul>' : '');
  }
  function apiBody(b) {
    var a = b.api;
    return '<div class="wk-guide">把这一条流程从入口到出口完整跑一遍。每一站是一个函数，绿色是走过的，蓝色是当前这一站。</div>' +
      '<div class="wk-src">入口：<code>' + esc(a.entry) + '</code><br>输入：' + esc(a.input || '') + '<br>输出：<code>' + esc(Stage.fit(a.output || '', 320, 12, true)) + '</code></div>' +
      '<div class="wk-runinfo" id="wk-apiinfo"></div><div class="wk-src"><a href="viz.html#api=' + encodeURIComponent(a.id) + '">在可视化页打开 ›</a>（还能切到「函数调用图」看谁调用谁）</div>';
  }
  function apiInfo(b, i) {
    var box = $('#wk-apiinfo');
    if (!box) return;
    var hp = b.api.hops[i], cap = global.Viz.captionApi({ api: b.api, idx: i });
    box.innerHTML = '<div class="wk-at">第 ' + (i + 1) + ' / ' + b.api.hops.length + ' 站：<code>' + esc(hp.fn ? hp.fn.split('::')[1] : hp.label || '') + '</code>' + (hp.fn ? '（' + esc(hp.fn.split('::')[0]) + '）' : '') + '</div>' +
      (hp.in ? '<div class="wk-src">传进来：<code>' + esc(Stage.fit(hp.in, 340, 12, true)) + '</code></div>' : '') +
      (hp.out ? '<div class="wk-src">交出去：<code>' + esc(Stage.fit(hp.out, 340, 12, true)) + '</code></div>' : '') +
      '<div class="wk-say">' + inline(cap.say || '') + '</div>' + (cap.dat ? '<div class="wk-src">' + esc(cap.dat) + '</div>' : '') +
      (cap.link ? '<div class="wk-src"><a href="' + cap.link.href + '">' + esc(cap.link.text) + ' ›</a></div>' : '');
  }
  function plainBody(b) {
    var s = b.s, C = content(s.id) || {};
    var h = C.goal ? '<div class="wk-goal">' + C.goal + '</div>' : '';
    h += badge(s);
    h += C.why ? '<div class="wk-why">' + C.why + '</div>' : '';
    h += runCmds(s);
    if ((s.produces || []).length) h += '<div class="wk-sub">运行后生成</div><ul class="wk-points">' + s.produces.map(function (p) { return '<li><code>' + esc(p) + '</code></li>'; }).join('') + '</ul>';
    if (C.state) h += '<div class="wk-sub">现在的状态</div><div class="wk-state">' + C.state + '</div>';
    if ((C.pit || []).length) h += '<div class="wk-sub">这一步容易错</div><ul class="wk-pit">' + C.pit.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>';
    return h || '<p class="muted">这一步照着命令做即可。</p>';
  }
  function overviewBody() {
    var ov = (N.walk[W.sid] || {}).overview;
    return '<div class="wk-why">' + (ov ? ov : '<p>' + esc(W.stage.summary || '') + '</p>') + '</div>' +
      '<div class="wk-sub">这个阶段的路线（点一项直接跳过去）。✎ 要写代码，▶ 写完能看它怎么跑。</div><ol class="wk-route">' +
      W.bigs.slice(1).map(function (b, j) {
        if (b.k === 'api') return '<li class="full"><a href="#" data-big="' + (j + 1) + '">▶ 完整跑一遍：' + esc(b.api.title) + '</a></li>';
        var done = isDone(b.s.id);
        return '<li class="' + (done ? 'done' : '') + '"><a href="#" data-big="' + (j + 1) + '"><span class="sid">' + b.s.id + '</span> ' + esc(b.s.title) + '</a>' +
          (b.writes.length ? ' <i>✎</i>' : '') + (b.nRun ? ' <i class="r">▶' + b.nRun + '</i>' : '') + (done ? ' <i class="ok">✓</i>' : '') + '</li>';
      }).join('') + '</ol>';
  }
  function afterHtml() {
    var i = N.stages.indexOf(W.stage), nx = N.stages[i + 1];
    return '<div class="wk-after"><b>这个阶段走完了？</b> <a href="#" data-sec="sec-verify">运行验证</a> · <a href="#" data-sec="sec-pit">易错点 ' + W.stage.pitfalls.length + ' 条</a>' + (W.stage.quiz && W.stage.quiz.length ? ' · <a href="#" data-sec="sec-quiz">自测 ' + W.stage.quiz.length + ' 题</a>' : '') +
      (nx ? ' · <a href="#' + nx.id + '">下一个阶段：' + nx.id + ' ' + esc(nx.title) + ' ›</a>' : '') + '</div>';
  }
  function bodyHtml(b, ph) {
    var h = b.k === 'ov' ? overviewBody() : b.k === 'api' ? apiBody(b) : ph && ph.ph === 'write' ? writeBody(b, ph) : ph && ph.ph === 'run' ? runBody(b, ph) : plainBody(b);
    if (W.bi === W.bigs.length - 1) h += afterHtml();
    return h;
  }

  /* ---------------- 同步：大步（整张面板）/ 小步（只改需要改的部分，进度条不重画，拖动不会断） ---------------- */
  var shownPh = null;
  function phKey(b, ph) { return !ph ? 'none' : ph.ph === 'write' ? 'write' + ph.k : ph.ph === 'run' ? 'run' + ph.c : ph.ph; }
  function renderBig() {
    var b = W.bigs[W.bi], card = $('#wk-card');
    if (!card) return;
    $('#wk-pick').innerHTML = pickHtml();
    $('#wk-pick').value = String(W.bi);
    $('#wk-bprev').disabled = W.bi <= 0; $('#wk-bnext').disabled = W.bi >= W.bigs.length - 1;
    $('#wk-pos').textContent = (W.bi + 1) + ' / ' + W.bigs.length;
    var ph = b.k === 'step' && b.n ? phaseAt(b, curSmall()) : b.k === 'api' ? { ph: 'api' } : null;
    shownPh = phKey(b, ph);
    card.innerHTML = '<div class="wk-h">' + head(b) + '</div><div class="wk-body" id="wk-body">' + bodyHtml(b, ph) + '</div>' +
      (b.n > 1 ? '<div class="wk-ctl" id="wk-ctl"><button type="button" class="wk-btn" id="wk-prev" title="上一小步（←）">‹</button>' +
        '<div class="wk-track"><input type="range" id="wk-range" min="0" max="' + (b.n - 1) + '" value="0" aria-label="小步进度，可点击或拖动"></div>' +
        '<button type="button" class="wk-btn" id="wk-next" title="下一小步（→）">›</button><span class="wk-slabel" id="wk-slabel"></span></div>' : '');
    card.setAttribute('data-id', b.k === 'step' ? b.s.id : '');
    card.className = 'wk-card ph-' + (ph ? ph.ph : 'none');
    App.enhance(card);
    syncProgress();
    renderSmall(true);
  }
  function renderSmall(fresh) {
    var b = W.bigs[W.bi];
    if (!b.n) return;
    var j = curSmall(), ph = b.k === 'api' ? { ph: 'api', i: j } : phaseAt(b, j);
    if (phKey(b, ph) !== shownPh) {                            // 写 ↔ 跑、换了一个文件 / 一段演示：换面板正文（控制条不动）
      shownPh = phKey(b, ph);
      $('#wk-body').innerHTML = bodyHtml(b, ph);
      $('#wk-card').className = 'wk-card ph-' + ph.ph;
      App.enhance($('#wk-body'));
      syncProgress();
    }
    var rg = $('#wk-range');
    if (rg) {
      rg.value = j;
      $('#wk-prev').disabled = j <= 0; $('#wk-next').disabled = j >= b.n - 1;
      $('#wk-slabel').innerHTML = ph.ph === 'write' ? '<b>✎ 写</b>' + (b.writes.length > 1 ? ' ' + (ph.k + 1) + '/' + b.writes.length : '') + (b.nRun ? ' · 后面 ▶ ' + b.nRun + ' 步' : '')
        : ph.ph === 'run' ? '<b>▶ 跑</b> ' + (j - b.writes.length + 1) + ' / ' + b.nRun : '<b>▶</b> ' + (j + 1) + ' / ' + b.n;
    }
    if (ph.ph === 'run') runInfo(b, ph);
    if (ph.ph === 'api') apiInfo(b, j);
    if (!fresh) $('#wk-body').scrollTop = ph.ph === 'run' || ph.ph === 'api' ? $('#wk-body').scrollTop : 0;
  }
  // 舞台跟着走
  function draw(dur) {
    var svg = $('#wk-svg');
    if (!svg || !global.Stage || !global.Viz) return;
    if (!stage || stage.svg !== svg) stage = new global.Stage(svg);
    var b = W.bigs[W.bi], sc, V = global.Viz, sf = stageFiles(W.steps);
    if (b.k === 'ov') sc = V.sceneStage({ title: W.sid + ' ' + W.stage.title + '：这个阶段动了哪些文件', stage: W.sid, fresh: sf.fresh, mod: sf.mod });
    else if (b.k === 'api') sc = V.sceneApi({ api: b.api, idx: curSmall() });
    else if (!b.n) {
      var mine = (b.s.files || []).map(function (f) { return f.path; });
      sc = V.sceneStage({ title: (b.s.run ? '▶ 运行 ' : '') + b.s.id + ' ' + b.s.title, stage: W.sid, fresh: sf.fresh, mod: sf.mod, hot: mine });
    } else {
      var ph = phaseAt(b, curSmall());
      if (ph.ph === 'run') sc = V.sceneTrace({ trace: b.clips[ph.c].t, idx: ph.i });
      else {
        var f = b.writes[ph.k], next = '', next2 = '';
        if (ph.k < b.writes.length - 1) { next = '下一格：✎ 写第 ' + (ph.k + 2) + ' 个文件'; next2 = b.writes[ph.k + 1].path; }
        else if (b.clips.length) { next = '下一格起是「▶ 跑」：' + b.clips.map(function (c) { return c.t.func.split('.').pop(); }).join('、') + ' 被真正调用一次'; next2 = '一行一行执行，共 ' + b.nRun + ' 小步'; }
        else { next = '这一步写的代码没有逐行演示'; next2 = '（定义、配置，或者要等后面的步骤调用），只看写法'; }
        sc = V.sceneWrite({ sid: b.s.id, path: f.path, lines: snapshot(f.path, b.s.id), action: f.action, names: f.names, state: stateOf(b.s.id),
          k: ph.k, nFiles: b.writes.length, bandText: f.bands.map(function (r) { return r[0] === r[1] ? r[0] : r[0] + '–' + r[1]; }).join('、'), next: next, next2: next2 });
      }
    }
    stage.apply(sc, { dur: dur == null ? 600 : dur });
  }
  function save() {
    var b = W.bigs[W.bi];
    pos[W.sid] = { b: b.id, s: curSmall() };
    App.store.set(POS_KEY, pos);
  }
  function goBig(j, small) {
    if (!W || !$('#wk')) return;
    W.bi = Math.max(0, Math.min(W.bigs.length - 1, j));
    var b = W.bigs[W.bi];
    if (small !== undefined) W.small[b.id] = small;
    renderBig(); draw(); save();
  }
  function goSmall(j) {
    var b = W && W.bigs[W.bi];
    if (!b || b.n < 2) return;
    var v = Math.max(0, Math.min(b.n - 1, j));
    if (v === curSmall()) return;
    W.small[b.id] = v;
    renderSmall(); draw(520); save();
  }
  // 勾、当前进度、下拉菜单里的 ✓ / ◀ 当前进度，跟着进度走
  function syncProgress() {
    if (!W) return;
    var card = $('#wk-card');
    if (card && card.getAttribute('data-id')) {
      var id = card.getAttribute('data-id'), done = isDone(id);
      card.classList.toggle('done', done);
      card.classList.toggle('current', id === currentId());
      var box = card.querySelector('.wk-h input[data-done]');
      if (box) box.checked = done;
    }
    var pick = $('#wk-pick');
    if (pick) Array.prototype.forEach.call(pick.querySelectorAll('option'), function (o) { o.textContent = bigLabel(W.bigs[+o.value]); });
  }

  /* ---------------- 对外 ---------------- */
  // 渲染完外壳后调用。进来停在：上次在这个阶段看到的地方 → 复原进度所在的那一步 → 总览
  function start(stepId) {
    if (!W || !$('#wk')) return;
    var p = pos[W.sid], j = p ? W.bigs.map(function (b) { return b.id; }).indexOf(p.b) : -1;
    var cur = W.bigs.map(function (b) { return b.k === 'step' ? b.s.id : ''; }).indexOf(currentId());
    if (stepId) { var k = W.bigs.map(function (b) { return b.k === 'step' ? b.s.id : ''; }).indexOf(stepId); if (k >= 0) { W.bi = k; W.small[W.bigs[k].id] = 0; renderBig(); draw(0); save(); return; } }
    W.bi = j >= 0 ? j : cur >= 0 ? cur : 0;
    if (j >= 0 && typeof p.s === 'number') W.small[W.bigs[j].id] = p.s;
    renderBig(); draw(0);
  }
  function owns() {
    var r = $('#sec-walk') && $('#sec-walk').getBoundingClientRect();
    return !!(W && r && r.bottom > 80 && r.top < innerHeight - 80);
  }
  function init() {
    document.addEventListener('click', function (e) {
      if (!W || !e.target.closest || !e.target.closest('#sec-walk')) return;
      var btn = e.target.closest('button');
      if (btn) {
        if (btn.id === 'wk-bprev') return goBig(W.bi - 1);
        if (btn.id === 'wk-bnext') return goBig(W.bi + 1);
        if (btn.id === 'wk-prev') return goSmall(curSmall() - 1);
        if (btn.id === 'wk-next') return goSmall(curSmall() + 1);
      }
      var a = e.target.closest('a');
      if (a && a.getAttribute('data-big')) { e.preventDefault(); goBig(+a.getAttribute('data-big')); return; }
      if (a && a.getAttribute('data-small')) { e.preventDefault(); goSmall(+a.getAttribute('data-small')); return; }
      if (a && a.getAttribute('data-sec')) { e.preventDefault(); var t = document.getElementById(a.getAttribute('data-sec')); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    });
    document.addEventListener('change', function (e) {
      if (!W) return;
      if (e.target.id === 'wk-pick') { goBig(+e.target.value); e.target.blur(); }
      if (e.target.getAttribute && e.target.getAttribute('data-done')) {
        App.setChecked('step:' + e.target.getAttribute('data-done'), e.target.checked);
        syncProgress();
        Array.prototype.forEach.call(document.querySelectorAll('.step-old input[type=checkbox][data-step="' + e.target.getAttribute('data-done') + '"]'), function (x) { x.checked = e.target.checked; });
      }
    });
    document.addEventListener('input', function (e) { if (W && e.target.id === 'wk-range') goSmall(+e.target.value); });
    // ← → 小步，Shift + ← → 大步：走读在屏幕上、焦点不在输入框里、而且屏幕上露出来更多的不是「核心原理」时
    document.addEventListener('keydown', function (e) {
      if (!W || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (global.Concepts && global.Concepts.owns()) return;
      if (!owns()) return;
      var dir = e.key === 'ArrowRight' ? 1 : -1;
      if (e.shiftKey) goBig(W.bi + dir); else goSmall(curSmall() + dir);
      e.preventDefault();
    });
  }
  function goStep(id) {
    if (!W) return false;
    var j = W.bigs.map(function (b) { return b.k === 'step' ? b.s.id : ''; }).indexOf(id);
    if (j < 0) return false;
    goBig(j, 0);
    return true;
  }

  global.Walk = { init: init, html: html, start: start, goStep: goStep, owns: owns, refresh: function () { if (W) { renderBig(); draw(0); } } };
})(window);

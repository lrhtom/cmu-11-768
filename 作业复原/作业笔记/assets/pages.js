/* pages.js —— 七个页面各自怎么把 NOTES 里的数据摆出来。每个页面的 <body data-page="..."> 决定走哪个函数。 */
(function (global) {
  'use strict';
  var N = global.NOTES, App = global.App, h = App.h, esc = App.esc;
  var main = document.querySelector('main');
  var stageById = {}, stepById = {}, stepsOf = {};
  N.stages.forEach(function (s) { stageById[s.id] = s; stepsOf[s.id] = []; });
  N.steps.forEach(function (s) { stepById[s.id] = s; stepsOf[s.id.split('-')[0]].push(s); });
  // 重要程度（content/steps/aN.json 每个阶段的 imp / imp_why，和网课页的三档一样）：难度已经用 1–5 颗星，这里只写字
  var IMP = { 3: '必须掌握', 2: '应该看懂', 1: '了解即可' };
  function impTag(s) { return s.imp ? '<i class="imp imp' + s.imp + '" title="' + esc(s.imp_why || '') + '">' + IMP[s.imp] + '</i>' : ''; }
  function kindPill(kind, zh) { return '<span class="pill k-' + kind + '">' + esc(zh) + '</span>'; }
  function sections(list, into) {
    list.forEach(function (sec) {
      into.appendChild(h('h2', { text: sec.title }));
      into.appendChild(h('div', { html: sec.html }));
    });
  }
  function doneCount() { return N.steps.filter(function (s) { return App.isChecked('step:' + s.id); }).length; }

  /* 正文里用 @widget 名字 留的空位，在这里填上 */
  var WIDGETS = {
    dirs: function (el) {
      el.className = 'dirs';
      [['课程仓库（起始代码）', 'github.com/cmu-agents/assignment-1 … assignment-3', '三次作业的课程仓库，在 GitHub 上。里面有起始代码、测试、任务文件、作业说明 ASSIGNMENT.md。', '只读不改，每次作业开工时把它整个复制成你的 aN/'],
        ['成品（复原目录）', 'a1/ a2/ a3/', N.meta.files + ' 个代码文件，是起始代码原样加上填好的 TODO。每一步的代码和实测输出，都已经放进笔记页面里。', '你做完以后应该和它逐字一样'],
        ['笔记目录', '作业复原/作业笔记/（就是这里）', '7 个页面和 assets/。代码、实测输出、图解都已经打包进页面。', '讲清楚每一处 TODO 为什么这样填']
      ].forEach(function (d) {
        el.appendChild(h('div', { class: 'd', html: '<h5>' + d[0] + '</h5><code>' + esc(d[1]) + '</code><p>' + esc(d[2]) + '</p><p class="muted">' + esc(d[3]) + '</p>' }));
      });
    },
    order: function (el) {
      el.className = 'orderchain';
      N.stages.forEach(function (s, i) {
        if (i) el.appendChild(h('span', { class: 'arrow', text: '→' }));
        el.appendChild(h('a', { href: 'stages.html#' + s.id, title: s.kind_zh, html: '<b>' + s.id + '</b>' + esc(s.title) }));
      });
    },
    checks: function (el) {
      var ul = h('ul', { class: 'checks' });
      N.meta.checks.forEach(function (c) { ul.appendChild(h('li', { html: '<span class="ok">' + (c.ok ? '通过' : '失败') + '</span><b>' + c.code + '</b> ' + esc(c.msg) })); });
      el.appendChild(ul);
      el.appendChild(h('p', { class: 'muted', text: '上面是 build.py 最近一次运行（' + N.meta.built + '）打印的校验结果。' }));
    },
    counts: function (el) {
      el.appendChild(h('p', { html: '当前数据：<b>' + N.meta.stages + '</b> 个阶段、<b>' + N.meta.steps + '</b> 步、<b>' + N.meta.files + '</b> 个代码文件、<b>' +
        N.meta.traces + '</b> 段逐行执行的录制、<b>' + N.meta.apis + '</b> 条 API 流程。' }));
    }
  };
  function fillWidgets(root) {
    Array.prototype.forEach.call(root.querySelectorAll('[data-widget]'), function (el) {
      var fn = WIDGETS[el.getAttribute('data-widget')];
      if (fn) fn(el);
    });
  }

  var PAGES = {};

  /* ---------- 页面 1 ---------- */
  PAGES.index = function () {
    main.appendChild(h('h1', { text: 'CMU 11-768 三次作业的复原：从起始代码到跑通' }));
    main.appendChild(h('p', { class: 'lead', text: 'CMU 11-768（AI Agents，Fall 2026）有 3 次编程作业。第一次给语言模型搭一个能干活的外壳（Harness）。第二次给智能体做评测（Eval）。第三次用强化学习训练智能体（Training）。课程给了起始代码，关键的几处留成 TODO。这份笔记从起始代码开始，一处处填完。再在一台没有显卡的电脑上，把能跑的部分真跑一遍。要云端沙箱、要付费模型的部分，换成本机替身，或写明「未实测」。' }));
    sections(N.project, main);
  };

  /* ---------- 页面 2 ---------- */
  PAGES.prereq = function () {
    var P = N.prereq;
    main.appendChild(h('h1', { text: '前置知识' }));
    main.appendChild(h('p', { class: 'lead', text: '只列复原目录的代码里实际用到的东西。"用在哪"是 build.py 在代码里搜出来的，点文件名可以跳到文件地图。' }));
    P.groups.forEach(function (g) {
      main.appendChild(h('h2', { text: g.zh }));
      var grid = h('div', { class: 'pre-grid' });
      P.items.filter(function (it) { return it.group === g.id; }).forEach(function (it) {
        var w = P.where[it.id];
        var where = w.show.map(function (x) { return '<a class="loc" href="files.html#' + encodeURIComponent(x.path) + '">' + esc(x.path) + ':' + x.line + '</a>'; }).join('');
        grid.appendChild(h('div', { class: 'pre-card', id: it.id, html:
          '<div class="pre-h"><b>' + esc(it.name) + '</b><span class="stars" title="难度 ' + it.level + ' / 3">' + '★'.repeat(it.level) + '<i>' + '★'.repeat(3 - it.level) + '</i></span></div>' +
          '<p class="why">' + it.why_html + '</p>' +
          '<div class="where"><span class="muted">用在哪（共 ' + w.count + ' 处，' + w.files + ' 个文件）：</span>' + where + '</div>' +
          (it.quiz ? '<div class="quiz"><details><summary>自测：' + it.quiz.q_html + '</summary><div class="ans">' + it.quiz.a_html + '</div></details></div>' : '') }));
      });
      main.appendChild(grid);
    });
    main.appendChild(h('h2', { text: '每个阶段开工前最少要会' }));
    main.appendChild(h('p', { class: 'muted', text: '会了就勾上，勾选状态存在这个浏览器里。点条目的名字可以跳回上面对应的卡片。' }));
    var byId = {}; P.items.forEach(function (it) { byId[it.id] = it; });
    N.stages.forEach(function (s) {
      var card = h('div', { class: 'card' }, [h('h3', { html: '<a href="stages.html#' + s.id + '">' + s.id + '</a> ' + esc(s.title) + ' ' + kindPill(s.kind, s.kind_zh) })]);
      (P.need[s.id] || []).forEach(function (id) {
        card.appendChild(App.checkRow('need:' + s.id + ':' + id, '<a href="#' + id + '">' + esc(byId[id].name) + '</a>'));
      });
      if (!(P.need[s.id] || []).length) card.appendChild(h('p', { class: 'muted', text: '没有新的要求，前面的会了就行。' }));
      main.appendChild(card);
    });
  };

  /* ---------- 页面 3 ---------- */
  PAGES.stages = function () {
    main.classList.add('wide', 'stwide');
    var side = h('aside', { class: 'side' }), body = h('div', { class: 'stbody' });
    if (global.Concepts) global.Concepts.init();
    if (global.Walk) global.Walk.init();
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';      // 滚动位置由下面的 route 自己管（带步骤号进来时停在走读）
    main.appendChild(h('div', { class: 'split' }, [side, body]));
    var lastKind = null, links = {}, marks = {};
    var fold = h('button', { class: 'side-fold', type: 'button', title: '收起 / 展开目录', text: '⟨', onclick: function () {
      var on = !main.classList.contains('side-min'); main.classList.toggle('side-min', on); fold.textContent = on ? '⟩' : '⟨';
      try { localStorage.setItem('cmu768-notes:side-min', on ? '1' : ''); } catch (e) { /* 存不了就算了 */ }
    } });
    side.appendChild(fold);
    try { if (localStorage.getItem('cmu768-notes:side-min')) { main.classList.add('side-min'); fold.textContent = '⟩'; } } catch (e) { /* 读不了就默认展开 */ }
    N.stages.forEach(function (s) {
      if (s.kind !== lastKind) { side.appendChild(h('div', { class: 'grp', text: s.kind_zh })); lastKind = s.kind; }
      marks[s.id] = h('i', { class: 'st-mark' });
      links[s.id] = h('a', { href: '#' + s.id, title: s.id + ' ' + s.title + ' · 难度 ' + (s.level || '?') + ' / 5' + (s.imp ? ' · ' + IMP[s.imp] : '') }, [h('b', { text: s.id }),
        h('span', { text: s.title }), h('em', { class: 'lv', text: '★'.repeat(s.level || 0) }), h('i', { class: 'imp imp' + (s.imp || 0), text: IMP[s.imp] || '' }), marks[s.id]]);
      side.appendChild(links[s.id]);
    });
    function paintMarks() {                                    // 已完成 / 当前 / 未开始：看步骤链里勾了几步
      var firstOpen = N.steps.filter(function (x) { return !App.isChecked('step:' + x.id); })[0];
      var curStage = firstOpen ? firstOpen.id.split('-')[0] : null;
      N.stages.forEach(function (s) {
        var all = stepsOf[s.id], done = all.filter(function (x) { return App.isChecked('step:' + x.id); }).length;
        var st = done === all.length && all.length ? 'done' : s.id === curStage ? 'cur' : done ? 'cur' : 'todo';
        marks[s.id].className = 'st-mark ' + st;
        marks[s.id].textContent = st === 'done' ? '已完成' : st === 'cur' ? '当前' : '未开始';
      });
    }
    paintMarks();
    global.addEventListener('change', function (e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-step')) paintMarks(); });
    function secHead(no, title, id) { return h('div', { class: 'sec-h', id: id || null }, [h('span', { class: 'no', text: String(no) }), h('h2', { text: title })]); }
    function fileBlock(path) {
      var info = N.code.files[path], text = info ? info.text : N.code.extra[path];
      if (text == null) return null;
      var pre = h('pre', { class: 'code', 'data-lang': /\.py$/.test(path) ? 'python' : 'text' }, [h('code', { text: text.replace(/\n$/, '') })]);
      if (!text.trim()) return h('p', { class: 'muted', style: 'font-size:13.5px;margin:6px 0', text: '完整文件：' + path + ' 是空文件，建出来就行。' });
      return h('details', { class: 'fold' }, [h('summary', { text: '完整文件：' + path + '（' + text.replace(/\n$/, '').split('\n').length + ' 行）' }), h('div', { class: 'inner' }, [pre])]);
    }
    function show(id, targetStep) {
      var s = stageById[id] || N.stages[0];
      var i = N.stages.indexOf(s);
      Object.keys(links).forEach(function (k) { links[k].classList.toggle('cur', k === s.id); });
      body.innerHTML = '';
      body.appendChild(h('h1', { html: '<span class="muted" style="font-family:var(--mono);font-size:.7em">' + s.id + '</span> ' + esc(s.title) + ' ' + kindPill(s.kind, s.kind_zh) }));
      body.appendChild(h('p', { class: 'lead', text: s.summary || '' }));
      var firstStep = stepsOf[s.id][0], focus = firstStep ? firstStep.focus : '';
      body.appendChild(h('div', { class: 'st-meta', html: impTag(s) + '<span>难度 <b class="lv">' + '★'.repeat(s.level || 0) + '</b><i class="lv0">' + '★'.repeat(5 - (s.level || 0)) + '</i></span>' +
        (s.orig_url ? '<span>原项目：<a href="' + esc(s.orig_url) + '" target="_blank" rel="noopener">' + esc(s.orig_url.replace('https://github.com/', '')) + ' ↗</a></span>' : '') +
        '<a class="btn" href="steps.html#' + s.id + '">→ 步骤链里的这一阶段</a>' +
        '<a class="btn" href="viz.html#focus=' + encodeURIComponent(focus) + (firstStep ? '&step=' + firstStep.id : '') + '">→ 原理可视化</a>' }));
      var toc = h('nav', { class: 'st-toc' });
      [['1', '目标', 'sec-goal'], ['2', '变化', 'sec-chg'], ['3', '核心原理', 'sec-con'], ['4', '逐步走读', 'sec-walk'], ['5', '运行验证', 'sec-verify'], ['6', '易错点', 'sec-pit']].concat(s.quiz && s.quiz.length ? [['7', '自测题', 'sec-quiz']] : []).forEach(function (x) {
        toc.appendChild(h('a', { href: '#', text: x[0] + ' ' + x[1], onclick: function (e) { e.preventDefault(); var el = document.getElementById(x[2]); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
      });
      body.appendChild(toc);
      body.appendChild(secHead(1, '目标', 'sec-goal'));
      body.appendChild(h('div', { html: s.goal }));
      body.appendChild(secHead(2, '相对上一阶段的变化', 'sec-chg'));
      var ch = h('div', { class: 'changes' });
      function listBox(title, cls, items) {
        ch.appendChild(h('div', { class: 'box', html: '<h5><span class="pill ' + cls + '">' + title + '</span></h5>' +
          (items.length ? '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '<p class="muted" style="margin:2px 0">没有</p>') }));
      }
      var fl = function (p) { return '<a href="files.html#' + encodeURIComponent(p) + '"><code>' + esc(p) + '</code></a>'; };
      listBox('新增 ' + s.added.length + ' 个文件', 'new', s.added.map(fl));
      var merged = {}, mergedOrder = [];                         // 同一个文件在这个阶段被改了几次，合成一行
      s.modified.forEach(function (m) {
        if (!merged[m.path]) { merged[m.path] = { adds: [], plus: 0, minus: 0, hunks: 0, steps: [] }; mergedOrder.push(m.path); }
        var g = merged[m.path];
        g.adds = g.adds.concat(m.adds || []); g.plus += m.plus || 0; g.minus += m.minus || 0; g.hunks += (m.hunks || []).length;
        if (g.steps.indexOf(m.step) < 0) g.steps.push(m.step);
      });
      listBox('修改 ' + mergedOrder.length + ' 个文件', 'mod', mergedOrder.map(function (p) {   // 填 TODO：增删行数 + 跳到第一次动它的那一步
        var g = merged[p], steps = g.steps.map(function (sid) { return '<a href="stages.html#' + sid + '">' + sid + '</a>'; }).join('、');
        return fl(p) + '：' + (g.hunks ? '填 ' + g.hunks + ' 处 TODO，<b style="color:#178a57">+' + g.plus + '</b> <b style="color:#cf3046">−' + g.minus + '</b> 行' :
          '加了 ' + g.adds.map(function (a) { return '<code>' + esc(a) + '</code>'; }).join('、')) + '（' + steps + '）';
      }));
      listBox('删除', 'same', []);
      if (s.produced.length) listBox('运行生成', 'art', s.produced.map(fl));
      body.appendChild(ch);
      // 3 核心原理：有翻页图解（content/concepts/S<N>.json）就用图解，旧的文字版收起来放在下面；没有就直接显示文字版
      body.appendChild(secHead(3, '核心原理 · 翻页图解'));
      var con = h('div', { id: 'sec-con' }), conHtml = global.Concepts ? global.Concepts.html(s.id) : '';
      if (conHtml) {
        con.innerHTML = conHtml;
        con.appendChild(h('details', { class: 'fold oldtext' }, [h('summary', { text: '文字版（改版前的写法，方便搜索和打印）' }), h('div', { class: 'inner', html: s.principle })]));
      } else con.appendChild(h('div', { html: s.principle }));
      body.appendChild(con);
      // 4 逐步走读：先写，后跑（walk.js）；改版前的逐步讲解收起来放在下面
      body.appendChild(secHead(4, '逐步走读 · 先写，后跑'));
      var wk = h('div', { id: 'sec-walk' });
      if (global.Walk) wk.innerHTML = global.Walk.html(s.id);
      var oldBox = h('div', { class: 'inner' });
      stepsOf[s.id].forEach(function (st) {
        var card = h('article', { class: 'step step-old', id: 'old-' + st.id });
        var files = (st.files || []).map(function (f) { return '<span class="pill ' + (f.action === 'new' ? 'new' : 'mod') + '">' + (f.action === 'new' ? '新增' : '修改') + '</span> ' + fl(f.path); }).join('　');
        card.appendChild(h('div', { class: 'step-h' }, [h('span', { class: 'sid', text: st.id }), h('h3', { text: st.title }),
          h('a', { class: 'btn', href: 'viz.html#focus=' + encodeURIComponent(st.focus) + '&step=' + st.id, text: '在舞台上看' })]));
        card.appendChild(h('div', { class: 'step-files', html: files + (st.depends && st.depends.length ? '　前置：' + st.depends.map(function (d) { return '<a href="#' + d + '">' + d + '</a>'; }).join('、') : '') }));
        card.appendChild(h('div', { html: st.html }));
        (st.files || []).forEach(function (f) { if (f.action === 'new') { var b = fileBlock(f.path); if (b) card.appendChild(b); } });
        var row = App.checkRow('step:' + st.id, '这一步做完了（和步骤链页面是同一个勾）', function () { if (global.Walk) global.Walk.refresh(); });
        row.querySelector('input').setAttribute('data-step', st.id);
        card.appendChild(row);
        oldBox.appendChild(card);
      });
      wk.appendChild(h('details', { class: 'fold oldtext', id: 'walk-text' }, [h('summary', { text: '文字版逐步讲解：改版前的写法，方便搜索和打印。代码片段、依赖图、逐行演示都在正文里。' }), oldBox]));
      body.appendChild(wk);
      body.appendChild(secHead(5, '运行验证', 'sec-verify'));
      body.appendChild(h('div', { html: s.verify }));
      body.appendChild(secHead(6, '易错点', 'sec-pit'));
      s.pitfalls.forEach(function (p) { body.appendChild(h('div', { class: 'co warn', html: '<span class="co-tag">' + esc(p.title) + '</span>' + p.html })); });
      if (s.quiz && s.quiz.length) {                          // 自测题可以没有（内容已挪进注释和易错点）
        body.appendChild(secHead(7, '自测题', 'sec-quiz'));
        var qz = h('div', { class: 'quiz' });
        s.quiz.forEach(function (q, k) { qz.appendChild(h('details', {}, [h('summary', { html: (k + 1) + '. ' + q.q }), h('div', { class: 'ans', html: q.a })])); });
        body.appendChild(qz);
      }
      var nav = h('div', { class: 'row', style: 'margin-top:28px;justify-content:space-between' });
      nav.appendChild(i > 0 ? h('a', { class: 'btn', href: '#' + N.stages[i - 1].id, text: '← ' + N.stages[i - 1].id + ' ' + N.stages[i - 1].title }) : h('span'));
      nav.appendChild(i < N.stages.length - 1 ? h('a', { class: 'btn', href: '#' + N.stages[i + 1].id, text: N.stages[i + 1].id + ' ' + N.stages[i + 1].title + ' →' }) : h('span'));
      body.appendChild(nav);
      App.enhance(body);
      if (global.Concepts) global.Concepts.start();
      if (global.Walk) global.Walk.start(targetStep || null);
      App.saveState({ stage: s.id });
      if (targetStep && document.getElementById('sec-walk')) document.getElementById('sec-walk').scrollIntoView();
      else if (targetStep === false) global.scrollTo(0, 0);
    }
    function route(fromUser) {
      var hash = decodeURIComponent(location.hash.slice(1));
      if (stepById[hash]) show(hash.split('-')[0], hash);
      else if (stageById[hash]) show(hash, fromUser ? false : null);
      else show(App.state.stage || N.stages[0].id, null);
    }
    global.addEventListener('hashchange', function () { route(true); });
    route(false);
    if (!location.hash && App.state.scrollY) global.scrollTo(0, App.state.scrollY);
    return true;                                              // 滚动位置自己管，不走通用的恢复
  };

  /* ---------- 页面 4 ---------- */
  PAGES.files = function () {
    main.appendChild(h('h1', { text: '文件地图' }));
    main.appendChild(h('p', { class: 'lead', text: '复原出来的每个文件是干什么的。选一个阶段，看做完这个阶段时目录长什么样。哪些是这个阶段新增的、修改的，哪些没动，哪些还没出现。' }));
    var order = {}; N.steps.forEach(function (s, i) { order[s.id] = i; });
    var lastStep = {}; N.stages.forEach(function (s) { lastStep[s.id] = order[stepsOf[s.id][stepsOf[s.id].length - 1].id]; });
    var cur = App.state.fileStage || N.stages[N.stages.length - 1].id;
    var bar = h('div', { class: 'row', style: 'margin:10px 0 4px' });
    var btns = N.stages.map(function (s) {
      var b = h('button', { class: 'btn', type: 'button', title: s.title, text: s.id, onclick: function () { cur = s.id; paint(); } });
      bar.appendChild(b); return b;
    });
    var info = h('p', { class: 'muted' });
    var tree = h('div', { class: 'tree card' });
    main.appendChild(bar); main.appendChild(info); main.appendChild(tree);
    main.appendChild(h('p', { class: 'muted', html: '没有列在上面的有三样。一是复原时本机实测的输出，已经放进笔记页面里。二是 <code>__pycache__/</code>，Python 的缓存。三是虚拟环境 <code>.venv-aN/</code>。原始仓库在 GitHub 上的 <code>cmu-agents/assignment-N</code>。' }));
    var rows = [], lastDir = null;
    function dirOf(f) { return f.path.indexOf('/') < 0 ? '' : f.path.slice(0, f.path.lastIndexOf('/') + 1); }
    var sorted = N.tree.slice().sort(function (a, b) {          // 先按目录、再按文件名；根目录的文件排最前
      var da = dirOf(a), db = dirOf(b);
      return da === db ? (a.path < b.path ? -1 : 1) : (da < db ? -1 : 1);
    });
    sorted.forEach(function (f) {
      var dir = dirOf(f) || '（根目录）';
      if (dir !== lastDir) { tree.appendChild(h('div', { class: 'dir', text: dir })); lastDir = dir; }
      var pill = h('span', { class: 'pill' });
      var row = h('div', { class: 'f', id: f.path }, [
        h('span', { class: 'nm', title: f.path, text: f.path.split('/').pop() + (f.is_dir ? '/' : '') }), pill,
        h('span', { class: 'role', html: esc(f.role) + ' <span class="muted">· ' + (f.artifact ? '由 ' : '') + '<a href="stages.html#' + f.born + '">' + f.born + '</a>' + (f.artifact ? ' 运行生成' : ' 新建') +
          (f.modified.length ? '，' + f.modified.map(function (m) { return '<a href="stages.html#' + m + '">' + m + '</a>'; }).join('、') + ' 修改' : '') + (f.loc ? ' · ' + f.loc + ' 行' : '') + '</span>' })]);
      tree.appendChild(row);
      rows.push({ f: f, row: row, pill: pill });
    });
    function paint() {
      var s = stageById[cur], end = lastStep[cur], begin = order[stepsOf[cur][0].id], cnt = { n: 0, m: 0, s: 0, l: 0 };
      btns.forEach(function (b) { b.classList.toggle('on', b.textContent === cur); });
      rows.forEach(function (r) {
        var born = order[r.f.born], mods = r.f.modified.map(function (m) { return order[m]; });
        var st = born > end ? 'later' : born >= begin ? 'new' : mods.some(function (m) { return m >= begin && m <= end; }) ? 'mod' : 'same';
        r.pill.className = 'pill ' + (st === 'new' && r.f.artifact ? 'art' : st);
        r.pill.textContent = st === 'later' ? '还没有' : st === 'new' ? (r.f.artifact ? '新生成' : '新增') : st === 'mod' ? '修改' : '未变';
        r.row.classList.toggle('later', st === 'later');
        cnt[st === 'new' ? 'n' : st === 'mod' ? 'm' : st === 'same' ? 's' : 'l']++;
      });
      info.innerHTML = '做完 <b>' + s.id + ' ' + esc(s.title) + '</b>：这个阶段新增 ' + cnt.n + ' 项、修改 ' + cnt.m + ' 项，之前就有且没动的 ' + cnt.s + ' 项，还没出现的 ' + cnt.l + ' 项。';
      App.saveState({ fileStage: cur });
    }
    paint();
  };

  /* ---------- 页面 5 ---------- */
  PAGES.viz = function () {
    main.classList.add('wide');
    main.appendChild(h('h1', { text: '可视化演示' }));
    main.appendChild(h('p', { class: 'lead', text: '四个视图共用下面这一块画布。切换视图时，同一个文件、同一个函数会移到新位置。新出现的淡入，用不到的淡出。' }));
    var box = h('div', {});
    main.appendChild(box);
    global.Viz.mountMain(box);
    main.appendChild(h('div', { class: 'card', html: '<h3>四个视图各看什么</h3><ul>' +
      '<li><b>结构图</b>：每个文件是一个方块，按目录分成六列。文件里的类挂在文件下面，连线是 import。点一个文件，看它的上下游。</li>' +
      '<li><b>API 流程</b>：选一个对外的入口，比如"评估一个模型"。一步一步看，数据从输入到输出经过哪些函数。每一站的数据是什么样子。</li>' +
      '<li><b>函数调用图</b>：同一个入口，换个角度看它往下调用了谁。调用关系是 build.py 用 Python 的 ast 模块从代码里扫出来的。</li>' +
      '<li><b>逐行执行</b>：选一个函数，看每执行一行，局部变量变成了什么样。数值是 tools/trace.py 真跑代码录下来的。</li></ul>' +
      '<p class="muted">没有用第三方库：舞台是 assets/stage.js，排版是 assets/viz.js，都是手写的。</p>' }));
  };

  /* ---------- 页面 6 ---------- */
  PAGES.steps = function () {
    main.appendChild(h('h1', { text: '复原步骤链' }));
    main.appendChild(h('p', { class: 'lead', text: '从课程仓库的起始代码开始，到公开测试全部通过。本机能跑的部分也全部跑完，一共 ' + N.meta.steps + ' 步。顺序按代码之间真实的依赖关系排，被别人用到的先写。点步骤标题，跳到可视化页，并高亮对应的文件。' }));
    var bar = h('div', { class: 'progress' }, [h('i')]), text = h('span', { class: 'muted' });
    var locate = h('button', { class: 'btn', type: 'button', text: '定位到当前步骤', onclick: function () {
      var next = N.steps.filter(function (s) { return !App.isChecked('step:' + s.id); })[0];
      Array.prototype.forEach.call(document.querySelectorAll('.chain-step.cur'), function (e) { e.classList.remove('cur'); });
      if (!next) { text.textContent = '全部做完了。'; return; }
      var row = document.getElementById(next.id);
      row.classList.add('cur'); row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } });
    main.appendChild(h('div', { class: 'card' }, [h('div', { class: 'row' }, [locate, text]), bar]));
    function refresh() {
      var d = doneCount();
      bar.firstChild.style.width = (100 * d / N.steps.length) + '%';
      text.textContent = '已完成 ' + d + ' / ' + N.steps.length + ' 步';
    }
    N.stages.forEach(function (s) {
      var box = h('section', { class: 'chain-stage', id: s.id }, [h('header', { html: '<b>' + s.id + '</b><h3>' + esc(s.title) + '</h3>' + kindPill(s.kind, s.kind_zh) })]);
      stepsOf[s.id].forEach(function (st) {
        var input = h('input', { type: 'checkbox', 'aria-label': st.id + ' 做完了' });
        input.checked = App.isChecked('step:' + st.id);
        var row = h('div', { class: 'chain-step' + (input.checked ? ' done' : ''), id: st.id });
        input.addEventListener('change', function () { App.setChecked('step:' + st.id, input.checked); row.classList.toggle('done', input.checked); row.classList.remove('cur'); refresh(); });
        var meta = (st.files || []).map(function (f) { return (f.action === 'new' ? '+ ' : '~ ') + f.path; }).join('   ') + (st.run ? '   $ ' + st.run : '') +
          (st.depends && st.depends.length ? '   ← ' + st.depends.join(', ') : '');
        var title = h('a', { class: 't', href: 'viz.html#focus=' + encodeURIComponent(st.focus) + '&step=' + st.id, text: st.title });
        row.appendChild(input);
        row.appendChild(h('span', { class: 'sid', text: st.id }));
        row.appendChild(h('div', {}, [title, h('div', { class: 'm', text: meta })]));
        row.appendChild(h('div', { class: 'acts' }, [h('a', { href: 'stages.html#' + st.id, text: '看走读' })]));
        box.appendChild(row);
      });
      main.appendChild(box);
    });
    refresh();
    main.appendChild(h('h2', { text: 'build.py 对这条链做的检查' }));
    var holder = h('div', {}); main.appendChild(holder); WIDGETS.checks(holder);
  };

  /* ---------- 页面 7 ---------- */
  PAGES.diffs = function () {
    main.appendChild(h('h1', { text: '和原作业的差异、出处' }));
    main.appendChild(h('p', { class: 'lead', text: '复原不是照抄。这一页一次说清四件事。哪里和原作业要求的一样，哪里缩小或换了。为什么这样做，哪些没做。' }));
    sections(N.diffs, main);
  };

  App.topbar();
  var custom = PAGES[App.page] && PAGES[App.page]();
  fillWidgets(main);
  App.enhance(main);
  main.appendChild(h('p', { class: 'foot', text: '数据生成于 ' + N.meta.built + ' · 没有用任何第三方库' }));
  if (!custom) App.restoreScroll();
})(window);

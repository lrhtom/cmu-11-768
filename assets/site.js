/* ===== CMU 11-768 AI Agents 笔记 · 页面逻辑（与 CS336、RAG、机器学习笔记同一套框架） =====
 * 外壳（顶栏 / 左栏每一集）· 每集标题条 · 滚动联动 · 文字编辑 · 图示（flow / seq / bars）· 代码着色
 * 所有运行时生成的节点都带 data-gen，「另存为 HTML」时会被剥掉，保证存下来的文件能再次正常打开。 */
(function () {
  'use strict';
  var PAGE = window.PAGE || { key: 'index' };
  var CO = window.COURSE;
  var MOD = null;
  (CO.modules || []).forEach(function (m) { if (m.key === PAGE.key) MOD = m; });
  var $ = function (q, r) { return (r || document).querySelector(q); };
  var $$ = function (q, r) { return Array.prototype.slice.call((r || document).querySelectorAll(q)); };
  function el(tag, attrs, parent, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function lessonUrl(l) { return l.url || (CO.base && l.id ? CO.base + l.id + '/' + l.slug : ''); }
  var KP = (CO.ns || 'pt') + ':';          // 本地存储的键前缀，每套笔记各用各的
  var UNIT = CO.unit || '集';

  /* ---------- 本地存储（file:// 下可能被禁，全部兜底） ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } },
    keys: function (p) { var o = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(p) === 0) o.push(k); } } catch (e) { } return o; }
  };
  function toast(msg, ms) {
    var t = $('.toast') || el('div', { class: 'toast', 'data-gen': '' }, document.body);
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 1900);
  }

  /* ---------- 主题 ---------- */
  var root = document.documentElement;
  function applyTheme(th) { root.setAttribute('data-theme', th); var b = $('#themeBtn'); if (b) b.textContent = th === 'dark' ? '☀' : '☾'; }
  applyTheme(store.get(KP + 'theme') || 'light');   // 默认浅色白底；点右上角按钮可切深色，选择会记住

  /* ---------- 学习进度：按讲、按小节记 ----------
   * done[章][n] = 1：第 n 讲整讲读完；done[章]['n.i'] = 1：第 n 讲的第 i 个小节读完（整讲打勾时，小节的键会清掉，小节一律算读完）。
   * 每讲有几个小节只有打开那一章时才知道，记在 subs[章][n] 里，首页据此显示「小节 a / b」。 */
  function getDone() { try { return JSON.parse(store.get(KP + 'done') || '{}') || {}; } catch (e) { return {}; } }
  function setDone(d) { store.set(KP + 'done', JSON.stringify(d)); }
  function subTotals() { try { return JSON.parse(store.get(KP + 'subs') || '{}') || {}; } catch (e) { return {}; } }
  function modOf(key) { var r = null; CO.modules.forEach(function (m) { if (m.key === key) r = m; }); return r; }
  function chapterStat(m, d) {
    var dn = (d || getDone())[m.key] || {}, st = subTotals()[m.key] || {}, L = 0, S = 0, ST = 0, known = true;
    m.lessons.forEach(function (_, i) {
      var n = i + 1, tot = st[n];
      if (dn[n]) L++;
      if (tot == null) { known = false; return; }
      ST += tot;
      if (dn[n]) S += tot; else for (var j = 1; j <= tot; j++) if (dn[n + '.' + j]) S++;
    });
    var any = Object.keys(dn).length > 0;
    return { lessons: L, total: m.lessons.length, subs: S, subTotal: known ? ST : 0, fin: L === m.lessons.length, started: any };
  }
  function setChapter(key, on) {          // 整章打勾 / 取消
    var d = getDone(), m = modOf(key);
    if (on) { var o = {}; m.lessons.forEach(function (_, i) { o[i + 1] = 1; }); d[key] = o; } else delete d[key];
    setDone(d);
  }
  function markNav() {                    // 顶栏的章节标签：读完的打 ✓，读了一部分的加一个点
    var d = getDone();
    $$('.topbar .mods a').forEach(function (a) {
      var m = modOf((a.getAttribute('href') || '').replace('.html', '')); if (!m) return;
      var s = chapterStat(m, d);
      a.classList.toggle('fin', s.fin); a.classList.toggle('part', !s.fin && s.started);
    });
  }

  /* ---------- 外壳 ---------- */
  function buildShell() {
    var bar = el('header', { class: 'topbar', 'data-gen': '' });
    var h = '<button class="tbtn menu-toggle" aria-label="本模块目录">☰</button>' +
      '<a class="brand" href="index.html">' + esc(CO.brand || '笔记') + '<span>' + esc(CO.brandSub || '') + '</span></a><nav class="mods">';
    CO.modules.forEach(function (m, i) {
      h += '<a href="' + m.key + '.html" class="' + (m.key === PAGE.key ? 'cur' : '') + '" title="' + esc(m.en) + '"><b>' + esc(m.tag || ('M' + (i + 1))) + '</b><em style="font-style:normal">' + esc(m.zh) + '</em></a>';
    });
    (CO.links || []).forEach(function (x, i) {    // 排在各章后面的入口（比如作业复原笔记）
      h += (i ? '' : '<i class="sep"></i>') + '<a href="' + x.href + '" title="' + esc(x.en || '') + '"><b>' + esc(x.tag) + '</b><em style="font-style:normal">' + esc(x.zh) + '</em></a>';
    });
    h += '</nav><span class="spacer"></span>';
    if (MOD) {
      h += '<button class="tbtn" id="editBtn" title="直接改正文文字，自动保存在本机浏览器">✎ 编辑</button>' +
        '<div class="more"><button class="tbtn" id="moreBtn" aria-label="更多">⋯</button><div class="more-pop">' +
        '<button id="saveHtml">另存为 HTML<small>把修改写进一份新的页面文件</small></button>' +
        '<button id="expBtn">导出修改（JSON）</button><button id="impBtn">导入修改（JSON）</button>' +
        '<button id="rstBtn">撤销本页全部修改</button></div></div>';
    }
    h += '<button class="tbtn" id="themeBtn" aria-label="切换深浅色">☾</button>';
    bar.innerHTML = h;
    document.body.insertBefore(bar, document.body.firstChild);
    applyTheme(root.getAttribute('data-theme'));
    $('#themeBtn').onclick = function () {
      var th = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(th); store.set(KP + 'theme', th);
    };
    if (!MOD) return;
    document.body.classList.add('has-side');
    el('div', { class: 'read-bar', 'data-gen': '' }, document.body);
    var main = $('main');
    var shell = el('div', { class: 'shell' });
    main.parentNode.insertBefore(shell, main);
    var side = el('aside', { class: 'sidebar', 'data-gen': '' }, shell);
    var grip = el('div', { class: 'sb-grip', 'data-gen': '', title: '拖动调左栏宽度，双击恢复默认宽度', 'aria-hidden': 'true' }, shell);
    shell.appendChild(main);
    shell.setAttribute('data-shell', '');
    // 左栏伸缩：宽屏点 ☰ 收起 / 展开（记住），拖右边缘调宽度（记住）；窄屏 ☰ 照旧是滑出的抽屉
    var narrow = function () { return matchMedia('(max-width:920px)').matches; };
    var w0 = +store.get(KP + 'sidew');
    if (w0 >= 200 && w0 <= 560) root.style.setProperty('--side', w0 + 'px');
    if (store.get(KP + 'side') === 'off') document.body.classList.add('side-off');
    var tg = $('.menu-toggle');
    function tgTitle() { tg.title = narrow() ? '本章目录' : (document.body.classList.contains('side-off') ? '展开左栏' : '收起左栏'); }
    tgTitle(); addEventListener('resize', tgTitle);
    tg.onclick = function () {
      if (narrow()) { document.body.classList.toggle('nav-open'); return; }
      var off = document.body.classList.toggle('side-off');
      store.set(KP + 'side', off ? 'off' : 'on'); tgTitle();
    };
    grip.addEventListener('pointerdown', function (e) {
      if (narrow()) return;
      e.preventDefault(); document.body.classList.add('sb-drag');
      try { grip.setPointerCapture(e.pointerId); } catch (er) { }       // 有的环境不让捕获，下面在 window 上也听着
      var left = shell.getBoundingClientRect().left, w = side.getBoundingClientRect().width;
      function mv(ev) {
        w = Math.round(ev.clientX - left);
        if (w < 150) { document.body.classList.add('side-off'); return; }      // 拖到很窄就直接收起
        document.body.classList.remove('side-off');
        root.style.setProperty('--side', Math.max(200, Math.min(560, w)) + 'px');
      }
      function up() {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.classList.remove('sb-drag');
        if (document.body.classList.contains('side-off')) store.set(KP + 'side', 'off');
        else { store.set(KP + 'side', 'on'); store.set(KP + 'sidew', String(Math.max(200, Math.min(560, w)))); }
        tgTitle();
      }
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', function () { root.style.removeProperty('--side'); store.del(KP + 'sidew'); });
    document.addEventListener('click', function (e) {
      if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('.menu-toggle')) document.body.classList.remove('nav-open');
      if (!e.target.closest('.more')) { var m = $('.more'); if (m) m.classList.remove('open'); }
    });
    $('#moreBtn').onclick = function () { $('.more').classList.toggle('open'); };
    return side;
  }

  /* ---------- 每集标题条 + 左栏 ---------- */
  // 左栏的小标题可以折叠（记住哪些折起来了）
  function foldable(head, box, id) {
    var key = KP + 'sbfold', f = {};
    try { f = JSON.parse(store.get(key) || '{}') || {}; } catch (e) { }
    head.classList.add('fold'); head.setAttribute('role', 'button'); head.setAttribute('tabindex', '0');
    head.title = '点一下折叠 / 展开';
    function set(on) { head.classList.toggle('shut', on); box.classList.toggle('shut', on); }
    set(!!f[id]);
    function flip() {
      var g = {}; try { g = JSON.parse(store.get(key) || '{}') || {}; } catch (er) { }
      if (g[id]) delete g[id]; else g[id] = 1;
      store.set(key, JSON.stringify(g)); set(!!g[id]);
    }
    head.addEventListener('click', flip);
    head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  }
  /* 小节的难度和重要程度：写在 <h3 data-d data-m data-why> 上（打分脚本 写入）。
   * 标签插在 h3 后面、不放进 h3 里：h3 的内容是编辑模式存改动的键，也是左栏的小节名。 */
  var LV_D = { 1: ['易', '读一遍就懂，不用算'], 2: ['中', '要停下来跟一遍公式、张量维度或代码'], 3: ['难', '要动笔推导，或要同时想着好几个前面的概念'] };
  var LV_M = { 1: '★ 了解即可', 2: '★★ 应该看懂', 3: '★★★ 必须掌握' };
  function lvTag(h3) {
    var d = LV_D[h3.getAttribute('data-d')], m = LV_M[h3.getAttribute('data-m')];
    if (!d || !m) return;
    var box = el('div', { class: 'lv', 'data-gen': '', contenteditable: 'false' });
    el('span', { class: 'lv-d d' + h3.getAttribute('data-d'), title: d[1] }, box, '难度 ' + d[0]);
    el('span', { class: 'lv-m m' + h3.getAttribute('data-m'), title: h3.getAttribute('data-why') || '' }, box, m);
    h3.parentNode.insertBefore(box, h3.nextSibling);
  }
  function lvMark(h3, a) {
    var d = LV_D[h3.getAttribute('data-d')], m = LV_M[h3.getAttribute('data-m')];
    if (!d || !m) return;
    el('i', { class: 'lvi d' + h3.getAttribute('data-d') + ' m' + h3.getAttribute('data-m'), title: '难度 ' + d[0] + ' · ' + m }, a,
      '<b>' + d[0] + '</b>' + m.split(' ')[0]);
  }
  function lvNote() {
    var hd = $('main .mhead');
    if (!hd || !$('main section.ep > h3[data-d]')) return;
    el('div', { class: 'lv-note', 'data-gen': '', contenteditable: 'false' }, hd,
      '每个小节都标了难度和重要程度。难度分易、中、难。重要程度分 ★★★ 必须掌握、★★ 应该看懂、★ 了解即可。这是整理笔记时的判断，不是官方标注。鼠标放到标签上能看到依据，标准写在<a href="index.html#howto">首页</a>。');
  }

  function buildEpisodes(side) {
    var mi = CO.modules.indexOf(MOD) + 1;
    var head = el('div', { class: 'sb-h' }, side, '<span>' + esc(MOD.tag || ('M' + mi)) + ' · ' + esc(MOD.zh) + '</span><em id="sbProg"></em>');
    var list = el('div', { class: 'eplist' }, side);
    foldable(head, list, 'eps');
    var items = [], totals = {};
    function D() { var d = getDone(); d[MOD.key] = d[MOD.key] || {}; return d; }
    function subDone(dn, n, i) { return !!(dn[n] || dn[n + '.' + i]); }
    $$('main section.ep').forEach(function (sec) {
      var n = +sec.getAttribute('data-n'), L = MOD.lessons[n - 1];
      if (!L) return;
      if (!sec.id) sec.id = 'e' + n;
      // 标题条
      var hd = el('div', { class: 'ep-head', 'data-gen': '', contenteditable: 'false' });
      hd.innerHTML = '<span class="ep-no">' + (L.no ? esc(L.no) : '第 ' + n + ' ' + UNIT) + '</span>' + (L.en ? '<span class="ep-en">' + esc(L.en) + '</span>' : '') +
        (L.who ? '<span class="ep-who">' + esc(L.who) + '</span>' : '') +
        (L.dur ? '<span class="ep-dur">' + L.dur + '</span>' : '') +
        (L.src ? (L.doc ? '<a class="ep-src" href="' + L.doc + '" target="_blank" rel="noopener" title="这一' + UNIT + '的官方讲义">' + esc(L.src) + ' ↗</a>'
          : '<span class="ep-src" title="这一' + UNIT + '对应原始笔记的位置">' + esc(L.src) + '</span>') : '') +
        (lessonUrl(L) ? '<a class="ep-open" href="' + lessonUrl(L) + '" target="_blank" rel="noopener">打开这一' + UNIT + ' ↗</a>' : '');
      sec.insertBefore(hd, sec.firstChild);
      // 小节锚点
      var subs = $$(':scope > h3', sec);
      subs.forEach(function (h3, i) { if (!h3.id) h3.id = sec.id + '-' + (i + 1); lvTag(h3); });
      totals[n] = subs.length;
      // 左栏条目：一讲一行（✓ 整讲打勾），下面每个小节一行（✓ 单个小节打勾）；▸ 展开 / 收起这一讲的小节
      var it = el('div', { class: 'epi' }, list);
      var row = el('div', { class: 'epi-row' }, it);
      var fold = el('button', { class: 'epi-fold', title: '展开 / 收起这一' + UNIT + '的小节', 'aria-label': '展开小节' }, row, '▸');
      el('a', { class: 'epi-a', href: '#' + sec.id }, row,
        '<span class="n">' + esc(L.num || n) + '</span><span class="t">' + esc(L.zh) + '<small>' + (L.dur || '') + '<b class="sc"></b></small></span>');
      var ck = el('button', { class: 'epi-ck', title: '这一' + UNIT + '整讲读完（再点一下取消）', 'aria-label': '整讲打勾' }, row, '✓');
      fold.onclick = function () {
        var open = it.classList.contains('open') || (it.classList.contains('cur') && !it.classList.contains('shut'));
        it.classList.toggle('open', !open); it.classList.toggle('shut', open);
      };
      ck.onclick = function () {
        var d = D(), dn = d[MOD.key];
        var on = !dn[n];
        Object.keys(dn).forEach(function (k) { if (k.indexOf(n + '.') === 0) delete dn[k]; });
        if (on) dn[n] = 1; else delete dn[n];
        if (!Object.keys(dn).length) delete d[MOD.key];
        setDone(d); paint();
      };
      var sub = el('div', { class: 'epi-sub' }, it), rows = [];
      subs.forEach(function (h3, i) {
        var r = el('div', { class: 'sub-row' }, sub);
        var c = el('button', { class: 'sub-ck', title: '这一小节读完（再点一下取消）', 'aria-label': '小节打勾' }, r, '✓');
        var ra = el('a', { href: '#' + h3.id }, r);
        ra.textContent = h3.textContent.replace(/\s+/g, ' ').trim();
        lvMark(h3, ra);
        c.onclick = function () {
          var d = D(), dn = d[MOD.key], j = i + 1, k;
          if (dn[n]) {                                      // 整讲原来是勾上的：取消这一小节 = 其余小节逐个记下
            delete dn[n];
            for (k = 1; k <= subs.length; k++) if (k !== j) dn[n + '.' + k] = 1;
          } else if (dn[n + '.' + j]) delete dn[n + '.' + j];
          else dn[n + '.' + j] = 1;
          var all = subs.length > 0;
          for (k = 1; k <= subs.length; k++) if (!dn[n + '.' + k]) all = false;
          if (all) {                                        // 小节全勾上 = 整讲读完
            for (k = 1; k <= subs.length; k++) delete dn[n + '.' + k];
            dn[n] = 1;
          }
          if (!Object.keys(dn).length) delete d[MOD.key];
          setDone(d); paint();
        };
        rows.push(r);
      });
      items.push({ n: n, sec: sec, it: it, subs: subs, sub: sub, rows: rows });
    });
    // 记下这一章每讲有几个小节（首页按小节算进度要用）
    var st = subTotals(); st[MOD.key] = totals; store.set(KP + 'subs', JSON.stringify(st));
    function paint() {
      var dn = getDone()[MOD.key] || {}, Ld = 0, S = 0, ST = 0;
      items.forEach(function (x) {
        var c = 0;
        x.rows.forEach(function (r, i) { var on = subDone(dn, x.n, i + 1); r.classList.toggle('done', on); if (on) c++; });
        var full = !!dn[x.n];
        x.it.classList.toggle('done', full);
        x.it.classList.toggle('part', !full && c > 0);
        x.it.querySelector('.sc').textContent = x.rows.length ? ' · ' + c + '/' + x.rows.length + ' 节' : '';
        if (full) Ld++;
        S += c; ST += x.rows.length;
      });
      $('#sbProg').textContent = Ld + '/' + MOD.lessons.length + ' 讲 · ' + S + '/' + ST + ' 节';
      paintChapters(); markNav();
    }
    if (MOD.extra && MOD.extra.length) {
      var eh = el('div', { class: 'sb-h' }, side, '<span>' + esc(CO.extraLabel || '配套') + '</span>');
      var ex = el('div', { class: 'extra' }, side);
      foldable(eh, ex, 'extra');
      MOD.extra.forEach(function (x) {
        el('a', { href: lessonUrl(x), target: '_blank', rel: 'noopener' }, ex, esc(x.t) + (x.pro ? '<span>需 Pro</span>' : '<span>↗</span>'));
      });
    }
    // 全部章节：章数多，顶栏只显示编号，这里给一份带中文名的完整清单；右边的 ✓ 整章打勾 / 取消
    var chh = el('div', { class: 'sb-h' }, side, '<span>全部章节</span><em id="chProg"></em>');
    var chl = el('nav', { class: 'chlist' }, side), chRows = [];
    foldable(chh, chl, 'chs');
    CO.modules.forEach(function (m) {
      var r = el('div', { class: 'chrow' }, chl);
      el('a', { href: m.key + '.html', class: m.key === MOD.key ? 'cur' : '' }, r,
        '<b>' + esc(m.tag) + '</b><span>' + esc(m.zh) + '</span><small></small>');
      var c = el('button', { class: 'ch-ck', 'aria-label': '整章打勾' }, r, '✓');
      c.onclick = function () {
        var s = chapterStat(m);
        if (s.fin) {
          if (!confirm('取消「' + m.zh + '」这一章的全部打勾？')) return;
          setChapter(m.key, false);
        } else setChapter(m.key, true);                     // 没读完（包括勾了一部分）：整章补成读完
        paint();
      };
      chRows.push({ m: m, r: r, c: c });
    });
    function paintChapters() {
      var d = getDone(), fin = 0;
      chRows.forEach(function (x) {
        var s = chapterStat(x.m, d);
        x.r.classList.toggle('done', s.fin); x.r.classList.toggle('part', !s.fin && s.started);
        x.r.querySelector('small').textContent = (s.lessons ? s.lessons + '/' : '') + s.total + (s.subTotal && !s.fin && s.subs ? ' · ' + Math.round(100 * s.subs / s.subTotal) + '%' : '');
        x.c.title = s.fin ? '这一章已读完（点一下取消）' : (s.started ? '这一章读了一部分（点一下整章打勾）' : '整章打勾');
        if (s.fin) fin++;
      });
      $('#chProg').textContent = fin + '/' + CO.modules.length + ' 章';
    }
    paint();
    $$('a', side).forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('nav-open'); }); });
    document.addEventListener('vz:mounted', function (e) {
      items.forEach(function (x) {
        var host = e.detail && e.detail.host;
        if (!host || !x.sec.contains(host)) return;
        if (!x.it.querySelector('.t i')) {
          var t = x.it.querySelector('.t'); t.insertBefore(el('i', null, null, '演示'), t.querySelector('small'));
        }
        // 演示挂在哪个小节下面：左栏那个小节后面也标一个「演示」
        var p = host;
        while (p && p.parentNode !== x.sec) p = p.parentNode;
        while (p && p.tagName !== 'H3') p = p.previousElementSibling;
        if (p && p.id) {
          var a = x.sub.querySelector('a[href="#' + p.id + '"]');
          if (a && !a.querySelector('i.vzi')) el('i', { class: 'vzi', title: '这一小节下面有动画演示' }, a, '演示');
        }
      });
    });
    return items;
  }

  /* ---------- 滚动联动 ---------- */
  function initSpy(items) {
    var bar = $('.read-bar'), cur = null, curH = null, tick = false;
    function upd() {
      tick = false;
      var y = 110, c = null;
      for (var i = 0; i < items.length; i++) { if (items[i].sec.getBoundingClientRect().top <= y) c = items[i]; else break; }
      if (c !== cur) {
        if (cur) cur.it.classList.remove('cur');
        cur = c;
        if (c) {
          c.it.classList.add('cur');
          var sb = c.it.closest('.sidebar'), r = c.it.getBoundingClientRect(), sr = sb.getBoundingClientRect();
          if (r.top < sr.top + 20 || r.bottom > sr.bottom - 20) sb.scrollTop += r.top - sr.top - 90;
        }
      }
      var h = null;
      if (c) for (var j = 0; j < c.subs.length; j++) { if (c.subs[j].getBoundingClientRect().top <= y) h = c.subs[j]; else break; }
      if (h !== curH) {
        $$('.epi-sub a.act').forEach(function (a) { a.classList.remove('act'); });
        curH = h;
        if (h) { var a = $('.epi-sub a[href="#' + h.id + '"]'); if (a) a.classList.add('act'); }
      }
      if (bar) { var max = document.documentElement.scrollHeight - innerHeight; bar.style.width = (max > 0 ? Math.min(100, scrollY / max * 100) : 0) + '%'; }
    }
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener('resize', upd);
    upd();
  }

  /* ---------- 正文出处链到网上：「讲义第 N 页」→ 官网讲义 PDF 的那一页，（这门课没有课程笔记，NOTES 为空）----------
   * 第 1 讲的讲义分两部分，「第 6 讲讲义第…」指别的讲，讨论课、复习课、手推讲义的页码不配。包裹在 initEdit 之后做，unGen 存档前去掉。 */
  var NOTES = {};
  function initRefs() {
    var docOf = {};
    CO.modules.forEach(function (m) {
      m.lessons.forEach(function (L) { var k = /\d+/.exec(L.no || ''); if (k && L.doc) docOf[k[0]] = L.doc; });
      (m.extra || []).forEach(function (x) {                   // course.js 里「课程笔记 · 中文名」的那几篇
        var k = /^课程笔记 · (.+)$/.exec(x.t || ''), s = /cs231n\.github\.io\/([\w-]+)\/$/.exec(x.url || '');
        if (k && s) NOTES[k[1]] = s[1];
      });
    });
    var SK = 'pre,code,a,button,svg,.ts,.dg > :not(figcaption),[data-vz],[data-gen]';
    var RE = /(第\s*(\d+)\s*讲的?)?讲义(附录)?(?:第\s*([12])\s*部分)?第\s*(\d+)(?:\s*[–-]\s*\d+)?(?:\s*、\s*\d+(?:\s*[–-]\s*\d+)?)*\s*页|课程笔记《([^《》]{1,24})》/g;
    $$('main section.ep').forEach(function (sec) {
      var L = MOD.lessons[+sec.getAttribute('data-n') - 1] || {};
      var w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = w.nextNode())) if (/讲义|课程笔记/.test(n.nodeValue) && !n.parentNode.closest(SK)) nodes.push(n);
      nodes.forEach(function (n) {
        var t = n.nodeValue, last = 0, m, f = null;
        RE.lastIndex = 0;
        while ((m = RE.exec(t))) {
          var href = null, tip;
          if (m[6]) { if (NOTES[m[6]]) { href = 'https://cs231n.github.io/' + NOTES[m[6]] + '/'; tip = '课程官方笔记《' + m[6] + '》'; } }
          else if (m[1] || !/[课推]$/.test(t.slice(0, m.index))) {
            var doc = m[2] ? docOf[m[2]] : L.doc;
            if (doc && m[4] === '2') doc = doc.replace('part_1', 'part_2');
            if (doc) { href = doc + '#page=' + m[5]; tip = '打开官网讲义 ' + doc.split('/').pop() + ' 第 ' + m[5] + ' 页'; }
          }
          if (!href) continue;
          f = f || document.createDocumentFragment();
          f.appendChild(document.createTextNode(t.slice(last, m.index)));
          el('a', { class: 'lp', href: href, target: '_blank', rel: 'noopener', title: tip }, f).textContent = m[0];
          last = m.index + m[0].length;
        }
        if (f) { f.appendChild(document.createTextNode(t.slice(last))); n.parentNode.replaceChild(f, n); }
      });
    });
  }

  /* ---------- 术语小卡片：缩写和专有名词，鼠标放上去显示全称和一句解释（词条在 glossary.js） ----------
   * 每处都带一条淡淡的下划线。包裹要在 initEdit 之后做：编辑的键是块内容的哈希；
   * 存修改、另存为 HTML 时用 unGen 去掉包裹，本地存档和页面文件里都不留这一层。 */
  function unGen(box) {                                     // 去掉运行时加的包裹（术语、出处链接），存修改、另存为 HTML 时用
    $$('.gl, a.lp', box).forEach(function (s) {
      while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s);
      s.remove();
    });
    box.normalize();
  }
  function initGloss() {                                   // 词表和卡片在 assets/glossary.js（window.GL），作业笔记也用它
    if (window.GL) GL.apply($('main'));
  }

  /* ---------- 文字编辑：按块存 localStorage ---------- */
  var EDIT_SEL = ':scope > h2, :scope > h3, :scope > h4, :scope > p, :scope > ul, :scope > ol, :scope > table, :scope > .co, :scope > .cmp, :scope > .pipe, :scope > details, :scope > pre.code';
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h.toString(36); }
  function initEdit() {
    var pre = KP + PAGE.key + ':', blocks = [], seen = {}, restored = 0;
    $$('main .mhead, main section.ep').forEach(function (box) {
      var sid = box.id || 'head';
      $$(EDIT_SEL, box).forEach(function (b) {
        var k = sid + ':' + hash(b.innerHTML.trim());
        if (seen[k]) { seen[k]++; k += '-' + seen[k]; } else seen[k] = 1;
        b.setAttribute('data-k', k); blocks.push(b);
        var v = store.get(pre + k);
        if (v != null) { b.innerHTML = v; b.classList.add('dirty'); b._restored = true; restored++; }
      });
    });
    if (restored) setTimeout(function () { toast('已恢复本页 ' + restored + ' 处本地修改'); }, 500);
    var timers = {};
    function save(b) {
      var c = b.cloneNode(true); unGen(c);
      if (!store.set(pre + b.getAttribute('data-k'), c.innerHTML)) toast('浏览器禁用了本地存储，请用「另存为 HTML」保存修改', 3600);
      b.classList.add('dirty');
    }
    var doc = $('main');
    doc.addEventListener('input', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      var k = b.getAttribute('data-k'); clearTimeout(timers[k]); timers[k] = setTimeout(function () { save(b); }, 450);
    });
    doc.addEventListener('paste', function (e) {
      if (!document.body.classList.contains('editing')) return;
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (t != null) { e.preventDefault(); document.execCommand('insertText', false, t); }
    });
    var btn = $('#editBtn');
    function setEditing(on) {
      document.body.classList.toggle('editing', on); btn.classList.toggle('on', on);
      btn.textContent = on ? '✓ 完成' : '✎ 编辑';
      blocks.forEach(function (b) { if (on) b.setAttribute('contenteditable', 'true'); else b.removeAttribute('contenteditable'); });
      if (on) toast('编辑模式：点正文直接改，自动存在本机浏览器。想写进文件，用 ⋯ 里的「另存为 HTML」。', 3200);
    }
    btn.onclick = function () { setEditing(!document.body.classList.contains('editing')); };
    addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && document.body.classList.contains('editing')) {
        e.preventDefault(); blocks.forEach(function (b) { var k = b.getAttribute('data-k'); if (timers[k]) { clearTimeout(timers[k]); timers[k] = 0; save(b); } }); toast('已保存');
      }
    });
    $('#expBtn').onclick = function () {
      var data = { page: PAGE.key, exported_at: new Date().toISOString(), blocks: {} };
      store.keys(pre).forEach(function (k) { data.blocks[k.slice(pre.length)] = store.get(k); });
      var n = Object.keys(data.blocks).length; if (!n) return toast('本页还没有修改');
      download((CO.brand || '笔记') + '-' + PAGE.key + '-修改.json', JSON.stringify(data, null, 1), 'application/json'); toast('已导出 ' + n + ' 处修改');
    };
    $('#impBtn').onclick = function () {
      var inp = el('input', { type: 'file', accept: '.json,application/json' });
      inp.onchange = function () {
        var f = inp.files[0]; if (!f) return; var r = new FileReader();
        r.onload = function () {
          try {
            var d = JSON.parse(r.result), n = 0;
            Object.keys(d.blocks || {}).forEach(function (k) { if ($('[data-k="' + k + '"]')) { store.set(pre + k, d.blocks[k]); n++; } });
            toast('导入 ' + n + ' 处修改，正在刷新'); setTimeout(function () { location.reload(); }, 700);
          } catch (err) { toast('文件格式不对：' + err.message, 3000); }
        };
        r.readAsText(f, 'utf-8');
      };
      inp.click();
    };
    $('#rstBtn').onclick = function () {
      var ks = store.keys(pre); if (!ks.length) return toast('本页没有修改');
      if (!confirm('撤销本页全部 ' + ks.length + ' 处修改，恢复原文？')) return;
      ks.forEach(store.del); location.reload();
    };
    $('#saveHtml').onclick = function () {
      var c = root.cloneNode(true);
      unGen(c);
      $$('[data-gen]', c).forEach(function (n) { n.remove(); });
      var sh = c.querySelector('[data-shell]');
      if (sh) { var m = sh.querySelector('main'); sh.parentNode.replaceChild(m, sh); }
      $$('[data-k]', c).forEach(function (b) { b.removeAttribute('data-k'); b.removeAttribute('contenteditable'); b.classList.remove('dirty'); if (!b.getAttribute('class')) b.removeAttribute('class'); });
      $$('pre.code', c).forEach(function (p) { var t = p.textContent; p.innerHTML = '<code>' + esc(t) + '</code>'; p.removeAttribute('data-hl'); });
      $$('.ep h3[id]', c).forEach(function (h) { h.removeAttribute('id'); });
      c.removeAttribute('data-theme'); c.querySelector('body').removeAttribute('class');
      download(PAGE.key + '.html', '<!doctype html>\n' + c.outerHTML, 'text/html');
      toast('已生成 ' + PAGE.key + '.html，用它覆盖原文件即可', 3200);
    };
  }
  function download(name, text, type) {
    var a = el('a', { href: URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })), download: name }, document.body);
    a.click(); a.remove();
  }

  /* ---------- 代码着色（轻量，够看即可） ---------- */
  var KW = {
    py: 'def return if elif else for while in import from as class with try except raise None True False and or not lambda pass yield assert is',
    js: 'var let const function return if else for while new this class await async try catch throw typeof of in true false null undefined',
    sh: 'pip install export echo cd python',
    json: 'true false null', yaml: 'true false null', text: ''
  };
  function hilite(lang, src) {
    var set = {}; (KW[lang] || '').split(' ').forEach(function (w) { if (w) set[w] = 1; });
    var cmt = lang === 'js' ? '//' : '#';
    return src.split('\n').map(function (line) {
      var out = '', i = 0, n = line.length;
      while (i < n) {
        var ch = line[i], rest = line.slice(i);
        if (lang !== 'json' && lang !== 'text' && rest.indexOf(cmt) === 0) { out += '<span class="cm">' + esc(rest) + '</span>'; break; }
        if (ch === '"' || ch === "'") {
          var j = i + 1; while (j < n && line[j] !== ch) { if (line[j] === '\\') j++; j++; }
          out += '<span class="s">' + esc(line.slice(i, j + 1)) + '</span>'; i = j + 1; continue;
        }
        var m = /^\d+(\.\d+)?(e-?\d+)?/.exec(rest);
        if (m && !/[\w.]/.test(line[i - 1] || '')) { out += '<span class="nm">' + m[0] + '</span>'; i += m[0].length; continue; }
        m = /^[A-Za-z_][\w]*/.exec(rest);
        if (m) {
          var w = m[0];
          out += set[w] ? '<span class="k">' + w + '</span>' : line[i + w.length] === '(' ? '<span class="fn">' + w + '</span>' : esc(w);
          i += w.length; continue;
        }
        out += esc(ch); i++;
      }
      return out;
    }).join('\n');
  }
  function initCode() {
    $$('pre.code').forEach(function (p) {
      if (p._restored || p.getAttribute('data-hl')) return;
      var lang = p.getAttribute('data-lang') || 'text';
      var src = p.textContent.replace(/^\n/, '').replace(/\s+$/, '');
      p.innerHTML = '<code>' + (lang === 'text' ? esc(src) : hilite(lang, src)) + '</code>';
      p.setAttribute('data-hl', '1');
    });
  }

  /* ================= 图示：把 <figure class="dg"> 里的 JSON 画成 SVG ================= */
  var NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  var KIND = { data: 1, ok: 1, warn: 1, bad: 1, info: 1, neutral: 1 };
  function kfill(k) { return KIND[k] ? 'var(--' + k + '-weak)' : 'var(--bg-2)'; }
  function kstroke(k) { return KIND[k] ? 'var(--' + k + ')' : 'var(--line-2)'; }
  var DGID = 0;
  function mkSvg(fig, W, H) {
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'data-gen': '' });
    svg.style.maxWidth = W + 'px'; svg.style.margin = '0 auto';
    var id = 'dg' + (++DGID), defs = s('defs', null, svg);
    ['fg-3', 'data', 'ok', 'warn', 'bad', 'info', 'neutral'].forEach(function (k) {
      var m = s('marker', { id: id + '-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      s('path', { d: 'M0,1 L10,5 L0,9 z', style: 'fill:var(--' + k + ')' }, m);
    });
    svg._id = id;
    var cap = fig.querySelector('figcaption');
    fig.insertBefore(svg, cap);
    return svg;
  }
  function label(svg, x, y, str, size, color, weight, anchor, mono) {
    return s('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'dominant-baseline': 'central', 'font-size': size || 13,
      'font-weight': weight || null, class: mono ? 'mono' : null, style: 'fill:' + (color || 'var(--fg)') }, svg, str);
  }
  function textW(str, size) { var w = 0; for (var i = 0; i < str.length; i++) w += str.charCodeAt(i) > 255 ? size : size * 0.58; return w; }

  /* flow：节点摆在 (c, r) 网格上，边自动走直线 / 折线 / 弧线 */
  function drawFlow(fig, sp) {
    var cw = sp.cw || 148, ch = sp.ch || 50, gx = sp.gx == null ? 44 : sp.gx, gy = sp.gy == null ? 34 : sp.gy, pad = 14, top = sp.top || 0;
    var N = {}, maxC = 0, maxR = 0, byId = {}, labels = [];
    sp.nodes.forEach(function (n) { byId[n.id] = n; });
    (sp.edges || []).forEach(function (e) {
      var a = byId[e[0]], b = byId[e[1]], o = e[3] || {};
      if (e[2] && a && b && Math.abs(a.r - b.r) < 0.01 && (!o.via || o.via === 'h')) gx = Math.max(gx, textW(e[2], 11.5) + 26);
    });
    sp.nodes.forEach(function (n) {
      var w = (n.w || 1) * cw + ((n.w || 1) - 1) * gx, h = (n.h || 1) * ch + ((n.h || 1) - 1) * gy;
      var o = { n: n, x: pad + n.c * (cw + gx), y: pad + top + n.r * (ch + gy), w: w, h: h };
      o.cx = o.x + w / 2; o.cy = o.y + h / 2; N[n.id] = o;
      maxC = Math.max(maxC, n.c + (n.w || 1)); maxR = Math.max(maxR, n.r + (n.h || 1));
    });
    (sp.groups || []).forEach(function (g) { maxC = Math.max(maxC, g.c + g.w); maxR = Math.max(maxR, g.r + g.h); });
    var W = pad * 2 + maxC * cw + (maxC - 1) * gx, H = pad * 2 + top + maxR * ch + (maxR - 1) * gy + (sp.bottom || 0);
    var svg = mkSvg(fig, W, H);
    (sp.groups || []).forEach(function (g) {
      var x = pad + g.c * (cw + gx) - 9, y = pad + top + g.r * (ch + gy) - 22, w = g.w * cw + (g.w - 1) * gx + 18, h = g.h * ch + (g.h - 1) * gy + 31;
      s('rect', { x: x, y: y, width: w, height: h, rx: 10, 'stroke-dasharray': '5 4', 'stroke-width': 1.2, style: 'fill:' + kfill(g.k) + ';fill-opacity:.45;stroke:' + kstroke(g.k) }, svg);
      label(svg, x + 9, y + 11, g.t, 11, kstroke(g.k) === 'var(--line-2)' ? 'var(--fg-3)' : kstroke(g.k), 700, 'start');
    });
    var eg = s('g', null, svg);
    (sp.edges || []).forEach(function (e) {
      var a = N[e[0]], b = N[e[1]], lab = e[2], o = e[3] || {};
      if (!a || !b) return;
      var d, lx, ly, dx = b.cx - a.cx, dy = b.cy - a.cy, via = o.via;
      if (!via) via = Math.abs(dy) < 2 ? 'h' : Math.abs(dx) < 2 ? 'v' : 'hv';
      var x1, y1, x2, y2;
      if (via === 'h') { x1 = dx > 0 ? a.x + a.w : a.x; x2 = dx > 0 ? b.x : b.x + b.w; y1 = a.cy + (o.oy || 0); y2 = b.cy + (o.oy || 0); d = 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2; lx = (x1 + x2) / 2; ly = y1 - 9; }
      else if (via === 'v') { y1 = dy > 0 ? a.y + a.h : a.y; y2 = dy > 0 ? b.y : b.y + b.h; x1 = a.cx + (o.ox || 0); x2 = b.cx + (o.ox || 0); d = 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2; lx = x1 + 8; ly = (y1 + y2) / 2; }
      else if (via === 'hv') { x1 = dx > 0 ? a.x + a.w : a.x; y1 = a.cy; x2 = b.cx; y2 = dy > 0 ? b.y : b.y + b.h; d = 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y1 + ' L' + x2 + ',' + y2; lx = (x1 + x2) / 2; ly = y1 - 9; }
      else if (via === 'vh') { x1 = a.cx; y1 = dy > 0 ? a.y + a.h : a.y; x2 = dx > 0 ? b.x : b.x + b.w; y2 = b.cy; d = 'M' + x1 + ',' + y1 + ' L' + x1 + ',' + y2 + ' L' + x2 + ',' + y2; lx = x1 + 8; ly = (y1 + y2) / 2; }
      else { // arc：从 a 的上/下边弯到 b 的上/下边，适合回环
        var up = (o.bend || -1) < 0, bend = Math.abs(o.bend || 34);
        x1 = a.cx; x2 = b.cx; y1 = up ? a.y : a.y + a.h; y2 = up ? b.y : b.y + b.h;
        var my = (up ? Math.min(y1, y2) - bend : Math.max(y1, y2) + bend);
        d = 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + my + ' ' + x2 + ',' + my + ' ' + x2 + ',' + y2; lx = (x1 + x2) / 2; ly = my + (up ? bend * 0.25 - 9 : -bend * 0.25 + 9);
      }
      var col = KIND[o.k] ? o.k : 'fg-3';
      s('path', { class: 'dg-e', d: d, 'stroke-dasharray': o.dash ? '5 4' : null, 'marker-end': 'url(#' + svg._id + '-' + col + ')', style: 'stroke:var(--' + col + ')' }, eg);
      if (lab) {
        var tw = textW(lab, 11.5) + 10; if (via === 'v' || via === 'vh') lx += tw / 2 - 2;
        labels.push([lx, ly, tw, lab, KIND[o.k] ? 'var(--' + o.k + ')' : 'var(--fg-2)']);
      }
    });
    sp.nodes.forEach(function (n) {
      var o = N[n.id], g = s('g', { class: 'dg-node' }, svg);
      s('rect', { x: o.x, y: o.y, width: o.w, height: o.h, rx: n.round ? o.h / 2 : 9, 'stroke-dasharray': n.dash ? '5 4' : null, style: 'fill:' + kfill(n.k) + ';stroke:' + kstroke(n.k) }, g);
      label(g, o.cx, n.s ? o.cy - 8.5 : o.cy, n.t, n.size || 13.5, 'var(--fg)', 650, null, n.mono);
      if (n.s) label(g, o.cx, o.cy + 10, n.s, 11, 'var(--fg-3)', null, null, n.smono);
    });
    labels.forEach(function (L) {
      s('rect', { class: 'dg-elbg', x: L[0] - L[2] / 2, y: L[1] - 8, width: L[2], height: 16, rx: 4 }, svg);
      label(svg, L[0], L[1], L[3], 11.5, L[4], 600);
    });
  }

  /* seq：时序图。actors 一列一个，msgs 一行一条 */
  function drawSeq(fig, sp) {
    var cw = sp.cw || 176, rowH = sp.rowH || 42, pad = 12, headH = 38, A = {}, n = sp.actors.length;
    var W = pad * 2 + n * cw, rows = sp.msgs.length, H = pad * 2 + headH + 16 + rows * rowH + 10;
    var svg = mkSvg(fig, W, H);
    sp.actors.forEach(function (a, i) {
      var cx = pad + cw * i + cw / 2; A[a.id] = cx;
      s('line', { x1: cx, y1: pad + headH, x2: cx, y2: H - pad, 'stroke-dasharray': '3 5', style: 'stroke:var(--line-2)', 'stroke-width': 1.5 }, svg);
      s('rect', { x: cx - cw / 2 + 12, y: pad, width: cw - 24, height: headH, rx: 9, 'stroke-width': 1.5, style: 'fill:' + kfill(a.k) + ';stroke:' + kstroke(a.k) }, svg);
      label(svg, cx, pad + headH / 2, a.t, 13.5, 'var(--fg)', 650);
    });
    sp.msgs.forEach(function (m, i) {
      var y = pad + headH + 16 + i * rowH + rowH / 2;
      if (!Array.isArray(m)) { // 说明条
        var ids = m.over || [sp.actors[0].id, sp.actors[n - 1].id];
        var xs = ids.map(function (id) { return A[id]; }), x1 = Math.min.apply(null, xs) - cw / 2 + 18, x2 = Math.max.apply(null, xs) + cw / 2 - 18;
        s('rect', { x: x1, y: y - 13, width: x2 - x1, height: 26, rx: 6, 'stroke-width': 1, style: 'fill:' + kfill(m.k || 'neutral') + ';stroke:' + kstroke(m.k || 'neutral') }, svg);
        label(svg, (x1 + x2) / 2, y, m.note, 12, 'var(--fg-2)');
        return;
      }
      var a = A[m[0]], b = A[m[1]], o = m[3] || {}, col = KIND[o.k] ? o.k : 'fg-3';
      if (m[0] === m[1]) {
        s('path', { class: 'dg-e', d: 'M' + a + ',' + (y - 9) + ' h34 v18 h-28', 'marker-end': 'url(#' + svg._id + '-' + col + ')', style: 'stroke:var(--' + col + ')' }, svg);
        label(svg, a + 42, y, m[2], 12, 'var(--fg-2)', null, 'start');
      } else {
        var dir = b > a ? 1 : -1;
        s('path', { class: 'dg-e', d: 'M' + (a + 3 * dir) + ',' + (y + 7) + ' L' + (b - 3 * dir) + ',' + (y + 7), 'stroke-dasharray': o.dash ? '5 4' : null, 'marker-end': 'url(#' + svg._id + '-' + col + ')', style: 'stroke:var(--' + col + ')' }, svg);
        label(svg, (a + b) / 2, y - 6, m[2], 12, KIND[o.k] ? 'var(--' + o.k + ')' : 'var(--fg-2)', 600);
      }
    });
  }

  /* bars：横向条形图，数值就是出处里的数 */
  function drawBars(fig, sp) {
    var rows = sp.rows, lw = sp.lw || 120, bw = sp.bw || 330, rh = 28, pad = 12, th = sp.title ? 30 : 0;
    rows.forEach(function (r) { lw = Math.max(lw, textW(String(r[0]), 13) + 22); });
    var max = sp.max || Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    var W = pad * 2 + lw + bw + 74, H = pad * 2 + th + rows.length * rh;
    var svg = mkSvg(fig, W, H);
    if (sp.title) label(svg, pad, pad + 10, sp.title, 13, 'var(--fg)', 650, 'start', sp.mono);
    rows.forEach(function (r, i) {
      var y = pad + th + i * rh + rh / 2, k = r[2] || 'neutral';
      label(svg, pad + lw - 10, y, r[0], 13, 'var(--fg)', 600, 'end', !/[^\x00-\xff]/.test(String(r[0])));
      s('rect', { x: pad + lw, y: y - 9, width: bw, height: 18, rx: 4, style: 'fill:var(--bg-3)' }, svg);
      s('rect', { x: pad + lw, y: y - 9, width: Math.max(2, bw * r[1] / max), height: 18, rx: 4, style: 'fill:var(--' + k + ')' }, svg);
      label(svg, pad + lw + bw + 9, y, sp.fmt != null ? r[1].toFixed(sp.fmt) : String(r[1]), 12.5, 'var(--fg-2)', null, 'start', true);
    });
  }

  /* plot：坐标图。curves 曲线（fn 表达式或 pts 点列）· lines 线段 / 向量箭头 · pts 点 · vl / hl 参考线 · notes 文字 */
  function drawPlot(fig, sp) {
    var W = sp.w || 480, H = sp.h || 300, L = sp.yl ? 56 : 44, R = 18, T = 14, B = sp.xl ? 42 : 28;
    var xr = sp.x, yr = sp.y, pw = W - L - R, ph = H - T - B;
    function X(v) { return L + (v - xr[0]) / (xr[1] - xr[0]) * pw; }
    function Y(v) { return T + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph; }
    function col(k) { return KIND[k] ? 'var(--' + k + ')' : 'var(--fg-2)'; }
    var svg = mkSvg(fig, W, H), id = svg._id;
    var cp = s('clipPath', { id: id + '-clip' }, svg.querySelector('defs'));
    s('rect', { x: L, y: T - 4, width: pw + 4, height: ph + 8 }, cp);
    // xtl / ytl：刻度的显示文字（可选，和 xt / yt 一一对应）。画对数坐标时，坐标用 log10 后的值，标签写 "10²⁰" 这种原值
    (sp.xt || []).forEach(function (v, i) {
      s('line', { x1: X(v), y1: T, x2: X(v), y2: T + ph, style: 'stroke:var(--line)' }, svg);
      label(svg, X(v), T + ph + 13, sp.xtl ? String(sp.xtl[i]) : String(v), 11, 'var(--fg-3)', null, null, true);
    });
    (sp.yt || []).forEach(function (v, i) {
      s('line', { x1: L, y1: Y(v), x2: L + pw, y2: Y(v), style: 'stroke:var(--line)' }, svg);
      label(svg, L - 7, Y(v), sp.ytl ? String(sp.ytl[i]) : String(v), 11, 'var(--fg-3)', null, 'end', true);
    });
    var ax = (yr[0] <= 0 && yr[1] >= 0) ? Y(0) : T + ph, ay = (xr[0] <= 0 && xr[1] >= 0) ? X(0) : L;
    s('line', { x1: L, y1: ax, x2: L + pw, y2: ax, 'stroke-width': 1.4, style: 'stroke:var(--fg-3)' }, svg);
    s('line', { x1: ay, y1: T, x2: ay, y2: T + ph, 'stroke-width': 1.4, style: 'stroke:var(--fg-3)' }, svg);
    if (sp.xl) label(svg, L + pw / 2, H - 10, sp.xl, 12, 'var(--fg-2)', 600);
    if (sp.yl) { var yt = label(svg, 13, T + ph / 2, sp.yl, 12, 'var(--fg-2)', 600); yt.setAttribute('transform', 'rotate(-90 13 ' + (T + ph / 2) + ')'); }
    (sp.vl || []).forEach(function (o) {
      s('line', { x1: X(o.x), y1: T, x2: X(o.x), y2: T + ph, 'stroke-dasharray': '5 4', 'stroke-width': 1.3, style: 'stroke:' + col(o.k) }, svg);
      if (o.t) label(svg, X(o.x) + 5, T + 9, o.t, 11.5, col(o.k), 600, 'start');
    });
    (sp.hl || []).forEach(function (o) {
      s('line', { x1: L, y1: Y(o.y), x2: L + pw, y2: Y(o.y), 'stroke-dasharray': '5 4', 'stroke-width': 1.3, style: 'stroke:' + col(o.k) }, svg);
      if (o.t) label(svg, L + pw - 4, Y(o.y) - 9, o.t, 11.5, col(o.k), 600, 'end');
    });
    var g = s('g', { 'clip-path': 'url(#' + id + '-clip)' }, svg);
    (sp.curves || []).forEach(function (c) {
      var pts = c.pts || [], i;
      if (c.fn) {
        var f = new Function('x', 'return ' + c.fn), a = c.from == null ? xr[0] : c.from, b = c.to == null ? xr[1] : c.to, n = c.n || 90;
        pts = []; for (i = 0; i <= n; i++) { var x = a + (b - a) * i / n, y = f(x); if (isFinite(y)) pts.push([x, y]); }
      }
      var lo = yr[0] - (yr[1] - yr[0]), hi = yr[1] + (yr[1] - yr[0]);
      var d = pts.map(function (p, j) { return (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(Math.max(lo, Math.min(hi, p[1]))).toFixed(1); }).join(' ');
      s('path', { d: d, fill: 'none', 'stroke-width': c.w || 2.3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': c.dash ? '6 4' : null, style: 'stroke:' + col(c.k) }, g);
      if (c.dots) pts.forEach(function (p) { s('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3, style: 'fill:' + col(c.k) }, g); });
    });
    (sp.lines || []).forEach(function (o) {
      var mk = KIND[o.k] ? o.k : 'fg-3';
      s('line', { x1: X(o.a[0]), y1: Y(o.a[1]), x2: X(o.b[0]), y2: Y(o.b[1]), 'stroke-width': o.w || 2, 'stroke-dasharray': o.dash ? '5 4' : null,
        'marker-end': o.arrow ? 'url(#' + id + '-' + mk + ')' : null, style: 'stroke:' + (KIND[o.k] ? 'var(--' + o.k + ')' : 'var(--fg-3)') }, svg);
      if (o.t) { var p = o.tp == null ? 1 : o.tp;
        label(svg, X(o.a[0] + (o.b[0] - o.a[0]) * p) + (o.dx == null ? 8 : o.dx), Y(o.a[1] + (o.b[1] - o.a[1]) * p) + (o.dy == null ? -8 : o.dy), o.t, o.size || 12, col(o.k), 600, o.ta || 'start'); }
    });
    (sp.pts || []).forEach(function (p) {
      s('circle', { cx: X(p.x), cy: Y(p.y), r: p.r || 4.5, 'stroke-width': 1.5, style: 'fill:' + (p.hollow ? 'var(--bg-2)' : col(p.k)) + ';stroke:' + col(p.k) }, svg);
      if (p.t) label(svg, X(p.x) + (p.dx == null ? 8 : p.dx), Y(p.y) + (p.dy == null ? -9 : p.dy), p.t, p.size || 12, p.tk ? col(p.tk) : 'var(--fg)', 600, p.ta || 'start');
    });
    (sp.notes || []).forEach(function (n) { label(svg, X(n.x), Y(n.y), n.t, n.size || 12, n.k ? col(n.k) : 'var(--fg-2)', n.bold ? 650 : null, n.ta || 'middle'); });
  }
  function initDiagrams() {
    $$('figure.dg').forEach(function (fig) {
      var js = fig.querySelector('script[type="application/json"]'); if (!js) return;
      try {
        var sp = JSON.parse(js.textContent);
        fig.setAttribute('contenteditable', 'false');
        (sp.type === 'seq' ? drawSeq : sp.type === 'bars' ? drawBars : sp.type === 'plot' ? drawPlot : drawFlow)(fig, sp);
      } catch (e) { console.error('[dg]', e, fig); el('pre', { 'data-gen': '' }, fig).textContent = '图示解析失败：' + e.message; }
    });
  }

  /* ---------- 时间戳：点一下在新标签页打开这一讲视频的对应位置（不改 DOM，另存为 HTML 不受影响） ---------- */
  function initTimestamps() {
    function lessonOf(node) {
      var sec = node.closest('section.ep');
      return sec && MOD ? MOD.lessons[+sec.getAttribute('data-n') - 1] : null;
    }
    function seconds(t) {
      var p = t.trim().split(':'), s = 0;
      for (var i = 0; i < p.length; i++) { if (!/^\d+$/.test(p[i])) return -1; s = s * 60 + +p[i]; }
      return s;
    }
    $$('main .ts').forEach(function (ts) {
      var L = lessonOf(ts);
      if (L && L.yt && seconds(ts.textContent) >= 0) { ts.classList.add('go'); ts.title = '在 YouTube 上从这里开始看'; }
      // 一串紧挨着的时间戳中间没有可断行的地方，窄屏会撑出横向滚动：每个后面补一个 <wbr>
      var nx = ts.nextSibling;
      if (nx && nx.nodeType === 1 && nx.classList.contains('ts')) ts.parentNode.insertBefore(document.createElement('wbr'), nx);
    });
    document.addEventListener('click', function (e) {
      var ts = e.target.closest && e.target.closest('.ts.go');
      if (!ts || document.body.classList.contains('editing')) return;
      var L = lessonOf(ts), s = seconds(ts.textContent);
      if (L && L.yt && s >= 0) window.open('https://youtu.be/' + L.yt + '?t=' + s, '_blank', 'noopener');
    });
  }

  /* ---------- 首页 ---------- */
  function initHome() {
    // 章节卡片：进度条按小节算（打开过那一章才知道小节数，否则按讲算）；右上角 ✓ 整章打勾 / 取消
    var cards = [];
    $$('.card[data-m]').forEach(function (c) {
      var m = modOf(c.getAttribute('data-m')); if (!m) return;
      var b = el('button', { class: 'card-ck', 'data-gen': '', 'aria-label': '整章打勾' }, c, '✓');
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var s = chapterStat(m);
        if (s.fin) { if (!confirm('取消「' + m.zh + '」这一章的全部打勾？')) return; setChapter(m.key, false); }
        else setChapter(m.key, true);
        paint();
      });
      cards.push({ c: c, m: m, b: b });
    });
    // 课表里每一讲：✓ 这一讲读完（和章节页左栏的整讲打勾是同一份记录）
    var rows = [];
    $$('a[data-ch]').forEach(function (a) {
      var m = modOf(a.getAttribute('data-ch')), mm = /#e(\d+)$/.exec(a.getAttribute('href') || '');
      if (!m || !mm || !a.closest('td')) return;
      var n = +mm[1];
      var b = el('button', { class: 'row-ck', 'data-gen': '', 'aria-label': '这一讲打勾' }, null, '✓');
      a.parentNode.insertBefore(b, a);
      b.onclick = function () {
        var d = getDone(); d[m.key] = d[m.key] || {};
        var dn = d[m.key], on = !dn[n];
        Object.keys(dn).forEach(function (k) { if (k.indexOf(n + '.') === 0) delete dn[k]; });
        if (on) dn[n] = 1; else delete dn[n];
        if (!Object.keys(dn).length) delete d[m.key];
        setDone(d); paint();
      };
      rows.push({ b: b, m: m, n: n, tr: a.closest('tr') });
    });
    function paint() {
      var d = getDone();
      cards.forEach(function (x) {
        var s = chapterStat(x.m, d), frac = s.subTotal ? s.subs / s.subTotal : s.lessons / s.total;
        var bar = x.c.querySelector('.bar i'); if (bar) bar.style.width = (100 * frac) + '%';
        var f = x.c.querySelector('.foot .pg');
        if (f) f.textContent = s.fin ? '已读完 ✓' : s.lessons + ' / ' + s.total + ' 讲' + (s.subTotal ? ' · ' + s.subs + ' / ' + s.subTotal + ' 节' : '');
        x.c.classList.toggle('fin', s.fin); x.c.classList.toggle('part', !s.fin && s.started);
        x.b.title = s.fin ? '这一章已读完（点一下取消）' : (s.started ? '这一章读了一部分（点一下整章打勾）' : '整章打勾');
      });
      rows.forEach(function (x) {
        var dn = d[x.m.key] || {}, part = false;
        Object.keys(dn).forEach(function (k) { if (k.indexOf(x.n + '.') === 0) part = true; });
        x.b.classList.toggle('on', !!dn[x.n]); x.b.classList.toggle('part', !dn[x.n] && part);
        x.b.title = dn[x.n] ? '这一讲已读完（点一下取消）' : (part ? '这一讲读了一部分小节（点一下整讲打勾）' : '这一讲读完了就打勾');
        if (x.tr) x.tr.classList.toggle('read', !!dn[x.n]);
      });
      markNav();
    }
    paint();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var side = buildShell();
    if (MOD) {
      var items = buildEpisodes(side);
      lvNote();
      initEdit();
      initCode();
      initDiagrams();
      initTimestamps();
      initRefs();
      initGloss();
      initSpy(items);
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 60); }
    } else { initHome(); initDiagrams(); if (window.GL) GL.apply($('.home') || $('main')); }
  });
  window.PT = { hilite: hilite, toast: toast };
})();

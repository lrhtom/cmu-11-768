/* app.js —— 每个页面都要用的东西：顶栏、记住页面状态、复制按钮、代码着色、可勾选的清单。没有用第三方库。 */
(function (global) {
  'use strict';
  var PAGES = [
    ['index.html', '1', '功能介绍'], ['prereq.html', '2', '前置知识'], ['stages.html', '3', '分阶段笔记'],
    ['files.html', '4', '文件地图'], ['viz.html', '5', '可视化演示'], ['steps.html', '6', '复原步骤链'],
    ['diffs.html', '7', '差异与出处']];
  var NS = 'lab-notes:';
  var page = document.body.getAttribute('data-page');
  var memory = {};

  /* ---- 本地存储：读写都包一层，浏览器不给用时退回内存，页面照常能看 ---- */
  var store = {
    get: function (key, fallback) {
      try { var raw = localStorage.getItem(NS + key); return raw == null ? fallback : JSON.parse(raw); }
      catch (e) { return key in memory ? memory[key] : fallback; }
    },
    set: function (key, value) {
      memory[key] = value;
      try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) { /* 存不了就只留在内存里 */ }
    }
  };

  /* ---- 页面状态：滚动位置和各页自己的进度，离开时存、回来时取 ---- */
  var state = store.get('state:' + page, {});
  function saveState(patch) {
    for (var k in patch) state[k] = patch[k];
    store.set('state:' + page, state);
  }
  var scrollTimer = 0;
  global.addEventListener('scroll', function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { saveState({ scrollY: Math.round(global.scrollY) }); }, 150);
  }, { passive: true });
  global.addEventListener('pagehide', function () { saveState({ scrollY: Math.round(global.scrollY) }); });
  function restoreScroll() {
    if (location.hash) {                                     // 带锚点进来的：以锚点为准
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) { target.scrollIntoView(); if (target.classList) target.classList.add('hit'); }
      return;
    }
    if (state.scrollY) global.scrollTo(0, state.scrollY);
  }

  function h(tag, attrs, children) {
    var e = document.createElement(tag), k;
    for (k in attrs || {}) {
      if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function topbar() {
    var nav = h('nav', { class: 'nav' }, PAGES.map(function (p) {
      return h('a', { href: p[0], class: p[0].replace('.html', '') === page ? 'cur' : null }, [h('b', { text: p[1] }), p[2]]);
    }));
    nav.appendChild(h('i', { class: 'sep' }));
    var noteBtn = h('a', { href: '#', class: 'notes-toggle', title: '显示 / 隐藏代码里的注释层（灰底的讲解行，复制时不会带上）', onclick: function (e) {
      e.preventDefault(); var off = !document.body.classList.contains('hide-notes');
      document.body.classList.toggle('hide-notes', off); noteBtn.lastChild.textContent = off ? '注释：关' : '注释：开';
      try { localStorage.setItem('cmu768-notes:hide-notes', off ? '1' : ''); } catch (er) { /* 存不了就算了 */ }
    } }, [h('b', { text: '✎' }), '注释：开']);
    try { if (localStorage.getItem('cmu768-notes:hide-notes')) { document.body.classList.add('hide-notes'); noteBtn.lastChild.textContent = '注释：关'; } } catch (er) { /* 默认显示 */ }
    nav.appendChild(noteBtn);
    nav.appendChild(h('a', { href: '../../c8.html', title: '课程笔记里讲三次作业的那一章' }, [h('b', { text: 'c8' }), '作业章']));
    nav.appendChild(h('a', { href: '../../index.html', title: '回到 CMU 11-768 的逐讲笔记' }, [h('b', { text: '11-768' }), '课程笔记']));
    document.body.insertBefore(h('header', { class: 'topbar' }, [
      h('a', { class: 'brand', href: 'index.html', html: '作业复原笔记<small>CMU 11-768 · 作业 1–3</small>' }), nav]), document.body.firstChild);
    var cur = nav.querySelector('.cur');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /* ---- Python 着色：注释、字符串、数字、关键字、装饰器 ---- */
  var KW = /^(?:False|None|True|and|as|assert|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)$/;
  var TOKEN = /(#[^\n]*)|((?:[rRfFbB]{0,2})(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))|(@[\w.]+)|\b(\d+(?:\.\d+)?(?:e[-+]?\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  function highlightPython(src) {
    var out = '', last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      out += esc(src.slice(last, m.index));
      var cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'd' : m[4] ? 'n' : (KW.test(m[5]) ? 'k' : '');
      out += cls ? '<span class="tk-' + cls + '">' + esc(m[0]) + '</span>' : esc(m[0]);
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  function copyText(text, btn) {
    function done() { var old = btn.textContent; btn.textContent = '已复制'; setTimeout(function () { btn.textContent = old; }, 1200); }
    function fallback() {
      var ta = h('textarea', { style: 'position:fixed;left:-999px;top:0' });
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { btn.textContent = '复制失败'; }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && global.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }

  /* ---- 给一块刚放进页面的内容补上：着色、复制按钮、嵌在正文里的小演示 ---- */
  function enhance(root) {
    Array.prototype.forEach.call(root.querySelectorAll('pre'), function (pre) {
      if (pre.parentNode.classList.contains('codewrap')) return;
      var code = pre.querySelector('code') || pre, text = code.textContent;
      if (pre.getAttribute('data-lang') === 'python') code.innerHTML = highlightPython(text);
      var nt = pre.getAttribute('data-notes');                 // 注释层：插在代码行之间，不能选中；复制用的 text 是插之前取的
      if (nt) {
        try {
          var by = {};
          JSON.parse(nt).forEach(function (n) { (by[n[0]] = by[n[0]] || []).push(n[1]); });
          var lines = code.innerHTML.split('\n'), outH = '';
          var pend = '';                                       // 注释接在换行符后面、下一行前面（块级，不会多出空行）
          lines.forEach(function (ln, i) {
            outH += (i ? '\n' + pend : '') + ln;
            pend = (by[i + 1] || []).map(function (x) { return '<span class="cnote" aria-hidden="true">' + x + '</span>'; }).join('');
          });
          outH += pend;
          code.innerHTML = outH;
        } catch (e) { /* 注释坏了就不显示，代码照常 */ }
      }
      var wrap = h('div', { class: 'codewrap' });
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      if (pre.getAttribute('data-nocopy')) return;            // 「删掉的旧行」只给人看，不给复制
      var btn = h('button', { class: 'copy', type: 'button', text: '复制', onclick: function () { copyText(text, btn); } });
      wrap.appendChild(btn);
    });
    if (global.Viz) Array.prototype.forEach.call(root.querySelectorAll('.inviz'), function (box) {
      if (!box.getAttribute('data-mounted')) { box.setAttribute('data-mounted', '1'); global.Viz.mountInline(box); }
    });
  }

  /* ---- 可勾选的一行，勾选状态记在浏览器里 ---- */
  function checkRow(key, labelHtml, onChange) {
    var on = !!store.get('chk:' + key, false);
    var input = h('input', { type: 'checkbox' });
    input.checked = on;
    var row = h('label', { class: 'check' + (on ? ' done' : '') }, [input, h('span', { html: labelHtml })]);
    input.addEventListener('change', function () {
      store.set('chk:' + key, input.checked);
      row.classList.toggle('done', input.checked);
      if (onChange) onChange(input.checked);
    });
    return row;
  }
  function isChecked(key) { return !!store.get('chk:' + key, false); }
  function setChecked(key, value) { store.set('chk:' + key, !!value); }

  global.App = { store: store, state: state, saveState: saveState, restoreScroll: restoreScroll, h: h, esc: esc,
    topbar: topbar, enhance: enhance, checkRow: checkRow, isChecked: isChecked, setChecked: setChecked,
    highlightPython: highlightPython, page: page };
})(window);

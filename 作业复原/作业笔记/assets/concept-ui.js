/* concept-ui.js —— 分阶段笔记第 3 部分「核心原理」：翻页图解（从 go_learn 笔记搬过来，按阶段组织）。
 *   节 = 这个阶段的一个核心原理：下拉菜单 / 上一节 / 下一节（Shift + ← →）。
 *   页 = 这一节的一张图：上一页 / 下一页（← →），进度条可点可拖。同一个东西从头到尾同一个 id，翻页时舞台只补间（移动、变色），
 *        新出现的淡入、去掉的淡出，黄底 / 橙框是这一页的变化；换一节整张换。
 *   面板（宽屏在舞台右边，窄屏在舞台下面）：这一页讲什么、本节各页目录（可点）、最后一页的「一句话记住」和下一节入口。
 * 舞台是这一节自己的 SVG（tween.js），排版用 trace-core.js。
 * 数据：concepts.js 里的 CONCEPTS / CONCEPT_SRC（tools/build_concepts.py 从 content/concepts/S<N>.json 生成，写法见那里的 README.md）。
 */
window.Concepts = (function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const prose = t => String(t || '').split(/\n{2,}/).map(p => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`).join('');
  const POS_KEY = 'lab-notes:con_pos';

  let C = null;            // 当前阶段：{ sid, D, list, ci, pi: { 节下标: 页下标 } }
  let stage = null;        // 当前 SVG 的补间舞台（每次换阶段重画时换新的）
  let shownCi = -1;
  let pos = {};
  try { pos = JSON.parse(localStorage.getItem(POS_KEY) || '{}') || {}; } catch (e) { pos = {}; }

  const data = sid => (window.CONCEPTS || {})[sid] || null;
  const curPage = () => { const c = C.list[C.ci]; return Math.max(0, Math.min(c.steps.length - 1, C.pi[C.ci] || 0)); };

  // ---------------- 外壳（每个阶段渲染一次）；这个阶段还没有图解就返回空串，由阶段页退回旧的文字版 ----------------
  function html(sid) {
    const D = data(sid);
    if (!D || !(D.list || []).length || !window.TraceCore || !window.Tween) { C = null; return ''; }
    C = { sid, D, list: D.list, ci: 0, pi: {} };
    shownCi = -1;
    const nPages = C.list.reduce((n, c) => n + c.steps.length, 0);
    return `
      <p class="muted cx-hint">${D.intro ? inline(D.intro) + ' ' : ''}这个阶段 ${C.list.length} 节、共 ${nPages} 页图。<b>节</b>用下拉菜单或「上一节 / 下一节」（Shift + ← →）。
        <b>页</b>用 ‹ › 或 ← →，进度条可点可拖。翻页时同一个东西会移动、变色，新出现的淡入。黄底、橙框是这一页的变化。</p>
      <div class="cx" id="cx">
        <div class="wk-nav cx-nav">
          <span class="wk-lbl">节</span>
          <button type="button" class="wk-btn" id="cx-cprev" title="上一节（Shift + ←）">‹ 上一节</button>
          <select id="cx-pick" title="选择一节">${C.list.map((c, j) => `<option value="${j}">${j + 1}. ${esc(c.t)}（${c.steps.length} 页）</option>`).join('')}</select>
          <button type="button" class="wk-btn" id="cx-cnext" title="下一节（Shift + →）">下一节 ›</button>
          <span class="wk-pos" id="cx-pos"></span>
        </div>
        <div class="cx-grid">
          <div class="cx-stage"><svg id="cx-svg" class="cx-svg" viewBox="0 0 1000 560" role="img" aria-label="核心原理图解"></svg></div>
          <div class="cx-card" id="cx-card"></div>
        </div>
      </div>`;
  }

  // ---------------- 面板：换一节重画整块（进度条只在这时新建，拖动不会断）；翻页只换正文 ----------------
  function renderConcept() {
    const c = C.list[C.ci], n = c.steps.length;
    $('#cx-pick').value = String(C.ci);
    $('#cx-cprev').disabled = C.ci <= 0; $('#cx-cnext').disabled = C.ci >= C.list.length - 1;
    $('#cx-pos').textContent = `${C.ci + 1} / ${C.list.length}`;
    $('#cx-card').innerHTML = `<div class="cx-h"><em>${C.ci + 1}</em><b>${inline(c.t)}</b></div>
      <div class="cx-body" id="cx-body"></div>
      <div class="wk-ctl cx-ctl"><button type="button" class="wk-btn" id="cx-prev" title="上一页（←）">‹</button>
        <div class="wk-track"><input type="range" id="cx-range" min="0" max="${n - 1}" value="0" aria-label="翻页进度，可点击或拖动"></div>
        <button type="button" class="wk-btn" id="cx-next" title="下一页（→）">›</button><span class="wk-slabel" id="cx-slabel"></span></div>`;
    renderPage();
  }
  function renderPage() {
    const c = C.list[C.ci], n = c.steps.length, j = curPage(), p = c.steps[j], last = j === n - 1;
    const nx = C.list[C.ci + 1];
    let h = `<div class="cx-ph"><span>第 ${j + 1} 页</span>${inline(p.h || '')}</div><div class="cx-say">${prose(p.say)}</div>`;
    if (last && c.sum) h += `<div class="cx-sum"><b>一句话记住</b>${inline(c.sum)}</div>`;
    if (last) h += nx ? `<div class="cx-next">本节完。下一节：<a href="#" data-cx="${C.ci + 1}">${C.ci + 2}. ${inline(nx.t)} ›</a></div>`
      : `<div class="cx-next">这个阶段的原理看完了。接下来动手：<a href="#" data-sec="sec-walk">逐步走读 · 先写后跑 ›</a></div>`;
    h += `<div class="wk-sub">本节 ${n} 页（点一项直接翻过去）</div><ol class="cx-pages">${c.steps.map((s, k) =>
      `<li class="${k === j ? 'on' : k < j ? 'seen' : ''}"><a href="#" data-pg="${k}">${inline(s.h || '第 ' + (k + 1) + ' 页')}</a></li>`).join('')}</ol>`;
    $('#cx-body').innerHTML = h;
    $('#cx-body').scrollTop = 0;
    $('#cx-range').value = j;
    $('#cx-prev').disabled = j <= 0; $('#cx-next').disabled = last;
    $('#cx-slabel').textContent = `${j + 1} / ${n}`;
  }
  // 镜头：一节里所有页用到的范围（不看代码的整幅图常常只占画布中间一块），按舞台的比例放大到刚好装下，整节不变。
  // 窄屏（手机）上整张 1000 宽的画布缩得太小：有源码的节只对准右边的图，源码栏留给宽屏看
  const W0 = 1000, H0 = 560, PAD = 18, MINW = 600;
  const NARROW = window.matchMedia('(max-width: 700px)');
  function lens(c) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = b => { if (!b) return; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]); };
    c.steps.forEach((s, i) => {
      const sc = window.TraceCore.scene(c, i, window.CONCEPT_SRC || {});
      if (!sc.geo.full && !NARROW.matches) add([8, 8, 428, 544]);
      sc.tops.forEach(t => add(t[1])); sc.marks.forEach(m => add(m[1]));
    });
    if (!isFinite(x0)) return `0 0 ${W0} ${H0}`;
    let w = x1 - x0 + 2 * PAD, h = y1 - y0 + 2 * PAD;
    if (NARROW.matches) { w = Math.max(320, w, h / 1.2); h = Math.max(h, w * 0.45); }      // 窄屏：按图本身的比例，舞台可以高一点
    else { w = Math.max(MINW, w); if (w / h > W0 / H0) h = w * H0 / W0; else w = h * W0 / H0; }
    w = Math.min(W0, w); h = Math.min(H0, h);
    const x = Math.max(0, Math.min(W0 - w, (x0 + x1) / 2 - w / 2)), y = Math.max(0, Math.min(H0 - h, (y0 + y1) / 2 - h / 2));
    return [x, y, w, h].map(v => Math.round(v)).join(' ');
  }
  // 舞台跟着翻：同一节里只补间；换了一节先把上一节整张撤掉，新的从空白淡入
  function draw() {
    const svg = $('#cx-svg');
    if (!svg) return;
    if (!stage || stage.svg !== svg) { stage = window.Tween.stage(svg); stage.svg = svg; shownCi = -1; }
    const c = C.list[C.ci];
    if (shownCi !== C.ci) { stage.clear(); shownCi = C.ci; svg.setAttribute('viewBox', lens(c)); }
    stage.show(window.TraceCore.scene(c, curPage(), window.CONCEPT_SRC || {}).prims);
  }
  const relens = () => { const svg = $('#cx-svg'); if (C && svg) svg.setAttribute('viewBox', lens(C.list[C.ci])); };
  if (NARROW.addEventListener) NARROW.addEventListener('change', relens);
  function save() {
    pos[C.sid] = { c: C.ci, p: curPage() };
    try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) { /* 存不了就只管这一次 */ }
  }
  function goConcept(j, page) {
    if (!C || !$('#cx')) return;
    C.ci = Math.max(0, Math.min(C.list.length - 1, j));
    if (page !== undefined) C.pi[C.ci] = page;
    renderConcept(); draw(); save();
  }
  function goPage(j) {
    if (!C || !$('#cx')) return;
    const n = C.list[C.ci].steps.length, v = Math.max(0, Math.min(n - 1, j));
    if (v === curPage()) return;
    C.pi[C.ci] = v;
    renderPage(); draw(); save();
  }

  // 键盘归谁：核心原理和逐步走读都用 ← →，看屏幕上哪一块露出来的多
  const vis = el => { if (!el) return 0; const r = el.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)); };
  function owns() {
    if (!C || !$('#cx')) return false;
    const a = vis($('#sec-con'));
    return a > 80 && a >= vis($('#sec-walk'));
  }

  // ---------------- 对外 ----------------
  // 渲染完外壳后调用。进来停在上次在这个阶段看到的那一节那一页
  function start() {
    if (!C || !$('#cx')) return;
    const p = pos[C.sid];
    if (p && C.list[p.c]) { C.ci = p.c; C.pi[p.c] = p.p; }
    stage = null;
    renderConcept(); draw();
  }
  function init() {
    document.addEventListener('click', e => {
      if (!C || !e.target.closest('#sec-con')) return;
      const btn = e.target.closest('button');
      if (btn) {
        if (btn.id === 'cx-cprev') return goConcept(C.ci - 1);
        if (btn.id === 'cx-cnext') return goConcept(C.ci + 1);
        if (btn.id === 'cx-prev') return goPage(curPage() - 1);
        if (btn.id === 'cx-next') return goPage(curPage() + 1);
      }
      const a = e.target.closest('a');
      if (a && a.dataset.pg) { e.preventDefault(); goPage(+a.dataset.pg); }
      else if (a && a.dataset.cx) { e.preventDefault(); goConcept(+a.dataset.cx, 0); }
      else if (a && a.dataset.sec) { e.preventDefault(); const t = document.getElementById(a.dataset.sec); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    });
    document.addEventListener('change', e => { if (C && e.target.id === 'cx-pick') { goConcept(+e.target.value); e.target.blur(); } });
    document.addEventListener('input', e => { if (C && e.target.id === 'cx-range') goPage(+e.target.value); });
    document.addEventListener('keydown', e => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable || !owns()) return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (e.shiftKey) goConcept(C.ci + dir, 0); else goPage(curPage() + dir);
      e.preventDefault();
    });
  }

  return { init, html, start, owns, go: goConcept, has: sid => !!(data(sid) || {}).list };
})();

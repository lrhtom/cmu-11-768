// 补间舞台：把 trace-core.js 排出来的图元画进一个 SVG（分阶段笔记「核心原理」翻页图解用，一节一张；从 go_learn 笔记搬过来，没改逻辑）。
// 做法和页面 5 的舞台（stage.js）一样：每个图元有稳定 id，翻页时同一个 id 还在就只补间 位置 / 颜色 / 透明度，新增的淡入、去掉的淡出，从不整块重绘。
// 只认 trace-core 的四种图元：rect / text / link / dot（circle）。
//   const st = Tween.stage(svg);  st.show(prims);  st.clear();   // clear：换一节时整张撤掉，新的一节从空白淡入
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const css = a => `rgb(${a.map(v => Math.round(v)).join(',')})`;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t;
  const clone = o => { const r = {}; for (const k in o) r[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return r; };
  const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const LAYER = { link: 'under', rect: 'back' };      // 线在最底下，框在中间，字和点在最上面
  const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function stage(svg) {
    const els = new Map();
    let running = false;
    svg.textContent = '';
    const layers = {};
    for (const name of ['under', 'back', 'nodes']) layers[name] = mk('g', { class: 'layer-' + name }, svg);

    function props(pr) {
      const p = Object.assign({ opacity: 1 }, pr.p);
      for (const key of ['fill', 'stroke', 'color']) if (typeof p[key] === 'string') p[key] = hex(p[key]);
      if (pr.t === 'dot') Object.assign(p, { stroke: p.fill, sw: 0, fo: 1 });
      return p;
    }
    function create(pr, start) {
      const m = pr.m || {}, type = pr.t === 'dot' ? 'circle' : pr.t;
      const el = { id: pr.id, type, cur: start, from: null, to: null, t0: 0, dur: 0, dying: false };
      el.g = mk('g', { class: 'tw-' + type }, layers[LAYER[type] || 'nodes']);
      if (type === 'rect') {
        el.r = mk('rect', { rx: m.rx || 0 }, el.g);
        if (m.dash) el.r.setAttribute('stroke-dasharray', m.dash);
      } else if (type === 'text') {
        el.t = mk('text', { class: m.cls || '', 'text-anchor': m.anchor || 'start' }, el.g);
        el.t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
        if (m.spans) for (const [s, c] of m.spans) { const ts = mk('tspan', c ? { class: 'sx-' + c } : {}, el.t); ts.textContent = s; }
        else el.t.textContent = m.text;
        if (m.title) mk('title', {}, el.g).textContent = m.title;
      } else if (type === 'link') {
        el.line = mk('path', { class: 'tr-link', fill: 'none' }, el.g);
        if (m.dash) el.line.setAttribute('stroke-dasharray', m.dash);
        el.arrow = mk('path', { class: 'tr-head' }, el.g);
      } else {
        el.c = mk('circle', {}, el.g);
      }
      els.set(pr.id, el);
      return el;
    }

    // snap：不播动画，直接画到位（系统设置了「减少动画」、页面在后台时也这样：后台不跑动画帧，免得停在半路）
    function show(prims, opt) {
      const snap = (opt && opt.snap) || reduce.matches || document.hidden;
      const now = performance.now(), dur = snap ? 0 : 650, seen = new Set();
      for (const pr of prims) {
        seen.add(pr.id);
        const target = props(pr);
        let el = els.get(pr.id);
        if (!el) {
          const start = clone(target);
          start.opacity = 0;
          if (pr.enter) Object.assign(start, pr.enter);
          el = create(pr, start);
        }
        el.dying = false;
        el.from = clone(el.cur); el.to = Object.assign(clone(el.cur), target); el.t0 = now; el.dur = dur;
      }
      for (const el of els.values()) {
        if (seen.has(el.id) || el.dying) continue;
        el.dying = true; el.from = clone(el.cur); el.to = Object.assign(clone(el.cur), { opacity: 0 }); el.t0 = now; el.dur = dur * 0.7;
      }
      if (snap) frame(now);
      else if (!running) { running = true; requestAnimationFrame(frame); }
    }
    function clear() {
      for (const el of els.values()) el.g.remove();
      els.clear();
    }

    function frame(now) {
      let active = false;
      for (const el of [...els.values()]) {
        if (!el.to) continue;
        const t = el.dur ? Math.min(1, (now - el.t0) / el.dur) : 1, e = ease(t);
        for (const k in el.to) el.cur[k] = lerp(el.from[k] !== undefined ? el.from[k] : el.to[k], el.to[k], e);
        render(el);
        if (t < 1) active = true;
        else { el.to = null; if (el.dying) { el.g.remove(); els.delete(el.id); } }
      }
      if (active) { running = true; requestAnimationFrame(frame); } else running = false;
    }

    function render(el) {
      const p = el.cur;
      el.g.style.opacity = p.opacity;
      if (el.type === 'rect') {
        el.r.setAttribute('x', p.x); el.r.setAttribute('y', p.y);
        el.r.setAttribute('width', Math.max(0, p.w)); el.r.setAttribute('height', Math.max(0, p.h));
        el.r.setAttribute('fill', css(p.fill)); el.r.setAttribute('fill-opacity', p.fo);
        el.r.setAttribute('stroke', css(p.stroke)); el.r.setAttribute('stroke-width', p.sw);
      } else if (el.type === 'text') {
        el.g.setAttribute('transform', `translate(${p.x},${p.y})`);
        if (p.fill) el.t.setAttribute('fill', css(p.fill));
      } else if (el.type === 'circle') {
        el.c.setAttribute('cx', p.x); el.c.setAttribute('cy', p.y); el.c.setAttribute('r', Math.max(0, p.r));
        el.c.setAttribute('fill', css(p.fill)); el.c.setAttribute('fill-opacity', p.fo);
        el.c.setAttribute('stroke', css(p.stroke)); el.c.setAttribute('stroke-width', p.sw);
      } else if (el.type === 'link') {
        el.line.setAttribute('d', `M${p.x1},${p.y1} C${p.c1x},${p.c1y} ${p.c2x},${p.c2y} ${p.x2},${p.y2}`);
        const col = css(p.color);
        el.line.setAttribute('stroke', col); el.line.setAttribute('stroke-width', p.width);
        let fx = p.c2x, fy = p.c2y;
        if (Math.abs(fx - p.x2) + Math.abs(fy - p.y2) < 0.5) { fx = p.x1; fy = p.y1; }
        const ang = Math.atan2(p.y2 - fy, p.x2 - fx), s = 5 + p.width * 1.5;
        const ax = p.x2 - Math.cos(ang) * s, ay = p.y2 - Math.sin(ang) * s;
        const px = Math.cos(ang + Math.PI / 2) * s * 0.45, py = Math.sin(ang + Math.PI / 2) * s * 0.45;
        el.arrow.setAttribute('d', `M${p.x2},${p.y2} L${ax + px},${ay + py} L${ax - px},${ay - py} Z`);
        el.arrow.setAttribute('fill', col);
      }
    }

    return { show, clear };
  }

  window.Tween = { stage };
})();

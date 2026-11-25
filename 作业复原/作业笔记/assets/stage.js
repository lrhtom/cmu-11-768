/* stage.js —— 常驻舞台。没有用任何第三方库。
 *
 * 用法：var st = new Stage(svgElement); st.apply(scene, {dur: 600});
 * scene 是 {id: 规格} 的字典。舞台记住每个 id 现在的样子，apply 时只做三件事：
 *   上一幕和这一幕都有的 id → 位置、大小、颜色、透明度从现在的值补间到新值
 *   这一幕新出现的 id       → 在目标位置淡入
 *   这一幕没有了的 id       → 淡出，淡完再从页面上拿掉
 * 所以不会整块重画，也不会有东西突然跳到别处。
 *
 * 规格的 kind：
 *   box   矩形 + 文字   x y w h rx fill stroke sw op label sub fs color align('c'|'l') mono bold dash
 *   edge  两个 box 之间的连线  from to color sw op dash arrow label side （端点跟着 box 走，每帧重算）
 *   text  单独一行字    x y text fs color op anchor mono bold
 *   dot   小圆点        x y r fill op
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var NUM = ['x', 'y', 'w', 'h', 'rx', 'op', 'sw', 'fs', 'r'];
  var COL = ['fill', 'stroke', 'color'];
  var DEF = { op: 1, sw: 1.2, rx: 7, fs: 12.5, r: 6, w: 0, h: 0, x: 0, y: 0 };
  var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function parseColor(c) {
    if (!c || c === 'none') return null;
    if (c[0] === '#') {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
    }
    var m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) { var p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return null;
  }
  function mixColor(a, b, t) {
    var A = parseColor(a), B = parseColor(b);
    if (!B) return b || 'none';
    if (!A) A = [B[0], B[1], B[2], 0];                      // 从"没有颜色"过渡：同色、透明度从 0 起
    var r = function (i) { return Math.round(A[i] + (B[i] - A[i]) * t); };
    return 'rgba(' + r(0) + ',' + r(1) + ',' + r(2) + ',' + (A[3] + (B[3] - A[3]) * t).toFixed(3) + ')';
  }
  function textWidth(s, fs, mono) {                           // 粗略估宽：中日韩字符按 1 个字宽，其余按 0.56～0.6
    var w = 0;
    for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e80 ? 1 : (mono ? 0.6 : 0.56);
    return w * fs;
  }
  function fit(s, maxW, fs, mono) {
    s = String(s == null ? '' : s);
    if (textWidth(s, fs, mono) <= maxW) return s;
    while (s.length > 1 && textWidth(s + '…', fs, mono) > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function Stage(svg, opts) {
    opts = opts || {};
    this.svg = svg;
    this.items = {};
    this.onClick = opts.onClick || null;
    this.defs = el('defs', {}, svg);
    this.layers = { edge: el('g', {}, svg), box: el('g', {}, svg), text: el('g', {}, svg), dot: el('g', {}, svg) };
    this.markers = {};
    this.raf = 0;
    this.tick = this.tick.bind(this);
  }

  Stage.prototype.marker = function (color) {
    var key = color.replace(/[^a-z0-9]/gi, '');
    if (!this.markers[key]) {
      var m = el('marker', { id: 'ah-' + key + '-' + Math.random().toString(36).slice(2, 7), viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, this.defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m);
      this.markers[key] = m.id;
    }
    return this.markers[key];
  };

  Stage.prototype.create = function (id, spec) {
    var it = { id: id, kind: spec.kind || 'box', cur: {}, from: {}, to: {}, t0: 0, dur: 0, delay: 0, removing: false, spec: spec };
    var self = this;
    if (it.kind === 'box') {
      it.g = el('g', { 'data-id': id }, this.layers.box);
      it.rect = el('rect', {}, it.g);
      it.t1 = el('text', { 'dominant-baseline': 'central' }, it.g);
      it.t2 = el('text', { 'dominant-baseline': 'central' }, it.g);
      if (spec.click !== false && this.onClick) {
        it.g.style.cursor = 'pointer';
        it.g.addEventListener('click', function () { self.onClick(id); });
      }
    } else if (it.kind === 'edge') {
      it.g = el('g', { 'data-id': id }, this.layers.edge);
      it.path = el('path', { fill: 'none', 'stroke-linecap': 'round' }, it.g);
      it.t1 = el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, it.g);
    } else if (it.kind === 'text') {
      it.g = el('g', { 'data-id': id }, this.layers.text);
      it.t1 = el('text', { 'dominant-baseline': 'central' }, it.g);
    } else {
      it.g = el('g', { 'data-id': id }, this.layers.dot);
      it.c = el('circle', {}, it.g);
    }
    return it;
  };

  /* 换一幕。返回一个 Promise，补间全部走完时兑现。 */
  Stage.prototype.apply = function (scene, o) {
    o = o || {};
    var dur = reduce ? 0 : (o.dur == null ? 600 : o.dur);
    var now = performance.now(), self = this, id, it, k, maxEnd = now;
    for (id in scene) {
      var spec = scene[id];
      it = this.items[id];
      var fresh = !it;
      if (fresh) { it = this.items[id] = this.create(id, spec); }
      it.removing = false;
      it.spec = spec;
      var target = {};
      for (k = 0; k < NUM.length; k++) target[NUM[k]] = spec[NUM[k]] == null ? DEF[NUM[k]] : spec[NUM[k]];
      for (k = 0; k < COL.length; k++) target[COL[k]] = spec[COL[k]] || 'none';
      if (fresh) {                                            // 新元素：就地出现，只有透明度从 0 起
        for (k in target) it.cur[k] = target[k];
        it.cur.op = 0;
        if (spec.enterFrom) { it.cur.x = spec.enterFrom.x; it.cur.y = spec.enterFrom.y; }
        it.text = { label: spec.label, sub: spec.sub, text: spec.text };
        it.nextText = null;
      } else if (it.text.label !== spec.label || it.text.sub !== spec.sub || it.text.text !== spec.text) {
        it.nextText = { label: spec.label, sub: spec.sub, text: spec.text };   // 文字变了：补间走到一半时换字
        it.swapping = dur > 0;
        if (!it.swapping) { it.text = it.nextText; it.nextText = null; }
      }
      it.from = {}; for (k in it.cur) it.from[k] = it.cur[k];
      it.to = target;
      it.delay = reduce ? 0 : (spec.delay || 0);
      it.t0 = now; it.dur = dur;
      maxEnd = Math.max(maxEnd, now + it.delay + dur);
    }
    for (id in this.items) {
      if (scene[id]) continue;
      it = this.items[id];
      if (it.removing) continue;
      it.removing = true;
      it.from = {}; for (k in it.cur) it.from[k] = it.cur[k];
      it.to = {}; for (k in it.cur) it.to[k] = it.cur[k];
      it.to.op = 0; it.delay = 0; it.t0 = now; it.dur = dur * 0.7;
      maxEnd = Math.max(maxEnd, now + dur);
    }
    this.endAt = maxEnd;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    if (dur === 0) this.tick(performance.now());
    return new Promise(function (res) { setTimeout(res, Math.max(0, maxEnd - now) + 20); });
  };

  Stage.prototype.tick = function (now) {
    var id, it, k, active = false;
    for (id in this.items) {
      it = this.items[id];
      var p = it.dur <= 0 ? 1 : Math.min(1, Math.max(0, (now - it.t0 - it.delay) / it.dur));
      var e = ease(p);
      for (k = 0; k < NUM.length; k++) { var n = NUM[k]; it.cur[n] = it.from[n] + (it.to[n] - it.from[n]) * e; }
      for (k = 0; k < COL.length; k++) { var c = COL[k]; it.cur[c] = p >= 1 ? it.to[c] : mixColor(it.from[c], it.to[c], e); }
      it.dip = 1;
      if (it.swapping) {                                      // 换字：前半程旧字淡出，后半程新字淡入
        if (p >= 0.5 && it.nextText) { it.text = it.nextText; it.nextText = null; }
        it.dip = Math.abs(2 * p - 1);
        if (p >= 1) it.swapping = false;
      }
      if (p < 1) active = true;
    }
    for (id in this.items) {
      it = this.items[id];
      this.draw(it);
      if (it.removing && it.cur.op <= 0.001) { it.g.parentNode.removeChild(it.g); delete this.items[id]; }
    }
    this.raf = active ? requestAnimationFrame(this.tick) : 0;
  };

  Stage.prototype.anchor = function (a, b, side) {            // 从 a 的边缘中点连到 b 的边缘中点，走哪条边看相对位置（side: 'h' 强制走左右两边）
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    var dx = bx - ax, dy = by - ay;
    if (side === 'h' || Math.abs(dx) * (a.h + b.h) >= Math.abs(dy) * (a.w + b.w) * 0.6) {
      var s = dx >= 0 ? 1 : -1;
      return [ax + s * a.w / 2, ay, bx - s * b.w / 2, by, 'h'];
    }
    var t = dy >= 0 ? 1 : -1;
    return [ax, ay + t * a.h / 2, bx, by - t * b.h / 2, 'v'];
  };

  Stage.prototype.draw = function (it) {
    var c = it.cur, s = it.spec;
    it.g.setAttribute('opacity', Math.max(0, c.op).toFixed(3));
    if (it.kind === 'box') {
      it.rect.setAttribute('x', c.x); it.rect.setAttribute('y', c.y);
      it.rect.setAttribute('width', Math.max(0, c.w)); it.rect.setAttribute('height', Math.max(0, c.h));
      it.rect.setAttribute('rx', c.rx);
      it.rect.setAttribute('fill', c.fill); it.rect.setAttribute('stroke', c.stroke); it.rect.setAttribute('stroke-width', c.sw);
      if (s.dash) it.rect.setAttribute('stroke-dasharray', s.dash); else it.rect.removeAttribute('stroke-dasharray');
      var left = s.align === 'l', pad = s.pad == null ? 9 : s.pad, tx = left ? c.x + pad : c.x + c.w / 2;
      var label = it.text.label, sub = it.text.sub, two = sub != null && sub !== '';
      var fam = s.mono ? 'var(--mono)' : 'var(--sans)';
      it.t1.setAttribute('x', tx); it.t1.setAttribute('y', c.y + (two ? c.h * 0.36 : c.h / 2));
      it.t1.setAttribute('text-anchor', left ? 'start' : 'middle');
      it.t1.setAttribute('font-size', c.fs); it.t1.setAttribute('font-family', fam);
      it.t1.setAttribute('font-weight', s.bold ? 700 : 500);
      it.t1.setAttribute('fill', c.color === 'none' ? '#1b1f25' : c.color);
      it.t1.setAttribute('opacity', it.dip);
      it.t1.textContent = s.nofit ? (label == null ? '' : label) : fit(label, Math.max(0, c.w - pad * 2), c.fs, s.mono);
      it.t1.style.whiteSpace = 'pre';
      it.t2.setAttribute('x', tx); it.t2.setAttribute('y', c.y + c.h * 0.72);
      it.t2.setAttribute('text-anchor', left ? 'start' : 'middle');
      it.t2.setAttribute('font-size', Math.max(9, c.fs - 2.5)); it.t2.setAttribute('font-family', 'var(--mono)');
      it.t2.setAttribute('fill', '#79818d'); it.t2.setAttribute('opacity', it.dip);
      it.t2.textContent = two ? fit(sub, Math.max(0, c.w - pad * 2), Math.max(9, c.fs - 2.5), true) : '';
    } else if (it.kind === 'edge') {
      var A = this.items[s.from], B = this.items[s.to];
      if (!A || !B) { it.path.setAttribute('d', ''); return; }
      var q = this.anchor(A.cur, B.cur, s.side), d;
      if (q[4] === 'h') { var mx = (q[0] + q[2]) / 2; d = 'M' + q[0] + ',' + q[1] + ' C' + mx + ',' + q[1] + ' ' + mx + ',' + q[3] + ' ' + q[2] + ',' + q[3]; }
      else { var my = (q[1] + q[3]) / 2; d = 'M' + q[0] + ',' + q[1] + ' C' + q[0] + ',' + my + ' ' + q[2] + ',' + my + ' ' + q[2] + ',' + q[3]; }
      it.path.setAttribute('d', d);
      var col = c.color === 'none' ? '#c9d0da' : c.color;
      it.path.setAttribute('stroke', col); it.path.setAttribute('stroke-width', c.sw);
      if (s.dash) it.path.setAttribute('stroke-dasharray', s.dash); else it.path.removeAttribute('stroke-dasharray');
      if (s.arrow !== false) it.path.setAttribute('marker-end', 'url(#' + this.marker(it.to.color === 'none' ? '#c9d0da' : it.to.color) + ')');
      it.t1.textContent = it.text.label || '';
      it.t1.setAttribute('x', (q[0] + q[2]) / 2); it.t1.setAttribute('y', (q[1] + q[3]) / 2 - 8);
      it.t1.setAttribute('font-size', 10.5); it.t1.setAttribute('fill', col);
    } else if (it.kind === 'text') {
      it.t1.setAttribute('x', c.x); it.t1.setAttribute('y', c.y);
      it.t1.setAttribute('font-size', c.fs); it.t1.setAttribute('text-anchor', s.anchor || 'start');
      it.t1.setAttribute('font-family', s.mono ? 'var(--mono)' : 'var(--sans)');
      it.t1.setAttribute('font-weight', s.bold ? 700 : 500);
      it.t1.setAttribute('fill', c.color === 'none' ? '#454c56' : c.color);
      it.t1.setAttribute('opacity', it.dip);
      it.t1.style.whiteSpace = 'pre';
      it.t1.textContent = it.text.text == null ? '' : it.text.text;
    } else {
      it.c.setAttribute('cx', c.x); it.c.setAttribute('cy', c.y); it.c.setAttribute('r', c.r);
      it.c.setAttribute('fill', c.fill); it.c.setAttribute('stroke', '#fff'); it.c.setAttribute('stroke-width', 2);
    }
  };

  /* 在某个 box 外面放一圈扩散开又消失的光环，用来指给人看"就是这个"。 */
  Stage.prototype.pulse = function (id, color) {
    var it = this.items[id];
    if (!it || it.kind !== 'box' || reduce) return;
    var c = it.to, ring = el('rect', { fill: 'none', stroke: color || '#2563eb', 'stroke-width': 3, rx: (c.rx || 7) + 4 }, this.layers.dot);
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / 900), g = 4 + 14 * ease(p);
      ring.setAttribute('x', c.x - g); ring.setAttribute('y', c.y - g);
      ring.setAttribute('width', c.w + 2 * g); ring.setAttribute('height', c.h + 2 * g);
      ring.setAttribute('opacity', (1 - p).toFixed(3));
      if (p < 1) requestAnimationFrame(step); else ring.parentNode.removeChild(ring);
    })(t0);
  };

  Stage.prototype.has = function (id) { return !!this.items[id] && !this.items[id].removing; };
  Stage.fit = fit;
  Stage.textWidth = textWidth;
  global.Stage = Stage;
})(window);

// Schlanke SVG-Liniendiagramme ohne Abhängigkeiten.
// Tatsächliche Werte als durchgezogene Linie, Prognosen gestrichelt; Fadenkreuz + Tooltip beim Überfahren.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

function niceTicks(min, max, count = 5) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Teilt Punkte in zusammenhängende Läufe gleicher Art (actual/prognose); Läufe überlappen am Übergang. */
function runs(points) {
  const out = [];
  let cur = null;
  points.forEach((p, i) => {
    const kind = p.actual ? 'actual' : 'forecast';
    if (!cur || cur.kind !== kind) {
      cur = { kind, pts: i > 0 ? [points[i - 1]] : [] };
      out.push(cur);
    }
    cur.pts.push(p);
  });
  return out;
}

/**
 * @param {HTMLElement} host
 * @param {object} cfg { series:[{name,color,points:[{x,y,actual}]}], yFormat, xLabel, markers:[{x,y,label,color}], vlines:[{x,label}], height, ariaLabel }
 */
export function lineChart(host, cfg) {
  host.innerHTML = '';
  host.classList.add('chart');
  const W = Math.max(280, host.clientWidth || 600);
  const H = cfg.height || 260;
  const narrow = W < 480;
  const m = { top: 16, right: narrow ? 12 : 20, bottom: 28, left: narrow ? 48 : 64 };
  const all = cfg.series.flatMap((s) => s.points);
  if (!all.length) return;
  const xMin = Math.min(...all.map((p) => p.x)), xMax = Math.max(...all.map((p) => p.x));
  let yMin = Math.min(...all.map((p) => p.y)), yMax = Math.max(...all.map((p) => p.y));
  if (cfg.yZero) yMin = Math.min(0, yMin);
  const pad = (yMax - yMin) * 0.06 || 1;
  const yt = niceTicks(cfg.yZero ? yMin : yMin - pad, yMax + pad, narrow ? 4 : 5);
  const y0 = yt[0], y1 = yt[yt.length - 1];
  const X = (x) => m.left + (x - xMin) / (xMax - xMin || 1) * (W - m.left - m.right);
  const Y = (y) => m.top + (1 - (y - y0) / (y1 - y0)) * (H - m.top - m.bottom);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': cfg.ariaLabel || '' }, host);

  // Raster + Y-Achse
  const grid = el('g', { class: 'grid' }, svg);
  for (const t of yt) {
    el('line', { x1: m.left, x2: W - m.right, y1: Y(t), y2: Y(t) }, grid);
    const tx = el('text', { x: m.left - 8, y: Y(t), 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'tick' }, grid);
    tx.textContent = cfg.yFormat(t);
  }
  // X-Achse: Jahre
  const yA = new Date(xMin).getUTCFullYear(), yB = new Date(xMax).getUTCFullYear();
  const every = Math.max(1, Math.ceil((yB - yA + 1) / (narrow ? 5 : 10)));
  for (let y = yA + 1; y <= yB; y++) {
    if ((y - yA) % every) continue;
    const x = X(Date.UTC(y, 0, 1));
    if (x < m.left || x > W - m.right) continue;
    el('line', { x1: x, x2: x, y1: H - m.bottom, y2: H - m.bottom + 4, class: 'axis' }, grid);
    const tx = el('text', { x, y: H - 8, 'text-anchor': 'middle', class: 'tick' }, grid);
    tx.textContent = y;
  }
  el('line', { x1: m.left, x2: W - m.right, y1: H - m.bottom, y2: H - m.bottom, class: 'axis' }, grid);

  for (const v of cfg.vlines || []) {
    if (v.x < xMin || v.x > xMax) continue;
    el('line', { x1: X(v.x), x2: X(v.x), y1: m.top, y2: H - m.bottom, class: 'vline' }, svg);
    const t = el('text', { x: X(v.x) - 4, y: m.top + 10, 'text-anchor': 'end', class: 'vlabel' }, svg);
    t.textContent = v.label;
  }

  // Linien
  for (const s of cfg.series) {
    for (const r of runs(s.points)) {
      if (r.pts.length < 2) continue;
      el('path', {
        d: r.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(''),
        fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        'stroke-dasharray': r.kind === 'forecast' ? '5 4' : null,
      }, svg);
    }
  }
  // Direkte Beschriftung am Linienende (Identität nicht nur über Farbe)
  const markerNearEnd = (cfg.markers || []).some((mk) => (mk.x - xMin) / (xMax - xMin || 1) > 0.8);
  if (cfg.series.length > 1 && !narrow && !markerNearEnd) {
    // von oben nach unten platzieren, bei Überlappung nach unten schieben
    const ends = cfg.series.map((s) => ({ s, p: s.points[s.points.length - 1] })).sort((a, b) => b.p.y - a.p.y);
    let lastY = -Infinity;
    for (const { s, p } of ends) {
      let y = Y(p.y);
      if (y - lastY < 14) y = lastY + 14;
      lastY = y;
      const t = el('text', { x: X(p.x) - 6, y: y - 8, 'text-anchor': 'end', class: 'endlabel' }, svg);
      t.textContent = s.short || s.name;
    }
  }
  // Markierungen (Schnittpunkt, Hoch-/Tiefstwert)
  for (const mk of cfg.markers || []) {
    if (mk.x < xMin || mk.x > xMax) continue;
    const cx = X(mk.x), cy = Y(mk.y);
    el('circle', { cx, cy, r: 5, class: 'marker', stroke: mk.color || 'currentColor' }, svg);
    const below = mk.below ?? cy < m.top + 24;
    const anchor = cx < W * 0.2 ? 'start' : cx > W * 0.8 ? 'end' : 'middle';
    const t = el('text', { x: cx, y: below ? cy + 20 : cy - 12, 'text-anchor': anchor, class: 'mlabel' }, svg);
    t.textContent = mk.label;
  }

  // Hover-Ebene
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true;
  host.appendChild(tip);
  const cross = el('line', { y1: m.top, y2: H - m.bottom, class: 'cross', visibility: 'hidden' }, svg);
  const dots = cfg.series.map((s) => el('circle', { r: 4, fill: s.color, class: 'hoverdot', visibility: 'hidden' }, svg));
  const hit = el('rect', { x: m.left, y: m.top, width: W - m.left - m.right, height: H - m.top - m.bottom, fill: 'transparent' }, svg);
  const ref = cfg.series[0].points;
  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * (W / rect.width);
    const xv = xMin + (px - m.left) / (W - m.left - m.right) * (xMax - xMin);
    let lo = 0, hi = ref.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ref[mid].x < xv) lo = mid; else hi = mid; }
    const i = Math.abs(ref[lo].x - xv) < Math.abs(ref[hi].x - xv) ? lo : hi;
    const p = ref[i];
    cross.setAttribute('x1', X(p.x)); cross.setAttribute('x2', X(p.x)); cross.setAttribute('visibility', 'visible');
    const rows = cfg.series.map((s, k) => {
      const q = s.points[i];
      if (!q) return '';
      dots[k].setAttribute('cx', X(q.x)); dots[k].setAttribute('cy', Y(q.y)); dots[k].setAttribute('visibility', 'visible');
      return `<div class="tip-row"><span class="sw" style="background:${s.color}"></span>${s.name}<b>${cfg.yFormat(q.y, true)}</b></div>`;
    }).join('');
    tip.innerHTML = `<div class="tip-h">${cfg.xFormat(p.x)}${p.actual ? '' : ' · Prognose'}</div>${rows}${cfg.tipExtra ? cfg.tipExtra(i) : ''}`;
    tip.hidden = false;
    const tx = X(p.x) / W * rect.width;
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(0, tx + 12 + tw > rect.width ? tx - tw - 12 : tx + 12), Math.max(0, rect.width - tw)) + 'px';
    tip.style.top = '8px';
  };
  const leave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', leave);
}

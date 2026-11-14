// Minimales SVG-Liniendiagramm.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

/**
 * series: [{ label, color, points: [{ x: index|timestamp, y, tip }] }]
 * opts: { yMax, ySuffix, xLabels: [string] (pro Index) }
 */
export function lineChart(series, { yMax, ySuffix = '', xLabels = [], height = 200, ref = null } = {}) {
  const W = 640, H = height, L = 40, R = 14, T = 12, B = 26;
  const n = Math.max(xLabels.length, ...series.map(s => s.points.length), 1);
  const maxY = yMax ?? Math.max(1, ...series.flatMap(s => s.points.map(p => p.y)));
  const niceMax = yMax ?? Math.max(4, niceCeil(maxY));
  const x = i => L + (n === 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R));
  const y = v => T + (1 - v / niceMax) * (H - T - B);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const grid = el('g', { class: 'grid' });
  for (let k = 0; k <= 4; k++) {
    const v = (niceMax / 4) * k;
    grid.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }));
    const t = el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }); t.textContent = `${Math.round(v)}${ySuffix}`; grid.append(t);
  }
  svg.append(grid);
  const step = Math.max(1, Math.ceil(n / 6));
  xLabels.forEach((lab, i) => {
    if (i % step && i !== n - 1) return;
    const t = el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }); t.textContent = lab; svg.append(t);
  });
  if (ref != null) svg.append(el('line', { x1: L, x2: W - R, y1: y(ref), y2: y(ref), stroke: 'rgba(243,238,220,.35)', 'stroke-width': 2, 'stroke-dasharray': '6 6' }));
  for (const s of series) {
    if (!s.points.length) continue;
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.i ?? i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    svg.append(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    for (const [i, p] of s.points.entries()) {
      const c = el('circle', { cx: x(p.i ?? i), cy: y(p.y), r: 4.5, fill: s.color, stroke: '#0E2A10', 'stroke-width': 2 });
      const title = el('title'); title.textContent = p.tip ?? `${p.y}${ySuffix}`; c.append(title);
      svg.append(c);
    }
  }
  return svg;
}

function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

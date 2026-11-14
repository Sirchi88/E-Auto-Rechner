// Animierbare SVG-Dartscheibe.
// Ziel-Schlüssel: S20 (beide Single-Flächen), S20o/S20i, D20, T20, 25 (Single-Bull), 50 (Bullseye),
// BULL (25 + 50), SEG20 (komplettes Segment).
const NS = 'http://www.w3.org/2000/svg';
export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// Radien relativ zu Doppel-außen = 100 (offizielle Maße)
const R = { be: 3.7, bull: 9.4, tIn: 58.2, tOut: 62.9, dIn: 95.3, dOut: 100, num: 112 };

const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };

function sector(r1, r2, a1, a2) {
  const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r2},${r2} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${r1},${r1} 0 0 0 ${x4.toFixed(2)},${y4.toFixed(2)}Z`;
}

export function createBoard({ numbers = true, className = '' } = {}) {
  const svg = el('svg', { viewBox: '-122 -122 244 244', class: `board ${className}`, role: 'img', 'aria-label': 'Dartscheibe' });
  svg.append(el('circle', { r: 121, class: 'b-rim' }));
  const parts = {};
  const add = (key, node) => { (parts[key] ||= []).push(node); svg.append(node); };

  ORDER.forEach((n, i) => {
    const a1 = i * 18 - 9, a2 = i * 18 + 9;
    const dark = i % 2 === 0;
    add(`S${n}i`, el('path', { d: sector(R.bull, R.tIn, a1, a2), class: dark ? 'b-dark' : 'b-light' }));
    add(`T${n}`, el('path', { d: sector(R.tIn, R.tOut, a1, a2), class: dark ? 'b-red' : 'b-green' }));
    add(`S${n}o`, el('path', { d: sector(R.tOut, R.dIn, a1, a2), class: dark ? 'b-dark' : 'b-light' }));
    add(`D${n}`, el('path', { d: sector(R.dIn, R.dOut, a1, a2), class: dark ? 'b-red' : 'b-green' }));
    if (numbers) {
      const [x, y] = pt(R.num, i * 18);
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), class: 'b-num', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = n; t.dataset.n = n; svg.append(t);
    }
  });
  add('25', el('circle', { r: R.bull, class: 'b-green' }));
  add('50', el('circle', { r: R.be, class: 'b-red' }));
  // Draht
  const wire = el('g', { class: 'b-wire' });
  for (const r of [R.bull, R.tIn, R.tOut, R.dIn, R.dOut]) wire.append(el('circle', { r, fill: 'none' }));
  ORDER.forEach((_, i) => { const [x1, y1] = pt(R.bull, i * 18 - 9), [x2, y2] = pt(R.dOut, i * 18 - 9); wire.append(el('line', { x1, y1, x2, y2 })); });
  svg.append(wire);
  const marks = el('g', { class: 'b-marks' });
  svg.append(marks);

  function nodes(key) {
    const k = String(key);
    if (k === 'BULL') return [...parts['25'], ...parts['50']];
    if (k === 'Bull') return [...parts['25'], ...parts['50']];
    if (/^S\d+$/.test(k)) return [...(parts[`${k}i`] || []), ...(parts[`${k}o`] || [])];
    if (/^SEG\d+$/.test(k)) { const n = k.slice(3); return [`S${n}i`, `S${n}o`, `D${n}`, `T${n}`].flatMap(x => parts[x] || []); }
    return parts[k] || [];
  }

  const api = {
    el: svg,
    clear() {
      svg.querySelectorAll('.hl, .hl-steady, .hl-dim').forEach(n => n.classList.remove('hl', 'hl-steady', 'hl-dim'));
      svg.querySelectorAll('.b-num.on').forEach(n => n.classList.remove('on'));
      marks.replaceChildren();
    },
    // keys: Array von Ziel-Schlüsseln; mode: 'blink' | 'steady'
    highlight(keys = [], mode = 'blink') {
      api.clear();
      for (const k of keys) {
        for (const n of nodes(k)) n.classList.add(mode === 'blink' ? 'hl' : 'hl-steady');
        const num = String(k).match(/\d+/)?.[0];
        if (num && Number(num) <= 20) svg.querySelector(`.b-num[data-n="${num}"]`)?.classList.add('on');
      }
    },
    // kleine „Dart“-Markierung an Position eines Ziels (für Info-Animationen)
    dart(key, ok = true) {
      const k = String(key);
      let r = 0, ang = 0;
      const n = Number(k.match(/\d+/)?.[0]);
      const idx = ORDER.indexOf(n);
      if (k === '50' || k === 'BULL' || k === 'Bull') r = 1.5;
      else if (k === '25') r = 6.5;
      else if (idx >= 0) {
        ang = idx * 18 + (Math.random() * 8 - 4);
        r = k.startsWith('D') ? 97.6 : k.startsWith('T') ? 60.5 : (Math.random() < .5 ? 40 : 80);
      }
      if (!ok) { r = 108; }
      const [x, y] = pt(r, ang);
      const g = el('g', { class: `b-dart${ok ? '' : ' miss'}`, transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` });
      g.append(el('circle', { r: 4.2 }), el('circle', { r: 1.6, class: 'tip' }));
      marks.append(g);
    },
  };
  return api;
}

// Wandelt Spiel-Ziele (z. B. "D7", "Bull", "T19", "7") in Board-Schlüssel um
export function boardKeys(target) {
  const t = String(target).trim();
  if (/^bull/i.test(t)) return ['BULL'];
  if (t === '25' || t === '50') return [t];
  if (/^[SDT]\d+$/.test(t)) return [t];
  if (/^\d+$/.test(t) && Number(t) <= 20) return [`S${t}`];
  return [];
}

// Board-Schlüssel für einen Checkout-Weg („T19 D12“)
export function pathKeys(path) {
  return String(path || '').split(/\s+/).filter(Boolean).flatMap(p => boardKeys(p === 'Bull' ? 'Bull' : p));
}

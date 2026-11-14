// Trainingstage, Streak und Kalender-Heatmap.
import { h } from './ui.js';
import { store } from './store.js';

const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Map Tag → Anzahl Aktivitäten
export function trainingDays() {
  const m = new Map();
  const add = ts => { if (ts) { const k = dayKey(ts); m.set(k, (m.get(k) || 0) + 1); } };
  for (const s of store.sessions) add(s.start);
  for (const v of store.list('versusMatches')) add(v.date);
  return m;
}

export function streak(days = trainingDays()) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  // Heute noch nicht trainiert? Dann zählt die Serie bis gestern weiter.
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return { days: n, today: days.has(dayKey(Date.now())) };
}

export function bestStreak(days = trainingDays()) {
  const keys = [...days.keys()].sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    const t = new Date(`${k}T12:00:00`).getTime();
    cur = prev && Math.round((t - prev) / 86400000) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur); prev = t;
  }
  return best;
}

// Heatmap der letzten `weeks` Wochen (Mo–So Spalten)
export function heatmap(weeks = 17) {
  const days = trainingDays();
  const end = new Date(); end.setHours(12, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - (weeks * 7 - 1));
  // auf Montag zurücksetzen
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const grid = h('div', { class: 'heat' });
  const months = h('div', { class: 'heat-months' });
  let lastMonth = -1;
  for (let d = new Date(start), col = 0; d <= end; col++) {
    const colEl = h('div', { class: 'heat-col' });
    if (d.getMonth() !== lastMonth) { lastMonth = d.getMonth(); months.append(h('span', { style: { gridColumn: `${col + 1}` } }, d.toLocaleDateString('de-DE', { month: 'short' }))); }
    for (let r = 0; r < 7; r++) {
      const k = dayKey(d);
      const n = d <= end ? (days.get(k) || 0) : -1;
      colEl.append(h('i', { class: n < 0 ? 'future' : `l${Math.min(n, 3)}`, title: n > 0 ? `${d.toLocaleDateString('de-DE')}: ${n}× trainiert` : d.toLocaleDateString('de-DE') }));
      d.setDate(d.getDate() + 1);
    }
    grid.append(colEl);
  }
  months.style.gridTemplateColumns = `repeat(${grid.children.length}, 1fr)`;
  return h('div', { class: 'heat-wrap' }, months, grid,
    h('div', { class: 'heat-legend' }, 'weniger', [0, 1, 2, 3].map(l => h('i', { class: `l${l}` })), 'mehr'));
}

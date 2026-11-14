// Statistik-Verlauf: Sessions, Checkout-Quote, Fehlwürfe, schwache Zahlen.
import { h, iconBtn, fmtDate, fmtDuration, pct } from '../ui.js';
import { store } from '../store.js';
import { gameById } from '../games/registry.js';
import { lineChart } from '../chart.js';

const shortDate = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function weakNumbers(runs, minAttempts = 3, limit = 10) {
  const agg = {};
  for (const r of runs) for (const [n, [a, c]] of Object.entries(r.perNumber || {})) {
    const x = agg[n] || (agg[n] = [0, 0]); x[0] += a; x[1] += c;
  }
  return Object.entries(agg)
    .filter(([, [a]]) => a >= minAttempts)
    .map(([n, [a, c]]) => ({ n: Number(n), attempts: a, checks: c, quote: c / a }))
    .sort((x, y) => x.quote - y.quote || y.attempts - x.attempts || x.n - y.n)
    .slice(0, limit);
}

export function renderHistory({ onBack }) {
  const sessions = [...store.sessions].sort((a, b) => a.start - b.start);
  const runs = [...store.checkoutRuns].sort((a, b) => a.date - b.date);
  const settings = store.settings;

  // ---- Checkout-Quote ----
  const totalA = runs.reduce((s, r) => s + r.attempts, 0);
  const totalC = runs.reduce((s, r) => s + r.checks, 0);
  const coCard = h('div', { class: 'card' }, h('h3', {}, 'Checkout-Quote'));
  if (runs.length) {
    coCard.append(
      h('div', { class: 'statline', style: { marginBottom: '10px' } },
        h('div', { class: 'stat green' }, h('b', {}, `${pct(totalC, totalA)}%`), h('span', {}, 'Gesamt')),
        h('div', { class: 'stat' }, h('b', {}, totalA), h('span', {}, 'Versuche')),
        h('div', { class: 'stat' }, h('b', {}, runs.length), h('span', {}, 'Runden'))),
      lineChart([{ label: 'Quote', color: '#7CC242', points: runs.map(r => ({ y: r.quote, tip: `${fmtDate(r.date)}: ${r.quote}% (${r.checks}/${r.attempts})` })) }],
        { yMax: 100, ySuffix: '%', xLabels: runs.map(r => shortDate(r.date)), ref: settings.readyQuote }),
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: '#7CC242' } }), 'Quote pro Runde'),
        h('span', {}, h('i', { style: { background: 'rgba(243,238,220,.3)' } }), `Ziel ${settings.readyQuote}%`)));
  } else coCard.append(h('p', { class: 'empty' }, 'Noch keine Checkout-Runden.'));

  // ---- Around the Clock ----
  const atcSessions = sessions.filter(s => s.results.some(r => r.gameId === 'atcSingle' || r.gameId === 'atcDouble'));
  const lastOf = (s, id) => [...s.results].reverse().find(r => r.gameId === id);
  const series = [['atcSingle', 'Single', '#F3EEDC'], ['atcDouble', 'Doppel', '#D7262B']].map(([id, label, color]) => ({
    label, color,
    points: atcSessions.map((s, i) => ({ s, i, r: lastOf(s, id) })).filter(p => p.r)
      .map(p => ({ i: p.i, y: p.r.data.misses, tip: `${fmtDate(p.s.start)}: ${label} ${p.r.data.misses} Fehlwürfe` })),
  }));
  const atcCard = h('div', { class: 'card' }, h('h3', {}, 'Around the Clock – Fehlwürfe'));
  if (atcSessions.length) {
    atcCard.append(lineChart(series, { xLabels: atcSessions.map(s => shortDate(s.start)) }),
      h('div', { class: 'legend' }, series.map(s => h('span', {}, h('i', { style: { background: s.color } }), `${s.label} (Grenze ${s.label === 'Single' ? settings.atcSingleLimit : settings.atcDoubleLimit})`))));
  } else atcCard.append(h('p', { class: 'empty' }, 'Noch keine Around-the-Clock-Runden.'));

  // ---- Schwache Zahlen ----
  const weak = weakNumbers(runs);
  const weakCard = h('div', { class: 'card' }, h('h3', {}, 'Schwache Zahlen'),
    h('p', { class: 'muted small-text' }, 'Niedrigste Checkout-Quote (mind. 3 Versuche)'),
    weak.length
      ? h('div', { class: 'weak-list' }, weak.map(w => h('div', { class: 'weak' }, h('b', {}, w.n), h('div', { class: 'q' }, `${Math.round(w.quote * 100)}%`), h('span', {}, `${w.checks}/${w.attempts}`))))
      : h('p', { class: 'empty' }, 'Noch nicht genug Daten.'));

  // ---- Sessions ----
  const sessCard = h('div', { class: 'card' }, h('h3', {}, 'Sessions'));
  if (sessions.length) {
    for (const s of [...sessions].reverse()) {
      const names = s.results.map(r => gameById(r.gameId)?.name ?? r.gameId);
      sessCard.append(h('details', { class: 'session-item result-row', style: { display: 'block' } },
        h('summary', {},
          h('span', { class: 'name' }, fmtDate(s.start)),
          h('span', { class: 'muted small-text' }, fmtDuration((s.end || s.start) - s.start))),
        h('div', { class: 'games' }, `${s.mode === 'leek' ? 'TheLeek Mode' : 'Angepasst'} · ${names.length} Spiel${names.length === 1 ? '' : 'e'}`),
        h('div', { style: { marginTop: '8px' } }, s.results.map(r => {
          const g = gameById(r.gameId);
          const sum = g ? g.summary(r.data, settings) : { value: '–' };
          return h('div', { class: 'small-text', style: { display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '3px 0' } },
            h('span', {}, g?.name ?? r.gameId), h('span', { class: sum.bad ? '' : 'muted' }, `${sum.value}${sum.bad ? ' ⚠' : ''} · ${fmtDuration(r.durationMs)}`));
        }))));
    }
  } else sessCard.append(h('p', { class: 'empty' }, 'Noch keine Sessions gespeichert.'));

  return h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', onBack), h('h2', {}, 'Statistik')),
    h('div', { class: 'scroll' }, coCard, atcCard, weakCard, sessCard));
}

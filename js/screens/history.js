// Statistik-Verlauf: Sessions, Checkout-Quote, Fehlwürfe, schwache Zahlen.
import { h, iconBtn, fmtDate, fmtDuration, pct } from '../ui.js';
import { store } from '../store.js';
import { gameById } from '../games/registry.js';
import { lineChart } from '../chart.js';
import { DIFFICULTIES } from '../games/survival.js';
import { VARIANTS_121 } from '../games/l121.js';
import { heatmap, streak, bestStreak } from '../calendar.js';
import { badgeGrid, BADGES } from '../badges.js';

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
  const allRuns = [...store.checkoutRuns].sort((a, b) => a.date - b.date);
  const runs = allRuns.filter(r => r.source !== 'drill');
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
  const atcRuns = [...store.list('atcRuns')].sort((a, b) => a.date - b.date);
  const series = [['atcSingle', 'Single', '#F3EEDC', 'atcSingleLimit'], ['atcDouble', 'Doppel', '#D7262B', 'atcDoubleLimit'], ['atcTriple', 'Triple', '#7CC242', 'atcTripleLimit']].map(([id, label, color, lim]) => ({
    label, color, lim,
    points: atcRuns.map((r, i) => ({ r, i })).filter(p => p.r.game === id)
      .map(p => ({ i: p.i, y: p.r.misses, tip: `${fmtDate(p.r.date)}: ${label} ${p.r.misses} Fehlwürfe` })),
  })).filter(x => x.points.length);
  const atcCard = h('div', { class: 'card' }, h('h3', {}, 'Around the Clock – Fehlwürfe'));
  if (atcRuns.length) {
    atcCard.append(lineChart(series, { xLabels: atcRuns.map(r => shortDate(r.date)) }),
      h('div', { class: 'legend' }, series.map(x => h('span', {}, h('i', { style: { background: x.color } }), `${x.label} (Grenze ${settings[x.lim]})`))));
  } else atcCard.append(h('p', { class: 'empty' }, 'Noch keine Around-the-Clock-Runden.'));

  // ---- Leek Survival ----
  const sv = store.list('survivalRuns');
  const svCard = h('div', { class: 'card' }, h('h3', {}, 'Leek Survival – Rekorde'));
  if (sv.length) {
    svCard.append(h('div', { class: 'stat-grid' }, Object.entries(DIFFICULTIES).map(([k, d]) => {
      const rs = sv.filter(r => r.difficulty === k);
      const best = rs.length ? Math.max(...rs.map(r => r.highestRound)) : null;
      return h('div', { class: 'sg' }, h('b', {}, best ?? '–'), h('span', {}, `${d.emoji} ${d.label}${rs.length ? ` · ${rs.length}×` : ''}`));
    })));
    const last = sv.slice(-12);
    svCard.append(lineChart([{ label: 'Runde', color: '#7CC242', points: last.map(r => ({ y: r.highestRound, tip: `${fmtDate(r.date)}: ${DIFFICULTIES[r.difficulty]?.label} Runde ${r.highestRound}` })) }], { xLabels: last.map(r => shortDate(r.date)), height: 160 }));
  } else svCard.append(h('p', { class: 'empty' }, 'Noch keine Survival-Runden.'));

  // ---- 121, Doppel, 1vs1 ----
  const l121 = store.list('l121Runs'), dbl = store.list('doublesRuns'), vs = store.list('versusMatches');
  const misc = h('div', { class: 'card' }, h('h3', {}, 'Weitere Rekorde'),
    h('div', { class: 'stat-grid' },
      Object.entries(VARIANTS_121).map(([k, v]) => h('div', { class: 'sg' }, h('b', {}, Math.max(0, ...l121.filter(r => r.variant === k).map(r => r.highest)) || '–'), h('span', {}, `121 ${v.label}`))),
      h('div', { class: 'sg' }, h('b', {}, dbl.length ? Math.max(...dbl.map(r => r.perMin)) : '–'), h('span', {}, 'Doppel-Treffer/Min')),
      h('div', { class: 'sg' }, h('b', {}, vs.length), h('span', {}, '1vs1-Duelle'))));

  // ---- Schwache Zahlen ----
  const weak = weakNumbers(allRuns);
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
        h('div', { class: 'games' }, `${({ leek: 'Leek-Programm', custom: 'Individuell', single: 'Einzel' })[s.mode] || 'Angepasst'} · ${names.length} Spiel${names.length === 1 ? '' : 'e'}`),
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
    h('div', { class: 'scroll' }, calCard(), coCard, weakCard, atcCard, svCard, misc, badgeCard(), sessCard));
}

function calCard() {
  const st = streak();
  return h('div', { class: 'card' }, h('h3', {}, 'Trainings-Kalender'),
    h('div', { class: 'statline', style: { marginBottom: '12px' } },
      h('div', { class: 'stat green' }, h('b', {}, `🔥 ${st.days}`), h('span', {}, 'Aktuelle Serie')),
      h('div', { class: 'stat' }, h('b', {}, bestStreak()), h('span', {}, 'Beste Serie'))),
    heatmap());
}

function badgeCard() {
  const n = Object.keys(store.badges).length;
  return h('div', { class: 'card' }, h('h3', {}, `Leek-Abzeichen · ${n}/${BADGES.length}`), badgeGrid());
}

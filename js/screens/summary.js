// Abschluss-Statistik nach dem Training inkl. „Bereit fürs Match?“-Check.
import { h, fmtDuration } from '../ui.js';
import { gameById } from '../games/registry.js';
import { store } from '../store.js';

// Für den Ready-Check zählt pro Spiel das jeweils letzte Ergebnis.
export function readiness(session, settings) {
  const latest = new Map();
  for (const r of session.results) latest.set(r.gameId, r);
  const reasons = [];
  for (const r of latest.values()) {
    const g = gameById(r.gameId);
    const sum = g?.summary(r.data, settings);
    if (sum?.bad) reasons.push(`${g.name}: ${sum.value}${sum.note ? ` (${sum.note})` : ''}`);
  }
  return { ready: reasons.length === 0, reasons };
}

export function renderSummary(session, { onAddCheckouts, onDone, onHistory }) {
  const settings = store.settings;
  const total = (session.end || Date.now()) - session.start;
  const { ready, reasons } = readiness(session, settings);

  return h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, h('h2', {}, 'Auswertung', h('span', { class: 'sub' }, session.mode === 'leek' ? 'TheLeek Mode' : 'Training angepasst'))),
    h('div', { class: 'scroll' },
      h('div', { class: 'card', style: { textAlign: 'center' } },
        h('div', { class: 'label' }, 'Gesamtdauer'),
        h('div', { class: 'duration-big' }, fmtDuration(total))),
      ready
        ? h('div', { class: 'ready yes' }, h('div', { class: 'head' }, 'Bereit fürs Match! 🎯'), h('p', {}, 'Gut eingespielt – viel Erfolg!'))
        : h('div', { class: 'ready no' },
            h('div', { class: 'head' }, 'Noch nicht ganz –'),
            h('p', {}, 'eine Runde Checkouts dranhängen?'),
            h('p', { class: 'muted small-text' }, reasons.join(' · ')),
            h('button', { class: 'btn primary', onClick: onAddCheckouts }, 'Checkouts starten')),
      h('div', { class: 'card' },
        h('h3', {}, 'Spiele'),
        session.results.map(r => {
          const g = gameById(r.gameId);
          const sum = g ? g.summary(r.data, settings) : { value: '–' };
          return h('div', { class: 'result-row' },
            h('div', {}, h('div', { class: 'name' }, g?.name ?? r.gameId), h('div', { class: 'muted small-text' }, `Dauer ${fmtDuration(r.durationMs)}`)),
            h('div', { class: 'val' },
              h('div', {}, sum.value, sum.bad === true ? h('span', { class: 'tag bad' }, sum.badTag || 'über') : sum.bad === false ? h('span', { class: 'tag ok' }, sum.okTag || 'ok') : null),
              sum.note ? h('div', { class: 'muted small-text' }, sum.note) : null));
        }))),
    h('div', { class: 'controls' },
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onClick: onHistory }, 'Verlauf'),
        h('button', { class: 'btn primary', onClick: onDone }, 'Fertig'))));
}

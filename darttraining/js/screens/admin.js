// Admin-Bereich: rendert die Einstellungen aus dem Schema + TheLeek-Reihenfolge + Daten.
import { h, iconBtn, segmented, stepper, toggleSwitch, confirmDialog, toast, download, fmtDate, orderEditor } from '../ui.js';
import { sound } from '../sound.js';
import { store } from '../store.js';
import { SETTINGS_SCHEMA, defaultSettings } from '../settings.js';
import { gameById, GAME_IDS } from '../games/registry.js';

export function renderAdmin({ onBack }) {
  const body = h('div', { class: 'scroll' });
  const update = patch => { store.saveSettings({ ...store.settings, ...patch }); };

  function render() {
    const s = store.settings;
    body.replaceChildren();

    // Schema-basierte Felder, nach Sektion gruppiert
    const sections = new Map();
    for (const f of SETTINGS_SCHEMA) {
      if (!sections.has(f.section)) sections.set(f.section, []);
      sections.get(f.section).push(f);
    }
    for (const [title, fields] of sections) {
      body.append(h('div', { class: 'card' }, h('h3', {}, title), fields.map(f => fieldRow(f, s[f.key]))));
    }

    body.append(leekOrderCard(), dataCard(),
      h('div', { class: 'card' }, h('h3', {}, 'Zurücksetzen'),
        h('button', { class: 'btn ghost small', style: { width: '100%' }, onClick: async () => {
          if (await confirmDialog({ title: 'Einstellungen zurücksetzen?', text: 'Alle Einstellungen werden auf die Standardwerte gesetzt. Die Statistik bleibt erhalten.', ok: 'Zurücksetzen', danger: true })) {
            store.saveSettings(defaultSettings(GAME_IDS)); sound.setEnabled(store.settings.sound); render(); toast('Standardwerte wiederhergestellt');
          }
        } }, 'Einstellungen auf Standard')),
      h('p', { class: 'muted small-text', style: { textAlign: 'center' } }, 'Alle Daten bleiben lokal auf diesem Gerät.'));
  }

  function fieldRow(f, value) {
    let control;
    const onChange = v => {
      update({ [f.key]: v });
      if (f.key === 'sound') { sound.setEnabled(v); if (v) sound.play('hit'); }
      // z. B. Range-Grenzen getauscht → neu zeichnen
      if (store.settings[f.key] !== v) render();
    };
    if (f.type === 'choice') control = segmented(f.options, value, onChange);
    else if (f.type === 'number') control = stepper(value, f, onChange);
    else if (f.type === 'toggle') control = toggleSwitch(value, onChange, f.label);
    return h('div', { class: 'field' }, h('div', { class: 'f-label' }, f.label, f.hint ? h('small', {}, f.hint) : null), control);
  }

  // ---- Leek'sches Programm: Auswahl & Reihenfolge ----
  function leekOrderCard() {
    const list = orderEditor(() => store.settings.leekOrder, order => update({ leekOrder: order }), id => gameById(id).name);
    return h('div', { class: 'card' },
      h('h3', {}, 'TheLeek Trainingsprogramm'),
      h('p', { class: 'muted small-text' }, 'Haken = Spiel ist enthalten. Reihenfolge per Pfeil oder am Griff ziehen. Im Programm starten die Spiele direkt mit den Standardwerten.'),
      list,
      h('button', { class: 'btn ghost small', style: { width: '100%', marginTop: '10px' }, onClick: () => { update({ leekOrder: defaultSettings(GAME_IDS).leekOrder }); list.repaint(); } }, 'Standard-Reihenfolge'));
  }

  // ---- Statistik: Export & Reset ----
  function dataCard() {
    const n = store.sessions.length, r = store.checkoutRuns.filter(x => x.source !== 'drill').length;
    return h('div', { class: 'card' },
      h('h3', {}, 'Statistik'),
      h('p', { class: 'muted small-text' }, `${n} Session${n === 1 ? '' : 's'} · ${r} Checkout-Runde${r === 1 ? '' : 'n'} gespeichert`),
      h('div', { class: 'btn-col' },
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost small', onClick: exportJson }, 'Export JSON'),
          h('button', { class: 'btn ghost small', onClick: exportCsv }, 'Export CSV')),
        h('button', { class: 'btn fail small', onClick: async () => {
          if (!(await confirmDialog({ title: 'Statistik löschen?', text: 'Alle Sessions und Checkout-Statistiken werden unwiderruflich gelöscht. Tipp: vorher exportieren.', ok: 'Endgültig löschen', danger: true }))) return;
          store.resetStats(); render(); toast('Statistik zurückgesetzt');
        } }, 'Statistik zurücksetzen')));
  }

  render();
  return h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', onBack), h('h2', {}, 'Einstellungen', h('span', { class: 'sub' }, 'Admin-Bereich'))),
    body);
}


const stamp = () => new Date().toISOString().slice(0, 10);

function exportJson() {
  download(`leek-darttraining-${stamp()}.json`, JSON.stringify(store.exportAll(), null, 2), 'application/json');
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');

function exportCsv() {
  const rows = [['Typ', 'Datum', 'Session', 'Spiel', 'Dauer (s)', 'Fehlwürfe', 'Grenze', 'Versuche', 'Checks', 'Fails', 'Quote %', 'Zahl']];
  for (const s of store.sessions) {
    rows.push(['Session', fmtDate(s.start), s.id, ({ leek: 'Leek-Programm', custom: 'Individuell', single: 'Einzel' })[s.mode] || 'Angepasst', Math.round(((s.end || s.start) - s.start) / 1000)]);
    for (const r of s.results) {
      const d = r.data || {};
      rows.push(['Spiel', fmtDate(r.at || s.start), s.id, gameById(r.gameId)?.name ?? r.gameId, Math.round(r.durationMs / 1000),
        d.misses ?? '', d.limit ?? '', d.attempts ?? '', d.checks ?? '', d.fails ?? '', d.attempts ? d.quote : '']);
    }
  }
  for (const run of store.checkoutRuns) {
    rows.push(['Checkout-Runde', fmtDate(run.date), run.id, 'Random Checkouts', Math.round((run.durationMs || 0) / 1000), '', '', run.attempts, run.checks, run.fails, run.quote]);
    for (const [n, [a, c]] of Object.entries(run.perNumber || {})) {
      rows.push(['Checkout-Zahl', fmtDate(run.date), run.id, 'Random Checkouts', '', '', '', a, c, a - c, Math.round((c / a) * 100), n]);
    }
  }
  for (const r of store.list('survivalRuns')) rows.push(['Leek Survival', fmtDate(r.date), r.id, r.difficulty, Math.round(r.durationMs / 1000), r.livesLost, `Runde ${r.highestRound}`, r.ok + r.fail, r.ok, r.fail, r.quote]);
  for (const r of store.list('l121Runs')) rows.push(['121', fmtDate(r.date), r.id, r.variant, Math.round(r.durationMs / 1000), '', `Höchste ${r.highest}`, r.attempts, r.checks, r.attempts - r.checks, '']);
  for (const r of store.list('doublesRuns')) rows.push(['Doppel', fmtDate(r.date), r.id, r.seq.join(' '), Math.round(r.durationMs / 1000), '', `${r.perMin}/Min`, '', r.hits, '', '']);
  for (const r of store.list('versusMatches')) rows.push(['1vs1', fmtDate(r.date), r.id, r.duel, '', '', r.players.join(' vs '), '', '', '', '', r.winner ?? 'Unentschieden']);
  download(`leek-darttraining-${stamp()}.csv`, csv(rows), 'text/csv;charset=utf-8');
}

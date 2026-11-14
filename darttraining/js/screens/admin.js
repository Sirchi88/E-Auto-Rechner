// Admin-Bereich: rendert die Einstellungen aus dem Schema + TheLeek-Reihenfolge + Daten.
import { h, iconBtn, ICONS, segmented, stepper, toggleSwitch, confirmDialog, toast, download, fmtDate } from '../ui.js';
import { store } from '../store.js';
import { SETTINGS_SCHEMA, defaultSettings } from '../settings.js';
import { gameById } from '../games/registry.js';

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
            store.saveSettings(defaultSettings()); render(); toast('Standardwerte wiederhergestellt');
          }
        } }, 'Einstellungen auf Standard')),
      h('p', { class: 'muted small-text', style: { textAlign: 'center' } }, 'Alle Daten bleiben lokal auf diesem Gerät.'));
  }

  function fieldRow(f, value) {
    let control;
    const onChange = v => {
      update({ [f.key]: v });
      // z. B. Range-Grenzen getauscht → neu zeichnen
      if (store.settings[f.key] !== v) render();
    };
    if (f.type === 'choice') control = segmented(f.options, value, onChange);
    else if (f.type === 'number') control = stepper(value, f, onChange);
    else if (f.type === 'toggle') control = toggleSwitch(value, onChange, f.label);
    return h('div', { class: 'field' }, h('div', { class: 'f-label' }, f.label, f.hint ? h('small', {}, f.hint) : null), control);
  }

  // ---- TheLeek Mode: Auswahl & Reihenfolge (Pfeile + Drag & Drop) ----
  function leekOrderCard() {
    const list = h('div', { class: 'order-list' });
    const save = order => { update({ leekOrder: order }); paint(); };

    function paint() {
      const order = store.settings.leekOrder;
      list.replaceChildren(...order.map((o, i) => {
        const g = gameById(o.id);
        const handle = h('span', { class: 'handle', html: ICONS.grip, 'aria-hidden': 'true' });
        const item = h('div', { class: `order-item${o.on ? '' : ' off'}`, 'data-i': i },
          handle,
          h('button', { class: `chk${o.on ? ' on' : ''}`, role: 'checkbox', 'aria-checked': String(o.on), 'aria-label': `${g.name} im TheLeek Mode`, html: o.on ? ICONS.check : '',
            onClick: () => save(order.map((x, k) => k === i ? { ...x, on: !x.on } : x)) }),
          h('span', { class: 'name' }, g.name),
          h('span', { class: 'arrows' },
            h('button', { 'aria-label': 'nach oben', disabled: i === 0, html: ICONS.up, onClick: () => save(move(order, i, i - 1)) }),
            h('button', { 'aria-label': 'nach unten', disabled: i === order.length - 1, html: ICONS.down, onClick: () => save(move(order, i, i + 1)) })));
        enableDrag(handle, item, i);
        return item;
      }));
    }

    function enableDrag(handle, item, from) {
      handle.addEventListener('pointerdown', e => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const items = [...list.children];
        const rects = items.map(el => el.getBoundingClientRect());
        const startY = e.clientY;
        let to = from;
        item.classList.add('dragging');
        const onMove = ev => {
          const dy = ev.clientY - startY;
          item.style.transform = `translateY(${dy}px)`;
          const mid = rects[from].top + rects[from].height / 2 + dy;
          to = rects.findIndex(r => mid < r.bottom);
          if (to === -1) to = rects.length - 1;
        };
        const onUp = () => {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
          item.classList.remove('dragging');
          item.style.transform = '';
          if (to !== from) save(move(store.settings.leekOrder, from, to));
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      });
    }

    paint();
    return h('div', { class: 'card' },
      h('h3', {}, 'TheLeek Mode'),
      h('p', { class: 'muted small-text' }, 'Haken = Spiel ist enthalten. Reihenfolge per Pfeil oder am Griff ziehen.'),
      list,
      h('button', { class: 'btn ghost small', style: { width: '100%', marginTop: '10px' }, onClick: () => save(defaultSettings().leekOrder) }, 'Standard-Reihenfolge'));
  }

  // ---- Statistik: Export & Reset ----
  function dataCard() {
    const n = store.sessions.length, r = store.checkoutRuns.length;
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

function move(arr, from, to) {
  const a = arr.map(x => ({ ...x }));
  const [it] = a.splice(from, 1);
  a.splice(Math.max(0, Math.min(a.length, to)), 0, it);
  return a;
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
    rows.push(['Session', fmtDate(s.start), s.id, s.mode === 'leek' ? 'TheLeek Mode' : 'Angepasst', Math.round(((s.end || s.start) - s.start) / 1000)]);
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
  download(`leek-darttraining-${stamp()}.csv`, csv(rows), 'text/csv;charset=utf-8');
}

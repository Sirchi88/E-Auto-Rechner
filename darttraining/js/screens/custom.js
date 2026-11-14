// Individuelles Trainingsprogramm: gespeicherte Pläne + Plan-Baukasten in 3 Schritten.
import { h, iconBtn, gameTile, orderEditor, segmented, stepper, toggleSwitch, rangeSlider, confirmDialog, toast } from '../ui.js';
import { store, uid } from '../store.js';
import { GAMES, gameById } from '../games/registry.js';
import { PLAN_PARAMS, defaultParams } from '../plans.js';
import { DOUBLE_PRESETS } from '../games/doubles.js';

const fmtVal = (f, p) => {
  if (f.type === 'range') return `${p.coMin}–${p.coMax}`;
  if (f.type === 'toggle') return p[f.key] ? 'an' : 'aus';
  if (f.type === 'dblseq') return (p[f.key] || []).join(' · ');
  if (f.type === 'choice') return f.options.find(([v]) => v === p[f.key])?.[1] ?? p[f.key];
  return p[f.key];
};
export function paramSummary(gameId, params) {
  const fields = (PLAN_PARAMS[gameId] || []).filter(f => !f.when || f.when(params));
  return fields.map(f => fmtVal(f, params)).join(' · ');
}

// Grafische Programm-Übersicht (für TheLeek und eigene Pläne)
export function programPreview(app, { title, sub, games, params, onStart, onEdit, onDelete, back }) {
  app.show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', back), h('h2', {}, title, h('span', { class: 'sub' }, sub))),
    h('div', { class: 'scroll' },
      h('ol', { class: 'timeline' }, games.map((id, i) => {
        const g = gameById(id);
        const ps = params ? paramSummary(id, params) : '';
        return h('li', { class: 'tl-item' },
          h('span', { class: 'tl-num' }, i + 1),
          h('span', { class: 'tl-card' },
            h('span', { class: 'g-glyph' }, g.glyph),
            h('b', {}, g.name),
            h('span', {}, ps || g.tile)));
      })),
      onEdit || onDelete ? h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        onDelete ? h('button', { class: 'btn ghost small', onClick: onDelete }, 'Löschen') : null,
        onEdit ? h('button', { class: 'btn ghost small', onClick: onEdit }, 'Bearbeiten') : null) : null),
    h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: onStart }, `Training starten (${games.length})`))),
  { back });
}

export function customFlow(app) {
  // ---------- Übersicht: Meine Pläne ----------
  function overview() {
    const plans = store.settings.plans;
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', app.home), h('h2', {}, 'Individuelles Training', h('span', { class: 'sub' }, 'Deine Pläne – ein Tipp und los'))),
      h('div', { class: 'scroll' },
        plans.length ? h('div', { class: 'tile-grid' }, plans.map(p => gameTile({
          glyph: '📋', title: p.name, desc: `${p.games.length} Spiele · ${p.games.map(id => gameById(id).name).slice(0, 3).join(', ')}${p.games.length > 3 ? ' …' : ''}`,
          onClick: () => preview(p),
        }))) : h('div', { class: 'empty card' }, 'Noch keine eigenen Pläne. Stell dir jetzt deinen ersten zusammen!'),
        h('button', { class: 'btn huge primary', style: { width: '100%', marginTop: '14px' }, onClick: () => step1({ id: null, name: '', games: [], params: {} }) }, '+ Neuen Plan erstellen'))),
    { back: app.home });
  }

  function preview(plan) {
    programPreview(app, {
      title: plan.name, sub: 'Eigener Plan', games: plan.games, params: { ...store.settings, ...plan.params },
      back: overview,
      onStart: () => app.startProgram('custom', plan.games, plan.params, plan.name),
      onEdit: () => step1(JSON.parse(JSON.stringify(plan))),
      onDelete: async () => {
        if (!(await confirmDialog({ title: 'Plan löschen?', text: `„${plan.name}“ wird gelöscht.`, ok: 'Löschen', danger: true }))) return;
        store.saveSettings({ ...store.settings, plans: store.settings.plans.filter(p => p.id !== plan.id) });
        overview();
      },
    });
  }

  // ---------- Schritt 1: Spiele wählen ----------
  function step1(plan) {
    const chosen = new Set(plan.games);
    const grid = h('div', { class: 'tile-grid' });
    const next = h('button', { class: 'btn huge primary', onClick: () => {
      plan.games = [...plan.games.filter(id => chosen.has(id)), ...GAMES.map(g => g.id).filter(id => chosen.has(id) && !plan.games.includes(id))];
      step2(plan);
    } });
    const paint = () => {
      grid.replaceChildren(...GAMES.map(g => gameTile({
        glyph: g.glyph, title: g.name, desc: g.tile, selected: chosen.has(g.id), mark: chosen.has(g.id) ? '✓' : null,
        onClick: () => { chosen.has(g.id) ? chosen.delete(g.id) : chosen.add(g.id); paint(); },
      })));
      next.disabled = !chosen.size;
      next.textContent = chosen.size ? `Weiter (${chosen.size} Spiele)` : 'Spiele antippen';
    };
    paint();
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', overview), h('h2', {}, 'Spiele wählen', h('span', { class: 'sub' }, 'Schritt 1 von 3'))),
      h('div', { class: 'scroll' }, grid),
      h('div', { class: 'controls' }, next)),
    { back: overview });
  }

  // ---------- Schritt 2: Reihenfolge ----------
  function step2(plan) {
    let order = plan.games.map(id => ({ id, on: true }));
    const editor = orderEditor(() => order, o => { order = o.map(x => ({ ...x, on: true })); }, id => gameById(id).name);
    editor.classList.add('order-only');
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', () => step1(plan)), h('h2', {}, 'Reihenfolge', h('span', { class: 'sub' }, 'Schritt 2 von 3 · Pfeile oder am Griff ziehen'))),
      h('div', { class: 'scroll' }, editor),
      h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', onClick: () => { plan.games = order.map(o => o.id); step3(plan); } }, 'Weiter'))),
    { back: () => step1(plan) });
  }

  // ---------- Schritt 3: Einstellungen + Name ----------
  function step3(plan) {
    const params = { ...defaultParams(store.settings, plan.games), ...plan.params };
    const nameInput = h('input', { class: 'text-input', placeholder: 'z. B. „Vor dem Ligaspiel“', value: plan.name, maxlength: 30 });
    const body = h('div', { class: 'scroll stack' });
    const paint = () => {
      const withParams = plan.games.filter(id => PLAN_PARAMS[id]);
      body.replaceChildren(...[
        ...withParams.map(id => h('div', { class: 'card' },
          h('h3', {}, h('span', { class: 'h-glyph' }, gameById(id).glyph), gameById(id).name),
          (PLAN_PARAMS[id] || []).filter(f => !f.when || f.when(params)).map(f => paramField(f, params, paint)))),
        withParams.length ? null : h('p', { class: 'muted' }, 'Diese Spiele haben keine Einstellungen – direkt speichern oder starten.'),
        h('div', { class: 'card' }, h('h3', {}, 'Plan speichern'), nameInput)].filter(Boolean));
    };
    paint();
    const save = () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); toast('Bitte einen Namen eingeben'); return null; }
      const saved = { id: plan.id || uid(), name, games: plan.games, params: { ...params } };
      const plans = store.settings.plans.filter(p => p.id !== saved.id);
      store.saveSettings({ ...store.settings, plans: [...plans, saved] });
      return saved;
    };
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', () => step2(plan)), h('h2', {}, 'Einstellungen', h('span', { class: 'sub' }, 'Schritt 3 von 3'))),
      body,
      h('div', { class: 'controls' },
        h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: () => { const p = save(); if (p) app.startProgram('custom', p.games, p.params, p.name); } }, 'Speichern & starten'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost small', onClick: () => app.startProgram('custom', plan.games, params, nameInput.value.trim() || 'Individuell') }, 'Nur starten'),
          h('button', { class: 'btn ghost small', onClick: () => { const p = save(); if (p) { toast('Plan gespeichert ✓'); overview(); } } }, 'Nur speichern')))),
    { back: () => step2(plan) });
  }

  return { start: overview };
}

function paramField(f, p, repaint) {
  let control;
  if (f.type === 'choice') control = segmented(f.options, p[f.key], v => { p[f.key] = v; repaint(); });
  else if (f.type === 'number') control = stepper(p[f.key], f, v => { p[f.key] = v; });
  else if (f.type === 'toggle') control = toggleSwitch(p[f.key], v => { p[f.key] = v; }, f.label);
  else if (f.type === 'range') return h('div', { class: 'field col' }, h('div', { class: 'f-label' }, f.label),
    rangeSlider({ min: 2, max: 170, from: p.coMin, to: p.coMax, onChange: (a, b) => { p.coMin = a; p.coMax = b; } }));
  else if (f.type === 'dblseq') {
    const opts = [...DOUBLE_PRESETS, ...store.settings.dblHistory.filter(x => !DOUBLE_PRESETS.some(d => d.join() === x.join()))];
    control = h('div', { class: 'chip-row' }, opts.map(o => h('button', { class: `chip-btn${o.join() === (p[f.key] || []).join() ? ' on' : ''}`, onClick: () => { p[f.key] = [...o]; repaint(); } }, o.join(' · '))));
    return h('div', { class: 'field col' }, h('div', { class: 'f-label' }, f.label), control);
  }
  return h('div', { class: 'field' }, h('div', { class: 'f-label' }, f.label), control);
}

// Around the Clock (Single/Doppel). Gezählt werden nur die Fehlwürfe.
import { h, icon } from '../ui.js';

function atcGame({ id, name, short, prefix, limitKey }) {
  const targets = [...Array.from({ length: 20 }, (_, k) => `${prefix}${k + 1}`), 'Bull'];

  return {
    id, name, short, tracked: true,
    mount(root, ctx) {
      const limit = ctx.settings[limitKey];
      let idx, misses, history, attempts = 0;
      const reset = () => { idx = 0; misses = 0; history = []; attempts++; render(); };

      const hit = () => { if (idx >= targets.length) return; history.push('hit'); idx++; render(); };
      const miss = () => { if (idx >= targets.length) return; history.push('miss'); misses++; render(); };
      const undo = () => {
        const last = history.pop();
        if (last === 'hit') idx--; else if (last === 'miss') misses--;
        render();
      };
      const result = () => ({ misses, limit, over: misses > limit, attempts });

      function render() {
        root.replaceChildren();
        if (idx >= targets.length) {
          const over = misses > limit;
          root.append(h('div', { class: 'game' },
            h('div', { class: 'stage' },
              h('div', { class: 'label' }, `${name} – geschafft`),
              h('div', { class: `big${over ? '' : ' leek'}` }, misses),
              h('p', { class: 'hint' }, misses === 1 ? 'Fehlwurf' : 'Fehlwürfe', h('br'), h('span', { class: 'small-text' }, `Grenzwert: ${limit}`)),
              over ? h('div', { class: 'recommend' }, 'Empfehlung: Wiederholen')
                   : h('div', { class: 'ok-badge' }, 'Im grünen Bereich ✓')),
            h('div', { class: 'controls' },
              h('div', { class: 'btn-row' },
                h('button', { class: `btn huge ${over ? 'ghost' : 'primary'}`, onClick: () => ctx.finish(result()) }, 'Weiter'),
                h('button', { class: `btn huge ${over ? 'fail' : 'ghost'}`, onClick: reset }, 'Wiederholen')),
              h('button', { class: 'btn ghost small', onClick: undo }, icon('undo'), 'Letzte Eingabe rückgängig'))));
          return;
        }
        const t = targets[idx];
        root.append(h('div', { class: 'game' },
          h('div', { class: 'stage' },
            h('div', { class: 'ring-progress', 'aria-label': `Feld ${idx + 1} von ${targets.length}` },
              targets.map((_, k) => h('span', { class: k < idx ? 'done' : k === idx ? 'cur' : '' }))),
            h('div', { class: 'label', style: { marginTop: '10px' } }, 'Zielfeld'),
            h('div', { class: `big${t === 'Bull' ? ' medium' : ''}` }, t),
            t === 'Bull' ? h('p', { class: 'hint' }, 'Bull ', h('strong', {}, 'oder'), ' Bullseye – eins reicht') : null,
            h('div', { class: 'statline' },
              h('div', { class: `stat${misses > limit ? ' red' : ''}` }, h('b', {}, misses), h('span', {}, `Fehlwürfe (Grenze ${limit})`)))),
          h('div', { class: 'controls' },
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn huge fail', onClick: miss }, 'Fehlwurf'),
              h('button', { class: 'btn huge check stacked', onClick: hit }, 'Treffer', h('small', { class: 'btn-sub' }, '→ nächstes Feld'))),
            h('button', { class: 'btn ghost small', onClick: undo, disabled: !history.length }, icon('undo'), 'Undo'))));
      }

      ctx.onKey(e => {
        const done = idx >= targets.length;
        if (e.key === 'Enter') { e.preventDefault(); done ? ctx.finish(result()) : hit(); }
        else if (e.key === ' ') { e.preventDefault(); if (!done) miss(); }
        else if (e.key === 'Backspace' || (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); if (history.length) undo(); }
      });
      reset();
    },
    summary(data, settings) {
      const limit = data.limit ?? settings[limitKey];
      const over = data.misses > limit;
      return { value: `${data.misses} Fehlwürfe`, note: over ? `über Grenze ${limit}` : `unter Grenze ${limit}`, bad: over, badTag: 'über', okTag: 'unter' };
    },
  };
}

export const atcSingle = atcGame({ id: 'atcSingle', name: 'Around the Clock Single', short: '1–20 + Bull, Fehlwürfe zählen.', prefix: '', limitKey: 'atcSingleLimit' });
export const atcDouble = atcGame({ id: 'atcDouble', name: 'Around the Clock Doppel', short: 'D1–D20 + Bull, Fehlwürfe zählen.', prefix: 'D', limitKey: 'atcDoubleLimit' });

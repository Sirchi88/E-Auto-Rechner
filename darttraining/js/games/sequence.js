// 20 / 19 / 18 / 17 / Bull – 12 Treffer pro Feld, ohne Zählen.
import { h } from '../ui.js';

const STATIONS = ['20', '19', '18', '17', 'Bull'];

export default {
  id: 'sequence',
  name: '20 / 19 / 18 / 17 / Bull',
  short: '12 Treffer pro Feld, kein Zählen.',
  tracked: false,
  mount(root, ctx) {
    let i = 0;
    const render = () => {
      root.replaceChildren();
      if (i >= STATIONS.length) {
        root.append(h('div', { class: 'game' },
          h('div', { class: 'stage' },
            h('div', { class: 'label' }, 'Abgeschlossen'),
            h('div', { class: 'big medium leek' }, '✓'),
            h('p', { class: 'hint' }, '20, 19, 18, 17 und Bull – ', h('strong', {}, 'alle Stationen geschafft.'))),
          h('div', { class: 'controls' },
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ completed: true }) }, 'Weiter'),
            h('button', { class: 'btn ghost', onClick: () => { i = STATIONS.length - 1; render(); } }, 'Zurück'))));
        return;
      }
      const cur = STATIONS[i];
      const next = STATIONS[i + 1];
      root.append(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'station-dots' }, STATIONS.map((s, k) => h('span', { class: k < i ? 'done' : k === i ? 'cur' : '' }, s))),
          h('div', { class: 'label', style: { marginTop: '12px' } }, 'Ziel'),
          h('div', { class: `big${cur === 'Bull' ? ' medium' : ''}` }, cur),
          h('p', { class: 'hint' }, h('strong', {}, '12 Treffer'), cur === 'Bull' ? ' auf Bull (Single- oder Bullseye)' : ` auf die ${cur}`)),
        h('div', { class: 'controls' },
          h('button', { class: 'btn huge primary', onClick: advance }, next ? `Weiter zur ${next}` : 'Abschließen'),
          i > 0 ? h('button', { class: 'btn ghost small', onClick: () => { i--; render(); } }, 'Zurück') : null)));
    };
    const advance = () => { i++; render(); };
    ctx.onKey(e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (i >= STATIONS.length) ctx.finish({ completed: true }); else advance();
      }
    });
    render();
  },
  summary() { return { value: 'absolviert ✓', bad: null }; },
};

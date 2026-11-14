// 20 / 19 / 18 / 17 / Bull – 12 Treffer pro Feld, ohne Zählen.
import { h } from '../ui.js';
import { sound } from '../sound.js';
import { createBoard } from '../board.js';

const STATIONS = ['20', '19', '18', '17', 'Bull'];

export default {
  id: 'sequence',
  name: '20 / 19 / 18 / 17 / Bull',
  short: '12 Treffer pro Feld, kein Zählen.',
  tracked: false,
  info: {
    lines: ['Reihenfolge: 20 → 19 → 18 → 17 → Bull.', 'Pro Feld 12 Treffer (Single, Doppel oder Triple zählen).', 'Kein Zählen in der App – einfach weiter tippen.'],
    steps: [
      { hl: ['SEG20'], cap: '12 Treffer auf die 20', darts: [['T20', true], ['S20', true], ['S20', true]] },
      { hl: ['SEG19'], cap: 'dann 12 auf die 19', darts: [['S19', true], ['T19', true]] },
      { hl: ['SEG18'], cap: '… 18 …' }, { hl: ['SEG17'], cap: '… 17 …' },
      { hl: ['BULL'], cap: 'zum Schluss 12× Bull', darts: [['25', true], ['50', true]] },
    ],
  },
  mount(root, ctx) {
    let i = 0;
    const board = createBoard({ className: 'mini-board' });
    const render = () => {
      root.replaceChildren();
      if (i >= STATIONS.length) {
        root.append(h('div', { class: 'game' },
          h('div', { class: 'stage' },
            h('div', { class: 'label' }, 'Abgeschlossen'),
            h('div', { class: 'big medium leek' }, '✓'),
            h('p', { class: 'hint big-hint' }, '20, 19, 18, 17 und Bull – ', h('strong', {}, 'alle Stationen geschafft.'))),
          h('div', { class: 'controls' },
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ completed: true }) }, 'Weiter'),
            h('button', { class: 'btn ghost', onClick: () => { i = STATIONS.length - 1; render(); } }, 'Zurück'))));
        return;
      }
      const cur = STATIONS[i];
      const next = STATIONS[i + 1];
      board.highlight([cur === 'Bull' ? 'BULL' : `SEG${cur}`], 'steady');
      root.append(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'station-dots' }, STATIONS.map((s, k) => h('span', { class: k < i ? 'done' : k === i ? 'cur' : '' }, s))),
          h('div', { class: 'seq-row' },
            h('div', {}, h('div', { class: 'label' }, 'Ziel'), h('div', { class: `big${cur === 'Bull' ? ' medium' : ''}` }, cur)),
            board.el),
          h('div', { class: 'need' }, h('b', {}, '12'), h('span', {}, 'Treffer')),
          h('p', { class: 'hint big-hint' }, cur === 'Bull' ? 'auf Bull (Single-Bull oder Bullseye)' : `auf die ${cur} – Single, Doppel oder Triple`)),
        h('div', { class: 'controls' },
          h('button', { class: 'btn huge primary', 'data-snd': 'none', onClick: advance }, next ? `Weiter zur ${next}` : 'Abschluss'),
          i > 0 ? h('button', { class: 'btn ghost small', onClick: () => { i--; render(); } }, 'Zurück') : null)));
    };
    const advance = () => {
      sound.play(i === STATIONS.length - 1 ? 'finish' : 'hit');
      i++; render();
    };
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

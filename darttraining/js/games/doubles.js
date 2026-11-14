// „Ich liebe meine Doppel“ – Doppel-Reihenfolge werfen, nur Treffer zählen (Check-Button).
import { h, icon, Countdown, fmtClock, fmtDuration, segmented, stepper } from '../ui.js';
import { sound } from '../sound.js';
import { createBoard } from '../board.js';
import { store, uid } from '../store.js';

export const DOUBLE_PRESETS = [
  ['D20', 'D10', 'D5'],
  ['D16', 'D8', 'D4'],
  ['D4', 'D2', 'D1'],
];
const ALL_DOUBLES = [...Array.from({ length: 20 }, (_, i) => `D${i + 1}`), 'Bull'];
const keyOf = d => (d === 'Bull' ? 'BULL' : d);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export default {
  id: 'doubles',
  name: 'Ich liebe meine Doppel',
  short: 'Doppel-Reihenfolge werfen, jeden Treffer mit Check zählen.',
  tracked: true,
  info: {
    lines: [
      'Wähle eine Doppel-Reihenfolge (z. B. D20 · D10 · D5) oder stell dir eine eigene zusammen.',
      'Wirf die Doppel der Reihe nach – Dart 1 auf das erste, Dart 2 aufs zweite …',
      'Für jeden Treffer einmal „Check“ drücken. Welches Doppel du getroffen hast, ist egal.',
      'Auf Zeit (3/5/7 Min) oder bis zur Treffer-Anzahl.',
    ],
    steps: [
      { hl: ['D20', 'D10', 'D5'], cap: 'D20 → D10 → D5', darts: [['D20', true], ['S10', false], ['D5', true]] },
      { hl: ['D16', 'D8', 'D4'], cap: 'D16 → D8 → D4', darts: [['D16', true], ['D8', true], ['S4', false]] },
      { hl: ['D4', 'D2', 'D1'], cap: 'D4 → D2 → D1', darts: [['D4', true], ['D2', false], ['D1', true]] },
    ],
  },
  mount(root, ctx) {
    const s = ctx.settings;
    let seq = [...s.dblCustom];
    let mode = s.dblMode, minutes = s.dblMinutes, target = s.dblHits;
    let hits, timer, startedAt, phase = 'setup', elapsedIv;
    const board = createBoard();

    function setup() {
      phase = 'setup';
      const seqView = h('div', { class: 'seq-pills' });
      const paintSeq = () => {
        seqView.replaceChildren(...(seq.length ? seq.map(d => h('span', { class: 'pill' }, d)) : [h('span', { class: 'muted' }, 'Doppel antippen …')]));
        board.highlight(seq.map(keyOf), 'steady');
        presetRow.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i < DOUBLE_PRESETS.length && same(seq, DOUBLE_PRESETS[i])));
      };
      const presetRow = h('div', { class: 'chip-row' },
        DOUBLE_PRESETS.map(p => h('button', { class: 'chip-btn', onClick: () => { seq = [...p]; customGrid.hidden = true; paintSeq(); } }, p.join(' · '))),
        h('button', { class: 'chip-btn', onClick: () => { customGrid.hidden = !customGrid.hidden; if (!customGrid.hidden) { seq = []; paintSeq(); } } }, 'Eigene Reihenfolge'));
      const customGrid = h('div', { class: 'dbl-grid', hidden: true },
        ALL_DOUBLES.map(d => h('button', { onClick: () => { if (seq.length < 6) { seq.push(d); paintSeq(); } } }, d)),
        h('button', { class: 'wide', onClick: () => { seq = []; paintSeq(); } }, 'Leeren'));

      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll stack', style: { paddingTop: '8px' } },
          h('div', { class: 'board-wrap small' }, board.el),
          h('div', { class: 'card' }, h('h3', {}, 'Reihenfolge'), seqView, presetRow, customGrid),
          h('div', { class: 'card' }, h('h3', {}, 'Spielen nach'),
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Modus'), segmented([['time', 'Zeit'], ['hits', 'Treffer']], mode, v => { mode = v; setup(); })),
            mode === 'time'
              ? h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Dauer'), segmented([[3, '3'], [5, '5'], [7, '7 Min']], minutes, v => { minutes = v; }))
              : h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Treffer-Ziel'), stepper(target, { min: 1, max: 200 }, v => { target = v; })))),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'none', onClick: start }, 'Start'))));
      paintSeq();
    }

    function start() {
      if (!seq.length) seq = [...DOUBLE_PRESETS[0]];
      store.saveSettings({ ...store.settings, dblCustom: seq });
      sound.play('start');
      phase = 'play'; hits = 0; startedAt = Date.now();
      const count = h('div', { class: 'big' }, '0');
      const status = h('div', { class: 'label' });
      const bar = h('i');
      board.highlight(seq.map(keyOf), 'blink');
      const paint = () => {
        count.textContent = hits;
        if (mode === 'time') { status.textContent = `${fmtClock(timer.left)} · Treffer`; bar.style.width = `${100 - (timer.left / timer.total) * 100}%`; }
        else { status.textContent = `Treffer ${hits} / ${target} · ${fmtClock(Date.now() - startedAt + 999)}`; bar.style.width = `${(hits / target) * 100}%`; }
      };
      const undoBtn = h('button', { class: 'btn ghost small', onClick: () => { if (hits > 0) { hits--; paint(); } } }, icon('undo'), 'Undo');
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          status, h('div', { class: 'progress', style: { maxWidth: '420px' } }, bar),
          h('div', { class: 'seq-pills big-pills' }, seq.map(d => h('span', { class: 'pill' }, d))),
          h('div', { class: 'board-wrap small' }, board.el),
          count),
        h('div', { class: 'controls' },
          h('button', { class: 'btn huge check xl', 'data-snd': 'none', onClick: check }, 'Check'),
          h('div', { class: 'btn-row' }, undoBtn, h('button', { class: 'btn ghost small', onClick: () => finish() }, 'Beenden')))));
      function check() {
        if (phase !== 'play') return;
        hits++;
        if (mode === 'hits' && hits >= target) { sound.play('finish'); return finish(); }
        sound.play('hit'); paint();
      }
      el.check = check; el.undo = () => undoBtn.click();
      if (mode === 'time') { timer = new Countdown(minutes * 60000, { onTick: paint, onEnd: () => finish() }); timer.start(); }
      else elapsedIv = setInterval(paint, 500);
      paint();
    }
    const el = {};

    function finish() {
      if (phase !== 'play') return;
      phase = 'result';
      timer?.stop(); clearInterval(elapsedIv);
      const durationMs = Date.now() - startedAt;
      const perMin = durationMs ? Math.round((hits / (durationMs / 60000)) * 10) / 10 : 0;
      const run = { id: uid(), date: Date.now(), seq, mode, setting: mode === 'time' ? minutes : target, hits, durationMs, perMin };
      if (hits) store.log('doublesRuns', run);
      const best = Math.max(0, ...store.list('doublesRuns').filter(r => r.mode === mode && r.setting === run.setting).map(r => r.perMin));
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'label' }, seq.join(' · ')),
          h('div', { class: 'big leek' }, hits),
          h('div', { class: 'label' }, 'Doppel-Treffer'),
          h('div', { class: 'statline', style: { marginTop: '12px' } },
            h('div', { class: 'stat' }, h('b', {}, fmtDuration(durationMs)), h('span', {}, 'Zeit')),
            h('div', { class: 'stat green' }, h('b', {}, perMin), h('span', {}, 'Treffer/Min')),
            h('div', { class: 'stat' }, h('b', {}, best), h('span', {}, 'Bestwert/Min')))),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ hits, perMin, durationMs, seq }) }, 'Weiter'),
            h('button', { class: 'btn huge ghost', onClick: setup }, 'Nochmal')))));
    }

    ctx.onKey(e => {
      if (phase === 'setup' && e.key === 'Enter') { e.preventDefault(); start(); }
      else if (phase === 'play' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.check(); }
      else if (phase === 'play' && e.key === 'Backspace') { e.preventDefault(); el.undo(); }
    });
    ctx.leek ? start() : setup();
    return () => { timer?.stop(); clearInterval(elapsedIv); };
  },
  summary(data) {
    return { value: `${data.hits} Treffer`, note: `${data.perMin} pro Minute`, bad: null };
  },
};

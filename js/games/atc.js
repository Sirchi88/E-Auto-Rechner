// Around the Clock (Single/Doppel/Triple) – Modus „Einfach“ (selbst zählen) oder „Ausführlich“ (jeden Dart quittieren).
import { h, icon, segmented } from '../ui.js';
import { sound } from '../sound.js';
import { createBoard } from '../board.js';
import { store, uid } from '../store.js';

export const ATC_VARIANTS = {
  S: { label: 'Single', prefix: 'S', show: n => `${n}` },
  D: { label: 'Doppel', prefix: 'D', show: n => `D${n}` },
  T: { label: 'Triple', prefix: 'T', show: n => `T${n}` },
};
export const atcTargets = v => [...Array.from({ length: 20 }, (_, k) => ({ key: `${ATC_VARIANTS[v].prefix}${k + 1}`, label: ATC_VARIANTS[v].show(k + 1) })), { key: 'BULL', label: 'Bull' }];

function atcGame({ id, v, limitKey }) {
  const V = ATC_VARIANTS[v];
  const name = `Around the Clock ${V.label}`;
  const targets = atcTargets(v);

  return {
    id, name, tracked: true,
    short: `${V.show(1)}–${V.show(20)} + Bull, Fehlwürfe zählen.`,
    info: {
      lines: [
        `Alle Felder von ${V.show(1)} bis ${V.show(20)} der Reihe nach treffen, zum Schluss Bull oder Bullseye.`,
        'Gezählt werden nur die Fehlwürfe (jeder Dart, der das Zielfeld verfehlt).',
        'Einfach: Du zählst selbst und tippst nur „Fehlwurf“ und am Ende „Geschafft“.',
        'Ausführlich: Das Zielfeld blinkt, du quittierst jeden Dart.',
      ],
      steps: [
        { hl: [`${V.prefix}1`], cap: `Start: ${V.show(1)}`, darts: [[`${V.prefix}1`, true]] },
        { hl: [`${V.prefix}2`], cap: `weiter: ${V.show(2)}`, darts: [['S17', false], [`${V.prefix}2`, true]] },
        { hl: [`${V.prefix}3`], cap: `… bis ${V.show(20)}`, darts: [[`${V.prefix}3`, true]] },
        { hl: ['BULL'], cap: 'Abschluss: Bull oder Bullseye', darts: [['25', true]] },
      ],
    },
    mount(root, ctx) {
      const limit = ctx.settings[limitKey];
      let mode = ctx.settings.atcMode;
      let idx, misses, history, attempts = 0, fieldMiss, startedAt;
      const board = createBoard();

      function setup() {
        root.replaceChildren(h('div', { class: 'game' },
          h('div', { class: 'stage' },
            h('div', { class: 'board-wrap' }, board.el),
            h('div', { class: 'card setup-card' },
              h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Modus'),
                segmented([['simple', 'Einfach'], ['detailed', 'Ausführlich']], mode, m => { mode = m; desc.textContent = modeDesc(); })),
              desc)),
          h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: start }, 'Start'))));
        board.highlight(targets.map(t => t.key).slice(0, 20), 'steady');
      }
      const desc = h('p', { class: 'muted small-text', style: { margin: '6px 0 0' } });
      const modeDesc = () => mode === 'simple'
        ? `Du zählst selbst. Tippe bei jedem Fehlwurf auf „Fehlwurf“ und am Ende auf „Geschafft“. Grenze: ${limit} Fehlwürfe.`
        : `Das Zielfeld blinkt auf der Scheibe. Jeden Dart mit „Treffer“ oder „Fehlwurf“ quittieren. Grenze: ${limit}.`;
      desc.textContent = modeDesc();

      function start() {
        idx = 0; misses = 0; history = []; attempts++; fieldMiss = {}; startedAt = Date.now();
        render();
      }

      const done = () => (mode === 'simple' ? idx === 1 : idx >= targets.length);
      const hit = () => {
        if (done()) return;
        history.push('hit'); idx++;
        sound.play(done() ? 'finish' : 'hit');
        render();
      };
      const miss = () => {
        if (done()) return;
        history.push('miss'); misses++;
        if (mode === 'detailed') { const k = targets[idx].key; fieldMiss[k] = (fieldMiss[k] || 0) + 1; }
        sound.play('miss');
        render();
      };
      const undo = () => {
        const last = history.pop();
        if (last === 'hit') idx--;
        else if (last === 'miss') { misses--; if (mode === 'detailed') { const k = targets[idx].key; fieldMiss[k] = Math.max(0, (fieldMiss[k] || 0) - 1); } }
        render();
      };
      const result = () => ({ misses, limit, over: misses > limit, attempts, mode });
      const leave = () => {
        // Statistik sichern
        store.log('atcRuns', { id: uid(), date: Date.now(), game: id, mode, misses, limit, durationMs: Date.now() - startedAt });
        if (mode === 'detailed') for (const t of targets) store.addFieldStat(t.key, 1 + (fieldMiss[t.key] || 0), 1);
        ctx.finish(result());
      };

      function render() {
        root.replaceChildren();
        if (done()) {
          const over = misses > limit;
          root.append(h('div', { class: 'game' },
            h('div', { class: 'stage' },
              h('div', { class: 'label' }, `${name} – geschafft`),
              h('div', { class: `big${over ? '' : ' leek'}` }, misses),
              h('p', { class: 'hint' }, misses === 1 ? 'Fehlwurf' : 'Fehlwürfe', h('br'), h('span', { class: 'small-text' }, `Grenzwert: ${limit}`)),
              over ? h('div', { class: 'recommend' }, 'Empfehlung: Nochmal machen')
                   : h('div', { class: 'ok-badge' }, 'Im grünen Bereich ✓')),
            h('div', { class: 'controls' },
              h('div', { class: 'btn-row' },
                h('button', { class: `btn huge ${over ? 'fail' : 'ghost'}`, 'data-snd': 'start', onClick: () => { store.log('atcRuns', { id: uid(), date: Date.now(), game: id, mode, misses, limit, repeated: true }); start(); } }, 'Nochmal'),
                h('button', { class: `btn huge ${over ? 'ghost' : 'primary'}`, onClick: leave }, 'Weiter')),
              h('button', { class: 'btn ghost small', onClick: undo }, icon('undo'), 'Letzte Eingabe rückgängig'))));
          return;
        }

        if (mode === 'simple') {
          board.highlight(targets.map(t => t.key), 'steady');
          root.append(h('div', { class: 'game' },
            h('div', { class: 'stage' },
              h('div', { class: 'board-wrap small' }, board.el),
              h('div', { class: 'label' }, `${V.show(1)} → ${V.show(20)} → Bull · selbst zählen`),
              h('div', { class: `big medium${misses > limit ? ' warn' : ''}` }, misses),
              h('div', { class: 'label' }, `Fehlwürfe · Grenze ${limit}`)),
            h('div', { class: 'controls' },
              h('button', { class: 'btn huge fail', 'data-snd': 'none', onClick: miss }, 'Fehlwurf'),
              h('div', { class: 'btn-row' },
                h('button', { class: 'btn ghost', onClick: undo, disabled: !history.length }, icon('undo'), 'Undo'),
                h('button', { class: 'btn check', 'data-snd': 'none', onClick: hit }, 'Geschafft')))));
          return;
        }

        const t = targets[idx];
        board.highlight([t.key], 'blink');
        root.append(h('div', { class: 'game' },
          h('div', { class: 'stage' },
            h('div', { class: 'atc-head' },
              h('div', {}, h('div', { class: 'label' }, `Feld ${idx + 1}/${targets.length}`), h('div', { class: 'big medium' }, t.label)),
              h('div', { class: `stat${misses > limit ? ' red' : ''}` }, h('b', {}, misses), h('span', {}, `Fehl · max ${limit}`))),
            h('div', { class: 'board-wrap' }, board.el),
            h('p', { class: 'hint', style: { visibility: t.key === 'BULL' ? 'visible' : 'hidden' } }, 'Bull ', h('strong', {}, 'oder'), ' Bullseye – eins reicht')),
          h('div', { class: 'controls' },
            h('div', { class: 'btn-row' },
              h('button', { class: 'btn huge fail', 'data-snd': 'none', onClick: miss }, 'Fehlwurf'),
              h('button', { class: 'btn huge check stacked', 'data-snd': 'none', onClick: hit }, 'Treffer', h('small', { class: 'btn-sub' }, '→ nächstes Feld'))),
            h('button', { class: 'btn ghost small', onClick: undo, disabled: !history.length }, icon('undo'), 'Undo'))));
      }

      ctx.onKey(e => {
        if (idx === undefined) { if (e.key === 'Enter') { e.preventDefault(); sound.play('start'); start(); } return; }
        if (e.key === 'Enter') { e.preventDefault(); done() ? leave() : hit(); }
        else if (e.key === ' ') { e.preventDefault(); if (!done()) miss(); }
        else if (e.key === 'Backspace' || (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); if (history.length) undo(); }
      });
      ctx.leek ? start() : setup();
    },
    summary(data, settings) {
      const limit = data.limit ?? settings[limitKey];
      const over = data.misses > limit;
      return { value: `${data.misses} Fehlwürfe`, note: over ? `über Grenze ${limit}` : `unter Grenze ${limit}`, bad: over, badTag: 'über', okTag: 'unter' };
    },
  };
}

export const atcSingle = atcGame({ id: 'atcSingle', v: 'S', limitKey: 'atcSingleLimit' });
export const atcDouble = atcGame({ id: 'atcDouble', v: 'D', limitKey: 'atcDoubleLimit' });
export const atcTriple = atcGame({ id: 'atcTriple', v: 'T', limitKey: 'atcTripleLimit' });

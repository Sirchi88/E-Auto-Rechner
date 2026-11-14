// 121 – 9 Darts pro Zahl. Varianten: Klassisch, Leek (Einloggen), GROB Boys (Leben).
import { h, icon, fmtDuration } from '../ui.js';
import { sound } from '../sound.js';
import { checkoutPath, BOGEYS } from '../checkouts.js';
import { store, uid } from '../store.js';
import { pathKeys } from '../board.js';

export const VARIANTS_121 = {
  classic: { label: 'Klassisch', emoji: '🎯', desc: 'In 9 Darts gecheckt → nächste Zahl. Nicht geschafft → zurück auf 121.' },
  leek: { label: 'Leek', emoji: '🔒', desc: 'Checkst du mit den ersten 3 Darts, wird die Zahl eingeloggt – tiefer fällst du nicht mehr.' },
  grob: { label: 'GROB Boys', emoji: '💚', desc: 'Mit Leben: 3 Darts = +2 Leben, 6 Darts = +1 Leben. Nicht geschafft = −1 Leben, ohne Leben zurück auf 121.' },
};

export const next121 = n => { let x = n + 1; while (BOGEYS.has(x)) x++; return x > 170 ? null : x; };

// Reine Spiellogik (auch für 1vs1). darts = 3 | 6 | 9 (gecheckt) oder 0 (nicht gecheckt).
export function create121(variant) {
  const st = { variant, n: 121, base: 121, lives: 0, maxLives: 0, highest: 0, checks: 0, attempts: 0, darts: 0, laps: 0, history: [] };
  return {
    st,
    attempt(darts) {
      st.history.push(JSON.stringify({ ...st, history: undefined }));
      st.attempts++;
      st.darts += darts || 9;
      const ev = { ok: darts > 0, darts };
      if (darts > 0) {
        st.checks++;
        st.highest = Math.max(st.highest, st.n);
        if (variant === 'leek' && darts === 3 && st.n > st.base) { st.base = st.n; ev.locked = st.n; }
        if (variant === 'grob') { const g = darts === 3 ? 2 : darts === 6 ? 1 : 0; st.lives += g; ev.lives = g; st.maxLives = Math.max(st.maxLives, st.lives); }
        const nx = next121(st.n);
        if (nx == null) { st.laps++; st.n = 121; st.base = 121; ev.lap = true; } else st.n = nx;
      } else if (variant === 'grob' && st.lives > 0) {
        st.lives--; ev.lifeLost = true;
      } else {
        ev.fallback = variant === 'grob' ? 121 : st.base;
        st.n = ev.fallback;
      }
      return ev;
    },
    undo() {
      const prev = st.history.pop();
      if (!prev) return false;
      const hist = st.history; Object.assign(st, JSON.parse(prev)); st.history = hist;
      return true;
    },
  };
}

// Die vier Eingabe-Buttons (auch im 1vs1 genutzt)
export function buttons121(variant, onAttempt) {
  const sub = d => variant === 'grob' ? (d === 3 ? '+2 Leben' : d === 6 ? '+1 Leben' : 'nur weiter')
    : variant === 'leek' ? (d === 3 ? 'Zahl einloggen 🔒' : 'weiter') : 'weiter';
  const okBtn = d => h('button', { class: 'btn check c121', 'data-snd': 'none', onClick: () => onAttempt(d) },
    h('span', {}, 'Geschafft mit'), h('b', { class: 'dn' }, `${d} Darts`), h('small', { class: 'btn-sub' }, sub(d)));
  return h('div', { class: 'grid121' },
    okBtn(3), okBtn(6), okBtn(9),
    h('button', { class: 'btn fail c121', 'data-snd': 'none', onClick: () => onAttempt(0) },
      h('b', { class: 'dn' }, 'Nicht'), h('span', {}, 'gecheckt'), h('small', { class: 'btn-sub' }, variant === 'grob' ? '−1 Leben' : 'zurück')));
}

export function lifeHearts(n) {
  return h('span', { class: 'green-hearts' }, n <= 0 ? '' : n <= 6 ? '💚'.repeat(n) : '💚 ×');
}

export const sound121 = (ev) => sound.play(ev.locked ? 'lock' : ev.lives ? 'lifeGain' : ev.lap ? 'record' : ev.ok ? 'hit' : (ev.lifeLost || ev.fallback) ? 'lifeLost' : 'miss');

export default {
  id: 'l121',
  name: '121',
  short: '9 Darts pro Zahl – wie hoch kommst du?',
  tracked: true,
  info: {
    lines: [
      'Start bei 121. Du hast 9 Darts (3 Aufnahmen), um die Zahl auszuchecken.',
      'Geschafft → nächste Zahl (122, 123 …). Nicht geschafft → zurück.',
      'Leek: Check mit den ersten 3 Darts loggt die Zahl ein – tiefer fällst du nicht mehr.',
      'GROB Boys: 3 Darts = +2 Leben, 6 Darts = +1 Leben. Fehlversuch kostet ein Leben, ohne Leben zurück auf 121.',
      'Nach jeder Zahl tippst du, mit wie vielen Darts du gecheckt hast. „Fertig“ beendet das Spiel.',
    ],
    steps: [
      { hl: pathKeys('T20 T11 D14'), cap: '121 = T20 · T11 · D14', darts: [['T20', true], ['T11', true], ['D14', true]] },
      { hl: pathKeys('T18 T20 D4'), cap: 'Geschafft → 122', darts: [['T18', true], ['S20', true], ['S4', false]] },
      { hl: ['T20', 'T11', 'D14'], cap: 'Nicht in 9 Darts? Zurück!' },
    ],
  },
  mount(root, ctx) {
    let variant = ctx.settings.l121Variant;
    let game, startedAt, phase = 'setup', flash = '';

    function setup() {
      phase = 'setup';
      const cards = h('div', { class: 'variant-list' });
      const paint = () => cards.replaceChildren(...Object.entries(VARIANTS_121).map(([k, v]) =>
        h('button', { class: `variant${k === variant ? ' on' : ''}`, onClick: () => { variant = k; paint(); } },
          h('span', { class: 'v-emoji' }, v.emoji),
          h('span', { class: 'v-txt' }, h('b', {}, v.label), h('span', {}, v.desc)))));
      paint();
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll stack', style: { paddingTop: '6px' } }, h('div', { class: 'label' }, 'Variante wählen'), cards),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: start }, 'Start bei 121'))));
    }

    function start() {
      game = create121(variant); startedAt = Date.now(); phase = 'play'; flash = '';
      render();
    }

    function act(darts) {
      const ev = game.attempt(darts);
      sound121(ev);
      flash = ev.locked ? `🔒 ${ev.locked} eingeloggt` : ev.lives ? `+${ev.lives} Leben 💚` : ev.lap ? '170 gecheckt! Neue Runde ab 121'
        : ev.ok ? 'Sauber – weiter!' : ev.lifeLost ? '−1 Leben' : `Zurück auf ${ev.fallback}`;
      render();
    }

    function render() {
      const st = game.st;
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage s121' },
          h('div', { class: 'info121' },
            h('div', { class: 'i-item' }, h('span', {}, 'Variante'), h('b', {}, VARIANTS_121[variant].label)),
            variant === 'grob' ? h('div', { class: 'i-item main' }, h('span', {}, 'Leben'), h('b', {}, lifeHearts(st.lives), h('em', {}, st.lives)))
              : variant === 'leek' ? h('div', { class: 'i-item main' }, h('span', {}, 'Eingeloggt'), h('b', {}, `🔒 ${st.base}`))
              : null,
            h('div', { class: 'i-item' }, h('span', {}, 'Bestes'), h('b', {}, st.highest || '–'))),
          h('div', { class: 'label' }, 'Checke'),
          h('div', { class: 'big n121' }, st.n),
          h('div', { class: 'path' }, checkoutPath(st.n)),
          h('div', { class: `flash ${flash ? '' : 'empty'}` }, flash || ' ')),
        h('div', { class: 'controls' },
          buttons121(variant, act),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost small', disabled: !st.history.length, onClick: () => { game.undo(); flash = ''; render(); } }, icon('undo'), 'Undo'),
            h('button', { class: 'btn ghost small', onClick: finish }, 'Fertig')))));
    }

    function finish() {
      phase = 'result';
      const st = game.st;
      const prevBest = Math.max(0, ...store.list('l121Runs').filter(r => r.variant === variant).map(r => r.highest || 0));
      const run = { id: uid(), date: Date.now(), variant, highest: st.highest, checks: st.checks, attempts: st.attempts, darts: st.darts, maxLives: st.maxLives, durationMs: Date.now() - startedAt };
      if (st.attempts) store.log('l121Runs', run);
      const record = st.highest > prevBest && st.highest > 0;
      sound.play(record ? 'record' : 'finish');
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'label' }, `121 · ${VARIANTS_121[variant].label}`),
          h('div', { class: 'ok-badge', style: { visibility: record ? 'visible' : 'hidden' } }, 'Neuer Rekord! 🏆'),
          h('div', { class: 'big leek' }, st.highest || '–'),
          h('div', { class: 'label' }, 'Höchste gecheckte Zahl'),
          h('div', { class: 'statline', style: { marginTop: '12px' } },
            h('div', { class: 'stat green' }, h('b', {}, st.checks), h('span', {}, 'Checks')),
            h('div', { class: 'stat' }, h('b', {}, st.attempts), h('span', {}, 'Versuche')),
            h('div', { class: 'stat' }, h('b', {}, Math.max(prevBest, st.highest) || '–'), h('span', {}, 'Rekord'))),
          h('p', { class: 'muted small-text' }, `${st.darts} Darts · ${fmtDuration(run.durationMs)}`)),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge ghost', onClick: ctx.leek ? start : setup }, 'Nochmal'),
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ variant, highest: st.highest, checks: st.checks, attempts: st.attempts }) }, 'Weiter')))));
    }

    ctx.onKey(e => {
      if (phase === 'setup' && e.key === 'Enter') { e.preventDefault(); sound.play('start'); start(); }
      else if (phase === 'play') {
        const map = { 1: 3, 2: 6, 3: 9, 0: 0, ' ': 0 };
        if (e.key in map) { e.preventDefault(); act(map[e.key]); }
        else if (e.key === 'Backspace') { e.preventDefault(); game.undo(); flash = ''; render(); }
      }
    });
    ctx.leek ? start() : setup();
  },
  summary(data) {
    return { value: `Höchste: ${data.highest || '–'}`, note: `${VARIANTS_121[data.variant]?.label ?? ''} · ${data.checks} Checks`, bad: null };
  },
};

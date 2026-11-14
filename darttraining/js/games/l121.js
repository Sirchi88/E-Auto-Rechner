// 121 – 9 Darts pro Zahl. Varianten: Klassisch, Leek (Einloggen), GROB Boys (Leben).
import { h, icon, segmented, fmtDuration } from '../ui.js';
import { sound } from '../sound.js';
import { checkoutPath, BOGEYS } from '../checkouts.js';
import { store, uid } from '../store.js';
import { pathKeys } from '../board.js';

export const VARIANTS_121 = {
  classic: { label: 'Klassisch', desc: 'In 9 Darts gecheckt → nächste Zahl. Nicht geschafft → zurück auf 121.' },
  leek: { label: 'Leek', desc: 'Wie klassisch – aber checkst du mit den ersten 3 Darts, wird die Zahl eingeloggt: Du fällst nur noch bis dorthin zurück.' },
  grob: { label: 'GROB Boys', desc: 'Mit Leben: Check mit 3 Darts = +2 Leben, mit 6 Darts = +1 Leben, mit 9 Darts = nur weiter. Nicht geschafft = −1 Leben. Keine Leben mehr → zurück auf 121.' },
};

export const next121 = n => { let x = n + 1; while (BOGEYS.has(x)) x++; return x > 170 ? null : x; };

// Reine Spiellogik (auch für 1vs1 genutzt)
export function create121(variant) {
  const st = { variant, n: 121, base: 121, visit: 0, lives: 0, highest: 0, checks: 0, attempts: 0, darts: 0, laps: 0, history: [] };
  const snap = () => st.history.push(JSON.stringify({ ...st, history: undefined }));
  return {
    st,
    // Ergebnis eines 3-Dart-Besuchs: ok = gecheckt. Gibt Ereignis zurück.
    visit(ok) {
      snap();
      st.darts += 3;
      let ev = { type: ok ? 'check' : 'miss' };
      if (ok) {
        st.checks++; st.attempts++;
        st.highest = Math.max(st.highest, st.n);
        if (variant === 'leek' && st.visit === 0) { st.base = st.n; ev.locked = st.n; }
        if (variant === 'grob') { const g = st.visit === 0 ? 2 : st.visit === 1 ? 1 : 0; st.lives += g; ev.lives = g; }
        const nx = next121(st.n);
        if (nx == null) { st.laps++; st.n = 121; st.base = 121; ev.lap = true; } else st.n = nx;
        st.visit = 0;
        ev.turnEnd = true;
      } else if (st.visit < 2) {
        st.visit++;
      } else {
        st.attempts++;
        st.visit = 0; ev.turnEnd = true;
        if (variant === 'grob' && st.lives > 0) { st.lives--; ev.lifeLost = true; }
        else { ev.fallback = st.base; st.n = st.base; if (variant === 'grob') { st.base = 121; st.n = 121; } }
      }
      return ev;
    },
    undo() {
      const prev = st.history.pop();
      if (!prev) return false;
      const h2 = st.history; Object.assign(st, JSON.parse(prev)); st.history = h2;
      return true;
    },
  };
}

export default {
  id: 'l121',
  name: '121',
  short: '9 Darts pro Zahl – schaffst du es, geht’s eins höher.',
  tracked: true,
  info: {
    lines: [
      'Start bei 121. Du hast 9 Darts (3 Aufnahmen), um die Zahl auszuchecken.',
      'Geschafft → nächste Zahl (122, 123 …). Nicht geschafft → zurück.',
      'Leek: Check mit den ersten 3 Darts loggt die Zahl ein – tiefer fällst du nicht mehr.',
      'GROB Boys: Leben sammeln (3 Darts = +2, 6 Darts = +1). Fehlversuch kostet ein Leben, ohne Leben zurück auf 121.',
      'Nach jeder Aufnahme: „Gecheckt“ oder „Nicht gecheckt“. Schluss machst du mit „Reicht für heute“.',
    ],
    steps: [
      { hl: pathKeys('T20 T11 D14'), cap: '121 = T20 · T11 · D14', darts: [['T20', true], ['T11', true], ['D14', true]] },
      { hl: pathKeys('T18 T20 D4'), cap: 'Geschafft → 122', darts: [['T18', true], ['S20', true], ['S4', false]] },
      { hl: ['T20', 'T11', 'D14'], cap: 'Nicht in 9 Darts? Zurück!' },
    ],
  },
  mount(root, ctx) {
    let variant = ctx.settings.l121Variant;
    let game, startedAt, phase = 'setup', toastMsg = '';

    function setup() {
      phase = 'setup';
      const desc = h('p', { class: 'muted', style: { margin: '10px 0 0' } }, VARIANTS_121[variant].desc);
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'big medium leek' }, '121'),
          h('div', { class: 'card setup-card' },
            h('h3', {}, 'Variante'),
            segmented(Object.entries(VARIANTS_121).map(([k, v]) => [k, v.label]), variant, v => { variant = v; desc.textContent = VARIANTS_121[v].desc; }),
            desc)),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: start }, 'Start'))));
    }

    function start() {
      game = create121(variant); startedAt = Date.now(); phase = 'play'; toastMsg = '';
      render();
    }

    function act(ok) {
      const ev = game.visit(ok);
      toastMsg = '';
      if (ev.locked) { sound.play('lock'); toastMsg = `🔒 ${ev.locked} eingeloggt`; }
      else if (ev.lives === 2) { sound.play('lifeGain'); toastMsg = '+2 Leben'; }
      else if (ev.lives === 1) { sound.play('lifeGain'); toastMsg = '+1 Leben'; }
      else if (ev.lap) { sound.play('record'); toastMsg = '170 gecheckt! Neue Runde ab 121'; }
      else if (ok) sound.play('hit');
      else if (ev.lifeLost) { sound.play('lifeLost'); toastMsg = '−1 Leben'; }
      else if (ev.fallback) { sound.play('lifeLost'); toastMsg = `Zurück auf ${ev.fallback}`; }
      else sound.play('miss');
      render();
    }

    function render() {
      const st = game.st;
      const path = checkoutPath(st.n);
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'chip-row center' },
            h('span', { class: 'pill' }, VARIANTS_121[variant].label),
            variant !== 'classic' ? h('span', { class: 'pill' }, variant === 'grob' ? `❤ ${st.lives} Leben` : `🔒 Basis ${st.base}`) : null,
            h('span', { class: 'pill' }, `Bestes: ${st.highest || '–'}`)),
          h('div', { class: 'label', style: { marginTop: '10px' } }, 'Checke'),
          h('div', { class: 'big' }, st.n),
          h('div', { class: 'path' }, path),
          h('div', { class: 'visits' }, [0, 1, 2].map(v => h('span', { class: v < st.visit ? 'used' : v === st.visit ? 'cur' : '' }, `Darts ${v * 3 + 1}–${v * 3 + 3}`))),
          toastMsg ? h('div', { class: 'flash' }, toastMsg) : null),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge fail stacked', 'data-snd': 'none', onClick: () => act(false) }, 'Nicht gecheckt', h('small', { class: 'btn-sub' }, 'Aufnahme vorbei')),
            h('button', { class: 'btn huge check', 'data-snd': 'none', onClick: () => act(true) }, 'Gecheckt')),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost small', disabled: !st.history.length, onClick: () => { game.undo(); toastMsg = ''; render(); } }, icon('undo'), 'Undo'),
            h('button', { class: 'btn ghost small', onClick: finish }, 'Reicht für heute')))));
    }

    function finish() {
      phase = 'result';
      const st = game.st;
      const prevBest = Math.max(0, ...store.list('l121Runs').filter(r => r.variant === variant).map(r => r.highest || 0));
      const run = { id: uid(), date: Date.now(), variant, highest: st.highest, checks: st.checks, attempts: st.attempts, darts: st.darts, durationMs: Date.now() - startedAt };
      if (st.darts) store.log('l121Runs', run);
      const record = st.highest > prevBest && st.highest > 0;
      sound.play(record ? 'record' : 'finish');
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'label' }, `121 · ${VARIANTS_121[variant].label}`),
          record ? h('div', { class: 'ok-badge' }, 'Neuer Rekord! 🏆') : null,
          h('div', { class: 'big leek' }, st.highest || '–'),
          h('div', { class: 'label' }, 'Höchste gecheckte Zahl'),
          h('div', { class: 'statline', style: { marginTop: '12px' } },
            h('div', { class: 'stat green' }, h('b', {}, st.checks), h('span', {}, 'Checks')),
            h('div', { class: 'stat' }, h('b', {}, st.attempts), h('span', {}, 'Versuche')),
            h('div', { class: 'stat' }, h('b', {}, Math.max(prevBest, st.highest) || '–'), h('span', {}, 'Rekord'))),
          h('p', { class: 'muted small-text' }, `${st.darts} Darts · ${fmtDuration(run.durationMs)}`)),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ variant, highest: st.highest, checks: st.checks, attempts: st.attempts }) }, 'Weiter'),
            h('button', { class: 'btn huge ghost', onClick: setup }, 'Nochmal')))));
    }

    ctx.onKey(e => {
      if (phase === 'setup' && e.key === 'Enter') { e.preventDefault(); sound.play('start'); start(); }
      else if (phase === 'play') {
        if (e.key === 'Enter') { e.preventDefault(); act(true); }
        else if (e.key === ' ') { e.preventDefault(); act(false); }
        else if (e.key === 'Backspace') { e.preventDefault(); game.undo(); toastMsg = ''; render(); }
      }
    });
    ctx.leek ? start() : setup();
  },
  summary(data) {
    return { value: `Höchste: ${data.highest || '–'}`, note: `${VARIANTS_121[data.variant]?.label ?? ''} · ${data.checks} Checks`, bad: null };
  },
};

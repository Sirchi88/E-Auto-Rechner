// Leek Survival – endlos, bis die Leben weg sind. Aufgaben werden mit jeder Runde schwerer.
import { h, icon, pick, pct, fmtDuration, stepper } from '../ui.js';
import { sound } from '../sound.js';
import { createBoard, pathKeys } from '../board.js';
import { checkoutPath, checkablePool } from '../checkouts.js';
import { store, uid } from '../store.js';
import { svLives } from '../settings.js';

export const DIFFICULTIES = {
  easy:   { label: 'Easy',   desc: 'Singles und einfache Felder', start: 0, cap: 2, emoji: '🌱' },
  normal: { label: 'Normal', desc: 'Doppel und Triple',            start: 1, cap: 4, emoji: '🎯' },
  hard:   { label: 'Hard',   desc: 'Schwierige Doppel & Checkouts', start: 2, cap: 5, emoji: '🔥' },
  insane: { label: 'Insane', desc: 'Zufällige, anspruchsvolle Aufgaben', start: 3, cap: 5, emoji: '💀' },
};

const NUMS = Array.from({ length: 20 }, (_, i) => i + 1);
const TOP = [20, 19, 18, 17, 16, 15];
const HARD_D = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const NICE_D = [20, 16, 10, 8, 12, 18, 4];
const SCORE = [41, 60, 81, 100, 121, 140];
const CO_RANGE = [[2, 40], [21, 60], [41, 80], [61, 100], [81, 130], [100, 170]];
const NEIGHBOURS = [[20, 1, 18], [19, 3, 17], [16, 8, 11], [14, 9, 12], [6, 10, 15], [5, 20, 1], [17, 2, 15]];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// Aufgaben-Generatoren: lv = aktuelle Stufe (0–5). Rückgabe: { id, sig, cat, text, sub, hl, field }
const GENS = [
  { id: 'single', cat: 'Single', min: 0, max: 1, make: () => { const n = pick(NUMS); return { sig: n, text: `Triff die ${n}`, sub: 'Single reicht · 3 Darts', hl: [`S${n}`], field: `S${n}` }; } },
  { id: 'segment2', cat: 'Single', min: 0, max: 2, make: lv => { const n = pick(TOP); const k = lv >= 2 ? 3 : 2; return { sig: n, text: `${k}× in die ${n}`, sub: 'Single, Doppel oder Triple · 3 Darts', hl: [`SEG${n}`] }; } },
  { id: 'zone', cat: 'Single', min: 0, max: 2, make: () => { const g = pick(NEIGHBOURS); return { sig: g.join(), text: `Alle 3 Darts in ${g.join(' · ')}`, sub: 'Die Nachbarschaft halten', hl: g.map(n => `SEG${n}`) }; } },
  { id: 'teens', cat: 'Single', min: 0, max: 1, make: () => ({ sig: 'teens', text: 'Jeder Dart mind. 10 Punkte', sub: 'Keine Ausrutscher in die kleinen Zahlen', hl: [] }) },
  { id: 'bull', cat: 'Bull', min: 0, max: 3, make: () => ({ sig: 'bull', text: 'Triff das Bull', sub: '25 oder 50 · 3 Darts', hl: ['BULL'], field: 'BULL' }) },
  { id: 'score', cat: 'Scoring', min: 0, max: 5, make: lv => { const x = SCORE[Math.min(lv, 5)]; return { sig: x, text: `${x}+ Punkte`, sub: 'mit 3 Darts', hl: ['T20', 'T19'] }; } },
  { id: 'seq', cat: 'Präzision', min: 1, max: 4, make: () => { const g = pick(NEIGHBOURS); return { sig: g.join('-'), text: `${g[0]} → ${g[1]} → ${g[2]}`, sub: 'Je ein Dart, genau in dieser Reihenfolge', hl: g.map(n => `S${n}`) }; } },
  { id: 'triple', cat: 'Triple', min: 1, max: 5, make: lv => { const n = lv <= 2 ? pick(TOP) : pick(NUMS); return { sig: n, text: `Triff T${n}`, sub: '3 Darts', hl: [`T${n}`], field: `T${n}` }; } },
  { id: 'double', cat: 'Doppel', min: 1, max: 3, make: () => { const n = pick(NICE_D); return { sig: n, text: `Triff D${n}`, sub: '3 Darts', hl: [`D${n}`], field: `D${n}` }; } },
  { id: 'hardDouble', cat: 'Doppel', min: 2, max: 5, make: () => { const n = pick(HARD_D); return { sig: n, text: `Triff D${n}`, sub: 'Ungerades Doppel · 3 Darts', hl: [`D${n}`], field: `D${n}` }; } },
  { id: 'checkout', cat: 'Checkout', min: 1, max: 5, make: lv => { const [a, b] = CO_RANGE[Math.min(lv, 5)]; const n = pick(checkablePool(a, b)); return { sig: n, text: `Checke ${n}`, sub: `${checkoutPath(n)} · 3 Darts`, hl: pathKeys(checkoutPath(n)) }; } },
  { id: 'checkout6', cat: 'Checkout', min: 2, max: 4, make: () => { const n = pick(checkablePool(101, 140)); return { sig: n, text: `Checke ${n}`, sub: `${checkoutPath(n)} · 6 Darts`, hl: pathKeys(checkoutPath(n)) }; } },
  { id: 'twoDoubles', cat: 'Doppel', min: 3, max: 5, make: () => ({ sig: '2d', text: '2 Doppel in einer Aufnahme', sub: 'Egal welche · 3 Darts', hl: NUMS.map(n => `D${n}`) }) },
  { id: 'mirror', cat: 'Präzision', min: 3, max: 5, make: () => { const n = pick(TOP); return { sig: n, text: `D${n} und T${n}`, sub: 'Beide in einer Aufnahme', hl: [`D${n}`, `T${n}`] }; } },
  { id: 'shanghai', cat: 'Präzision', min: 4, max: 5, make: () => { const n = pick(NUMS); return { sig: n, text: `Shanghai auf ${n}`, sub: `S${n}, D${n} und T${n} in einer Aufnahme`, hl: [`SEG${n}`] }; } },
  { id: 'bullseye', cat: 'Bull', min: 3, max: 5, make: () => ({ sig: 'be', text: 'Triff das Bullseye', sub: 'Nur die 50 zählt · 3 Darts', hl: ['50'], field: '50' }) },
  { id: 'ton40', cat: 'Scoring', min: 4, max: 5, make: () => ({ sig: 140, text: '140+ Punkte', sub: 'mit 3 Darts', hl: ['T20'] }) },
];

const BONUS = [
  () => ({ text: 'Triff das Bull', sub: '25 oder 50 · 3 Darts', hl: ['BULL'], field: 'BULL' }),
  () => { const n = pick(TOP); return { text: `Triff T${n}`, sub: '3 Darts', hl: [`T${n}`], field: `T${n}` }; },
  () => ({ text: '100+ Punkte', sub: 'mit 3 Darts', hl: ['T20'] }),
];
const BOSS = [
  () => ({ text: 'Big Fish: Checke 170', sub: 'T20 T20 Bull · 6 Darts', hl: pathKeys('T20 T20 Bull') }),
  () => { const n = pick(HARD_D); return { text: `D${n} zweimal`, sub: 'in einer Aufnahme', hl: [`D${n}`], field: `D${n}` }; },
  () => { const n = pick([20, 19, 18]); return { text: `Shanghai auf ${n}`, sub: `S${n}, D${n} und T${n} in einer Aufnahme`, hl: [`SEG${n}`] }; },
  () => ({ text: 'Bullseye zweimal', sub: 'in einer Aufnahme', hl: ['50'], field: '50' }),
  () => { const n = pick(checkablePool(121, 160)); return { text: `Checke ${n}`, sub: `${checkoutPath(n)} · 6 Darts`, hl: pathKeys(checkoutPath(n)) }; },
];

const QUIPS_OK = ['Sauber!', 'Leek-Level!', 'Weiter so!', 'Eiskalt.', 'Das sitzt!', 'Lauch-Power!', 'Bärenstark!'];
const QUIPS_FAIL = ['Kopf hoch.', 'Nächste Runde!', 'Abhaken.', 'Durchatmen.', 'Das wird noch.'];

export function makeTaskEngine(diffKey) {
  const D = DIFFICULTIES[diffKey];
  const recent = [];
  let lastGen = null;
  return function task(round) {
    const lv = Math.min(D.cap, D.start + Math.floor((round - 1) / 6));
    if (round % 10 === 0) return { ...pick(BOSS)(), kind: 'boss', cat: 'Boss', lv };
    if (round % 5 === 0) return { ...pick(BONUS)(), kind: 'bonus', cat: 'Bonus', lv };
    let pool = GENS.filter(g => lv >= g.min && lv <= g.max + (diffKey === 'insane' ? 1 : 0));
    if (diffKey === 'insane') pool = pool.filter(g => g.max >= 3);
    for (let tries = 0; tries < 40; tries++) {
      const g = pick(pool);
      if (g.id === lastGen && pool.length > 2) continue;
      const t = g.make(lv);
      const sig = `${g.id}:${t.sig}`;
      if (recent.includes(sig)) continue;
      recent.push(sig); if (recent.length > 12) recent.shift();
      lastGen = g.id;
      const danger = lv >= 2 && Math.random() < 0.08;
      return { ...t, kind: danger ? 'danger' : 'normal', cat: g.cat, gen: g.id, lv };
    }
    return { ...GENS[0].make(), kind: 'normal', cat: 'Single', lv };
  };
}

export default {
  id: 'survival',
  name: 'Leek Survival',
  short: 'Endlos-Challenge mit Leben – wie weit kommst du?',
  tracked: true,
  info: {
    lines: [
      'Jede Runde eine neue Aufgabe – mit jeder Runde wird es schwerer.',
      'Geschafft → nächste Runde. Nicht geschafft → ein Leben weg. Keine Leben mehr = Game over.',
      'Easy 10 · Normal 7 · Hard 5 · Insane 3 Leben (frei einstellbar).',
      'Alle 5 Runden Bonus 🎁 (+1 Leben, kein Risiko), alle 10 Runden Boss 💀 (+2 Leben, aber 2 Leben Einsatz). ⚡ Doppelte Gefahr kostet 2 Leben.',
      '5 Treffer in Serie = +1 Leben. Am Ende: Rekord, Quote, Vergleich zum letzten Versuch.',
    ],
    steps: [
      { hl: ['S20'], cap: 'Runde 1: Triff die 20', darts: [['S20', true]] },
      { hl: ['T19'], cap: 'Runde 2: Triff T19', darts: [['S19', false], ['T19', true]] },
      { hl: ['D10'], cap: 'Runde 3: D10 in 3 Darts', darts: [['D10', true]] },
      { hl: pathKeys('T19 D12'), cap: 'Runde 9: Checke 81', darts: [['T19', true], ['S12', false], ['D6', false]] },
    ],
  },
  mount(root, ctx) {
    const s = ctx.settings;
    let diff = s.svDifficulty;
    const lives0 = {}; for (const k of Object.keys(DIFFICULTIES)) lives0[k] = svLives(s, k);
    let st, engine, startedAt, phase = 'setup', snapshot = null, flash = null;
    const board = createBoard();

    function setup() {
      phase = 'setup';
      const cards = h('div', { class: 'diff-grid' });
      const paint = () => cards.replaceChildren(...Object.entries(DIFFICULTIES).map(([k, d]) => {
        const best = bestOf(k);
        return h('button', { class: `diff${k === diff ? ' on' : ''}`, onClick: () => { diff = k; paint(); } },
          h('span', { class: 'd-emoji' }, d.emoji),
          h('b', {}, d.label),
          h('span', { class: 'd-lives' }, `❤ ${lives0[k]}`),
          h('span', { class: 'd-desc' }, d.desc),
          h('span', { class: 'd-best' }, best ? `Rekord: Runde ${best}` : 'Noch kein Rekord'));
      }));
      paint();
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll stack', style: { paddingTop: '8px' } },
          cards,
          h('div', { class: 'card' }, h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Leben für diese Runde', h('small', {}, 'individuell anpassbar')),
            stepper(lives0[diff], { min: 1, max: 30 }, v => { lives0[diff] = v; paint(); })))),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'none', onClick: start }, 'Challenge starten'))));
    }
    const runsOf = k => store.list('survivalRuns').filter(r => r.difficulty === k);
    const bestOf = k => Math.max(0, ...runsOf(k).map(r => r.highestRound));

    function start() {
      sound.play('start');
      engine = makeTaskEngine(diff);
      st = { round: 1, bossWins: 0, lives: lives0[diff], startLives: lives0[diff], lost: 0, gained: 0, ok: 0, fail: 0, streak: 0, bestStreak: 0, catFails: {}, task: null };
      st.task = engine(1);
      startedAt = Date.now(); phase = 'play'; flash = null;
      render();
    }

    function answer(ok) {
      if (phase !== 'play') return;
      snapshot = JSON.stringify(st);
      const t = st.task;
      if (t.field) store.addFieldStat(t.field, 3, ok ? 1 : 0);
      if (ok) {
        st.ok++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak);
        if (t.kind === 'boss') st.bossWins++;
        let gain = t.kind === 'boss' ? 2 : t.kind === 'bonus' || t.kind === 'danger' ? 1 : 0;
        let msg = pick(QUIPS_OK);
        if (st.streak > 0 && st.streak % 5 === 0) { gain++; msg = `🔥 ${st.streak}er-Serie!`; }
        if (gain) { st.lives += gain; st.gained += gain; msg += ` +${gain} ❤`; sound.play('lifeGain'); } else sound.play('hit');
        flash = { ok: true, msg };
      } else {
        st.fail++; st.streak = 0;
        st.catFails[t.cat] = (st.catFails[t.cat] || 0) + 1;
        const loss = t.kind === 'bonus' ? 0 : t.kind === 'boss' || t.kind === 'danger' ? 2 : 1;
        st.lost += Math.min(loss, st.lives); st.lives -= loss;
        flash = { ok: false, msg: loss ? `${pick(QUIPS_FAIL)} −${loss} ❤` : 'Bonus verpasst – kein Leben weg.' };
        sound.play(loss ? 'lifeLost' : 'miss');
      }
      if (st.lives <= 0) { st.lives = 0; return gameOver(); }
      st.round++;
      st.task = engine(st.round);
      render();
    }
    function undo() { if (!snapshot) return; st = JSON.parse(snapshot); snapshot = null; flash = null; render(); }

    function render() {
      const t = st.task;
      board.highlight(t.hl || [], 'blink');
      const hearts = st.lives <= 12
        ? Array.from({ length: st.lives }, () => h('span', { class: 'heart' }, '❤'))
        : [h('span', { class: 'heart' }, '❤'), ` × ${st.lives}`];
      const badge = t.kind === 'boss' ? h('div', { class: 'task-badge boss' }, 'BOSS 💀 · Einsatz 2 Leben · Sieg +2')
        : t.kind === 'bonus' ? h('div', { class: 'task-badge bonus' }, 'BONUS 🎁 · +1 Leben · kein Risiko')
        : t.kind === 'danger' ? h('div', { class: 'task-badge danger' }, '⚡ Doppelte Gefahr · −2 / +1')
        : h('div', { class: 'task-badge', style: { visibility: 'hidden' } }, '\u00a0');
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'sv-head' },
            h('div', {}, h('div', { class: 'label' }, `${DIFFICULTIES[diff].label} · Stufe ${t.lv + 1}`), h('div', { class: 'round' }, `Runde ${st.round}`)),
            h('div', { class: 'sv-right' }, h('div', { class: 'hearts' }, hearts), st.streak >= 2 ? h('div', { class: 'streak' }, `🔥 ${st.streak}`) : null)),
          badge,
          h('div', { class: `task-card ${t.kind}` },
            h('div', { class: 'task-cat' }, t.cat),
            h('div', { class: 'task-text' }, t.text),
            h('div', { class: 'task-sub' }, t.sub)),
          h('div', { class: 'board-wrap small' }, board.el),
          h('div', { class: `flash ${flash ? (flash.ok ? 'ok' : 'bad') : 'empty'}` }, flash ? flash.msg : '\u00a0')),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge fail', 'data-snd': 'none', onClick: () => answer(false) }, 'Verfehlt'),
            h('button', { class: 'btn huge check', 'data-snd': 'none', onClick: () => answer(true) }, 'Geschafft')),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost small', disabled: !snapshot, onClick: undo }, icon('undo'), 'Undo'),
            h('button', { class: 'btn ghost small', onClick: gameOver }, 'Aufgeben')))));
    }

    function gameOver() {
      if (phase !== 'play') return;
      phase = 'result';
      const prev = runsOf(diff).at(-1);
      const best = bestOf(diff);
      const total = st.ok + st.fail;
      const run = {
        id: uid(), date: Date.now(), difficulty: diff, startLives: st.startLives,
        highestRound: st.round, survived: st.round - 1, livesLost: st.lost, livesGained: st.gained,
        ok: st.ok, fail: st.fail, quote: pct(st.ok, total), bestStreak: st.bestStreak, bossWins: st.bossWins, durationMs: Date.now() - startedAt,
      };
      store.log('survivalRuns', run);
      const record = run.highestRound > best;
      sound.play(record ? 'record' : 'end');
      const nemesis = Object.entries(st.catFails).sort((a, b) => b[1] - a[1])[0];
      const delta = prev ? run.highestRound - prev.highestRound : null;
      const deltaTxt = delta == null ? 'Erster Versuch' : delta > 0 ? `+${delta} Runden besser als letztes Mal` : delta < 0 ? `${delta} Runden zum letzten Mal` : 'Gleich weit wie letztes Mal';
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll' },
          h('div', { class: 'stage', style: { flex: 'none', paddingBottom: '10px' } },
            h('div', { class: 'label' }, `Game over · ${DIFFICULTIES[diff].label}`),
            record ? h('div', { class: 'ok-badge' }, 'Neuer persönlicher Rekord! 🏆') : null,
            h('div', { class: 'big leek' }, run.highestRound),
            h('div', { class: 'label' }, 'Höchste erreichte Runde'),
            h('div', { class: `delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}` }, deltaTxt)),
          h('div', { class: 'card' },
            h('div', { class: 'stat-grid' },
              [['Überlebte Runden', run.survived], ['Verlorene Leben', run.livesLost], ['Erfolgsquote', `${run.quote}%`],
               ['Persönlicher Rekord', Math.max(best, run.highestRound)], ['Beste Serie', run.bestStreak], ['Dauer', fmtDuration(run.durationMs)]]
                .map(([k, v]) => h('div', { class: 'sg' }, h('b', {}, v), h('span', {}, k)))),
            nemesis ? h('p', { class: 'muted small-text', style: { marginTop: '12px' } }, `Deine Nemesis heute: ${nemesis[0]} (${nemesis[1]}× verfehlt) – ab zu „Dran bleiben Junge“!`) : null)),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge ghost', onClick: setup }, 'Nochmal'),
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ difficulty: diff, highestRound: run.highestRound, quote: run.quote, livesLost: run.livesLost, record }) }, 'Weiter')))));
    }

    ctx.onKey(e => {
      if (phase === 'setup' && e.key === 'Enter') { e.preventDefault(); start(); }
      else if (phase === 'play') {
        if (e.key === 'Enter') { e.preventDefault(); answer(true); }
        else if (e.key === ' ') { e.preventDefault(); answer(false); }
        else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      }
    });
    ctx.leek ? start() : setup();
  },
  summary(data) {
    return { value: `Runde ${data.highestRound}`, note: `${DIFFICULTIES[data.difficulty]?.label ?? ''} · ${data.quote}% · ${data.record ? 'Rekord!' : `${data.livesLost} Leben verloren`}`, bad: null };
  },
};

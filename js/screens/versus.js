// 1vs1 auf einem Gerät: Namen, zufällige Charaktere, Duelle (ATC, 121, Random Checkouts).
import { h, icon, iconBtn, pick, shuffle, confirmDialog, toggleSwitch, gameTile, ICONS } from '../ui.js';
import { sound } from '../sound.js';
import { store, uid } from '../store.js';
import { createBoard, pathKeys } from '../board.js';
import { atcTargets, ATC_VARIANTS } from '../games/atc.js';
import { create121, VARIANTS_121, buttons121, lifeHearts, sound121 } from '../games/l121.js';
import { checkoutPath, checkablePool } from '../checkouts.js';
import { showInfo } from '../info.js';
import { checkBadges } from '../badges.js';

// Gemüse-Alter-Egos frei nach bekannten Dartprofis
export const CHARACTERS = [
  { name: 'Cool Hand Lauch', emoji: '😎', line: 'Bleibt cool – auch bei 170 Rest.' },
  { name: 'The Lauch-Nuke', emoji: '☢️', line: 'Jung, frech, explosiv.' },
  { name: 'Mighty Mike van Grünwerden', emoji: '🟢', line: 'Grüner wird’s nicht.' },
  { name: 'The Iceberg-Salat', emoji: '🥶', line: 'Kalt wie das Gemüsefach.' },
  { name: 'Snakebite Schnittlauch', emoji: '🐍', line: 'Bunte Frisur, scharfe Doppel.' },
  { name: 'Bully Boy Bärlauch', emoji: '🐻', line: 'Riecht man schon von Weitem.' },
  { name: 'The Bullet-Zwiebel', emoji: '🧅', line: 'Bringt jeden Gegner zum Weinen.' },
  { name: 'Voltage Frühlingszwiebel', emoji: '⚡', line: 'Unter Strom seit dem ersten Dart.' },
  { name: 'The Aspargus', emoji: '🌿', line: 'Lang, dünn, brandgefährlich.' },
  { name: 'The Heat Peperoni', emoji: '🌶️', line: 'Heiß auf die Triple 20.' },
  { name: 'The Ferret Fenchel', emoji: '🦦', line: 'Wendig und unberechenbar.' },
  { name: 'Dream-Maker Dill', emoji: '💭', line: 'Träumt nachts von Neun-Dartern.' },
  { name: 'Queen of the Beet', emoji: '👑', line: 'Regiert das ganze Gemüsebeet.' },
  { name: 'The Power Porree', emoji: '💪', line: '16-facher Lauch-Weltmeister (inoffiziell).' },
  { name: 'The Flying Schalotte', emoji: '🦅', line: 'Fliegt elegant aufs Doppel.' },
  { name: 'Chizzy Chicorée', emoji: '🥬', line: 'Bitter für jeden Gegner.' },
  { name: 'Rocky Rucola', emoji: '🪨', line: 'Hart im Nehmen, scharf im Abgang.' },
  { name: 'The Freeze-Erbse', emoji: '🧊', line: 'Tiefgekühlt am Oche.' },
  { name: 'Jackpot Kohlrabi', emoji: '💰', line: 'Räumt jeden Pott ab.' },
  { name: 'Barney Broccoli', emoji: '🥦', line: 'Die Legende aus dem Gemüsegarten.' },
];

const DUELS = [
  ...Object.entries(ATC_VARIANTS).map(([v, V]) => ({ id: `atc${v}`, glyph: v === 'S' ? '1→20' : v, name: `ATC ${V.label}`, desc: `Wer ist zuerst durch? ${V.show(1)}–${V.show(20)} + Bull.`, kind: 'atc', v })),
  { id: 'l121classic', glyph: '121', name: '121 Klassisch', desc: 'Höchste Zahl gewinnt.', kind: 'l121', v: 'classic' },
  { id: 'l121leek', glyph: '🔒', name: '121 Leek', desc: 'Mit Einloggen nach 3 Darts.', kind: 'l121', v: 'leek' },
  { id: 'l121grob', glyph: '💚', name: '121 GROB Boys', desc: 'Mit Leben sammeln.', kind: 'l121', v: 'grob' },
  { id: 'co', glyph: '✓', name: 'Random Checkouts', desc: 'Gleiche Zahl – wer zuerst X Checks hat.', kind: 'co' },
];

const DUEL_INFO = {
  atc: { lines: ['Beide spielen Around the Clock – wer zuerst durch ist (inkl. Bull), gewinnt.', 'Pro Aufnahme 3 Darts, jeden Dart mit Treffer/Fehlwurf quittieren. Danach wechselt die App automatisch.'], steps: [{ hl: ['S1'], cap: 'Spieler 1: Feld 1', darts: [['S1', true]] }, { hl: ['S3'], cap: 'Spieler 2: schon bei 3!', darts: [['S3', true]] }] },
  l121: { lines: ['Jeder hat seine eigene 121-Leiter.', 'Abwechselnd versucht jeder seine aktuelle Zahl (max. 9 Darts = 3 Aufnahmen).', 'Nach jedem Versuch: mit 3, 6 oder 9 Darts geschafft – oder nicht. „Fertig“ beendet das Duell, die höchste gecheckte Zahl gewinnt.'], steps: [{ hl: pathKeys('T20 T11 D14'), cap: '121 = T20 · T11 · D14', darts: [['T20', true], ['T11', true], ['D14', true]] }] },
  co: { lines: ['Pro Runde bekommen beide dieselbe Restzahl.', 'Jeder hat 3 Darts: Check oder Fail.', 'Wer zuerst die eingestellte Anzahl Checks hat, gewinnt (bei Gleichstand geht es weiter).'], steps: [{ hl: pathKeys('T19 D12'), cap: '81 – beide sind dran', darts: [['T19', true], ['D12', true]] }] },
};

export function versusFlow(app) {
  let players = null;
  let starter = 0;

  // ---------- Namen ----------
  function names() {
    const [n1, n2] = store.settings.vsNames;
    const i1 = h('input', { class: 'text-input', placeholder: 'Spieler 1', value: n1, maxlength: 20, autocomplete: 'off' });
    const i2 = h('input', { class: 'text-input', placeholder: 'Spieler 2', value: n2, maxlength: 20, autocomplete: 'off' });
    let withChars = store.settings.vsCharacters;
    const go = () => {
      const a = i1.value.trim() || 'Spieler 1', b = i2.value.trim() || 'Spieler 2';
      store.saveSettings({ ...store.settings, vsNames: [i1.value.trim(), i2.value.trim()], vsCharacters: withChars });
      const [c1, c2] = shuffle(CHARACTERS);
      players = [{ name: a, ch: withChars ? c1 : null }, { name: b, ch: withChars ? c2 : null }];
      withChars ? reveal() : choose();
    };
    const goBtn = h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: go }, withChars ? 'Charaktere auslosen' : 'Weiter zur Spielwahl');
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', app.home), h('h2', {}, '1vs1', h('span', { class: 'sub' }, 'Duell auf einem Gerät'))),
      h('div', { class: 'scroll stack' },
        h('img', { class: 'duel-img', src: 'icons/duel.webp', alt: 'Zwei Maskottchen schauen sich böse an' }),
        h('div', { class: 'card stack' },
          h('label', { class: 'label' }, 'Spieler 1'), i1,
          h('label', { class: 'label' }, 'Spieler 2'), i2),
        h('div', { class: 'card' }, h('div', { class: 'field' },
          h('div', { class: 'f-label' }, 'Mit lustigen Charakteren', h('small', {}, 'Zufälliges Gemüse-Alter-Ego für jeden')),
          toggleSwitch(withChars, v => { withChars = v; goBtn.textContent = v ? 'Charaktere auslosen' : 'Weiter zur Spielwahl'; }, 'Mit Charakteren')))),
      h('div', { class: 'controls' }, goBtn)),
    { back: app.home });
  }

  // ---------- Charakter-Reveal ----------
  function reveal() {
    const card = (p, i) => h('div', { class: `char-card p${i}`, style: { animationDelay: `${i * 0.35}s` } },
      h('div', { class: 'char-emoji' }, p.ch.emoji),
      h('div', { class: 'char-player' }, p.name),
      h('div', { class: 'char-name' }, `„${p.ch.name}“`),
      h('div', { class: 'char-line' }, p.ch.line));
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', names), h('h2', {}, 'Die Kontrahenten')),
      h('div', { class: 'stage' },
        card(players[0], 0),
        h('div', { class: 'vs-badge' }, 'VS'),
        card(players[1], 1)),
      h('div', { class: 'controls' },
        h('button', { class: 'btn ghost small', onClick: () => { const [c1, c2] = shuffle(CHARACTERS); players[0].ch = c1; players[1].ch = c2; reveal(); } }, 'Neu auslosen'),
        h('button', { class: 'btn huge primary', onClick: choose }, 'Spiel wählen'))),
    { back: names });
    sound.play('lifeGain');
  }

  // ---------- Spielwahl ----------
  function choose() {
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', players[0].ch ? reveal : names), h('h2', {}, 'Duell wählen', h('span', { class: 'sub' }, `${players[0].name} vs. ${players[1].name}`))),
      h('div', { class: 'scroll' }, h('div', { class: 'tile-grid' }, DUELS.map(d => gameTile({
        glyph: d.glyph, title: d.name, desc: d.kind === 'co' ? d.desc.replace('X', store.settings.vsChecks) : d.desc, onClick: () => startDuel(d),
      }))))),
    { back: players[0].ch ? reveal : names });
  }

  // ---------- Gemeinsamer Rahmen ----------
  function frame(duel, body, { scores, active, under = null }) {
    const exit = async () => {
      if (await confirmDialog({ title: 'Duell abbrechen?', text: 'Das Duell wird nicht gewertet.', ok: 'Abbrechen', cancel: 'Weiterspielen', danger: true })) choose();
    };
    return {
      el: h('section', { class: 'screen' },
        h('div', { class: 'topbar' },
          h('button', { class: 'icon-btn info-btn', 'aria-label': 'Spielerklärung', html: icon('info').innerHTML, onClick: () => showInfo({ name: duel.name, info: DUEL_INFO[duel.kind] }) }),
          h('h2', {}, duel.name, h('span', { class: 'sub' }, '1vs1')),
          iconBtn('close', 'Duell verlassen', exit)),
        h('div', { class: 'vs-bar' }, players.map((p, i) =>
          h('div', { class: `vs-chip${i === active ? ' active' : ''}` },
            p.ch ? h('span', { class: 'e' }, p.ch.emoji) : null,
            h('span', { class: 'n' }, h('b', {}, p.name), p.ch ? h('small', {}, p.ch.name) : null),
            h('span', { class: 's' }, scores[i])))),
        h('div', { class: 'turn-banner' },
          h('div', { class: 'tb-label' }, 'Am Wurf'),
          h('div', { class: 'tb-name' }, players[active].ch ? `${players[active].ch.emoji} ` : '', players[active].name),
          under),
        body),
      exit,
    };
  }

  function startDuel(duel) {
    if (duel.kind === 'atc') atcDuel(duel);
    else if (duel.kind === 'l121') duel121(duel);
    else coDuel(duel);
  }

  function winnerScreen(duel, winner, detail) {
    const draw = winner == null;
    store.log('versusMatches', { id: uid(), date: Date.now(), duel: duel.id, players: players.map(p => p.name), winner: draw ? null : players[winner].name, detail });
    sound.play('record');
    setTimeout(checkBadges, 1200);
    starter = 1 - starter;
    app.show(h('section', { class: 'screen' },
      h('div', { class: 'stage' },
        h('div', { class: `char-emoji big-emoji${draw ? '' : ' win'}` }, draw ? '🤝' : players[winner].ch?.emoji ?? '🏆'),
        h('div', { class: 'label' }, duel.name),
        h('div', { class: 'win-title' }, draw ? 'Unentschieden!' : `${players[winner].name} gewinnt!`),
        draw || !players[winner].ch ? null : h('div', { class: 'char-name' }, `„${players[winner].ch.name}“`),
        h('p', { class: 'hint' }, detail)),
      h('div', { class: 'controls' },
        h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: () => startDuel(duel) }, 'Revanche'),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn ghost', onClick: choose }, 'Anderes Spiel'),
          h('button', { class: 'btn ghost', onClick: app.home }, 'Menü')))),
    { back: choose });
  }

  // ---------- ATC-Rennen ----------
  function atcDuel(duel) {
    const targets = atcTargets(duel.v);
    let st = { idx: [0, 0], misses: [0, 0], cur: starter, dart: 0 };
    const hist = [];
    const board = createBoard();
    const render = () => {
      const p = st.cur;
      const t = targets[st.idx[p]];
      board.highlight([t.key], 'blink');
      const f = frame(duel, h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'label' }, `Dart ${st.dart + 1} von 3`),
          h('div', { class: 'big medium' }, t.label),
          h('div', { class: 'board-wrap small' }, board.el)),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge fail', 'data-snd': 'none', onClick: () => dart(false) }, 'Fehlwurf'),
            h('button', { class: 'btn huge check', 'data-snd': 'none', onClick: () => dart(true) }, 'Treffer')),
          h('button', { class: 'btn ghost small', disabled: !hist.length, onClick: undo }, icon('undo'), 'Undo'))),
      { scores: st.idx.map(i => `${i}/${targets.length}`), active: p });
      app.show(f.el, { back: f.exit });
      app.setKey(e => { if (e.key === 'Enter') { e.preventDefault(); dart(true); } else if (e.key === ' ') { e.preventDefault(); dart(false); } else if (e.key === 'Backspace') { e.preventDefault(); undo(); } });
    };
    const dart = ok => {
      hist.push(JSON.stringify(st));
      const p = st.cur;
      if (ok) { st.idx[p]++; sound.play('hit'); } else { st.misses[p]++; sound.play('miss'); }
      if (st.idx[p] >= targets.length) return winnerScreen(duel, p, `${st.misses[p]} Fehlwürfe – ${players[1 - p].name} war bei Feld ${st.idx[1 - p] + 1}.`);
      st.dart++;
      if (st.dart >= 3) { st.dart = 0; st.cur = 1 - p; }
      render();
    };
    const undo = () => { const s = hist.pop(); if (s) { st = JSON.parse(s); render(); } };
    render();
  }

  // ---------- 121-Duell ----------
  function duel121(duel) {
    const games = [create121(duel.v), create121(duel.v)];
    let cur = starter, msg = '';
    const hist = [];
    const render = () => {
      const g = games[cur].st;
      const under = duel.v === 'grob' ? h('div', { class: 'tb-lives' }, lifeHearts(g.lives), h('em', {}, `${g.lives} Leben`))
        : duel.v === 'leek' ? h('div', { class: 'tb-lives lock' }, `🔒 eingeloggt: ${g.base}`) : null;
      const f = frame(duel, h('div', { class: 'game' },
        h('div', { class: 'stage s121' },
          h('div', { class: 'label' }, 'Checke'),
          h('div', { class: 'big n121' }, g.n),
          h('div', { class: 'path' }, checkoutPath(g.n)),
          h('div', { class: `flash ${msg ? '' : 'empty'}` }, msg || '\u00a0')),
        h('div', { class: 'controls' },
          buttons121(duel.v, attempt),
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn ghost small', disabled: !hist.length, onClick: undo }, icon('undo'), 'Undo'),
            h('button', { class: 'btn ghost small', onClick: end }, 'Fertig')))),
      { scores: games.map(x => x.st.highest || '–'), active: cur, under });
      app.show(f.el, { back: f.exit });
      app.setKey(e => { const map = { 1: 3, 2: 6, 3: 9, 0: 0, ' ': 0 }; if (e.key in map) { e.preventDefault(); attempt(map[e.key]); } else if (e.key === 'Backspace') { e.preventDefault(); undo(); } });
    };
    const attempt = darts => {
      hist.push(cur);
      const ev = games[cur].attempt(darts);
      sound121(ev);
      const n = players[cur].name;
      msg = ev.locked ? `🔒 ${n} loggt ${ev.locked} ein` : ev.lives ? `+${ev.lives} Leben für ${n} 💚` : ev.lifeLost ? `${n}: −1 Leben` : ev.fallback ? `${n} fällt zurück auf ${ev.fallback}` : `${n} checkt!`;
      cur = 1 - cur;
      render();
    };
    const undo = () => { const c = hist.pop(); if (c == null) return; games[c].undo(); cur = c; msg = ''; render(); };
    const end = () => {
      const [a, b] = games.map(g => g.st.highest);
      winnerScreen(duel, a === b ? null : a > b ? 0 : 1, `Höchste Zahl: ${players[0].name} ${a || '–'} · ${players[1].name} ${b || '–'}`);
    };
    render();
  }

  // ---------- Checkout-Duell ----------
  function coDuel(duel) {
    const goal = store.settings.vsChecks;
    const pool = checkablePool(store.settings.coMin, store.settings.coMax);
    let showPath = store.settings.coShowPath;
    let st = { n: pick(pool), cur: starter, turn: 0, checks: [0, 0], att: [0, 0] };
    const hist = [];
    const render = () => {
      const pathToggle = toggleSwitch(showPath, v => { showPath = v; render(); }, 'Checkout-Weg');
      const f = frame(duel, h('div', { class: 'game' },
        h('div', { class: 'stage' },
          h('div', { class: 'label' }, 'Rest · 3 Darts'),
          h('div', { class: 'big' }, st.n),
          h('div', { class: `path${showPath ? '' : ' off'}` }, checkoutPath(st.n)),
          h('div', { class: 'attempt-counter' }, `Erster zu ${goal} Checks · Versuche ${st.att[0]} : ${st.att[1]}`)),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge fail', 'data-snd': 'none', onClick: () => enter(false) }, 'Fail'),
            h('button', { class: 'btn huge check', 'data-snd': 'none', onClick: () => enter(true) }, 'Check')),
          h('div', { class: 'btn-row', style: { gridTemplateColumns: 'auto 1fr' } },
            h('label', { class: 'btn ghost small', style: { gap: '10px', fontSize: '1rem' } }, 'Weg', pathToggle),
            h('button', { class: 'btn ghost small', disabled: !hist.length, onClick: undo }, icon('undo'), 'Undo')))),
      { scores: st.checks, active: st.cur });
      app.show(f.el, { back: f.exit });
      app.setKey(e => { if (e.key === 'Enter') { e.preventDefault(); enter(true); } else if (e.key === ' ') { e.preventDefault(); enter(false); } else if (e.key === 'Backspace') { e.preventDefault(); undo(); } });
    };
    const enter = ok => {
      hist.push(JSON.stringify(st));
      const p = st.cur;
      st.att[p]++; if (ok) st.checks[p]++;
      sound.play(ok ? 'hit' : 'miss');
      st.turn++;
      if (st.turn >= 2) {
        // Runde komplett → Sieg prüfen
        const [a, b] = st.checks;
        if ((a >= goal || b >= goal) && a !== b) return winnerScreen(duel, a > b ? 0 : 1, `${players[0].name} ${a} : ${b} ${players[1].name} Checks`);
        st.turn = 0; let n; do { n = pick(pool); } while (n === st.n && pool.length > 1); st.n = n;
      }
      st.cur = 1 - p;
      render();
    };
    const undo = () => { const s = hist.pop(); if (s) { st = JSON.parse(s); render(); } };
    render();
  }

  return { start: names };
}

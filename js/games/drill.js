// „Dran bleiben Junge“ – trainiert gezielt die Schwächen aus der Statistik, auf Zeit.
import { h, icon, Countdown, fmtClock, segmented, pct } from '../ui.js';
import { sound } from '../sound.js';
import { createBoard, boardKeys, pathKeys } from '../board.js';
import { checkoutPath } from '../checkouts.js';
import { analyzeWeaknesses } from '../weakness.js';
import { store, uid } from '../store.js';

export default {
  id: 'drill',
  name: 'Dran bleiben Junge',
  short: 'Deine Schwächen aus der Statistik – gezielt auf Zeit üben.',
  tracked: true,
  info: {
    lines: [
      'Die App filtert aus allen Auswertungen deine schwächsten Felder (z. B. aus Around the Clock und Leek Survival) und Checkout-Zahlen.',
      'Auf Zeit (3/5/7 Min) bekommst du diese Ziele zufällig – schwächere öfter.',
      'Pro Ziel eine Aufnahme (3 Darts): „Geschafft“ oder „Nicht geschafft“.',
      'Die Ergebnisse fließen wieder in die Statistik ein – so wird die Liste immer besser.',
    ],
    steps: [
      { hl: ['D7'], cap: 'Schwachstelle D7', darts: [['S7', false], ['D7', true]] },
      { hl: pathKeys('T17 D8'), cap: 'Checkout 67', darts: [['T17', true], ['D8', true]] },
      { hl: ['T19'], cap: 'Triple 19', darts: [['S19', false], ['T19', true]] },
    ],
  },
  mount(root, ctx) {
    let minutes = ctx.settings.drillMin;
    const { list, fromData } = analyzeWeaknesses();
    const board = createBoard();
    let phase = 'setup', timer, current = null, log = [], history = [];

    function setup() {
      phase = 'setup';
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll stack', style: { paddingTop: '8px' } },
          h('div', { class: 'card' },
            h('h3', {}, 'Deine Baustellen'),
            h('p', { class: 'muted small-text' }, fromData ? 'Aus deiner Statistik ermittelt (niedrigste Quote zuerst).' : 'Noch zu wenig Daten – wir starten mit typischen Problemzonen. Spiel Around the Clock (ausführlich), Random Checkouts oder Leek Survival, dann wird es persönlich.'),
            h('div', { class: 'weak-list' }, list.map(w => h('div', { class: 'weak' },
              h('b', {}, w.label), h('span', {}, w.type === 'co' ? 'Checkout' : 'Feld'),
              h('div', { class: w.quote != null ? 'q' : 'small-text muted' }, w.quote != null ? `${Math.round(w.quote * 100)}%` : 'Standard'))))),
          h('div', { class: 'card' }, h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Dauer'),
            segmented([[3, '3'], [5, '5'], [7, '7 Min']], minutes, v => { minutes = v; })))),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'none', onClick: start }, 'Los geht’s'))));
    }

    function nextTarget() {
      const weights = list.map(w => (w === current && list.length > 1 ? 0 : 1.25 - (w.quote ?? 0.5)));
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
      return list[0];
    }

    let el = {};
    function start() {
      sound.play('start');
      phase = 'play'; log = []; history = [];
      current = nextTarget();
      el.clock = h('div', { class: 'label' }); el.bar = h('i');
      el.title = h('div', { class: 'label', style: { marginTop: '8px' } });
      el.target = h('div', { class: 'big medium' }); el.path = h('div', { class: 'path' });
      el.score = h('div', { class: 'attempt-counter' });
      el.undo = h('button', { class: 'btn ghost small', onClick: undo }, icon('undo'), 'Undo');
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          el.clock, h('div', { class: 'progress', style: { maxWidth: '420px' } }, el.bar),
          el.title, el.target, el.path,
          h('div', { class: 'board-wrap small' }, board.el),
          el.score),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge fail', 'data-snd': 'none', onClick: () => enter(false) }, 'Nicht geschafft'),
            h('button', { class: 'btn huge check', 'data-snd': 'none', onClick: () => enter(true) }, 'Geschafft')),
          h('div', { class: 'btn-row' }, el.undo, h('button', { class: 'btn ghost small', onClick: finish }, 'Beenden')))));
      timer = new Countdown(minutes * 60000, { onTick: paint, onEnd: finish });
      timer.start();
      paint();
    }

    function paint() {
      if (phase !== 'play') return;
      el.clock.textContent = fmtClock(timer.left);
      el.bar.style.width = `${100 - (timer.left / timer.total) * 100}%`;
      const isCo = current.type === 'co';
      el.title.textContent = isCo ? 'Checke mit 3 Darts' : 'Triff mit 3 Darts';
      el.target.textContent = current.label;
      el.path.textContent = isCo ? checkoutPath(current.key) : '';
      board.highlight(isCo ? pathKeys(checkoutPath(current.key)) : boardKeys(current.key === 'BULL' ? 'Bull' : current.key), 'blink');
      const ok = log.filter(x => x.ok).length;
      el.score.textContent = `${ok} / ${log.length} geschafft · ${pct(ok, log.length)}%`;
      el.undo.disabled = !log.length;
    }

    function enter(ok) {
      if (phase !== 'play') return;
      sound.play(ok ? 'hit' : 'miss');
      log.push({ t: current, ok }); history.push(current);
      current = nextTarget();
      paint();
    }
    function undo() { if (!log.length) return; const l = log.pop(); history.pop(); current = l.t; paint(); }

    function finish() {
      if (phase !== 'play') return;
      phase = 'result'; timer.stop(); sound.play('finish');
      // Statistik zurückschreiben
      const perNumber = {};
      for (const { t, ok } of log) {
        if (t.type === 'field') store.addFieldStat(t.key, 3, ok ? 1 : 0);
        else { const p = perNumber[t.key] || (perNumber[t.key] = [0, 0]); p[0]++; if (ok) p[1]++; }
      }
      const coA = Object.values(perNumber).reduce((a, [x]) => a + x, 0);
      if (coA) { const coC = Object.values(perNumber).reduce((a, [, y]) => a + y, 0); store.addCheckoutRun({ id: uid(), date: Date.now(), source: 'drill', attempts: coA, checks: coC, fails: coA - coC, quote: pct(coC, coA), perNumber }); }
      const ok = log.filter(x => x.ok).length;
      store.log('drillRuns', { id: uid(), date: Date.now(), attempts: log.length, ok, minutes });
      const per = {};
      for (const { t, ok: o } of log) { const p = per[t.label] || (per[t.label] = [0, 0]); p[0]++; if (o) p[1]++; }
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll' },
          h('div', { class: 'stage', style: { flex: 'none' } },
            h('div', { class: 'label' }, 'Dran geblieben!'),
            h('div', { class: 'big leek' }, `${pct(ok, log.length)}%`),
            h('div', { class: 'label' }, `${ok} von ${log.length} Aufgaben geschafft`)),
          h('div', { class: 'card' }, h('h3', {}, 'Pro Ziel'),
            h('div', { class: 'weak-list' }, Object.entries(per).map(([k, [a, c]]) => h('div', { class: 'weak' }, h('b', {}, k), h('span', {}, `${c}/${a}`), h('div', { class: c / a < .5 ? 'q' : 'small-text' }, `${pct(c, a)}%`)))))),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', onClick: () => ctx.finish({ attempts: log.length, ok, quote: pct(ok, log.length) }) }, 'Weiter'))));
    }

    ctx.onKey(e => {
      if (phase === 'setup' && e.key === 'Enter') { e.preventDefault(); start(); }
      else if (phase === 'play') {
        if (e.key === 'Enter') { e.preventDefault(); enter(true); }
        else if (e.key === ' ') { e.preventDefault(); enter(false); }
        else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
      }
    });
    ctx.leek ? start() : setup();
    return () => timer?.stop();
  },
  summary(data) {
    return { value: `${data.quote}% (${data.ok}/${data.attempts})`, note: 'Schwächen-Training', bad: null };
  },
};

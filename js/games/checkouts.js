// Random Checkouts – Double-Out, 3 Darts pro Zahl, Check/Fail.
import { h, icon, Countdown, fmtClock, segmented, stepper, toggleSwitch, rangeSlider, pct } from '../ui.js';
import { sound } from '../sound.js';
import { checkoutPath, checkablePool } from '../checkouts.js';
import { store, uid } from '../store.js';
import { pathKeys } from '../board.js';

export default {
  id: 'checkouts',
  name: 'Random Checkouts',
  short: 'Zufällige Restzahl, 3 Darts: Check oder Fail.',
  tracked: true,
  info: {
    lines: [
      'Die App zeigt eine zufällige Restzahl (Double-Out).',
      'Du hast 3 Darts. Ausgecheckt → „Check“ (Enter), sonst „Fail“ (Leertaste).',
      'Modus „Checks“: Es zählen nur geschaffte Checkouts, bis die Zielanzahl erreicht ist.',
      'Modus „Zeit“: so viele Checkouts wie möglich in der eingestellten Zeit.',
    ],
    steps: [
      { hl: pathKeys('T19 D12'), cap: '81 = T19 · D12', darts: [['T19', true], ['D12', true]] },
      { hl: pathKeys('T20 D10'), cap: '80 = T20 · D10', darts: [['S20', true], ['D20', true]] },
      { hl: ['BULL'], cap: '50 = Bull', darts: [['50', true]] },
    ],
  },
  mount(root, ctx) {
    const s = ctx.settings;
    let mode = s.coMode;
    let minutes = s.coMinutes;
    let count = s.coCount;
    let showPath = s.coShowPath;
    let rMin = s.coMin, rMax = s.coMax;
    let pool;

    let entries, current, timer, finished, startedAt;
    let phase = 'setup';
    const runIds = [];

    // ---------- Setup ----------
    function setup() {
      cleanupTimer();
      phase = 'setup';
      const slider = rangeSlider({ min: 2, max: 170, from: rMin, to: rMax, onChange: (a, b) => { rMin = a; rMax = b; } });
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll stack', style: { paddingTop: '8px' } },
          h('div', { class: 'card' },
            h('h3', {}, 'Zahlenbereich'),
            slider,
            h('button', { class: 'chip-btn', onClick: () => slider.set(20, 90) }, 'Empfohlen: 20 – 90')),
          h('div', { class: 'card' },
            h('h3', {}, 'Spielen nach'),
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Modus'),
              segmented([['count', 'Checks'], ['time', 'Zeit']], mode, v => { mode = v; setup(); })),
            mode === 'time'
              ? h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Dauer', h('small', {}, 'Minuten')),
                  stepper(minutes, { min: 1, max: 120 }, v => { minutes = v; }))
              : h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Checks benötigt', h('small', {}, 'Nur geschaffte Checkouts zählen')),
                  stepper(count, { min: 1, max: 100 }, v => { count = v; })),
            h('div', { class: 'field' }, h('div', { class: 'f-label' }, 'Checkout-Weg anzeigen', h('small', {}, 'z. B. 81 = T19 D12')),
              toggleSwitch(showPath, v => { showPath = v; }, 'Checkout-Weg anzeigen'))),
          h('p', { class: 'muted small-text', style: { textAlign: 'center', margin: '4px 0' } },
            'Double-Out · 3 Darts pro Zahl', h('br'), 'Tastatur: Enter = Check · Leertaste = Fail · Backspace = Undo')),
        h('div', { class: 'controls' }, h('button', { class: 'btn huge primary', 'data-snd': 'none', onClick: start }, 'Los geht’s'))));
    }

    function pick() {
      if (pool.length === 1) return pool[0];
      let n;
      do { n = pool[Math.floor(Math.random() * pool.length)]; } while (n === current);
      return n;
    }

    // ---------- Spiel ----------
    let el = {};
    const checksOf = () => entries.filter(e => e.ok).length;
    function start() {
      sound.play('start');
      pool = checkablePool(rMin, rMax);
      if (!pool.length) pool = checkablePool(20, 90);
      entries = []; finished = false; current = null; startedAt = Date.now(); phase = 'play';
      current = pick();
      el.number = h('div', { class: 'big' });
      el.path = h('div', { class: 'path' });
      el.progressBar = h('i');
      el.progressText = h('div', { class: 'label' });
      el.checks = h('b'); el.fails = h('b'); el.quote = h('b');
      el.attempts = h('div', { class: 'attempt-counter' });
      el.undo = h('button', { class: 'btn ghost small', onClick: undo }, icon('undo'), 'Undo');
      el.pause = mode === 'time' ? h('button', { class: 'btn ghost small', onClick: togglePause }, 'Pause') : null;
      const pathToggle = toggleSwitch(showPath, v => { showPath = v; paint(); }, 'Checkout-Weg anzeigen');

      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'stage' },
          el.progressText,
          h('div', { class: 'progress', style: { maxWidth: '420px' } }, el.progressBar),
          h('div', { class: 'label', style: { marginTop: '14px' } }, 'Rest'),
          el.number,
          el.path,
          h('div', { class: 'statline', style: { marginTop: '8px' } },
            h('div', { class: 'stat green' }, el.checks, h('span', {}, 'Checks')),
            h('div', { class: 'stat red' }, el.fails, h('span', {}, 'Fails')),
            h('div', { class: 'stat' }, el.quote, h('span', {}, 'Quote'))),
          el.attempts),
        h('div', { class: 'controls' },
          h('div', { class: 'btn-row' },
            h('button', { class: 'btn huge fail stacked', 'data-snd': 'none', onClick: () => enter(false) }, 'Fail', h('small', { class: 'btn-sub' }, 'Leertaste')),
            h('button', { class: 'btn huge check stacked', 'data-snd': 'none', onClick: () => enter(true) }, 'Check', h('small', { class: 'btn-sub' }, 'Enter'))),
          h('div', { class: 'btn-row', style: { gridTemplateColumns: el.pause ? 'auto 1fr 1fr' : 'auto 1fr' } },
            h('label', { class: 'btn ghost small', style: { gap: '10px', fontSize: '1rem' } }, 'Weg', pathToggle),
            el.undo, el.pause))));

      if (mode === 'time') {
        timer = new Countdown(minutes * 60000, { onTick: () => paint(), onEnd: () => finish() });
        timer.start();
      }
      paint();
    }

    function paint() {
      if (finished || !el.number) return;
      const checks = checksOf();
      const fails = entries.length - checks;
      el.number.textContent = current;
      el.path.textContent = checkoutPath(current);
      el.path.classList.toggle('off', !showPath);
      el.checks.textContent = checks; el.fails.textContent = fails;
      el.quote.textContent = `${pct(checks, entries.length)}%`;
      el.attempts.textContent = `Versuche: ${entries.length}`;
      el.undo.disabled = !entries.length;
      if (mode === 'time') {
        el.progressText.textContent = `${fmtClock(timer.left)}${timer.running ? '' : ' · Pausiert'}`;
        el.progressBar.style.width = `${100 - (timer.left / timer.total) * 100}%`;
        el.number.classList.toggle('paused', !timer.running);
      } else {
        el.progressText.textContent = `Checks ${checks} / ${count}`;
        el.progressBar.style.width = `${(checks / count) * 100}%`;
      }
    }

    function enter(ok) {
      if (finished) return;
      if (timer && !timer.running) timer.start();
      entries.push({ n: current, ok });
      if (mode === 'count' && checksOf() >= count) { sound.play('finish'); return finish(); }
      sound.play(ok ? 'hit' : 'miss');
      current = pick();
      paint();
    }
    function undo() {
      if (!entries.length || finished) return;
      const last = entries.pop();
      current = last.n;
      paint();
    }
    function togglePause() {
      timer.toggle();
      el.pause.textContent = timer.running ? 'Pause' : 'Weiter';
      paint();
    }
    function cleanupTimer() { timer?.stop(); timer = null; }

    // ---------- Ergebnis ----------
    function finish() {
      finished = true; phase = 'result';
      cleanupTimer();
      const checks = checksOf();
      const perNumber = {};
      for (const e of entries) {
        const p = perNumber[e.n] || (perNumber[e.n] = [0, 0]);
        p[0]++; if (e.ok) p[1]++;
      }
      const run = {
        id: uid(), date: Date.now(), mode, setting: mode === 'time' ? minutes : count, range: [rMin, rMax],
        attempts: entries.length, checks, fails: entries.length - checks,
        quote: pct(checks, entries.length), perNumber, durationMs: Date.now() - startedAt,
      };
      if (run.attempts) { store.addCheckoutRun(run); runIds.push(run.id); }
      showResult(run);
    }

    function showResult(run) {
      const below = run.quote < s.readyQuote;
      const nums = Object.entries(run.perNumber).sort((a, b) => a[0] - b[0]);
      root.replaceChildren(h('div', { class: 'game' },
        h('div', { class: 'scroll' },
          h('div', { class: 'stage', style: { flex: 'none', padding: '8px 0 16px' } },
            h('div', { class: 'label' }, mode === 'time' ? 'Zeit abgelaufen' : `${run.checks} Checks geschafft`),
            h('div', { class: `big${below ? '' : ' leek'}` }, `${run.quote}%`),
            h('div', { class: 'label' }, 'Checkout-Quote'),
            h('div', { class: 'statline', style: { marginTop: '10px' } },
              h('div', { class: 'stat' }, h('b', {}, run.attempts), h('span', {}, 'Versuche')),
              h('div', { class: 'stat green' }, h('b', {}, run.checks), h('span', {}, 'Checks')),
              h('div', { class: 'stat red' }, h('b', {}, run.fails), h('span', {}, 'Fails')))),
          h('div', { class: 'btn-row', style: { marginBottom: '14px' } },
            h('button', { class: 'btn huge ghost', onClick: setup }, 'Nochmal'),
            h('button', { class: 'btn huge primary', onClick: () => ctx.finish(lastResult()) }, 'Weiter')),
          nums.length ? h('div', { class: 'card' }, h('h3', {}, 'Pro Zahl'),
            h('div', { class: 'weak-list' }, nums.map(([n, [a, c]]) =>
              h('div', { class: `weak ${c === a ? 'good' : c === 0 ? 'bad' : 'mixed'}` }, h('b', {}, n), h('span', {}, `${c}/${a}`), h('div', { class: 'small-text' }, `${pct(c, a)}%`))))) : null)));
    }

    // Mehrere Durchgänge („Nochmal“) werden zusammengefasst
    function lastResult() {
      const all = store.checkoutRuns.filter(r => runIds.includes(r.id));
      const attempts = all.reduce((a, r) => a + r.attempts, 0);
      const checks = all.reduce((a, r) => a + r.checks, 0);
      return { attempts, checks, fails: attempts - checks, quote: pct(checks, attempts), runIds: [...runIds] };
    }

    ctx.onKey(e => {
      if (phase === 'setup') { if (e.key === 'Enter') { e.preventDefault(); start(); } return; }
      if (phase === 'result') { if (e.key === 'Enter') { e.preventDefault(); ctx.finish(lastResult()); } return; }
      if (e.key === 'Enter') { e.preventDefault(); enter(true); }
      else if (e.key === ' ') { e.preventDefault(); enter(false); }
      else if (e.key === 'Backspace' || (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === 'p' && timer) togglePause();
    });

    (ctx.leek || ctx.autoStart) ? start() : setup();
    return () => cleanupTimer();
  },
  summary(data, settings) {
    if (!data.attempts) return { value: 'keine Würfe', bad: null };
    return { value: `${data.quote}% (${data.checks}/${data.attempts})`, note: `${data.checks} Checks · ${data.fails} Fails`, bad: data.quote < settings.readyQuote, badTag: `< ${settings.readyQuote}%`, okTag: `≥ ${settings.readyQuote}%` };
  },
};

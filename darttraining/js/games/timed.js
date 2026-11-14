// Baustein für reine Timer-Spiele (Warm-up, 20-Switch).
import { h, Countdown, fmtClock, segmented } from '../ui.js';
import { sound } from '../sound.js';

export function timedGame({ id, name, short, settingKey, title, renderHint, info }) {
  return {
    id, name, short, info, tracked: false,
    mount(root, ctx) {
      let minutes = ctx.settings[settingKey];
      let started = false;
      let ended = false;

      const clock = h('div', { class: 'big timer' }, fmtClock(minutes * 60000));
      const status = h('div', { class: 'label' }, title);
      const chooser = h('div', { class: 'chooser' }, segmented([[3, '3 Min'], [5, '5 Min']], minutes, v => {
        minutes = v; timer = makeTimer(); clock.textContent = fmtClock(minutes * 60000);
      }));
      const mainBtn = h('button', { class: 'btn huge primary', 'data-snd': 'none', onClick: () => main() }, 'Start');
      const nextBtn = h('button', { class: 'btn ghost', onClick: () => ctx.finish({ minutes, completed: ended }) }, 'Überspringen');

      const makeTimer = () => new Countdown(minutes * 60000, {
        onTick: left => { clock.textContent = fmtClock(left); clock.classList.toggle('last', left <= 60000 && left > 0); },
        onEnd: () => {
          ended = true;
          status.textContent = 'Zeit um!';
          clock.classList.remove('paused', 'last');
          clock.classList.add('leek');
          mainBtn.textContent = 'Weiter';
          mainBtn.className = 'btn huge primary';
          nextBtn.hidden = true;
        },
      });
      let timer = makeTimer();
      if (ctx.leek) chooser.style.visibility = 'hidden';

      function main() {
        if (ended) { sound.play('tap'); return ctx.finish({ minutes, completed: true }); }
        if (!started) {
          sound.play('start');
          started = true; chooser.style.visibility = 'hidden'; nextBtn.textContent = 'Beenden & weiter';
          timer.start(); mainBtn.textContent = 'Pause'; mainBtn.className = 'btn huge ghost';
          return;
        }
        sound.play('tap');
        timer.toggle();
        clock.classList.toggle('paused', !timer.running);
        status.textContent = timer.running ? title : 'Pausiert';
        mainBtn.textContent = timer.running ? 'Pause' : 'Fortsetzen';
        mainBtn.className = `btn huge ${timer.running ? 'ghost' : 'primary'}`;
      }

      ctx.onKey(e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); main(); }
      });

      root.append(h('div', { class: 'game' },
        h('div', { class: 'stage' }, status, clock, renderHint(), chooser),
        h('div', { class: 'controls' }, mainBtn, nextBtn)));

      return () => timer.stop();
    },
    summary() {
      return { value: 'absolviert ✓', bad: null };
    },
  };
}

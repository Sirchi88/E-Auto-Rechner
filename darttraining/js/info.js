// „i“-Erklärung: kurzer Text + animierte Dartscheibe.
// game.info = { lines: [string], steps: [{ hl: [keys], darts: [[key, ok]], cap: string }] }
import { h } from './ui.js';
import { createBoard } from './board.js';

export function showInfo(game) {
  const info = game.info || { lines: [game.short], steps: [] };
  const board = createBoard({ className: 'info-board' });
  const cap = h('div', { class: 'info-cap' });
  const dots = h('div', { class: 'info-dots' }, info.steps.map(() => h('span')));
  let i = 0, timers = [];

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function step() {
    clearTimers();
    if (!info.steps.length) return;
    const s = info.steps[i % info.steps.length];
    board.highlight(s.hl || [], 'blink');
    cap.textContent = s.cap || '';
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i % info.steps.length));
    (s.darts || []).forEach(([key, ok], k) => timers.push(setTimeout(() => board.dart(key, ok), 450 + k * 420)));
    timers.push(setTimeout(() => { i++; step(); }, Math.max(2300, 900 + (s.darts?.length || 0) * 420 + 900)));
  }

  const root = document.getElementById('modal-root');
  const close = () => { clearTimers(); back.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); close(); } };
  const back = h('div', { class: 'modal-back', onClick: e => { if (e.target === back) close(); } },
    h('div', { class: 'modal info-modal', role: 'dialog', 'aria-modal': 'true' },
      h('h3', {}, game.name),
      h('div', { class: 'info-stage' }, board.el, cap, dots),
      h('ul', { class: 'info-lines' }, info.lines.map(l => h('li', {}, l))),
      h('button', { class: 'btn primary', onClick: close }, 'Verstanden')));
  root.append(back);
  document.addEventListener('keydown', onKey, true);
  step();
}

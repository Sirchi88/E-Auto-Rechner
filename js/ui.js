// Kleine UI-Helfer ohne Framework.
import { sound } from './sound.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const svg = (path, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
export const ICONS = {
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  up: svg('<path d="M18 15l-6-6-6 6"/>'),
  down: svg('<path d="M6 9l6 6 6-6"/>'),
  grip: svg('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 'stroke-width="3.2"'),
  info: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/>', 'stroke-width="2.4"'),
  sliders: svg('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  dart: svg('<path d="M3 21l7.5-7.5"/><path d="M14 4l6 6-4.5 1.5L12.5 8.5 14 4z"/><path d="M10.5 13.5l2-5 3 3-5 2z"/><path d="M3 21l2.5-1 .5-2-2 .5z"/>'),
  heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  play: svg('<path d="M6 4l14 8-14 8z"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  target: `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#D7262B"/><circle cx="50" cy="50" r="36" fill="#F3EEDC"/><circle cx="50" cy="50" r="24" fill="#D7262B"/><circle cx="50" cy="50" r="12" fill="#F3EEDC"/></svg>`,
};
export const icon = name => h('span', { html: ICONS[name], style: { display: 'contents' } });

export function iconBtn(name, label, onClick) {
  return h('button', { class: 'icon-btn', 'aria-label': label, title: label, onClick, html: ICONS[name] });
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60), sec = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return m ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`;
}
export function fmtDate(ts, withTime = true) {
  const d = new Date(ts);
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return withTime ? `${date}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : date;
}
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function confirmDialog({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    const close = v => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
    };
    const okBtn = h('button', { class: `btn ${danger ? 'fail' : 'primary'}`, onClick: () => close(true) }, ok);
    const back = h('div', { class: 'modal-back', onClick: e => { if (e.target === back) close(false); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h3', {}, title),
        text ? h('p', {}, text) : null,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onClick: () => close(false) }, cancel), okBtn)));
    root.append(back);
    document.addEventListener('keydown', onKey, true);
    okBtn.focus();
  });
}

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

// Präziser Countdown mit Pause. Spielt leisen Ton zu Beginn der letzten Minute und am Ende.
export class Countdown {
  constructor(ms, { onTick, onEnd, sounds = true } = {}) {
    this.total = ms; this.left = ms; this.running = false;
    this.onTick = onTick; this.onEnd = onEnd; this.iv = null;
    this.sounds = sounds; this.warned = ms <= 60000;
  }
  start() {
    if (this.running || this.left <= 0) return;
    this.running = true; this.last = performance.now();
    this.iv = setInterval(() => this._tick(), 200);
    this.onTick?.(this.left);
  }
  pause() { if (!this.running) return; this._tick(); this.running = false; clearInterval(this.iv); this.onTick?.(this.left); }
  toggle() { this.running ? this.pause() : this.start(); }
  stop() { this.running = false; clearInterval(this.iv); }
  _tick() {
    const now = performance.now();
    this.left -= now - this.last; this.last = now;
    if (!this.warned && this.left <= 60000) { this.warned = true; if (this.sounds) sound.play('lastMinute'); }
    if (this.left <= 0) { this.left = 0; this.stop(); if (this.sounds) sound.play('end'); this.onTick?.(0); this.onEnd?.(); return; }
    this.onTick?.(this.left);
  }
}

// Einfache Segmented-Control
export function segmented(options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const render = () => {
    wrap.replaceChildren(...options.map(([v, label]) =>
      h('button', { class: v === value ? 'on' : '', 'aria-pressed': String(v === value), onClick: () => { value = v; render(); onChange(v); } }, label)));
  };
  render();
  return wrap;
}

export function stepper(value, { min, max, step = 1 }, onChange) {
  const input = h('input', { type: 'number', inputmode: 'numeric', min, max, step, value });
  const set = v => {
    v = Math.min(max, Math.max(min, Math.round(Number(v) || min)));
    input.value = v; onChange(v);
  };
  input.addEventListener('change', () => set(input.value));
  return h('div', { class: 'stepper' },
    h('button', { 'aria-label': 'weniger', onClick: () => set(Number(input.value) - step) }, '−'),
    input,
    h('button', { 'aria-label': 'mehr', onClick: () => set(Number(input.value) + step) }, '+'));
}

export function toggleSwitch(on, onChange, label) {
  const b = h('button', { class: `toggle${on ? ' on' : ''}`, role: 'switch', 'aria-checked': String(on), 'aria-label': label });
  b.addEventListener('click', () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); onChange(on); });
  return b;
}

export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Liste mit Haken + Reihenfolge (Pfeile & Drag am Griff)
export function orderEditor(getOrder, setOrder, nameOf) {
  const list = h('div', { class: 'order-list' });
  const move = (arr, from, to) => { const a = arr.map(x => ({ ...x })); const [it] = a.splice(from, 1); a.splice(Math.max(0, Math.min(a.length, to)), 0, it); return a; };
  const save = order => { setOrder(order); paint(); };
  function paint() {
    const order = getOrder();
    list.replaceChildren(...order.map((o, i) => {
      const handle = h('span', { class: 'handle', html: ICONS.grip, 'aria-hidden': 'true' });
      const item = h('div', { class: `order-item${o.on ? '' : ' off'}` },
        handle,
        h('button', { class: `chk${o.on ? ' on' : ''}`, role: 'checkbox', 'aria-checked': String(o.on), 'aria-label': nameOf(o.id), html: o.on ? ICONS.check : '',
          onClick: () => save(order.map((x, k) => k === i ? { ...x, on: !x.on } : x)) }),
        h('span', { class: 'name' }, nameOf(o.id)),
        h('span', { class: 'arrows' },
          h('button', { 'aria-label': 'nach oben', disabled: i === 0, html: ICONS.up, onClick: () => save(move(order, i, i - 1)) }),
          h('button', { 'aria-label': 'nach unten', disabled: i === order.length - 1, html: ICONS.down, onClick: () => save(move(order, i, i + 1)) })));
      handle.addEventListener('pointerdown', e => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const rects = [...list.children].map(el => el.getBoundingClientRect());
        const startY = e.clientY; let to = i;
        item.classList.add('dragging');
        const onMove = ev => {
          const dy = ev.clientY - startY;
          item.style.transform = `translateY(${dy}px)`;
          const mid = rects[i].top + rects[i].height / 2 + dy;
          to = rects.findIndex(r => mid < r.bottom); if (to === -1) to = rects.length - 1;
        };
        const onUp = () => {
          handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onUp);
          item.classList.remove('dragging'); item.style.transform = '';
          if (to !== i) save(move(getOrder(), i, to));
        };
        handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onUp);
      });
      return item;
    }));
  }
  paint();
  list.repaint = paint;
  return list;
}

// Doppel-Schieberegler (min/max)
export function rangeSlider({ min, max, from, to, onChange }) {
  const lo = h('input', { type: 'range', min, max, value: from, 'aria-label': 'von' });
  const hi = h('input', { type: 'range', min, max, value: to, 'aria-label': 'bis' });
  const fill = h('i', { class: 'rs-fill' });
  const out = h('div', { class: 'rs-out' });
  const update = src => {
    let a = Number(lo.value), b = Number(hi.value);
    if (a > b) { if (src === lo) { b = a; hi.value = b; } else { a = b; lo.value = a; } }
    fill.style.left = `${((a - min) / (max - min)) * 100}%`;
    fill.style.right = `${100 - ((b - min) / (max - min)) * 100}%`;
    out.textContent = `${a} – ${b}`;
    onChange(a, b);
  };
  lo.addEventListener('input', () => update(lo));
  hi.addEventListener('input', () => update(hi));
  const wrap = h('div', { class: 'rs' }, out, h('div', { class: 'rs-track' }, fill, lo, hi),
    h('div', { class: 'rs-scale' }, [min, 40, 80, 120, max].map(v => h('span', { style: { left: `${((v - min) / (max - min)) * 100}%` } }, v))));
  wrap.set = (a, b) => { lo.value = a; hi.value = b; update(lo); };
  queueMicrotask(() => update(lo));
  return wrap;
}

// Zufallsauswahl
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

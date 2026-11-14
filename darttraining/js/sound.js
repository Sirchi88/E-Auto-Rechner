// Kurze, synthetische Töne (Web Audio API) – keine Audiodateien nötig, offline-fähig.
// Im Admin-Bereich abschaltbar (settings.sound).
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Ein einzelner Ton: f = Frequenz, d = Dauer (s), t = Startversatz (s)
function tone(f, d, { t = 0, type = 'sine', vol = 0.18, slide = null } = {}) {
  const a = ac(); if (!a) return;
  const now = a.currentTime + t;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, now);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, now + d);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g).connect(a.destination);
  o.start(now); o.stop(now + d + 0.02);
}

const SOUNDS = {
  tap:        () => tone(720, 0.05, { vol: 0.08 }),
  start:      () => { tone(523, 0.08, { vol: 0.14 }); tone(784, 0.12, { t: 0.07, vol: 0.14 }); },
  hit:        () => { tone(880, 0.07, { vol: 0.15, type: 'triangle' }); tone(1319, 0.13, { t: 0.06, vol: 0.13, type: 'triangle' }); },
  miss:       () => tone(260, 0.16, { vol: 0.14, type: 'triangle', slide: 170 }),
  finish:     () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, { t: i * 0.07, vol: 0.13, type: 'triangle' })),
  lastMinute: () => tone(1000, 0.06, { vol: 0.05 }),
  end:        () => { tone(988, 0.16, { vol: 0.16 }); tone(659, 0.28, { t: 0.15, vol: 0.16 }); },
  lifeLost:   () => { tone(330, 0.12, { vol: 0.15, type: 'square', slide: 300 }); tone(220, 0.22, { t: 0.11, vol: 0.13, type: 'square', slide: 160 }); },
  lifeGain:   () => { tone(660, 0.07, { vol: 0.13 }); tone(990, 0.07, { t: 0.07, vol: 0.13 }); tone(1320, 0.12, { t: 0.14, vol: 0.12 }); },
  record:     () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.3 : 0.1, { t: i * 0.09, vol: 0.14, type: 'triangle' })),
  lock:       () => { tone(1200, 0.04, { vol: 0.12, type: 'square' }); tone(1600, 0.08, { t: 0.05, vol: 0.1, type: 'square' }); },
};

export const sound = {
  setEnabled(v) { enabled = !!v; },
  play(name) {
    if (!enabled || !SOUNDS[name]) return;
    try { SOUNDS[name](); } catch { /* ignorieren */ }
  },
};

// Globaler Klick-Ton für Buttons: data-snd="name" | "none"; Standard: .btn → tap
document.addEventListener('click', e => {
  const b = e.target.closest?.('button');
  if (!b || b.disabled) return;
  const s = b.dataset.snd;
  if (s === 'none') return;
  if (s) sound.play(s);
  else if (b.classList.contains('btn') || b.classList.contains('mode-card') || b.classList.contains('pick')) sound.play('tap');
}, true);

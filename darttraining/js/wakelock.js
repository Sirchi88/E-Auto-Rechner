// Bildschirm während des Trainings anlassen (Screen Wake Lock API).
let sentinel = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch { sentinel = null; }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });

export const wakeLock = {
  on() { wanted = true; acquire(); },
  async off() {
    wanted = false;
    try { await sentinel?.release(); } catch { /* egal */ }
    sentinel = null;
  },
};

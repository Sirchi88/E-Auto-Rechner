import { h, iconBtn, ICONS, confirmDialog } from './ui.js';
import { store, uid } from './store.js';
import { GAMES, GAME_IDS, gameById } from './games/registry.js';
import { wakeLock } from './wakelock.js';
import { renderHistory } from './screens/history.js';
import { renderAdmin } from './screens/admin.js';
import { renderSummary } from './screens/summary.js';

store.init(GAME_IDS);

const app = document.getElementById('app');
let cleanup = null;          // Aufräumfunktion des aktuellen Screens
let keyHandler = null;       // Tastatur-Handler des aktiven Spiels
let backAction = null;       // Was „Zurück“ (Android/Browser) tun soll
let session = null;          // laufende Trainings-Session

function show(screenEl, { back = null } = {}) {
  cleanup?.(); cleanup = null; keyHandler = null;
  backAction = back;
  app.replaceChildren(screenEl);
  window.scrollTo(0, 0);
  if (back && !history.state?.inner) history.pushState({ inner: true }, '');
}

window.addEventListener('popstate', () => {
  if (!backAction) return;
  const fn = backAction;
  history.pushState({ inner: true }, '');
  fn();
});

document.addEventListener('keydown', e => {
  if (!keyHandler || e.repeat) return;
  if (document.querySelector('.modal-back')) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  // Fokus auf Buttons: Leertaste/Enter sollen nicht den fokussierten Button auslösen
  if ((e.key === ' ' || e.key === 'Enter') && tag === 'BUTTON') e.target.blur();
  keyHandler(e);
});

// ---------------- Home ----------------
export function goHome() {
  if (session) endSession();
  const enabled = store.settings.leekOrder.filter(o => o.on).map(o => gameById(o.id));
  show(h('section', { class: 'screen' },
    h('header', { class: 'home-head' },
      h('img', { src: 'icons/logo.webp', alt: 'DartsOfALeek Logo', width: 64, height: 64 }),
      h('h1', {}, 'Darttraining', h('small', {}, 'mit The Leek')),
      h('div', { class: 'home-actions' },
        iconBtn('stats', 'Statistik', () => goHistory()),
        iconBtn('gear', 'Einstellungen', () => goAdmin()))),
    h('div', { class: 'mode-cards' },
      h('button', { class: 'mode-card primary', onClick: () => startLeek(), disabled: !enabled.length },
        h('span', { class: 'badge', html: ICONS.target }),
        h('span', { class: 'title' }, 'TheLeek Mode'),
        h('span', { class: 'desc' }, enabled.length ? 'Festes Programm – alle Spiele laufen automatisch nacheinander.' : 'Keine Spiele aktiviert – im Admin-Bereich auswählen.'),
        h('span', { class: 'chips' }, enabled.map((g, i) => h('span', { class: 'chip' }, `${i + 1}. ${g.name}`)))),
      h('button', { class: 'mode-card', onClick: () => startCustom() },
        h('span', { class: 'title' }, 'Training anpassen'),
        h('span', { class: 'desc' }, 'Spiele einzeln auswählen und starten.'),
        h('span', { class: 'chips' }, GAMES.map(g => h('span', { class: 'chip' }, g.name))))),
    h('p', { class: 'resume-hint' }, 'Konzentriert aufwärmen – dann ab ins Match. 🎯')));
}

// ---------------- Session ----------------
function newSession(mode) {
  session = { id: uid(), mode, start: Date.now(), end: null, results: [], queue: [], pos: 0 };
  wakeLock.on();
}
function endSession() {
  session = null;
  wakeLock.off();
}
function saveSession() {
  if (!session || !session.results.length) return;
  session.end = Date.now();
  const { queue, pos, ...rest } = session;
  store.upsertSession(rest);
}

function startLeek() {
  newSession('leek');
  session.queue = store.settings.leekOrder.filter(o => o.on).map(o => o.id);
  session.pos = 0;
  runGame(session.queue[0]);
}

function startCustom() {
  newSession('custom');
  goPicker();
}

function goPicker() {
  const played = new Set(session.results.map(r => r.gameId));
  show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' },
      iconBtn('back', 'Zurück', () => leaveSession()),
      h('h2', {}, 'Training anpassen', h('span', { class: 'sub' }, 'Spiel antippen zum Starten'))),
    h('div', { class: 'scroll' },
      h('div', { class: 'pick-list' }, GAMES.map((g, i) =>
        h('button', { class: 'pick', onClick: () => runGame(g.id) },
          h('span', { class: 'num' }, i + 1),
          h('span', { class: 'txt' }, h('b', {}, g.name), h('span', {}, g.short)),
          played.has(g.id) ? h('span', { class: 'done-mark' }, '✓') : null)))),
    session.results.length
      ? h('div', { class: 'controls' }, h('button', { class: 'btn primary', onClick: () => goSummary() }, 'Training beenden & Auswertung'))
      : null),
  { back: () => leaveSession() });
}

async function leaveSession() {
  if (session?.results.length) {
    const ok = await confirmDialog({ title: 'Training beenden?', text: 'Deine bisherigen Ergebnisse werden ausgewertet und gespeichert.', ok: 'Auswertung' , cancel: 'Weiterspielen' });
    if (ok) goSummary();
  } else {
    goHome();
  }
}

function runGame(gameId, { autoStart = false, returnTo = null } = {}) {
  const game = gameById(gameId);
  const startedAt = Date.now();
  const root = h('div', { class: 'game' });
  const isLeek = session.mode === 'leek' && !returnTo;
  const sub = isLeek ? `TheLeek Mode · Spiel ${session.pos + 1} von ${session.queue.length}` : (returnTo === 'summary' ? 'Zusatzrunde' : 'Training anpassen');

  const exit = async () => {
    const ok = await confirmDialog({
      title: 'Spiel abbrechen?',
      text: isLeek ? 'Das Training wird beendet, bisherige Ergebnisse werden ausgewertet.' : 'Dieses Spiel wird nicht gewertet.',
      ok: isLeek ? 'Training beenden' : 'Abbrechen', cancel: 'Weiterspielen', danger: true,
    });
    if (!ok) return;
    if (returnTo === 'summary') goSummary();
    else if (session.mode === 'custom') goPicker();
    else if (session.results.length) goSummary();
    else goHome();
  };

  show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('h2', {}, game.name, h('span', { class: 'sub' }, sub)),
      iconBtn('close', 'Spiel verlassen', exit)),
    root),
  { back: exit });

  const ctx = {
    settings: store.settings,
    autoStart,
    onKey: fn => { keyHandler = fn; },
    finish: data => {
      session.results.push({ gameId, durationMs: Date.now() - startedAt, at: Date.now(), data });
      saveSession();
      if (returnTo === 'summary') return goSummary();
      if (session.mode === 'leek') {
        session.pos++;
        if (session.pos < session.queue.length) runGame(session.queue[session.pos]);
        else goSummary();
      } else {
        goPicker();
      }
    },
  };
  cleanup = game.mount(root, ctx) || null;
}

function goSummary() {
  if (!session?.results.length) return goHome();
  saveSession();
  const s = session;
  show(renderSummary(s, {
    onAddCheckouts: () => runGame('checkouts', { autoStart: true, returnTo: 'summary' }),
    onDone: () => goHome(),
    onHistory: () => { endSession(); goHistory(); },
  }), { back: () => goHome() });
}

function goHistory() {
  show(renderHistory({ onBack: () => goHome() }), { back: () => goHome() });
}

function goAdmin() {
  show(renderAdmin({ onBack: () => goHome() }), { back: () => goHome() });
}

// ---------------- Start ----------------
goHome();
const splash = document.getElementById('splash');
setTimeout(() => {
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 700);
}, 2000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

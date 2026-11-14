import { h, iconBtn, ICONS, confirmDialog, toast, gameTile } from './ui.js';
import { store, uid } from './store.js';
import { GAMES, GAME_IDS, gameById } from './games/registry.js';
import { wakeLock } from './wakelock.js';
import { sound } from './sound.js';
import { showInfo } from './info.js';
import { renderHistory } from './screens/history.js';
import { renderAdmin } from './screens/admin.js';
import { renderSummary, readiness } from './screens/summary.js';
import { versusFlow } from './screens/versus.js';
import { customFlow, programPreview } from './screens/custom.js';
import { checkBadges } from './badges.js';
import { streak } from './calendar.js';

store.init(GAME_IDS);
sound.setEnabled(store.settings.sound);

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
  if (!backAction || document.querySelector('.modal-back')) {
    document.querySelector('.modal-back')?.click();
    if (backAction) history.pushState({ inner: true }, '');
    return;
  }
  const fn = backAction;
  history.pushState({ inner: true }, '');
  fn();
});

document.addEventListener('keydown', e => {
  if (!keyHandler || e.repeat) return;
  if (document.querySelector('.modal-back')) return;
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  // Leertaste/Enter sollen nicht zusätzlich den fokussierten Button auslösen
  if ((e.key === ' ' || e.key === 'Enter') && tag === 'BUTTON') e.target.blur();
  keyHandler(e);
});

const appApi = () => ({ show, setKey: fn => { keyHandler = fn; }, home: goHome, startProgram });

// ---------------- Home ----------------
export function goHome() {
  if (session) endSession();
  setTimeout(checkBadges, 500);
  const s = store.settings;
  const st = streak();
  const tile = (cls, art, title, desc, onClick, snd) => h('button', { class: `mode-card ${cls}`, onClick, 'data-snd': snd || null },
    art, h('span', { class: 'title' }, title), h('span', { class: 'desc' }, desc));
  show(h('section', { class: 'screen' },
    h('header', { class: 'home-head' },
      h('img', { src: 'icons/logo.webp', alt: 'DartsOfALeek Logo', width: 72, height: 72 }),
      h('h1', {}, 'Darttraining', h('small', {}, 'mit The Leek')),
      h('div', { class: 'home-actions' },
        iconBtn('stats', 'Statistik', () => goHistory()),
        iconBtn('gear', 'Einstellungen', () => goAdmin()))),
    s.streakHome && st.days ? h('button', { class: 'streak-chip', onClick: () => goHistory() }, `🔥 ${st.days} Tag${st.days === 1 ? '' : 'e'} in Folge${st.today ? '' : ' – heute noch trainieren!'}`) : null,
    h('div', { class: 'mode-cards' },
      tile('', h('img', { class: 'tile-art', src: 'icons/mascot.webp', alt: '' }), 'TheLeek Trainingsprogramm', 'Festes Programm – läuft automatisch durch.', () => leekPreview()),
      tile('', h('span', { class: 'tile-art svg', html: ICONS.sliders }), 'Individuelles Trainingsprogramm', s.plans.length ? `${s.plans.length} gespeicherte${s.plans.length === 1 ? 'r Plan' : ' Pläne'}` : 'Eigenen Plan bauen und speichern.', () => customFlow(appApi()).start()),
      tile('', h('span', { class: 'tile-art svg', html: ICONS.targetLine }), 'Einzeltraining', 'Wenn’s auch mal nur eins sein darf.', () => goSingles()),
      s.versus ? tile('', h('img', { class: 'tile-art duel', src: 'icons/duel.webp', alt: '' }), '1vs1', 'Duell auf einem Gerät.', () => versusFlow(appApi()).start()) : null),
    h('p', { class: 'resume-hint' }, 'Konzentriert aufwärmen – dann ab ins Match. 🎯')));
}

function leekPreview() {
  const games = store.settings.leekOrder.filter(o => o.on).map(o => o.id);
  if (!games.length) return toast('Keine Spiele aktiviert – im Admin-Bereich auswählen');
  programPreview(appApi(), {
    title: 'TheLeek Trainingsprogramm', sub: 'Festes Programm · Reihenfolge im Admin änderbar', games,
    params: { ...store.settings, ...LEEK_PARAMS }, back: goHome,
    onStart: () => startProgram('leek', games, LEEK_PARAMS, 'TheLeek Trainingsprogramm'),
  });
}
// Fixe Werte im TheLeek Programm
const LEEK_PARAMS = { switchMin: 3 };

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

function startProgram(kind, queue, params = {}, name = '') {
  if (!queue.length) return toast('Keine Spiele ausgewählt');
  newSession(kind);
  session.queue = queue;
  session.params = params;
  session.name = name;
  session.pos = 0;
  runGame(queue[0]);
}

// ---------------- Einzeltraining ----------------
function goSingles() {
  show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', goHome), h('h2', {}, 'Einzeltraining', h('span', { class: 'sub' }, 'Wenn’s auch mal nur eins sein darf.'))),
    h('div', { class: 'scroll' },
      h('div', { class: 'tile-grid' }, GAMES.map(g => gameTile({
        glyph: g.glyph, title: g.name, desc: g.tile,
        onClick: () => { newSession('single'); runGame(g.id); },
      }))))),
  { back: goHome });
}

async function leaveSession() {
  if (session?.results.length) {
    const ok = await confirmDialog({ title: 'Training beenden?', text: 'Deine bisherigen Ergebnisse werden ausgewertet und gespeichert.', ok: 'Auswertung', cancel: 'Weiterspielen' });
    if (ok) goSummary();
  } else {
    goHome();
  }
}

function runGame(gameId, { autoStart = false, returnTo = null } = {}) {
  const game = gameById(gameId);
  const startedAt = Date.now();
  const root = h('div', { class: 'game' });
  const inProgram = (session.mode === 'leek' || session.mode === 'custom') && !returnTo;
  const sub = inProgram
    ? `${session.mode === 'leek' ? 'TheLeek' : session.name || 'Individuell'} · Spiel ${session.pos + 1} von ${session.queue.length}`
    : returnTo === 'summary' ? 'Zusatzrunde' : 'Einzeltraining';

  const exit = async () => {
    const ok = await confirmDialog({
      title: 'Spiel abbrechen?',
      text: inProgram ? 'Das Training wird beendet, bisherige Ergebnisse werden ausgewertet.' : 'Dieses Spiel wird nicht gewertet.',
      ok: inProgram ? 'Training beenden' : 'Abbrechen', cancel: 'Weiterspielen', danger: true,
    });
    if (!ok) return;
    if (returnTo === 'summary') goSummary();
    else if (session.mode === 'single') { endSession(); goSingles(); }
    else if (session.results.length) goSummary();
    else goHome();
  };

  show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn info-btn', 'aria-label': 'Spielerklärung', title: 'So geht’s', html: ICONS.info, onClick: () => showInfo(game) }),
      h('h2', {}, game.name, h('span', { class: 'sub' }, sub)),
      iconBtn('close', 'Spiel verlassen', exit)),
    root),
  { back: exit });

  const ctx = {
    settings: inProgram ? { ...store.settings, ...session.params } : store.settings,
    leek: inProgram,
    program: inProgram ? session.mode : null,
    autoStart,
    onKey: fn => { keyHandler = fn; },
    finish: data => {
      session.results.push({ gameId, durationMs: Date.now() - startedAt, at: Date.now(), data });
      saveSession();
      if (returnTo === 'summary') return goSummary();
      if (session.mode === 'single') {
        endSession();
        toast(`${game.name}: gespeichert ✓`);
        setTimeout(checkBadges, 900);
        return goSingles();
      }
      session.pos++;
      if (session.pos < session.queue.length) runGame(session.queue[session.pos]);
      else { session.complete = true; sound.play('finish'); goSummary(); }
    },
  };
  cleanup = game.mount(root, ctx) || null;
}

function goSummary() {
  if (!session?.results.length) return goHome();
  session.ready = readiness(session, store.settings).ready;
  saveSession();
  setTimeout(checkBadges, 600);
  show(renderSummary(session, {
    onAddCheckouts: () => runGame('checkouts', { autoStart: true, returnTo: 'summary' }),
    onDone: () => goHome(),
    onHistory: () => { endSession(); goHistory(); },
  }), { back: () => goHome() });
}

function goHistory() {
  show(renderHistory({ onBack: () => goHome() }), { back: () => goHome() });
}

function goAdmin() {
  show(renderAdmin({ onBack: () => { sound.setEnabled(store.settings.sound); goHome(); } }), { back: () => goHome() });
}

// ---------------- Start ----------------
goHome();
const splash = document.getElementById('splash');
// Ablauf: Logo erscheint → Zwinkern → Logo fliegt dezent auf einen zu und verblasst → App
setTimeout(() => splash.classList.add('wink'), 750);
setTimeout(() => splash.classList.remove('wink'), 1300);
setTimeout(() => splash.classList.add('fly'), 1400);
setTimeout(() => splash.remove(), 2250);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

import { h, iconBtn, ICONS, confirmDialog, orderEditor, toast } from './ui.js';
import { store, uid } from './store.js';
import { GAMES, GAME_IDS, gameById } from './games/registry.js';
import { wakeLock } from './wakelock.js';
import { sound } from './sound.js';
import { showInfo } from './info.js';
import { renderHistory } from './screens/history.js';
import { renderAdmin } from './screens/admin.js';
import { renderSummary } from './screens/summary.js';
import { versusFlow } from './screens/versus.js';

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

const PROGRAMS = {
  leek: { title: 'Das Leek’sche Trainingsprogramm', key: 'leekOrder' },
  custom: { title: 'Individuelles Trainingsprogramm', key: 'customOrder' },
};

// ---------------- Home ----------------
export function goHome() {
  if (session) endSession();
  const s = store.settings;
  const leekGames = s.leekOrder.filter(o => o.on).map(o => gameById(o.id));
  const customGames = s.customOrder.filter(o => o.on).map(o => gameById(o.id));
  show(h('section', { class: 'screen' },
    h('header', { class: 'home-head' },
      h('img', { src: 'icons/logo.webp', alt: 'DartsOfALeek Logo', width: 64, height: 64 }),
      h('h1', {}, 'Darttraining', h('small', {}, 'mit The Leek')),
      h('div', { class: 'home-actions' },
        iconBtn('stats', 'Statistik', () => goHistory()),
        iconBtn('gear', 'Einstellungen', () => goAdmin()))),
    h('div', { class: 'mode-cards' },
      h('button', { class: 'mode-card primary', 'data-snd': 'start', onClick: () => startProgram('leek'), disabled: !leekGames.length },
        h('img', { class: 'tile-mascot', src: 'icons/mascot.webp', alt: '' }),
        h('span', { class: 'title' }, 'Das Leek’sche', h('br'), 'Trainingsprogramm'),
        h('span', { class: 'desc' }, leekGames.length ? 'Festes Programm – läuft automatisch durch.' : 'Keine Spiele aktiviert – im Admin-Bereich auswählen.'),
        h('span', { class: 'chips' }, leekGames.map((g, i) => h('span', { class: 'chip' }, `${i + 1}. ${g.name}`)))),
      h('button', { class: 'mode-card', onClick: () => goCustomBuilder() },
        h('span', { class: 'tile-icon', html: ICONS.sliders }),
        h('span', { class: 'title' }, 'Individuelles', h('br'), 'Trainingsprogramm'),
        h('span', { class: 'desc' }, customGames.length ? `Dein Programm: ${customGames.length} Spiel${customGames.length === 1 ? '' : 'e'}` : 'Stell dir dein eigenes Programm zusammen.'),
        customGames.length ? h('span', { class: 'chips' }, customGames.map((g, i) => h('span', { class: 'chip' }, `${i + 1}. ${g.name}`))) : null),
      h('button', { class: 'mode-card', onClick: () => goSingles() },
        h('span', { class: 'tile-icon', html: ICONS.target }),
        h('span', { class: 'title' }, 'Einzel Trainings'),
        h('span', { class: 'desc' }, `Jedes der ${GAMES.length} Spiele einzeln starten.`)),
      s.versus ? h('button', { class: 'mode-card versus', onClick: () => versusFlow({ show, setKey: fn => { keyHandler = fn; }, home: goHome }).start() },
        h('img', { class: 'tile-duel', src: 'icons/duel.webp', alt: '' }),
        h('span', { class: 'title' }, '1vs1'),
        h('span', { class: 'desc' }, 'Duell auf einem Gerät – ATC, 121, Random Checkouts.')) : null),
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

function startProgram(kind) {
  const queue = store.settings[PROGRAMS[kind].key].filter(o => o.on).map(o => o.id);
  if (!queue.length) return toast('Keine Spiele ausgewählt');
  newSession(kind);
  session.queue = queue;
  session.pos = 0;
  runGame(queue[0]);
}

// ---------------- Individuelles Programm ----------------
function goCustomBuilder() {
  const editor = orderEditor(() => store.settings.customOrder, order => { store.saveSettings({ ...store.settings, customOrder: order }); paintStart(); }, id => gameById(id).name);
  const startBtn = h('button', { class: 'btn huge primary', 'data-snd': 'start', onClick: () => startProgram('custom') });
  const paintStart = () => {
    const n = store.settings.customOrder.filter(o => o.on).length;
    startBtn.disabled = !n;
    startBtn.textContent = n ? `Programm starten (${n})` : 'Spiele auswählen';
  };
  paintStart();
  show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', goHome), h('h2', {}, 'Individuelles Programm', h('span', { class: 'sub' }, 'Haken setzen, Reihenfolge per Pfeil oder Griff'))),
    h('div', { class: 'scroll' }, editor,
      h('button', { class: 'btn ghost small', style: { width: '100%', marginTop: '12px' }, onClick: () => { store.saveSettings({ ...store.settings, customOrder: store.settings.leekOrder.map(o => ({ ...o })) }); editor.repaint(); paintStart(); } }, 'Leek-Programm als Vorlage übernehmen')),
    h('div', { class: 'controls' }, startBtn)),
  { back: goHome });
}

// ---------------- Einzel Trainings ----------------
function goSingles() {
  const played = new Set(store.sessions.filter(s => s.mode === 'single').map(s => s.results[0]?.gameId));
  show(h('section', { class: 'screen' },
    h('div', { class: 'topbar' }, iconBtn('back', 'Zurück', goHome), h('h2', {}, 'Einzel Trainings', h('span', { class: 'sub' }, 'Spiel antippen zum Starten'))),
    h('div', { class: 'scroll' },
      h('div', { class: 'pick-list' }, GAMES.map((g, i) =>
        h('button', { class: 'pick', onClick: () => { newSession('single'); runGame(g.id); } },
          h('span', { class: 'num' }, i + 1),
          h('span', { class: 'txt' }, h('b', {}, g.name), h('span', {}, g.short)),
          played.has(g.id) ? h('span', { class: 'done-mark' }, '✓') : null))))),
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
    ? `${session.mode === 'leek' ? 'Leek-Programm' : 'Individuell'} · Spiel ${session.pos + 1} von ${session.queue.length}`
    : returnTo === 'summary' ? 'Zusatzrunde' : 'Einzel Training';

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
    settings: store.settings,
    leek: session.mode === 'leek' && !returnTo,
    autoStart,
    onKey: fn => { keyHandler = fn; },
    finish: data => {
      session.results.push({ gameId, durationMs: Date.now() - startedAt, at: Date.now(), data });
      saveSession();
      if (returnTo === 'summary') return goSummary();
      if (session.mode === 'single') {
        endSession();
        toast(`${game.name}: gespeichert ✓`);
        return goSingles();
      }
      session.pos++;
      if (session.pos < session.queue.length) runGame(session.queue[session.pos]);
      else { sound.play('finish'); goSummary(); }
    },
  };
  cleanup = game.mount(root, ctx) || null;
}

function goSummary() {
  if (!session?.results.length) return goHome();
  saveSession();
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
setTimeout(() => splash.classList.add('wink'), 700);
setTimeout(() => splash.classList.remove('wink'), 1250);
setTimeout(() => {
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 700);
}, 2300);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

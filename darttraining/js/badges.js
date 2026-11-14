// Leek-Abzeichen: werden immer gesammelt, Pop-up im Admin abschaltbar.
import { h } from './ui.js';
import { store } from './store.js';
import { sound } from './sound.js';
import { streak, bestStreak } from './calendar.js';

const coChecked = min => store.checkoutRuns.some(r => Object.entries(r.perNumber || {}).some(([n, [, c]]) => Number(n) >= min && c > 0));
const coCheckedExact = n => store.checkoutRuns.some(r => (r.perNumber?.[n]?.[1] || 0) > 0);
const atc = (g, f) => store.list('atcRuns').some(r => r.game === g && !r.repeated && f(r));
const sv = f => store.list('survivalRuns').some(f);
const hourOf = ts => new Date(ts).getHours();
const results = id => store.sessions.flatMap(s => s.results.filter(r => r.gameId === id));

export const BADGES = [
  { id: 'first', emoji: '🌱', name: 'Erster Lauch', desc: 'Erstes Training abgeschlossen', test: () => store.sessions.length >= 1 },
  { id: 'leek_full', emoji: '🥬', name: 'Durchgezogen', desc: 'Das komplette TheLeek Trainingsprogramm geschafft', test: () => store.sessions.some(s => s.mode === 'leek' && s.complete) },
  { id: 'warm10', emoji: '🔥', name: 'Warmer Lauch', desc: '10 Warm-ups absolviert', test: () => results('warmup').length >= 10 },
  { id: 'clean', emoji: '✂️', name: 'Sauberer Schnitt', desc: 'Around the Clock Single ohne Fehlwurf', test: () => atc('atcSingle', r => r.misses === 0) },
  { id: 'dbl_garden', emoji: '🪴', name: 'Doppel-Gärtner', desc: 'Around the Clock Doppel unter 20 Fehlwürfen', test: () => atc('atcDouble', r => r.misses < 20) },
  { id: 'triple', emoji: '🍄', name: 'Triple-Trüffel', desc: 'Around the Clock Triple geschafft', test: () => atc('atcTriple', () => true) },
  { id: 'ton', emoji: '💯', name: 'Lauch-Ton', desc: 'Einen Checkout ab 100 geschafft', test: () => coChecked(100) },
  { id: 'bigfish', emoji: '🐟', name: 'Big Fish im Gemüsebeet', desc: '170 ausgecheckt', test: () => coCheckedExact(170) },
  { id: 'co_chef', emoji: '👨‍🍳', name: 'Checkout-Chefkoch', desc: 'Checkout-Quote ≥ 50 % (mind. 10 Versuche)', test: () => store.checkoutRuns.some(r => r.source !== 'drill' && r.attempts >= 10 && r.quote >= 50) },
  { id: 'co100', emoji: '🧺', name: 'Erntezeit', desc: '100 Checkouts insgesamt', test: () => store.checkoutRuns.reduce((a, r) => a + r.checks, 0) >= 100 },
  { id: 'dbl30', emoji: '💚', name: 'Doppelherz', desc: '30 Doppel-Treffer in einer Runde', test: () => store.list('doublesRuns').some(r => r.hits >= 30) },
  { id: 'l130', emoji: '⛰️', name: 'Über den Berg', desc: '121: bis 130 gecheckt', test: () => store.list('l121Runs').some(r => r.highest >= 130) },
  { id: 'l150', emoji: '🏔️', name: 'Höhenluft', desc: '121: bis 150 gecheckt', test: () => store.list('l121Runs').some(r => r.highest >= 150) },
  { id: 'grob', emoji: '🐗', name: 'Echter GROB Boy', desc: 'GROB Boys: 5 Leben gleichzeitig', test: () => store.list('l121Runs').some(r => (r.maxLives || 0) >= 5) },
  { id: 'sv10', emoji: '🛡️', name: 'Überlebenskünstler', desc: 'Leek Survival: Runde 10 erreicht', test: () => sv(r => r.highestRound >= 10) },
  { id: 'sv25', emoji: '🦾', name: 'Unkaputtbar', desc: 'Leek Survival: Runde 25 erreicht', test: () => sv(r => r.highestRound >= 25) },
  { id: 'insane', emoji: '🤪', name: 'Wahnsinniger Lauch', desc: 'Insane: Runde 6 erreicht', test: () => sv(r => r.difficulty === 'insane' && r.highestRound >= 6) },
  { id: 'boss', emoji: '💀', name: 'Bossbezwinger', desc: 'Einen Boss in Leek Survival besiegt', test: () => sv(r => (r.bossWins || 0) > 0) },
  { id: 'drill', emoji: '🔧', name: 'Schwachstellen-Jäger', desc: '„Dran bleiben Junge“ durchgezogen', test: () => store.list('drillRuns').length > 0 },
  { id: 'vs', emoji: '⚔️', name: 'Gemüse-Gladiator', desc: 'Erstes 1vs1-Duell gespielt', test: () => store.list('versusMatches').length > 0 },
  { id: 'max180', emoji: '🎉', name: 'Maximum-Lauch', desc: 'Eine 180 im 501 geworfen', test: () => Object.values(store.exportAll().scoreFreq || {}).some(m => (m[180] || 0) > 0) },
  { id: 'vs10', emoji: '🏟️', name: 'Arena-Lauch', desc: '10 Duelle gespielt', test: () => store.list('versusMatches').length >= 10 },
  { id: 'ready5', emoji: '🎯', name: 'Matchbereit', desc: '5× „Bereit fürs Match!“', test: () => store.sessions.filter(s => s.ready === true).length >= 5 },
  { id: 'plan', emoji: '📋', name: 'Planlauch', desc: 'Eigenen Trainingsplan gespeichert', test: () => store.settings.plans.length > 0 },
  { id: 'early', emoji: '🐓', name: 'Früher Lauch', desc: 'Vor 8 Uhr trainiert', test: () => store.sessions.some(s => hourOf(s.start) < 8 && hourOf(s.start) >= 4) },
  { id: 'night', emoji: '🦉', name: 'Nachtlauch', desc: 'Nach 23 Uhr trainiert', test: () => store.sessions.some(s => hourOf(s.start) >= 23 || hourOf(s.start) < 4) },
  { id: 'streak3', emoji: '📅', name: 'Dranbleiber', desc: '3 Tage in Folge trainiert', test: () => bestStreak() >= 3 },
  { id: 'streak7', emoji: '🗓️', name: 'Lauchwoche', desc: '7 Tage in Folge trainiert', test: () => bestStreak() >= 7 },
  { id: 'streak30', emoji: '🏆', name: 'Lauch-Legende', desc: '30 Tage in Folge trainiert', test: () => bestStreak() >= 30 },
  { id: 'all', emoji: '🧑‍🌾', name: 'Gemüsegärtner', desc: 'Jedes Spiel mindestens einmal gespielt', test: () => new Set(store.sessions.flatMap(s => s.results.map(r => r.gameId))).size >= 11 },
];

// Prüft alle Abzeichen und zeigt neue an
export function checkBadges() {
  const fresh = [];
  for (const b of BADGES) {
    let ok = false;
    try { ok = b.test(); } catch { ok = false; }
    if (ok && store.unlockBadge(b.id)) fresh.push(b);
  }
  if (fresh.length && store.settings.badgePopups) showBadges(fresh);
  return fresh;
}

let queue = [];
function showBadges(list) {
  queue.push(...list);
  if (document.querySelector('.badge-pop')) return;
  next();
}
function next() {
  const b = queue.shift();
  if (!b) return;
  sound.play('record');
  const el = h('div', { class: 'badge-pop', role: 'status', onClick: () => close() },
    h('div', { class: 'bp-emoji' }, b.emoji),
    h('div', {}, h('div', { class: 'bp-label' }, 'Abzeichen freigeschaltet'), h('div', { class: 'bp-name' }, b.name), h('div', { class: 'bp-desc' }, b.desc)));
  document.body.append(el);
  const t = setTimeout(close, 3600);
  function close() { clearTimeout(t); el.classList.add('out'); setTimeout(() => { el.remove(); next(); }, 300); }
}

export function badgeGrid() {
  const got = store.badges;
  return h('div', { class: 'badge-grid' }, BADGES.map(b => h('div', { class: `badge${got[b.id] ? ' on' : ''}`, title: b.desc },
    h('div', { class: 'b-emoji' }, got[b.id] ? b.emoji : '🔒'),
    h('b', {}, b.name),
    h('span', {}, b.desc))));
}

export { streak };

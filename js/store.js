// Lokale Datenhaltung (localStorage). Keine Cloud, kein Login.
import { normalizeSettings } from './settings.js';

const KEY = 'leek-darttraining-v1';
// Weitere Protokolle (einfach erweiterbar)
const LOGS = ['checkoutRuns', 'atcRuns', 'l121Runs', 'doublesRuns', 'drillRuns', 'survivalRuns', 'versusMatches'];

function load() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { raw = {}; }
  const d = { settings: raw.settings || null, sessions: Array.isArray(raw.sessions) ? raw.sessions : [], fieldStats: raw.fieldStats || {}, badges: raw.badges || {} };
  for (const k of LOGS) d[k] = Array.isArray(raw[k]) ? raw[k] : [];
  return d;
}

let data = load();
let gameIds = [];

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('Speichern fehlgeschlagen', e); }
}

export const store = {
  init(ids) {
    gameIds = ids;
    data.settings = normalizeSettings(data.settings, gameIds);
    persist();
  },
  get settings() { return data.settings; },
  saveSettings(next) {
    data.settings = normalizeSettings(next, gameIds);
    persist();
    return data.settings;
  },
  get sessions() { return data.sessions; },
  get checkoutRuns() { return data.checkoutRuns; },
  get fieldStats() { return data.fieldStats; },
  get badges() { return data.badges; },
  unlockBadge(id) { if (data.badges[id]) return false; data.badges[id] = Date.now(); persist(); return true; },
  list(kind) { return data[kind] || []; },
  log(kind, entry) {
    (data[kind] ||= []).push(entry);
    persist();
  },
  // Trefferstatistik pro Feld/Ziel (für „Dran bleiben Junge“)
  addFieldStat(key, attempts, hits) {
    const x = data.fieldStats[key] || (data.fieldStats[key] = [0, 0]);
    x[0] += attempts; x[1] += hits;
    persist();
  },
  upsertSession(session) {
    const i = data.sessions.findIndex(s => s.id === session.id);
    const copy = JSON.parse(JSON.stringify(session));
    if (i >= 0) data.sessions[i] = copy; else data.sessions.push(copy);
    persist();
  },
  addCheckoutRun(run) { this.log('checkoutRuns', run); },
  resetStats() {
    data.sessions = [];
    data.fieldStats = {};
    data.badges = {};
    for (const k of LOGS) data[k] = [];
    persist();
  },
  exportAll() {
    return { app: 'Darttraining mit The Leek', exportedAt: new Date().toISOString(), ...data };
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

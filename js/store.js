// Lokale Datenhaltung (localStorage). Keine Cloud, kein Login.
import { normalizeSettings } from './settings.js';

const KEY = 'leek-darttraining-v1';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      settings: raw.settings || null,
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
      checkoutRuns: Array.isArray(raw.checkoutRuns) ? raw.checkoutRuns : [],
    };
  } catch {
    return { settings: null, sessions: [], checkoutRuns: [] };
  }
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
  upsertSession(session) {
    const i = data.sessions.findIndex(s => s.id === session.id);
    const copy = JSON.parse(JSON.stringify(session));
    if (i >= 0) data.sessions[i] = copy; else data.sessions.push(copy);
    persist();
  },
  addCheckoutRun(run) {
    data.checkoutRuns.push(run);
    persist();
  },
  removeCheckoutRun(id) {
    data.checkoutRuns = data.checkoutRuns.filter(r => r.id !== id);
    persist();
  },
  resetStats() {
    data.sessions = [];
    data.checkoutRuns = [];
    persist();
  },
  exportAll() {
    return { app: 'Darttraining mit The Leek', exportedAt: new Date().toISOString(), ...data };
  },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Schwächen-Analyse aus allen gespeicherten Daten (Checkouts pro Zahl + Feld-Statistik).
import { store } from './store.js';

const DEFAULT_FIELDS = ['D7', 'D9', 'D3', 'D11', 'D13', 'T19', 'T18', 'D17'];
const DEFAULT_CHECKOUTS = [67, 61, 79, 83, 57, 41];
const fieldLabel = k => (k === 'BULL' ? 'Bull' : k.startsWith('S') ? k.slice(1) : k);

export function analyzeWeaknesses({ maxFields = 5, maxCheckouts = 5 } = {}) {
  const co = {};
  for (const r of store.checkoutRuns) for (const [n, [a, c]] of Object.entries(r.perNumber || {})) {
    const x = co[n] || (co[n] = [0, 0]); x[0] += a; x[1] += c;
  }
  const checkouts = Object.entries(co).filter(([, [a]]) => a >= 2)
    .map(([n, [a, c]]) => ({ type: 'co', key: Number(n), label: n, attempts: a, quote: c / a }))
    .filter(x => x.quote < 0.75)
    .sort((a, b) => a.quote - b.quote || b.attempts - a.attempts).slice(0, maxCheckouts);

  const fields = Object.entries(store.fieldStats).filter(([, [a]]) => a >= 2)
    .map(([k, [a, c]]) => ({ type: 'field', key: k, label: fieldLabel(k), attempts: a, quote: c / a }))
    .filter(x => x.quote < 0.6)
    .sort((a, b) => a.quote - b.quote || b.attempts - a.attempts).slice(0, maxFields);

  const list = [...fields, ...checkouts];
  const fromData = list.length;
  for (const k of DEFAULT_FIELDS) { if (list.filter(x => x.type === 'field').length >= 3) break; if (!list.some(x => x.key === k)) list.push({ type: 'field', key: k, label: fieldLabel(k), quote: null, standard: true }); }
  for (const n of DEFAULT_CHECKOUTS) { if (list.filter(x => x.type === 'co').length >= 3) break; if (!list.some(x => x.key === n)) list.push({ type: 'co', key: n, label: String(n), quote: null, standard: true }); }
  return { list, fromData };
}

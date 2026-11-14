import { EV_MODELS } from './data/ev.js';
import { ICE_MODELS } from './data/ice.js';

export { EV_MODELS, ICE_MODELS };
export const SEGMENTS = ['Kleinstwagen', 'Kleinwagen', 'Kompaktklasse', 'Mittelklasse', 'Obere Mittelklasse', 'Oberklasse'];
export const BODIES = ['Schrägheck', 'Limousine', 'Kombi', 'SUV', 'Van', 'Coupé'];
export const FUEL_LABEL = { strom: 'Elektro', benzin: 'Benzin', diesel: 'Diesel' };

export const findVehicle = (id) => EV_MODELS.find((v) => v.id === id) || ICE_MODELS.find((v) => v.id === id) || null;
export const vehicleName = (v) => `${v.brand} ${v.model}`;
export const brandsOf = (list) => [...new Set(list.map((v) => v.brand))].sort((a, b) => a.localeCompare(b, 'de'));

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#.]+/g, ' ').trim();

/** Suche mit Autovervollständigung: alle Suchwörter müssen in Marke/Modell vorkommen. */
export function searchVehicles(list, query = '', f = {}) {
  const words = norm(query).split(' ').filter(Boolean);
  return list.filter((v) => {
    if (f.brand && v.brand !== f.brand) return false;
    if (f.segment && v.segment !== f.segment) return false;
    if (f.body && v.body !== f.body) return false;
    if (f.fuel && v.fuel !== f.fuel) return false;
    if (f.minKw && v.kw < f.minKw) return false;
    if (f.maxKw && v.kw > f.maxKw) return false;
    if (!words.length) return true;
    const hay = norm(`${v.brand} ${v.model} ${v.segment} ${v.body}`);
    return words.every((w) => hay.includes(w));
  }).sort((a, b) => {
    // Treffer am Wortanfang der Marke zuerst, dann alphabetisch
    const q = words[0] || '';
    const sa = norm(a.brand).startsWith(q) ? 0 : 1, sb = norm(b.brand).startsWith(q) ? 0 : 1;
    return sa - sb || vehicleName(a).localeCompare(vehicleName(b), 'de');
  });
}

/**
 * Schlägt bis zu 3 passende Verbrenner zum E-Auto vor:
 * gleiches Segment, Leistung ±20 %, ähnlicher Preis; bevorzugt gleiche Karosserie und zeitgleich angeboten.
 * Wenn zu wenige Treffer: Leistungsfenster auf ±35 % erweitert (in der Begründung vermerkt).
 */
export function suggestIce(ev, list = ICE_MODELS, n = 3) {
  const fromYear = ev.from || 2018;
  const score = (c) => {
    const kwDev = Math.abs(c.kw - ev.kw) / ev.kw;
    const priceDev = Math.abs(c.price - ev.price) / ev.price;
    const bodyPenalty = c.body === ev.body ? 0 : 0.25;
    const eraPenalty = (c.to && c.to < fromYear) || (ev.to && c.from > ev.to) ? 0.5 : 0;
    return kwDev + priceDev + bodyPenalty + eraPenalty;
  };
  const pick = (tol) => list
    .filter((c) => c.segment === ev.segment && Math.abs(c.kw - ev.kw) / ev.kw <= tol)
    .map((c) => ({ vehicle: c, score: score(c), tol }));
  let cands = pick(0.2);
  if (cands.length < n) {
    const ids = new Set(cands.map((c) => c.vehicle.id));
    cands = cands.concat(pick(0.35).filter((c) => !ids.has(c.vehicle.id)));
  }
  return cands.sort((a, b) => a.score - b.score).slice(0, n)
    .map(({ vehicle, tol }) => ({ vehicle, reason: reasonFor(ev, vehicle, tol) }));
}

function reasonFor(ev, c, tol) {
  const pct = (a, b) => { const p = Math.round((a - b) / b * 100); return (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + ' %'; };
  const eur = (x) => Math.round(x).toLocaleString('de-DE') + ' €';
  const parts = [`gleiches Segment (${c.segment})`];
  parts.push(c.body === ev.body ? `gleiche Karosserie (${c.body})` : `${c.body} statt ${ev.body}`);
  parts.push(`${c.kw} kW (${pct(c.kw, ev.kw)}${tol > 0.2 ? ', erweitertes Leistungsfenster' : ''})`);
  const d = c.price - ev.price;
  parts.push(`Listenpreis ${eur(c.price)} (${d <= 0 ? '−' : '+'}${eur(Math.abs(d))})`);
  return parts.join(', ');
}

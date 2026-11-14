import { FUEL_DATA } from './data/fuelprices.js';

/** Liefert die Monatsreihe [{ym, price}] für Bundesland und Kraftstoff ('e10' | 'diesel'). */
export function fuelSeries(state, fuel, data = FUEL_DATA) {
  const key = fuel === 'diesel' ? 'diesel' : 'e10';
  let values;
  if (data.states && data.states[state]) values = data.states[state][key];
  else {
    const off = (data.stateOffset && data.stateOffset[state] && data.stateOffset[state][key]) || 0;
    values = data.national[key].map((v) => (v == null ? null : Math.round((v + off) * 1000) / 1000));
  }
  const [y0, m0] = data.start.split('-').map(Number);
  return values.map((price, i) => {
    const y = y0 + Math.floor((m0 - 1 + i) / 12);
    const m = ((m0 - 1 + i) % 12) + 1;
    return { ym: `${y}-${String(m).padStart(2, '0')}`, price };
  }).filter((p) => p.price != null);
}

export function seriesMap(series) {
  return Object.fromEntries(series.map((p) => [p.ym, p.price]));
}

export function seriesStats(series) {
  if (!series.length) return null;
  let min = series[0], max = series[0];
  for (const p of series) {
    if (p.price < min.price) min = p;
    if (p.price > max.price) max = p;
  }
  const last = series[series.length - 1];
  const last12 = series.slice(-12);
  const avg12 = last12.reduce((s, p) => s + p.price, 0) / last12.length;
  return { min, max, last, avg12 };
}

export const fuelMeta = () => FUEL_DATA.meta;

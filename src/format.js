const nf = (d) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const NF0 = nf(0), NF1 = nf(1), NF2 = nf(2), NF3 = nf(3);

export const eur = (x, d = 0) => (x == null || !isFinite(x) ? '–' : (d === 2 ? NF2 : d === 1 ? NF1 : NF0).format(x) + ' €');
export const eurSigned = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + eur(Math.abs(x));
export const num = (x, d = 0) => (x == null || !isFinite(x) ? '–' : (d === 3 ? NF3 : d === 2 ? NF2 : d === 1 ? NF1 : NF0).format(x));
export const km = (x) => num(x) + ' km';
export const perLitre = (x) => (x == null ? '–' : NF3.format(x) + ' €/l');
export const date = (d) => (d ? `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}` : '–');
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const monthYear = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const ymLabel = (ym) => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]} ${y}`; };

/** Zahl für Eingabefelder: ohne Tausenderpunkte, Dezimalkomma */
export const inputNum = (x, maxFrac = 3) => (x == null || x === '' ? '' : new Intl.NumberFormat('de-DE', { useGrouping: false, maximumFractionDigits: maxFrac }).format(x));
/** Eingabe parsen: akzeptiert Komma und Punkt als Dezimaltrennzeichen, Tausenderpunkte bei ganzen Zahlen */
export function parseNum(str) {
  let s = String(str).trim().replace(/\s|€|%/g, '');
  if (s === '') return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

// Datumshilfen auf UTC-Basis (keine Zeitzonen-/Sommerzeit-Effekte).
const DAY = 86400000;

export function parseDate(s) {
  if (s instanceof Date) return new Date(s.getTime());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}
export const ymd = (y, m, d) => new Date(Date.UTC(y, m, d));
export const toISO = (d) => d.toISOString().slice(0, 10);
export const ymKey = (d) => d.toISOString().slice(0, 7);
export const daysBetween = (a, b) => Math.round((b - a) / DAY);
export const addDays = (d, n) => new Date(d.getTime() + n * DAY);
export const daysInYear = (y) => daysBetween(ymd(y, 0, 1), ymd(y + 1, 0, 1));
export function addYears(d, n) {
  const r = ymd(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate());
  // 29.02. + n Jahre → 28.02./01.03. vermeiden: auf Monatsende kappen
  if (r.getUTCMonth() !== d.getUTCMonth()) return ymd(d.getUTCFullYear() + n, d.getUTCMonth() + 1, 0);
  return r;
}
/** Überlappung zweier halboffener Intervalle [a1,a2) und [b1,b2) in Tagen */
export function overlapDays(a1, a2, b1, b2) {
  const s = Math.max(a1.getTime(), b1.getTime());
  const e = Math.min(a2.getTime(), b2.getTime());
  return e > s ? Math.round((e - s) / DAY) : 0;
}
export const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export const monthLabel = (d) => MONTHS_DE[d.getUTCMonth()] + ' ' + d.getUTCFullYear();

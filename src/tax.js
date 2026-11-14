// Kfz-Steuer für Pkw nach dem Kraftfahrzeugsteuergesetz (KraftStG).
import { parseDate, ymd, addYears } from './dates.js';

// Erstzulassung bis 30.06.2009: Steuer je angefangene 100 cm³ nach Schadstoffklasse (§ 9 Abs. 1 Nr. 2 a/b)
export const OLD_RATES = {
  euro4: { benzin: 6.75, diesel: 15.44, label: 'Euro 4 und besser' },
  euro3: { benzin: 6.75, diesel: 15.44, label: 'Euro 3 / D3' },
  euro2: { benzin: 7.36, diesel: 16.05, label: 'Euro 2' },
  euro1: { benzin: 15.13, diesel: 27.35, label: 'Euro 1' },
  none: { benzin: 25.36, diesel: 37.58, label: 'ohne Schadstoffklasse' },
};

// CO₂-Staffel für Erstzulassungen ab 01.01.2021 (§ 9 Abs. 1 Nr. 2 c bb)
export const CO2_STEPS_2021 = [
  [95, 115, 2.0], [115, 135, 2.2], [135, 155, 2.5], [155, 175, 2.9], [175, 195, 3.4], [195, Infinity, 4.0],
];

/**
 * Jahressteuer eines Verbrenners in €.
 * @param {object} v  { fuel: 'benzin'|'diesel', ccm, co2, firstReg: 'YYYY-MM-DD', euroNorm }
 * @param {number} year  Steuerjahr (für die befristete 30-€-Ermäßigung)
 */
export function iceAnnualTax(v, year) {
  const ez = parseDate(v.firstReg);
  if (!ez || !(v.ccm > 0)) return 0;
  const diesel = v.fuel === 'diesel';
  const units = Math.ceil(v.ccm / 100);

  if (ez < ymd(2009, 6, 1)) {
    const r = OLD_RATES[v.euroNorm] || OLD_RATES.euro4;
    return Math.floor(units * (diesel ? r.diesel : r.benzin) * 100) / 100;
  }

  const base = units * (diesel ? 9.5 : 2.0);
  const co2 = Math.max(0, v.co2 || 0);
  let co2Part = 0;
  if (ez >= ymd(2021, 0, 1)) {
    for (const [from, to, rate] of CO2_STEPS_2021) {
      if (co2 > from) co2Part += (Math.min(co2, to) - from) * rate;
    }
  } else {
    const free = ez < ymd(2012, 0, 1) ? 120 : ez < ymd(2014, 0, 1) ? 110 : 95;
    co2Part = Math.max(0, co2 - free) * 2;
  }
  let tax = Math.floor(base + co2Part + 1e-9);
  // § 9 Abs. 4: 30 € Ermäßigung für EZ 12.06.2020–31.12.2024 mit max. 95 g/km, längstens bis 31.12.2024
  if (year <= 2024 && co2 > 0 && co2 <= 95 && ez >= ymd(2020, 5, 12) && ez <= ymd(2024, 11, 31)) {
    tax = Math.max(0, tax - 30);
  }
  return tax;
}

/** Ende der Steuerbefreiung reiner E-Autos (§ 3d): exklusives Enddatum oder null (keine Befreiung). */
export function evExemptionEnd(firstReg) {
  const ez = parseDate(firstReg);
  if (!ez || ez > ymd(2030, 11, 31)) return null;
  if (ez < ymd(2011, 4, 18)) return addYears(ez, 5);
  const tenYears = addYears(ez, 10);
  const cap = ymd(2036, 0, 1);
  return tenYears < cap ? tenYears : cap;
}

/** Jahressteuer eines E-Autos ohne Befreiung: nach zul. Gesamtgewicht, um 50 % ermäßigt (§ 9 Abs. 1 Nr. 4, Abs. 2). */
export function evAnnualTaxAfterExemption(weightKg) {
  const w = Math.max(0, weightKg || 0);
  const steps = [[2000, 11.25], [3000, 12.02], [3500, 12.78]];
  let prev = 0, tax = 0;
  for (const [limit, rate] of steps) {
    if (w > prev) tax += Math.ceil((Math.min(w, limit) - prev) / 200) * rate;
    prev = limit;
  }
  return Math.floor(tax * 0.5 * 100) / 100;
}

/** Tägliche Steuerfunktion für das E-Auto: liefert die Jahressteuer, die an Tag `d` gilt. */
export function evTaxAt(d, ev) {
  const end = evExemptionEnd(ev.firstReg);
  if (end && d < end) return 0;
  return evAnnualTaxAfterExemption(ev.weight);
}

// Rechenkern: Monatsweise Simulation, aggregiert zu Kalenderjahren (1.1.–31.12.).
import { parseDate, ymd, addYears, overlapDays, daysInYear, daysBetween, ymKey, toISO } from './dates.js';
import { iceAnnualTax, evExemptionEnd, evAnnualTaxAfterExemption } from './tax.js';

export const THG_FIRST_YEAR = 2022; // THG-Quote für Privatleute seit 2022
export const MAX_HORIZON_YEARS = 30; // Suchhorizont für den Break-even über die Haltedauer hinaus

/** Mischstrompreis €/kWh am Zähler des Autos: Ladeanteile × Preise × (1 + Ladeverluste) */
export function evPricePerKwh(ev) {
  const home = clamp(ev.homeShare, 0, 100) / 100;
  const mix = home * ev.homePrice + (1 - home) * ev.roadPrice;
  return mix * (1 + (ev.loss || 0) / 100);
}

/**
 * Hauptberechnung.
 * input = {
 *   purchaseDate, years, kmPerYear, startOdometer, odometer: { [year]: Stand am 1.1. },
 *   ev:  { price, residual, consumption (kWh/100 km), homeShare %, homePrice €/kWh, roadPrice €/kWh, loss %, thg €/Jahr, firstReg, weight },
 *   ice: { price, residual, consumption (l/100 km), fuel, ccm, co2, firstReg, euroNorm, fuelPrice (Override €/l | null), forecastPrice (€/l | null) },
 *   fuelPrices: { 'YYYY-MM': €/l }  // Monatsmittel des gewählten Bundeslands/Kraftstoffs
 * }
 */
export function calculate(input) {
  const start = parseDate(input.purchaseDate);
  const years = input.years;
  const holdEnd = addYears(start, years);
  const extEnd = addYears(start, Math.max(years, MAX_HORIZON_YEARS));
  const holdDays = daysBetween(start, holdEnd);
  const { ev, ice } = input;
  const odo = input.odometer || {};
  const fuelPrices = input.fuelPrices || {};
  const knownMonths = Object.keys(fuelPrices).sort();
  const lastKnown = knownMonths.length ? fuelPrices[knownMonths[knownMonths.length - 1]] : null;
  const forecastFuel = num(ice.forecastPrice) ?? lastKnown ?? 1.7;
  const kwhPrice = evPricePerKwh(ev);
  const evDepPerDay = (ev.price - ev.residual) / holdDays;
  const iceDepPerDay = (ice.price - ice.residual) / holdDays;
  const evExEnd = evExemptionEnd(ev.firstReg);
  const evTaxAfter = evAnnualTaxAfterExemption(ev.weight);
  const iceTaxCache = {};
  const iceTaxFor = (y) => (iceTaxCache[y] ??= iceAnnualTax(ice, y));

  // --- Kalenderjahre: Kilometer (tatsächlich aus Zählerständen oder geschätzt) ---
  const yearInfo = {};
  for (let y = start.getUTCFullYear(); y <= extEnd.getUTCFullYear(); y++) {
    const yS = ymd(y, 0, 1), yE = ymd(y + 1, 0, 1);
    const ownedDays = overlapDays(yS, yE, start, extEnd);
    const holdDaysInYear = overlapDays(yS, yE, start, holdEnd);
    const startReading = y === start.getUTCFullYear() ? num(input.startOdometer) : num(odo[y]);
    const endReading = num(odo[y + 1]);
    const actual = startReading != null && endReading != null && endReading >= startReading;
    const km = actual ? endReading - startReading : input.kmPerYear * ownedDays / daysInYear(y);
    yearInfo[y] = { ownedDays, holdDaysInYear, km, actual, startReading };
  }

  // --- Monate ---
  const months = [];
  let cursor = ymd(start.getUTCFullYear(), start.getUTCMonth(), 1);
  let odometer = num(input.startOdometer) ?? 0;
  while (cursor < extEnd) {
    const next = ymd(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
    const y = cursor.getUTCFullYear();
    const yi = yearInfo[y];
    const mS = cursor < start ? start : cursor;
    const mE = next > extEnd ? extEnd : next;
    const days = daysBetween(mS, mE);
    const inHold = mS < holdEnd;
    // Monat, der das Haltedauer-Ende schneidet, in zwei Teile splitten
    const parts = inHold && mE > holdEnd ? [[mS, holdEnd, true], [holdEnd, mE, false]] : [[mS, mE, inHold]];
    if (yi.startReading != null && y !== start.getUTCFullYear() && cursor.getUTCMonth() === 0) odometer = yi.startReading;

    for (const [pS, pE, hold] of parts) {
      const d = daysBetween(pS, pE);
      if (d <= 0) continue;
      const km = yi.km * d / yi.ownedDays;
      const ym = ymKey(cursor);
      const override = num(ice.fuelPrice);
      const knownPrice = fuelPrices[ym];
      const fuelPrice = override ?? knownPrice ?? forecastFuel;
      const priceActual = override != null || knownPrice != null;
      const thgDen = hold ? yi.holdDaysInYear : yi.ownedDays - yi.holdDaysInYear;
      const thg = y >= THG_FIRST_YEAR && thgDen > 0 ? (ev.thg || 0) * d / thgDen : 0;

      let evTax = 0, iceTax = 0;
      // Steuer tagesgenau (Monate liegen immer in einem Kalenderjahr)
      const dy = daysInYear(y);
      const taxedEvDays = evExEnd ? Math.max(0, daysBetween(evExEnd > pS ? evExEnd : pS, pE)) : d;
      evTax = evTaxAfter * Math.min(d, taxedEvDays) / dy;
      iceTax = iceTaxFor(y) * d / dy;

      const evE = { energy: km / 100 * ev.consumption * kwhPrice, tax: evTax, thg, dep: hold ? evDepPerDay * d : 0 };
      const iceE = { energy: km / 100 * ice.consumption * fuelPrice, tax: iceTax, thg: 0, dep: hold ? iceDepPerDay * d : 0 };
      for (const c of [evE, iceE]) { c.running = c.energy + c.tax - c.thg; c.tco = c.running + c.dep; }
      odometer += km;
      months.push({
        ym, year: y, start: pS, end: pE, days: d, km, odometerEnd: odometer, fuelPrice,
        actual: yi.actual && priceActual, inHold: hold, ev: evE, ice: iceE,
      });
    }
    cursor = next;
  }

  // --- Kumulierte Kurven ---
  let cum = { ev: { running: ev.price, tco: 0 }, ice: { running: ice.price, tco: 0 } };
  for (const m of months) {
    cum = {
      ev: { running: cum.ev.running + m.ev.running, tco: cum.ev.tco + m.ev.tco },
      ice: { running: cum.ice.running + m.ice.running, tco: cum.ice.tco + m.ice.tco },
    };
    m.cum = cum;
  }

  const holdMonths = months.filter((m) => m.inHold);
  const yearsTable = aggregateYears(holdMonths, ev, ice);
  const totals = sumTotals(holdMonths);
  const startPoint = { end: start, odometerEnd: num(input.startOdometer) ?? 0, cum: { ev: { running: ev.price, tco: 0 }, ice: { running: ice.price, tco: 0 } } };

  return {
    start, holdEnd, years, kwhPrice, forecastFuel,
    months, holdMonths, yearsTable, totals,
    priceDiff: ev.price - ice.price,
    breakEven: {
      running: findBreakEven([startPoint, ...months], 'running', holdEnd),
      tco: findBreakEven([startPoint, ...holdMonths], 'tco', holdEnd),
    },
    summary: summarize(totals, years, ev, ice),
  };
}

function aggregateYears(months, ev, ice) {
  const byYear = new Map();
  for (const m of months) {
    if (!byYear.has(m.year)) byYear.set(m.year, { year: m.year, days: 0, km: 0, fuelCost: 0, actual: true, ev: zero(), ice: zero() });
    const r = byYear.get(m.year);
    r.days += m.days; r.km += m.km; r.fuelCost += m.km * m.fuelPrice;
    r.actual = r.actual && m.actual;
    addInto(r.ev, m.ev); addInto(r.ice, m.ice);
    r.odometerEnd = m.odometerEnd;
    r.cum = m.cum;
  }
  let cumSaving = 0, cumSavingTco = 0;
  return [...byYear.values()].map((r) => {
    r.avgFuelPrice = r.km > 0 ? r.fuelCost / r.km : null;
    r.partial = r.days < daysInYear(r.year);
    r.savingRunning = r.ice.running - r.ev.running;
    r.savingTco = r.ice.tco - r.ev.tco;
    cumSaving += r.savingRunning; cumSavingTco += r.savingTco;
    r.cumSavingRunning = cumSaving; r.cumSavingTco = cumSavingTco;
    delete r.fuelCost;
    return r;
  });
}

function sumTotals(months) {
  const t = { km: 0, days: 0, ev: zero(), ice: zero() };
  for (const m of months) { t.km += m.km; t.days += m.days; addInto(t.ev, m.ev); addInto(t.ice, m.ice); }
  return t;
}

function summarize(t, years, ev, ice) {
  const per = (car) => ({
    runningPerYear: car.running / years,
    tcoPerYear: car.tco / years,
    runningPer100: t.km > 0 ? car.running / t.km * 100 : 0,
    tcoPer100: t.km > 0 ? car.tco / t.km * 100 : 0,
    ...car,
  });
  return {
    km: t.km,
    ev: per(t.ev), ice: per(t.ice),
    savingRunningPerYear: (t.ice.running - t.ev.running) / years,
    savingTcoPerYear: (t.ice.tco - t.ev.tco) / years,
    savingRunningTotal: t.ice.running - t.ev.running,
    savingTcoTotal: t.ice.tco - t.ev.tco,
    // Gesamtbilanz über die Haltedauer inkl. Kaufpreis und Restwert
    balanceTotal: (ice.price - ice.residual + t.ice.running) - (ev.price - ev.residual + t.ev.running),
  };
}

/**
 * Sucht den Zeitpunkt, ab dem die kumulierten Kosten des E-Autos die des Verbrenners nicht mehr übersteigen.
 * points: [{ end: Date, odometerEnd, cum }] – linear interpoliert zwischen Punkten.
 */
export function findBreakEven(points, mode, holdEnd) {
  const diff = (p) => p.cum.ev[mode] - p.cum.ice[mode];
  const first = points[0];
  // Bei TCO starten beide bei 0 → erste Periode entscheidet über "von Anfang an"
  const ref = mode === 'tco' ? points[1] : first;
  if (!ref) return { status: 'never' };
  if (diff(ref) <= 0) {
    const later = points.findIndex((p, i) => i > 0 && diff(p) > 0);
    return { status: 'immediate', evCheaperThroughout: later === -1 };
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const da = diff(a), db = diff(b);
    if (da > 0 && db <= 0) {
      const f = da / (da - db);
      const date = new Date(a.end.getTime() + f * (b.end - a.end));
      const km = a.odometerEnd + f * (b.odometerEnd - a.odometerEnd);
      return {
        status: date <= holdEnd ? 'reached' : 'beyond',
        date, dateISO: toISO(date), km, actual: !!b.actual,
        monthsAfterPurchase: monthsBetween(points[0].end, date),
      };
    }
  }
  return { status: 'never' };
}

function monthsBetween(a, b) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + (b.getUTCDate() - a.getUTCDate()) / 30;
}
const zero = () => ({ energy: 0, tax: 0, thg: 0, dep: 0, running: 0, tco: 0 });
function addInto(a, b) { for (const k in a) a[k] += b[k]; }
function num(v) { return v === '' || v == null || !Number.isFinite(+v) ? null : +v; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, +v || 0)); }

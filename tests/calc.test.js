import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, evPricePerKwh, findBreakEven } from '../src/calc.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

function base(over = {}) {
  return {
    purchaseDate: '2024-01-01', years: 5, kmPerYear: 10000, startOdometer: 0, odometer: {},
    ev: { price: 40000, residual: 20000, consumption: 15, homeShare: 100, homePrice: 0.30, roadPrice: 0.60, loss: 0, thg: 0, firstReg: '2024-01-01', weight: 2000 },
    ice: { price: 30000, residual: 15000, consumption: 6, fuel: 'benzin', ccm: 1498, co2: 128, firstReg: '2024-01-01', euroNorm: 'euro4', fuelPrice: 1.80, forecastPrice: null },
    fuelPrices: {},
    ...over,
  };
}

test('Mischstrompreis mit Ladeanteilen und Ladeverlusten', () => {
  near(evPricePerKwh({ homeShare: 70, homePrice: 0.30, roadPrice: 0.60, loss: 10 }), (0.7 * 0.3 + 0.3 * 0.6) * 1.1, 1e-9);
});

test('Jahreswerte: Energie, Steuer, Wertverlust über volle Kalenderjahre', () => {
  const r = calculate(base());
  assert.equal(r.yearsTable.length, 5);
  const y = r.yearsTable[0];
  assert.equal(y.year, 2024);
  near(y.km, 10000);
  near(y.ev.energy, 10000 / 100 * 15 * 0.30);   // 450 €
  near(y.ice.energy, 10000 / 100 * 6 * 1.80);   // 1080 €
  near(y.ev.tax, 0);
  near(y.ice.tax, 98);
  near(y.ev.dep, 20000 * 366 / 1827); near(y.ice.dep, 15000 * 366 / 1827); // 2024 = Schaltjahr
  near(r.totals.ev.dep, 20000); near(r.totals.ice.dep, 15000);
});

test('Break-even: Mehrpreis / jährliche Ersparnis', () => {
  // Ersparnis/Jahr = 1080 + 98 − 450 = 728 €; nach 10 Jahren endet die Steuerbefreiung (2.000 kg → 56,25 €/Jahr)
  // → 10 Jahre × 728 = 7.280 €, Rest 2.720 € / 671,75 € ≈ 4,05 Jahre → ≈ 14,05 Jahre (jenseits der Haltedauer)
  const r = calculate(base());
  assert.equal(r.breakEven.running.status, 'beyond');
  const yrs = 10 + 2720 / (728 - 56.25);
  near(r.breakEven.running.monthsAfterPurchase / 12, yrs, 0.02);
  near(r.breakEven.running.km, yrs * 10000, 150);
});

test('Break-even innerhalb der Haltedauer mit Monat und km-Stand', () => {
  // Mehrpreis 2.000 €, Ersparnis 728 €/Jahr → nach ~2,75 Jahren (≈ Okt. 2026), ~27.470 km
  const r = calculate(base({ ev: { ...base().ev, price: 32000, residual: 16000 } }));
  const be = r.breakEven.running;
  assert.equal(be.status, 'reached');
  assert.equal(be.dateISO.slice(0, 7), '2026-09');
  near(be.km, 2000 / 728 * 10000, 80);
});

test('E-Auto günstiger in der Anschaffung → sofortiger Break-even', () => {
  const r = calculate(base({ ev: { ...base().ev, price: 29000, residual: 14000 } }));
  assert.equal(r.breakEven.running.status, 'immediate');
  assert.equal(r.breakEven.running.evCheaperThroughout, true);
});

test('Kein Break-even, wenn E-Auto teurer im Betrieb', () => {
  const r = calculate(base({ ev: { ...base().ev, homeShare: 0, roadPrice: 0.9, consumption: 25 } }));
  assert.equal(r.breakEven.running.status, 'never');
});

test('Tatsächliche km aus Zählerständen, Prognose aus Schätzung', () => {
  const r = calculate(base({ odometer: { 2025: 12000, 2026: 20000 } }));
  const [y24, y25, y26] = r.yearsTable;
  near(y24.km, 12000); assert.equal(y24.actual, true);
  near(y25.km, 8000); assert.equal(y25.actual, true);
  near(y26.km, 10000); assert.equal(y26.actual, true === false); // Prognose
  near(y26.odometerEnd, 30000, 1);
});

test('Spritpreise: Monatsdaten, sonst letztes Preisniveau als Prognose', () => {
  const prices = {};
  for (let m = 1; m <= 12; m++) prices[`2024-${String(m).padStart(2, '0')}`] = m <= 6 ? 1.6 : 2.0;
  const r = calculate(base({ ice: { ...base().ice, fuelPrice: null }, fuelPrices: prices }));
  near(r.yearsTable[0].avgFuelPrice, (1.6 * 182 + 2.0 * 184) / 366, 0.002);
  near(r.yearsTable[1].avgFuelPrice, 2.0);
  near(r.forecastFuel, 2.0);
  assert.equal(r.yearsTable[0].actual, false); // km nicht durch Zählerstände belegt
});

test('Teiljahre: Kauf am 1.7., Jahre laufen 1.1.–31.12.', () => {
  const r = calculate(base({ purchaseDate: '2024-07-01', years: 2 }));
  assert.deepEqual(r.yearsTable.map((y) => y.year), [2024, 2025, 2026]);
  assert.equal(r.yearsTable[0].partial, true);
  assert.equal(r.yearsTable[2].partial, true);
  near(r.totals.km, 20000, 30);
  near(r.totals.ice.tax, 2 * 98, 0.5);
});

test('THG-Quote je Kalenderjahr, erst ab 2022', () => {
  const r = calculate(base({ purchaseDate: '2021-01-01', years: 3, ev: { ...base().ev, thg: 100, firstReg: '2021-01-01' } }));
  assert.deepEqual(r.yearsTable.map((y) => Math.round(y.ev.thg)), [0, 100, 100]);
});

test('TCO-Modus: Wertverlust wird einbezogen', () => {
  const r = calculate(base());
  near(r.summary.ev.tcoPerYear, r.summary.ev.runningPerYear + 4000, 1);
  near(r.summary.savingTcoPerYear, 728 - 1000, 2);
  assert.equal(r.breakEven.tco.status, 'never');
});

test('findBreakEven interpoliert linear', () => {
  const d = (s) => new Date(s + 'T00:00:00Z');
  const pts = [
    { end: d('2024-01-01'), odometerEnd: 0, cum: { ev: { running: 100 }, ice: { running: 0 } } },
    { end: d('2025-01-01'), odometerEnd: 1000, cum: { ev: { running: 100 }, ice: { running: 200 } } },
  ];
  const be = findBreakEven(pts, 'running', d('2030-01-01'));
  assert.equal(be.status, 'reached');
  near(be.km, 500);
  assert.equal(be.dateISO, '2024-07-02');
});

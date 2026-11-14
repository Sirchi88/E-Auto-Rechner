import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iceAnnualTax, evExemptionEnd, evAnnualTaxAfterExemption, evTaxAt } from '../src/tax.js';
import { toISO, ymd } from '../src/dates.js';

test('Benziner EZ 2021+: Hubraum + progressive CO₂-Staffel (Golf 1.5 TSI, 128 g)', () => {
  // 15 × 2 € = 30; 20 g × 2,00 = 40; 13 g × 2,20 = 28,60 → 98,60 → 98 €
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 1498, co2: 128, firstReg: '2023-05-01' }, 2025), 98);
});

test('Diesel EZ 2021+: 9,50 € je angefangene 100 cm³', () => {
  // 20 × 9,5 = 190; CO₂ 150: 20×2 + 20×2,2 + 15×2,5 = 121,5 → 311,5 → 311
  assert.equal(iceAnnualTax({ fuel: 'diesel', ccm: 1968, co2: 150, firstReg: '2022-01-01' }, 2025), 311);
});

test('Hohe CO₂-Werte erreichen alle Stufen bis 4 €/g', () => {
  // 30 × 2 = 60; 20×2 + 20×2,2 + 20×2,5 + 20×2,9 + 20×3,4 + 45×4 = 440 → 500
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 2981, co2: 240, firstReg: '2021-01-01' }, 2025), 500);
});

test('EZ 2014–2020: linear 2 €/g über 95 g', () => {
  // 15 × 2 = 30; (140 − 95) × 2 = 90 → 120
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 1498, co2: 140, firstReg: '2019-03-01' }, 2025), 120);
});

test('EZ 2012–2013: Freibetrag 110 g; EZ 07/2009–2011: 120 g', () => {
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 1390, co2: 140, firstReg: '2013-06-01' }, 2025), 14 * 2 + 30 * 2);
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 1390, co2: 140, firstReg: '2010-06-01' }, 2025), 14 * 2 + 20 * 2);
});

test('Alte Regel vor 01.07.2009 nach Schadstoffklasse', () => {
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 1598, co2: 170, firstReg: '2008-04-01', euroNorm: 'euro4' }, 2025), 108);
  assert.equal(iceAnnualTax({ fuel: 'diesel', ccm: 1896, co2: 150, firstReg: '2005-01-01', euroNorm: 'euro4' }, 2025), 293.36);
  assert.equal(iceAnnualTax({ fuel: 'benzin', ccm: 1598, co2: 0, firstReg: '1999-01-01', euroNorm: 'euro2' }, 2025), 117.76);
});

test('30-€-Ermäßigung für ≤ 95 g/km nur bis Steuerjahr 2024', () => {
  const v = { fuel: 'benzin', ccm: 1490, co2: 92, firstReg: '2021-02-01' };
  assert.equal(iceAnnualTax(v, 2024), 0); // 30 € − 30 €
  assert.equal(iceAnnualTax(v, 2025), 30);
});

test('E-Auto-Befreiung: 10 Jahre, längstens bis 31.12.2035', () => {
  assert.equal(toISO(evExemptionEnd('2020-03-15')), '2030-03-15');
  assert.equal(toISO(evExemptionEnd('2027-06-01')), '2036-01-01');
  assert.equal(toISO(evExemptionEnd('2030-12-31')), '2036-01-01');
  assert.equal(evExemptionEnd('2031-01-01'), null);
});

test('E-Auto nach Befreiung: Gewichtssteuer, halbiert', () => {
  // 2100 kg: 10 × 11,25 + 1 × 12,02 = 124,52 → × 0,5 = 62,26
  assert.equal(evAnnualTaxAfterExemption(2100), 62.26);
  assert.equal(evTaxAt(ymd(2029, 0, 1), { firstReg: '2020-03-15', weight: 2100 }), 0);
  assert.equal(evTaxAt(ymd(2031, 0, 1), { firstReg: '2020-03-15', weight: 2100 }), 62.26);
  assert.equal(evTaxAt(ymd(2031, 0, 1), { firstReg: '2031-01-01', weight: 2100 }), 62.26);
});

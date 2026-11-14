import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EV_MODELS, ICE_MODELS, SEGMENTS, BODIES, searchVehicles, suggestIce, findVehicle } from '../src/vehicles.js';
import { fuelSeries, seriesStats } from '../src/fuel.js';
import { STATES } from '../src/data/states.js';
import { defaultState, resolve, validate, toCalcInput, migrate, exportJSON } from '../src/state.js';
import { calculate } from '../src/calc.js';

test('Fahrzeugdaten vollständig und plausibel', () => {
  for (const v of EV_MODELS) {
    assert.ok(SEGMENTS.includes(v.segment) && BODIES.includes(v.body), v.id);
    assert.ok(v.kw > 20 && v.battery > 10 && v.consumption > 10 && v.consumption < 30 && v.price > 10000, v.id);
    assert.ok(v.from >= 2018 || v.from <= 2018, v.id);
  }
  for (const v of ICE_MODELS) {
    assert.ok(SEGMENTS.includes(v.segment) && BODIES.includes(v.body), v.id);
    assert.ok(['benzin', 'diesel'].includes(v.fuel), v.id);
    assert.ok(v.ccm > 800 && v.co2 > 80 && v.consumption > 3 && v.price > 10000, v.id);
  }
  assert.equal(new Set([...EV_MODELS, ...ICE_MODELS].map((v) => v.id)).size, EV_MODELS.length + ICE_MODELS.length);
});

test('Suche: Autovervollständigung, akzentunabhängig, mit Filtern', () => {
  assert.ok(searchVehicles(EV_MODELS, 'id.3').some((v) => v.model.startsWith('ID.3')));
  assert.ok(searchVehicles(EV_MODELS, 'citroen').every((v) => v.brand === 'Citroën'));
  assert.ok(searchVehicles(ICE_MODELS, '', { fuel: 'diesel', segment: 'Mittelklasse' }).every((v) => v.fuel === 'diesel' && v.segment === 'Mittelklasse'));
  assert.ok(searchVehicles(EV_MODELS, '', { minKw: 200, maxKw: 250 }).every((v) => v.kw >= 200 && v.kw <= 250));
});

test('Verbrenner-Vorschläge: gleiches Segment, ±20 % Leistung (bzw. vermerkt erweitert)', () => {
  for (const ev of EV_MODELS) {
    const s = suggestIce(ev);
    for (const { vehicle, reason } of s) {
      assert.equal(vehicle.segment, ev.segment);
      const dev = Math.abs(vehicle.kw - ev.kw) / ev.kw;
      assert.ok(dev <= 0.35);
      if (dev > 0.2) assert.match(reason, /erweitert/);
      assert.match(reason, /Segment/);
    }
  }
  const golfLike = suggestIce(findVehicle('ev-volkswagen-id-3-pro'));
  assert.equal(golfLike.length, 3);
});

test('Spritpreise: Reihe ab 2018 für alle Länder, Statistik', () => {
  for (const s of STATES) {
    const e10 = fuelSeries(s.code, 'e10');
    assert.equal(e10[0].ym, '2018-01');
    assert.ok(e10.every((p) => p.price > 0.9 && p.price < 2.5));
  }
  const st = seriesStats(fuelSeries('BY', 'diesel'));
  assert.equal(st.max.ym, '2022-03');
  assert.ok(st.min.price < 1.1);
});

test('Standardzustand ist gültig und rechenbar', () => {
  const r = resolve(defaultState(new Date('2026-11-14T00:00:00Z')));
  assert.deepEqual(validate(r, new Date('2026-11-14T00:00:00Z')), {});
  const res = calculate(toCalcInput(r));
  assert.ok(res.summary.ev.runningPerYear > 0 && res.summary.ice.runningPerYear > 0);
});

test('Validierung meldet fehlerhafte Eingaben', () => {
  const s = defaultState(new Date('2026-11-14T00:00:00Z'));
  s.years = 0; s.ev.homeShare = 120; s.purchaseDate = '2017-05-01';
  s.odometer = { 2025: 5000 };
  s.ev.residual = 999999;
  const e = validate(resolve(s), new Date('2026-11-14T00:00:00Z'));
  assert.ok(e.years && e['ev.homeShare'] && e.purchaseDate && e['ev.residual']);
  const s2 = defaultState(); s2.purchaseDate = '2024-03-01'; s2.startOdometer = 10000; s2.odometer = { 2025: 8000 };
  assert.ok(validate(resolve(s2), new Date('2026-11-14T00:00:00Z'))['odometer.2025']);
});

test('JSON-Export lässt sich wieder importieren', () => {
  const s = defaultState(); s.kmPerYear = 22222; s.ev.thg = 55; s.odometer = { 2025: 1234 };
  const back = migrate(JSON.parse(exportJSON(s)));
  assert.equal(back.kmPerYear, 22222); assert.equal(back.ev.thg, 55); assert.equal(back.odometer[2025], 1234);
  assert.throws(() => migrate(null));
});

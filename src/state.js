// Eingabezustand: Standardwerte, Ableitungen, Validierung, Speicherung.
import { findVehicle } from './vehicles.js';
import { fuelSeries, seriesMap, seriesStats } from './fuel.js';
import { parseDate, toISO, ymd } from './dates.js';

export const STORAGE_KEY = 'eauto-rechner.v1';
export const SCHEMA_VERSION = 1;

export function defaultState(today = new Date()) {
  const y = today.getUTCFullYear();
  return {
    version: SCHEMA_VERSION,
    onboarded: false,
    view: 'running', // 'running' | 'tco'
    state: 'NW',
    purchaseDate: toISO(ymd(y, 0, 1)),
    years: 8,
    kmPerYear: 15000,
    startOdometer: 0,
    odometer: {}, // { [Jahr]: Kilometerstand am 1.1. }
    ev: {
      vehicleId: 'ev-volkswagen-id-3-pro', name: '', custom: false,
      price: null, consumption: null, kw: null, battery: null, segment: null, body: null,
      firstReg: null, weight: null, residual: null,
      homeShare: 70, homePrice: 0.32, roadPrice: 0.55, loss: 10, thg: 80,
    },
    ice: {
      mode: 'new', // 'new' = Neuwagen-Vergleich | 'own' = eigenes altes Auto behalten
      vehicleId: 'ice-volkswagen-golf-1-5-tsi', name: '', custom: false,
      fuel: null, price: null, consumption: null, kw: null, ccm: null, co2: null, segment: null, body: null,
      firstReg: null, euroNorm: 'euro4', residual: null,
      fuelPrice: null, forecastPrice: null,
    },
  };
}

/** Grundwerte aus der Fahrzeugdatenbank (oder leer bei eigenem Fahrzeug). */
function base(car) {
  const v = car.custom ? null : findVehicle(car.vehicleId);
  return v || {};
}

/** Standard-Restwert: Listenpreis × 0,85^Jahre (für beide Antriebe gleich – bewusst neutral). */
export const defaultResidual = (price, years) => Math.round((price || 0) * Math.pow(0.85, years) / 100) * 100;

/** Für EV: zulässiges Gesamtgewicht schätzen, falls nicht angegeben. */
export const estimateWeight = (v) => Math.round(1500 + (v.battery || 50) * 9 + (v.kw || 100) * 0.8);

/** Eigenes Auto: Standard-Erstzulassung 5 Jahre vor Vergleichsbeginn. */
export function ownDefaultFirstReg(purchaseDate) {
  const d = parseDate(purchaseDate);
  return d ? toISO(ymd(d.getUTCFullYear() - 5, d.getUTCMonth(), 1)) : purchaseDate;
}
/** Eigenes Auto: Zeitwert ≈ Listenpreis × 0,85^Alter (Jahre). */
export function ownCarValue(listPrice, firstReg, purchaseDate) {
  const a = parseDate(firstReg), b = parseDate(purchaseDate);
  if (!listPrice || !a || !b) return 0;
  const age = Math.max(0, (b - a) / (365.25 * 86400000));
  return Math.round(listPrice * Math.pow(0.85, age) / 100) * 100;
}

/** Löst alle "automatisch"-Felder (null) zu effektiven Werten auf. */
export function resolve(s) {
  const evB = base(s.ev), iceB = base(s.ice);
  const pick = (val, fb) => (val === null || val === '' || val === undefined ? fb : val);
  const ev = {
    ...s.ev,
    name: s.ev.custom ? (s.ev.name || 'Eigenes E-Auto') : (evB.brand ? `${evB.brand} ${evB.model}` : 'E-Auto'),
    price: pick(s.ev.price, evB.price),
    consumption: pick(s.ev.consumption, evB.consumption),
    kw: pick(s.ev.kw, evB.kw), battery: pick(s.ev.battery, evB.battery),
    segment: pick(s.ev.segment, evB.segment), body: pick(s.ev.body, evB.body),
    firstReg: pick(s.ev.firstReg, s.purchaseDate),
  };
  ev.weight = pick(s.ev.weight, estimateWeight(ev));
  ev.residual = pick(s.ev.residual, defaultResidual(ev.price, s.years));

  const own = s.ice.mode === 'own';
  const ice = {
    ...s.ice,
    name: s.ice.custom ? (s.ice.name || (own ? 'Eigenes Auto' : 'Eigener Verbrenner')) : (iceB.brand ? `${iceB.brand} ${iceB.model}` : 'Verbrenner'),
    fuel: pick(s.ice.fuel, iceB.fuel || 'benzin'),
    price: pick(s.ice.price, iceB.price || 0),
    consumption: pick(s.ice.consumption, iceB.consumption),
    kw: pick(s.ice.kw, iceB.kw), ccm: pick(s.ice.ccm, iceB.ccm), co2: pick(s.ice.co2, iceB.co2),
    segment: pick(s.ice.segment, iceB.segment), body: pick(s.ice.body, iceB.body),
    firstReg: pick(s.ice.firstReg, own ? ownDefaultFirstReg(s.purchaseDate) : s.purchaseDate),
  };
  if (own && (s.ice.price === null || s.ice.price === '')) ice.price = ownCarValue(iceB.price, ice.firstReg, s.purchaseDate);
  ice.residual = pick(s.ice.residual, own ? Math.round(ice.price * Math.pow(0.88, s.years) / 100) * 100 : defaultResidual(ice.price, s.years));

  const series = fuelSeries(s.state, ice.fuel === 'diesel' ? 'diesel' : 'e10');
  const stats = seriesStats(series);
  return { ...s, ev, ice, fuelSeriesData: series, fuelStats: stats, fuelPrices: seriesMap(series) };
}

/** Eingabe für calculate() aus aufgelöstem Zustand, Prozent-/ct-Werte bereits in Basiseinheiten. */
export function toCalcInput(r) {
  return {
    purchaseDate: r.purchaseDate, years: +r.years, kmPerYear: +r.kmPerYear,
    startOdometer: +r.startOdometer || 0, odometer: r.odometer,
    ev: {
      price: +r.ev.price, residual: +r.ev.residual, consumption: +r.ev.consumption,
      homeShare: +r.ev.homeShare, homePrice: +r.ev.homePrice, roadPrice: +r.ev.roadPrice,
      loss: +r.ev.loss, thg: +r.ev.thg, firstReg: r.ev.firstReg, weight: +r.ev.weight,
    },
    ice: {
      price: +r.ice.price, residual: +r.ice.residual, consumption: +r.ice.consumption, fuel: r.ice.fuel,
      ccm: +r.ice.ccm, co2: +r.ice.co2, firstReg: r.ice.firstReg, euroNorm: r.ice.euroNorm,
      fuelPrice: r.ice.fuelPrice, forecastPrice: r.ice.forecastPrice,
    },
    fuelPrices: r.fuelPrices,
  };
}

/** Validierung. Liefert { 'pfad.feld': 'Meldung' }; leeres Objekt = gültig. */
export function validate(r, today = new Date()) {
  const e = {};
  const req = (path, v, min, max, label) => {
    if (v === null || v === '' || v === undefined || !Number.isFinite(+v)) e[path] = `${label}: bitte eine Zahl eingeben.`;
    else if (+v < min) e[path] = `${label}: mindestens ${min.toLocaleString('de-DE')}.`;
    else if (+v > max) e[path] = `${label}: höchstens ${max.toLocaleString('de-DE')}.`;
  };
  const pd = parseDate(r.purchaseDate);
  if (!pd) e.purchaseDate = 'Kaufdatum: bitte ein gültiges Datum wählen.';
  else if (pd < ymd(2018, 0, 1)) e.purchaseDate = 'Kaufdatum: ab 01.01.2018 (Beginn der Preisdaten).';
  else if (pd > ymd(today.getUTCFullYear() + 5, 11, 31)) e.purchaseDate = 'Kaufdatum: höchstens 5 Jahre in der Zukunft.';
  req('years', r.years, 1, 20, 'Haltedauer');
  if (!e.years && !Number.isInteger(+r.years)) e.years = 'Haltedauer: bitte ganze Jahre.';
  req('kmPerYear', r.kmPerYear, 1000, 100000, 'Kilometer pro Jahr');
  req('startOdometer', r.startOdometer, 0, 1000000, 'Kilometerstand bei Kauf');

  // Zählerstände: monoton steigend, nicht in der Zukunft
  let prev = +r.startOdometer || 0, prevLabel = 'Kauf';
  const years = Object.keys(r.odometer || {}).map(Number).sort((a, b) => a - b);
  for (const y of years) {
    const v = r.odometer[y];
    if (v === '' || v == null) continue;
    const key = `odometer.${y}`;
    if (!Number.isFinite(+v) || +v < 0) e[key] = `Stand 1.1.${y}: ungültige Zahl.`;
    else if (pd && y <= pd.getUTCFullYear()) e[key] = `Stand 1.1.${y}: liegt vor dem Kauf.`;
    else if (ymd(y, 0, 1) > today) e[key] = `Stand 1.1.${y}: liegt in der Zukunft.`;
    else if (+v < prev) e[key] = `Stand 1.1.${y}: kleiner als Stand bei ${prevLabel} (${prev.toLocaleString('de-DE')} km).`;
    else if (+v - prev > 150000) e[key] = `Stand 1.1.${y}: unplausibel hohe Fahrleistung.`;
    else { prev = +v; prevLabel = `1.1.${y}`; }
  }

  req('ev.price', r.ev.price, 0, 500000, 'Kaufpreis E-Auto');
  req('ev.consumption', r.ev.consumption, 5, 60, 'Verbrauch E-Auto (kWh/100 km)');
  req('ev.homeShare', r.ev.homeShare, 0, 100, 'Ladeanteil zu Hause');
  req('ev.homePrice', r.ev.homePrice, 0, 2, 'Strompreis zu Hause (€/kWh)');
  req('ev.roadPrice', r.ev.roadPrice, 0, 2, 'Strompreis unterwegs (€/kWh)');
  req('ev.loss', r.ev.loss, 0, 50, 'Ladeverluste');
  req('ev.thg', r.ev.thg, 0, 1000, 'THG-Quote');
  req('ev.residual', r.ev.residual, 0, 500000, 'Restwert E-Auto');
  req('ev.weight', r.ev.weight, 800, 3500, 'Zul. Gesamtgewicht');
  if (!e['ev.residual'] && +r.ev.residual > +r.ev.price) e['ev.residual'] = 'Restwert E-Auto: darf den Kaufpreis nicht übersteigen.';
  if (!parseDate(r.ev.firstReg)) e['ev.firstReg'] = 'Erstzulassung E-Auto: bitte ein gültiges Datum.';

  req('ice.price', r.ice.price, 0, 500000, r.ice.mode === 'own' ? 'Wert des eigenen Autos' : 'Kaufpreis Verbrenner');
  req('ice.consumption', r.ice.consumption, 1, 30, 'Verbrauch Verbrenner (l/100 km)');
  req('ice.ccm', r.ice.ccm, 500, 8000, 'Hubraum');
  req('ice.co2', r.ice.co2, 0, 600, 'CO₂-Ausstoß');
  req('ice.residual', r.ice.residual, 0, 500000, 'Restwert Verbrenner');
  if (!e['ice.residual'] && +r.ice.residual > +r.ice.price) e['ice.residual'] = 'Restwert Verbrenner: darf den Kaufpreis/Wert nicht übersteigen.';
  const iz = parseDate(r.ice.firstReg);
  if (!iz) e['ice.firstReg'] = 'Erstzulassung Verbrenner: bitte ein gültiges Datum.';
  else if (pd && iz > pd && r.ice.mode === 'own') e['ice.firstReg'] = 'Erstzulassung: muss beim eigenen Auto vor dem Vergleichsbeginn liegen.';
  for (const k of ['fuelPrice', 'forecastPrice']) {
    const v = r.ice[k];
    if (v !== null && v !== '' && v !== undefined) req(`ice.${k}`, v, 0.5, 5, k === 'fuelPrice' ? 'Spritpreis' : 'Prognose-Spritpreis');
  }
  return e;
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch { return null; }
}
export function save(s, storage = globalThis.localStorage) {
  try { storage && storage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* Speicher nicht verfügbar */ }
}

/** Importierte/gespeicherte Daten auf das aktuelle Schema heben (fehlende Felder mit Standardwerten). */
export function migrate(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Keine gültigen Daten.');
  const data = obj.data && obj.app === 'e-auto-rechner' ? obj.data : obj;
  const d = defaultState();
  const merged = { ...d, ...pickKnown(data, d) };
  merged.ev = { ...d.ev, ...pickKnown(data.ev || {}, d.ev) };
  merged.ice = { ...d.ice, ...pickKnown(data.ice || {}, d.ice) };
  merged.odometer = data.odometer && typeof data.odometer === 'object' ? { ...data.odometer } : {};
  merged.version = SCHEMA_VERSION;
  return merged;
}
function pickKnown(src, ref) {
  const out = {};
  for (const k of Object.keys(ref)) if (k in src && typeof src[k] !== 'object') out[k] = src[k];
  return out;
}

export function exportJSON(s) {
  return JSON.stringify({ app: 'e-auto-rechner', version: SCHEMA_VERSION, exported: new Date().toISOString(), data: s }, null, 2);
}

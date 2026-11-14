// UI: Schritt-für-Schritt-Assistent beim ersten Start, danach alles auf einer Seite.
import { STATES, STATE_NAME } from './data/states.js';
import { EV_MODELS, ICE_MODELS, SEGMENTS, BODIES, FUEL_LABEL, brandsOf, searchVehicles, suggestIce, findVehicle } from './vehicles.js';
import { defaultState, resolve, validate, toCalcInput, load, save, migrate, exportJSON } from './state.js';
import { calculate, THG_FIRST_YEAR } from './calc.js';
import { iceAnnualTax, evExemptionEnd, evAnnualTaxAfterExemption, OLD_RATES } from './tax.js';
import { fuelMeta } from './fuel.js';
import { parseDate, ymd } from './dates.js';
import { lineChart } from './charts.js';
import * as fmt from './format.js';

// ---------- Zustand ----------
let S = load() || defaultState();
let R = null, E = {}, RES = null;
let step = 0;
let updaters = [];
let showDetails = false;
const THEME_KEY = 'eauto-rechner.theme';
const VEHICLE_DATA_STAND = '2026-11';

// ---------- Helfer ----------
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  let t = o;
  for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]] ??= {};
  t[ks[ks.length - 1]] = v;
}
const fid = (path) => 'f-' + path.replace(/\./g, '-');
const own = () => S.ice.mode === 'own';

// ---------- Felddefinitionen ----------
const F = {
  state: { label: 'Bundesland', type: 'select', options: () => STATES.map((s) => [s.code, s.name]), help: 'Bestimmt die regionalen Spritpreise.' },
  purchaseDate: { label: 'Kaufdatum', type: 'date', help: 'Beginn des Vergleichs. Kalenderjahre laufen vom 1.1. bis 31.12.' },
  years: { label: 'Haltedauer', unit: 'Jahre', dec: 0 },
  kmPerYear: { label: 'Geschätzte Fahrleistung', unit: 'km/Jahr', dec: 0, help: 'Gilt für Jahre ohne Zählerstand und für die Prognose.' },
  startOdometer: { label: 'Kilometerstand bei Kauf', unit: 'km', dec: 0, help: 'Bei Neuwagen 0.' },

  'ev.name': { label: 'Bezeichnung', type: 'text', show: () => S.ev.custom },
  'ev.segment': { label: 'Segment', type: 'select', auto: true, options: () => SEGMENTS.map((s) => [s, s]), show: () => S.ev.custom },
  'ev.body': { label: 'Karosserie', type: 'select', auto: true, options: () => BODIES.map((s) => [s, s]), show: () => S.ev.custom },
  'ev.price': { label: 'Kaufpreis', unit: '€', auto: true, dec: 0, help: 'Vorbelegt mit dem Listenpreis – tatsächlichen Preis inkl. Rabatt eintragen.' },
  'ev.consumption': { label: 'Verbrauch', unit: 'kWh/100 km', auto: true, dec: 1, help: 'WLTP-Wert vorbelegt; im Alltag oft 10–20 % höher.' },
  'ev.residual': { label: 'Restwert am Ende', unit: '€', auto: true, dec: 0, help: 'Standard: 15 % Wertverlust pro Jahr.' },
  'ev.firstReg': { label: 'Erstzulassung', type: 'date', auto: true, autoHint: 'wie Kaufdatum', help: 'Steuerbefreit bei Erstzulassung bis 31.12.2030 – 10 Jahre, längstens bis 31.12.2035.' },
  'ev.weight': { label: 'Zul. Gesamtgewicht', unit: 'kg', auto: true, dec: 0, help: 'Nur für die Kfz-Steuer nach Ende der Befreiung (geschätzt).' },
  'ev.kw': { label: 'Leistung', unit: 'kW', auto: true, dec: 0 },
  'ev.battery': { label: 'Akku (netto)', unit: 'kWh', auto: true, dec: 1 },

  'ev.homeShare': { label: 'Ladeanteil zu Hause', unit: '%', dec: 0, help: 'Der Rest wird unterwegs geladen.' },
  'ev.homePrice': { label: 'Strompreis zu Hause', unit: 'ct/kWh', scale: 100, dec: 1 },
  'ev.roadPrice': { label: 'Strompreis unterwegs', unit: 'ct/kWh', scale: 100, dec: 1, help: 'Durchschnitt aus AC- und Schnellladen.' },
  'ev.loss': { label: 'Ladeverluste', unit: '%', dec: 1, help: 'Aufschlag auf den Verbrauch für Verluste beim Laden.' },
  'ev.thg': { label: 'THG-Quote', unit: '€/Jahr', dec: 0, help: `Prämie pro Kalenderjahr (ab ${THG_FIRST_YEAR}); wird von den E-Auto-Kosten abgezogen.` },

  'ice.name': { label: 'Bezeichnung', type: 'text', show: () => S.ice.custom },
  'ice.segment': { label: 'Segment', type: 'select', auto: true, options: () => SEGMENTS.map((s) => [s, s]), show: () => S.ice.custom },
  'ice.body': { label: 'Karosserie', type: 'select', auto: true, options: () => BODIES.map((s) => [s, s]), show: () => S.ice.custom },
  'ice.fuel': { label: 'Kraftstoff', type: 'select', auto: true, options: () => [['benzin', 'Benzin (E10)'], ['diesel', 'Diesel']] },
  'ice.price': { label: () => (own() ? 'Heutiger Wert (Verkaufserlös)' : 'Kaufpreis'), unit: '€', auto: true, dec: 0, help: () => (own() ? 'Was Sie beim Verkauf heute bekämen – zählt als „Kaufpreis“ des Weiterfahrens.' : 'Vorbelegt mit dem Listenpreis.') },
  'ice.consumption': { label: 'Verbrauch', unit: 'l/100 km', auto: true, dec: 1, help: 'WLTP-Wert vorbelegt; eigenen Durchschnitt eintragen, falls bekannt.' },
  'ice.residual': { label: 'Restwert am Ende', unit: '€', auto: true, dec: 0 },
  'ice.firstReg': { label: 'Erstzulassung', type: 'date', auto: true, autoHint: () => (own() ? 'geschätzt' : 'wie Kaufdatum'), help: 'Bestimmt die Steuerregel (vor 07/2009: nach Schadstoffklasse).' },
  'ice.euroNorm': { label: 'Schadstoffklasse', type: 'select', options: () => Object.entries(OLD_RATES).map(([k, v]) => [k, v.label]), show: () => { const d = parseDate(R?.ice.firstReg); return d && d < ymd(2009, 6, 1); } },
  'ice.ccm': { label: 'Hubraum', unit: 'cm³', auto: true, dec: 0 },
  'ice.co2': { label: 'CO₂-Ausstoß', unit: 'g/km', auto: true, dec: 0, help: 'WLTP (ab 09/2018), davor NEFZ laut Fahrzeugschein (Feld V.7).' },
  'ice.kw': { label: 'Leistung', unit: 'kW', auto: true, dec: 0 },

  'ice.fuelPrice': { label: 'Fester Spritpreis', unit: '€/l', auto: true, dec: 3, placeholder: () => 'Monatswerte verwenden', help: 'Optional: ersetzt die historischen Monatsmittel und die Prognose.' },
  'ice.forecastPrice': { label: 'Spritpreis für Prognose', unit: '€/l', auto: true, dec: 3, placeholder: () => fmt.inputNum(R?.fuelStats?.last.price), help: () => `Standard: letzter Monatswert (${R?.fuelStats ? fmt.ymLabel(R.fuelStats.last.ym) : '–'}).` },
};

const SECTIONS = [
  { id: 'basis', title: 'Grunddaten', lead: 'Wo und ab wann soll verglichen werden?', fields: ['state', 'purchaseDate', 'years'] },
  { id: 'km', title: 'Fahrleistung', lead: 'Geschätzte Kilometer – und sobald vorhanden die echten Zählerstände zum 1. Januar.', fields: ['kmPerYear', 'startOdometer'], after: odometerBlock },
  { id: 'ev', title: 'E-Auto', lead: 'Modell suchen oder eigenes Fahrzeug anlegen. Alle Werte lassen sich überschreiben.', before: () => pickerBlock('ev'), fields: ['ev.name', 'ev.segment', 'ev.body', 'ev.price', 'ev.consumption', 'ev.residual', 'ev.firstReg', 'ev.weight', 'ev.kw', 'ev.battery'] },
  { id: 'charge', title: 'Laden & THG-Quote', lead: 'Ihre eigenen Strompreise und wo Sie laden.', fields: ['ev.homeShare', 'ev.homePrice', 'ev.roadPrice', 'ev.loss', 'ev.thg'], after: mixInfoBlock },
  { id: 'ice', title: 'Vergleichsfahrzeug', lead: 'Ein passender Verbrenner – oder Ihr eigenes altes Auto.', before: () => [modeBlock(), suggestBlock(), pickerBlock('ice')], fields: ['ice.name', 'ice.segment', 'ice.body', 'ice.fuel', 'ice.price', 'ice.consumption', 'ice.residual', 'ice.firstReg', 'ice.euroNorm', 'ice.ccm', 'ice.co2', 'ice.kw'], after: taxInfoBlock },
  { id: 'fuel', title: 'Spritpreise', lead: 'Monatsmittel für Ihr Bundesland – bei Bedarf überschreibbar.', before: fuelChartBlock, fields: ['ice.fuelPrice', 'ice.forecastPrice'] },
];

// ---------- Felder ----------
function display(def, v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string' && def.type !== 'select' && def.type !== 'date' && def.type !== 'text') return v;
  if (def.type === 'select' || def.type === 'date' || def.type === 'text') return String(v);
  return fmt.inputNum(v * (def.scale || 1), def.dec ?? 2);
}
const val = (x) => (typeof x === 'function' ? x() : x);

function fieldEl(path) {
  const def = F[path];
  const id = fid(path);
  let input;
  const onChange = () => {
    let v;
    if (def.type === 'select' || def.type === 'date' || def.type === 'text') v = input.value === '' ? (def.auto ? null : '') : input.value;
    else {
      const n = fmt.parseNum(input.value);
      v = n === null ? (def.auto ? null : '') : Number.isNaN(n) ? input.value : n / (def.scale || 1);
      if (typeof v === 'number') v = Math.round(v * 1e6) / 1e6;
    }
    setPath(S, path, v);
    commit();
  };
  if (def.type === 'select') {
    input = h('select', { id, class: 'input', onchange: onChange }, val(def.options).map(([v, l]) => h('option', { value: v }, l)));
  } else if (def.type === 'date') {
    input = h('input', { id, class: 'input', type: 'date', min: '2000-01-01', onchange: onChange });
  } else if (def.type === 'text') {
    input = h('input', { id, class: 'input', type: 'text', autocomplete: 'off', oninput: onChange });
  } else {
    input = h('input', { id, class: 'input num', type: 'text', inputmode: def.dec === 0 ? 'numeric' : 'decimal', autocomplete: 'off', oninput: onChange });
  }
  const errId = id + '-err', helpId = id + '-help';
  input.setAttribute('aria-describedby', `${helpId} ${errId}`);
  const label = h('label', { for: id });
  const autoTag = h('span', { class: 'auto-tag' });
  const reset = h('button', { type: 'button', class: 'linkbtn reset', title: 'Auf automatischen Wert zurücksetzen', onclick: () => { setPath(S, path, null); commit(); } }, 'zurücksetzen');
  const help = h('p', { class: 'help', id: helpId });
  const err = h('p', { class: 'err', id: errId, role: 'alert' });
  const wrap = h('div', { class: 'field' + (def.type === 'text' ? ' wide' : '') },
    h('div', { class: 'label-row' }, label, autoTag, reset),
    h('div', { class: 'control' }, input, def.unit ? h('span', { class: 'unit' }, def.unit) : null),
    help, err);

  updaters.push(() => {
    const show = def.show ? !!def.show() : true;
    wrap.hidden = !show;
    label.textContent = val(def.label);
    help.textContent = val(def.help) || '';
    help.hidden = !help.textContent;
    const sv = getPath(S, path), rv = getPath(R, path);
    const isAuto = def.auto && (sv == null || sv === '');
    if (def.type === 'select') {
      if (document.activeElement !== input) input.value = rv ?? sv ?? '';
    } else if (def.type === 'date') {
      if (document.activeElement !== input) input.value = (isAuto ? rv : sv) || '';
    } else if (document.activeElement !== input) {
      input.value = display(def, sv);
    }
    if (def.type !== 'select' && def.type !== 'date') {
      input.placeholder = def.placeholder ? def.placeholder() || '' : def.auto ? display(def, rv) : '';
    }
    autoTag.textContent = isAuto ? (def.type === 'date' ? `automatisch · ${val(def.autoHint) || ''}` : 'automatisch') : '';
    autoTag.hidden = !(def.auto && isAuto) || def.placeholder;
    reset.hidden = !(def.auto && !isAuto);
    const msg = E[path] || '';
    err.textContent = msg;
    wrap.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  });
  return wrap;
}

// ---------- Blöcke ----------
function odometerBlock() {
  const box = h('div', { class: 'block' });
  let sig = '';
  updaters.push(() => {
    const pd = parseDate(R.purchaseDate);
    const now = new Date();
    const years = [];
    if (pd) {
      const last = Math.min(pd.getUTCFullYear() + (+R.years || 0), now.getUTCFullYear());
      for (let y = pd.getUTCFullYear() + 1; y <= last; y++) years.push(y);
    }
    const nsig = years.join(',');
    if (nsig !== sig) {
      sig = nsig;
      box.innerHTML = '';
      if (!years.length) {
        box.append(h('p', { class: 'note' }, 'Zählerstände zum 1.1. können eingetragen werden, sobald das erste Jahr vorbei ist. Bis dahin rechnet die App mit der geschätzten Fahrleistung (Prognose, gestrichelt).'));
        return;
      }
      box.append(h('h4', { class: 'sub' }, 'Tatsächliche Kilometerstände'),
        h('p', { class: 'note' }, 'Optional. Jahre mit Zählerstand werden als tatsächliche Werte gerechnet (durchgezogen), alle übrigen als Prognose (gestrichelt).'));
      const grid = h('div', { class: 'grid' });
      for (const y of years) {
        const path = `odometer.${y}`;
        if (!F[path]) F[path] = { label: `Stand am 1.1.${y}`, unit: 'km', dec: 0, auto: true };
        grid.append(fieldEl(path));
      }
      box.append(grid);
      // neue Feld-Updater sofort anwenden
      runUpdaters();
    }
  });
  return box;
}

function mixInfoBlock() {
  const p = h('p', { class: 'note calc-note' });
  updaters.push(() => {
    if (!R) return;
    const ev = R.ev;
    const share = Math.min(100, Math.max(0, +ev.homeShare || 0)) / 100;
    const mix = (share * ev.homePrice + (1 - share) * ev.roadPrice) * (1 + (+ev.loss || 0) / 100);
    p.textContent = isFinite(mix) ? `Effektiver Strompreis inkl. Ladeverlusten: ${fmt.num(mix * 100, 1)} ct/kWh → ${fmt.num(mix * ev.consumption, 2)} € pro 100 km.` : '';
  });
  return p;
}

function taxInfoBlock() {
  const p = h('p', { class: 'note calc-note' });
  updaters.push(() => {
    if (!R || E['ice.ccm'] || E['ice.co2'] || E['ice.firstReg']) { p.textContent = ''; return; }
    const year = new Date().getUTCFullYear();
    const t = iceAnnualTax({ ...R.ice, ccm: +R.ice.ccm, co2: +R.ice.co2 }, year);
    const end = evExemptionEnd(R.ev.firstReg);
    const evAfter = evAnnualTaxAfterExemption(+R.ev.weight);
    p.textContent = `Kfz-Steuer Verbrenner: ${fmt.eur(t, 2)}/Jahr. E-Auto: ` +
      (end ? `steuerfrei bis ${fmt.date(new Date(end.getTime() - 86400000))}, danach ca. ${fmt.eur(evAfter, 2)}/Jahr.` : `nicht befreit, ca. ${fmt.eur(evAfter, 2)}/Jahr.`);
  });
  return p;
}

function modeBlock() {
  const mk = (mode, label) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'seg-btn', onclick: () => {
      if (S.ice.mode === mode) return;
      S.ice.mode = mode;
      for (const k of ['price', 'residual', 'firstReg']) S.ice[k] = null;
      commit();
    } }, label);
    updaters.push(() => { b.setAttribute('aria-checked', String(S.ice.mode === mode)); });
    return b;
  };
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Art des Vergleichs' }, mk('new', 'Neuen Verbrenner kaufen'), mk('own', 'Eigenes Auto behalten'));
}

function suggestBlock() {
  const box = h('div', { class: 'suggest' });
  let sig = null;
  updaters.push(() => {
    box.hidden = own();
    const ev = R.ev;
    const nsig = [ev.segment, ev.body, ev.kw, ev.price, S.ice.vehicleId, S.ice.custom].join('|');
    if (nsig === sig) return;
    sig = nsig;
    box.innerHTML = '';
    if (!ev.segment || !(+ev.kw > 0) || !(+ev.price > 0)) {
      box.append(h('p', { class: 'note' }, 'Für Vorschläge beim E-Auto Segment, Leistung und Preis angeben.'));
      return;
    }
    const base = { ...(findVehicle(S.ev.vehicleId) || {}), segment: ev.segment, body: ev.body, kw: +ev.kw, price: +ev.price };
    const list = suggestIce(base);
    box.append(h('h4', { class: 'sub' }, `Passende Verbrenner zum ${ev.name}`));
    if (!list.length) { box.append(h('p', { class: 'note' }, 'Kein Verbrenner im gleichen Segment mit ähnlicher Leistung (±20 %, erweitert ±35 %) in der Datenbank – bitte über die Suche wählen oder ein eigenes Fahrzeug anlegen.')); return; }
    box.append(h('div', { class: 'suggest-list' }, list.map(({ vehicle, reason }) => {
      const active = !S.ice.custom && S.ice.vehicleId === vehicle.id;
      return h('button', { type: 'button', class: 'suggest-item' + (active ? ' active' : ''), 'aria-pressed': String(active), onclick: () => selectVehicle('ice', vehicle) },
        h('span', { class: 'si-name' }, `${vehicle.brand} ${vehicle.model}`),
        h('span', { class: 'si-facts' }, `${FUEL_LABEL[vehicle.fuel]} · ${vehicle.kw} kW · ${fmt.eur(vehicle.price)}`),
        h('span', { class: 'si-reason' }, reason));
    })));
  });
  return box;
}

const VEHICLE_FIELDS = {
  ev: ['price', 'consumption', 'kw', 'battery', 'segment', 'body', 'weight', 'residual'],
  ice: ['fuel', 'price', 'consumption', 'kw', 'ccm', 'co2', 'segment', 'body', 'residual'],
};
function selectVehicle(kind, v) {
  S[kind].vehicleId = v.id;
  S[kind].custom = false;
  S[kind].name = '';
  for (const k of VEHICLE_FIELDS[kind]) S[kind][k] = null;
  commit();
}
function makeCustom(kind) {
  // aktuelle Werte übernehmen, damit nichts verloren geht – danach frei änderbar
  for (const k of VEHICLE_FIELDS[kind]) if (k !== 'residual' && !(kind === 'ice' && k === 'price' && own())) S[kind][k] = R[kind][k] ?? null;
  S[kind].custom = true;
  S[kind].name = '';
  commit();
  setTimeout(() => document.getElementById(fid(`${kind}.name`))?.focus(), 0);
}

function pickerBlock(kind) {
  const list = kind === 'ev' ? EV_MODELS : ICE_MODELS;
  const f = { brand: '', segment: '', body: '', fuel: '', minKw: '', maxKw: '' };
  const lbId = `lb-${kind}`;
  let active = -1, results = [];
  const current = h('div', { class: 'picker-current' });
  const q = h('input', {
    type: 'search', class: 'input', id: `q-${kind}`, role: 'combobox', 'aria-expanded': 'false', 'aria-controls': lbId, 'aria-autocomplete': 'list', autocomplete: 'off',
    placeholder: kind === 'ev' ? 'E-Auto suchen, z. B. „ID.3“ oder „Tesla“' : 'Verbrenner suchen, z. B. „Golf“ oder „320d“',
  });
  const lb = h('ul', { class: 'results', id: lbId, role: 'listbox', hidden: true });
  const sel = (key, label, opts) => h('label', { class: 'mini' }, label,
    h('select', { class: 'input', onchange: (e) => { f[key] = e.target.value; open(); } }, h('option', { value: '' }, 'alle'), opts.map((o) => h('option', { value: o }, o))));
  const kwIn = (key, label) => h('label', { class: 'mini' }, label,
    h('input', { class: 'input num', type: 'text', inputmode: 'numeric', placeholder: 'kW', oninput: (e) => { f[key] = +fmt.parseNum(e.target.value) || ''; open(); } }));
  const filters = h('div', { class: 'filters', hidden: true },
    sel('brand', 'Marke', brandsOf(list)), sel('segment', 'Segment', SEGMENTS), sel('body', 'Karosserie', BODIES),
    kind === 'ice' ? h('label', { class: 'mini' }, 'Kraftstoff', h('select', { class: 'input', onchange: (e) => { f.fuel = e.target.value; open(); } }, h('option', { value: '' }, 'alle'), h('option', { value: 'benzin' }, 'Benzin'), h('option', { value: 'diesel' }, 'Diesel'))) : null,
    kwIn('minKw', 'Leistung ab'), kwIn('maxKw', 'bis'));
  const filterBtn = h('button', { type: 'button', class: 'btn ghost small', 'aria-expanded': 'false', onclick: () => {
    filters.hidden = !filters.hidden; filterBtn.setAttribute('aria-expanded', String(!filters.hidden));
    if (!filters.hidden) open();
  } }, 'Filter');

  function renderList() {
    lb.innerHTML = '';
    const shown = results.slice(0, 8);
    shown.forEach((v, i) => {
      lb.append(h('li', { role: 'option', id: `${lbId}-${i}`, class: 'opt' + (i === active ? ' active' : ''), 'aria-selected': String(i === active),
        onmousedown: (e) => { e.preventDefault(); choose(v); } },
      h('span', { class: 'o-name' }, `${v.brand} ${v.model}`),
      h('span', { class: 'o-facts' }, [v.segment, v.body, kind === 'ice' ? FUEL_LABEL[v.fuel] : `${fmt.num(v.battery, 1)} kWh`, `${v.kw} kW / ${v.ps} PS`, fmt.eur(v.price)].join(' · '))));
    });
    if (!results.length) lb.append(h('li', { class: 'opt empty' }, 'Kein Treffer – Filter lockern oder eigenes Fahrzeug anlegen.'));
    else if (results.length > shown.length) lb.append(h('li', { class: 'opt more' }, `${results.length - shown.length} weitere – Suche verfeinern`));
    q.setAttribute('aria-activedescendant', active >= 0 ? `${lbId}-${active}` : '');
  }
  function open() {
    results = searchVehicles(list, q.value, f);
    active = results.length ? 0 : -1;
    lb.hidden = false; q.setAttribute('aria-expanded', 'true');
    renderList();
  }
  function close() { lb.hidden = true; q.setAttribute('aria-expanded', 'false'); }
  function choose(v) { q.value = ''; close(); selectVehicle(kind, v); }
  q.addEventListener('input', open);
  q.addEventListener('focus', open);
  q.addEventListener('blur', () => setTimeout(close, 120));
  q.addEventListener('keydown', (e) => {
    const n = Math.min(8, results.length);
    if (e.key === 'ArrowDown') { e.preventDefault(); if (lb.hidden) open(); else { active = (active + 1) % n; renderList(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + n) % n; renderList(); }
    else if (e.key === 'Enter' && !lb.hidden && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') close();
  });

  updaters.push(() => {
    const r = R[kind];
    const v = !S[kind].custom && findVehicle(S[kind].vehicleId);
    const facts = kind === 'ev'
      ? [r.segment, r.body, r.kw && `${r.kw} kW / ${Math.round(r.kw * 1.35962)} PS`, r.battery && `${fmt.num(+r.battery, 1)} kWh`]
      : [r.segment, r.body, FUEL_LABEL[r.fuel], r.kw && `${r.kw} kW / ${Math.round(r.kw * 1.35962)} PS`, r.ccm && `${fmt.num(+r.ccm)} cm³`];
    current.innerHTML = '';
    current.append(
      h('div', { class: 'pc-main' },
        h('span', { class: 'dot ' + kind }),
        h('div', null, h('div', { class: 'pc-name' }, r.name, S[kind].custom ? h('span', { class: 'badge' }, 'eigenes Fahrzeug') : null),
          h('div', { class: 'pc-facts' }, facts.filter(Boolean).join(' · ') + (v ? ` · ${v.from}${v.to ? '–' + v.to : '–heute'}` : '')))),
    );
  });

  return h('div', { class: 'picker' }, current,
    h('div', { class: 'picker-search' }, h('label', { class: 'sr-only', for: `q-${kind}` }, 'Fahrzeug suchen'), q, filterBtn),
    filters,
    h('div', { class: 'lb-wrap' }, lb),
    h('button', { type: 'button', class: 'linkbtn', onclick: () => makeCustom(kind) }, kind === 'ev' ? '+ Eigenes E-Auto anlegen' : (own() ? '+ Eigenes Auto manuell eingeben' : '+ Eigenes Fahrzeug anlegen')));
}

function fuelChartBlock() {
  const box = h('div', { class: 'fuel-block' });
  const head = h('p', { class: 'note' });
  const chart = h('div', { class: 'chart-host' });
  const stats = h('div', { class: 'stat-row' });
  box.append(head, chart, stats);
  let sig = '';
  const draw = () => {
    const ser = R.fuelSeriesData, st = R.fuelStats;
    if (!ser.length) return;
    const meta = fuelMeta();
    const fuelName = R.ice.fuel === 'diesel' ? 'Diesel' : 'Super E10';
    head.textContent = `${fuelName} · ${STATE_NAME[R.state]} · Monatsmittel ${fmt.ymLabel(ser[0].ym)} bis ${fmt.ymLabel(st.last.ym)}`;
    const toX = (ym) => Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 15);
    const pd = parseDate(R.purchaseDate);
    lineChart(chart, {
      height: 200,
      ariaLabel: `Liniendiagramm ${fuelName}-Preis in ${STATE_NAME[R.state]}. Höchstwert ${fmt.perLitre(st.max.price)} im ${fmt.ymLabel(st.max.ym)}, Tiefstwert ${fmt.perLitre(st.min.price)} im ${fmt.ymLabel(st.min.ym)}.`,
      series: [{ name: fuelName, color: 'var(--ice)', points: ser.map((p) => ({ x: toX(p.ym), y: p.price, actual: true })) }],
      yFormat: (v, tip) => (tip ? fmt.perLitre(v) : fmt.num(v, 2)),
      xFormat: (x) => fmt.monthYear(new Date(x)),
      markers: [
        { x: toX(st.max.ym), y: st.max.price, label: `Hoch ${fmt.num(st.max.price, 3)} €`, color: 'var(--ice)' },
        { x: toX(st.min.ym), y: st.min.price, label: `Tief ${fmt.num(st.min.price, 3)} €`, color: 'var(--ice)', below: true },
      ],
      vlines: pd ? [{ x: pd.getTime(), label: 'Kauf' }] : [],
    });
    stats.innerHTML = '';
    stats.append(
      stat('Höchstwert', fmt.perLitre(st.max.price), fmt.ymLabel(st.max.ym)),
      stat('Tiefstwert', fmt.perLitre(st.min.price), fmt.ymLabel(st.min.ym)),
      stat('Letzter Wert', fmt.perLitre(st.last.price), fmt.ymLabel(st.last.ym)),
      stat('Ø 12 Monate', fmt.perLitre(st.avg12), meta.approximate ? 'Näherungswerte' : 'Tankerkönig'));
  };
  updaters.push(() => {
    const nsig = `${R.state}|${R.ice.fuel}|${R.purchaseDate}|${chart.clientWidth}`;
    if (nsig !== sig) { sig = nsig; draw(); }
  });
  return box;
}
const stat = (label, value, sub) => h('div', { class: 'stat' }, h('div', { class: 'stat-l' }, label), h('div', { class: 'stat-v' }, value), h('div', { class: 'stat-s' }, sub));

function sectionEl(sec, { numbered } = {}) {
  const body = h('div', { class: 'grid' }, sec.fields.map(fieldEl));
  return h('section', { class: 'card section', id: `sec-${sec.id}`, 'aria-labelledby': `h-${sec.id}` },
    h('h2', { id: `h-${sec.id}` }, numbered ? h('span', { class: 'num' }, numbered) : null, sec.title),
    sec.lead ? h('p', { class: 'lead' }, sec.lead) : null,
    sec.before ? sec.before() : null,
    body,
    sec.after ? sec.after() : null);
}

// ---------- Ergebnis ----------
function resultsEl() {
  const box = h('div', { class: 'results-col' });
  const toggle = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Kostenansicht' });
  for (const [mode, label] of [['running', 'Laufende Kosten'], ['tco', 'TCO inkl. Wertverlust']]) {
    const b = h('button', { type: 'button', role: 'radio', class: 'seg-btn', onclick: () => { S.view = mode; commit(); } }, label);
    updaters.push(() => b.setAttribute('aria-checked', String(S.view === mode)));
    toggle.append(b);
  }
  const errBox = h('div', { class: 'card errors', role: 'alert', hidden: true });
  const kpis = h('div', { class: 'kpis' });
  const chartCard = h('section', { class: 'card' });
  const tableCard = h('section', { class: 'card' });
  const assume = h('details', { class: 'card assumptions' });
  box.append(h('div', { class: 'results-head' }, h('h2', null, 'Ergebnis'), toggle), errBox, kpis, chartCard, tableCard, assume);
  let chartW = 0, lastRes = null, lastView = '';

  updaters.push(() => {
    const errs = Object.entries(E);
    errBox.hidden = !errs.length;
    [kpis, chartCard, tableCard].forEach((x) => x.classList.toggle('stale', !!errs.length));
    if (errs.length) {
      errBox.innerHTML = '';
      errBox.append(h('strong', null, 'Bitte Eingaben prüfen:'), h('ul', null, errs.map(([p, m]) => h('li', null, h('a', { href: '#' + fid(p), onclick: (e) => { e.preventDefault(); const t = document.getElementById(fid(p)); t?.focus(); t?.scrollIntoView({ block: 'center' }); } }, m)))));
      return;
    }
    if (!RES) return;
    const w = chartCard.clientWidth;
    if (RES === lastRes && S.view === lastView && Math.abs(w - chartW) < 2) return;
    lastRes = RES; lastView = S.view; chartW = w;
    renderKpis(kpis); renderChart(chartCard); renderTable(tableCard); renderAssumptions(assume);
  });
  return box;
}

function breakEvenText(be, mode) {
  const r = RES;
  if (be.status === 'immediate') {
    return mode === 'running'
      ? { main: 'Sofort', sub: be.evCheaperThroughout ? 'E-Auto ist in Anschaffung und Betrieb nicht teurer.' : 'E-Auto ist in der Anschaffung nicht teurer.' }
      : { main: 'Von Anfang an', sub: be.evCheaperThroughout ? 'E-Auto ist über die ganze Haltedauer günstiger.' : 'E-Auto startet günstiger.' };
  }
  if (be.status === 'never') {
    return { main: mode === 'running' ? 'Nicht erreicht' : 'Nicht innerhalb der Haltedauer', sub: mode === 'running' ? `Auch nach ${MAX_YEARS_TXT} gleicht die Ersparnis den Mehrpreis nicht aus.` : 'Mit Wertverlust bleibt das E-Auto teurer.' };
  }
  const yrs = be.monthsAfterPurchase / 12;
  const sub = `bei ${fmt.km(Math.round(be.km / 100) * 100)} · nach ${fmt.num(yrs, 1)} Jahren`;
  if (be.status === 'beyond') return { main: fmt.monthYear(be.date), sub: `${sub} – nach Ende der Haltedauer (Prognose)`, forecast: true };
  return { main: fmt.monthYear(be.date), sub: sub + (be.actual ? '' : ' (Prognose)'), forecast: !be.actual };
}
const MAX_YEARS_TXT = '30 Jahren';

function renderKpis(box) {
  const r = RES, s = r.summary, tco = S.view === 'tco';
  const k = tco ? 'tcoPerYear' : 'runningPerYear', k100 = tco ? 'tcoPer100' : 'runningPer100';
  const saving = tco ? s.savingTcoPerYear : s.savingRunningPerYear;
  const savingTotal = tco ? s.savingTcoTotal : s.savingRunningTotal;
  const be = breakEvenText(r.breakEven[tco ? 'tco' : 'running'], tco ? 'tco' : 'running');
  const pair = (a, b, d = 0) => h('div', { class: 'pair' },
    h('div', null, h('span', { class: 'dot ev' }), h('span', { class: 'pl' }, 'E-Auto'), h('b', null, fmt.eur(a, d))),
    h('div', null, h('span', { class: 'dot ice' }), h('span', { class: 'pl' }, own() ? 'Eigenes Auto' : 'Verbrenner'), h('b', null, fmt.eur(b, d))));
  box.innerHTML = '';
  box.append(
    h('div', { class: 'kpi hero' },
      h('div', { class: 'kpi-l' }, 'Break-even'),
      h('div', { class: 'kpi-v' + (be.forecast ? ' forecast' : '') }, be.main),
      h('div', { class: 'kpi-s' }, be.sub)),
    h('div', { class: 'kpi' },
      h('div', { class: 'kpi-l' }, tco ? 'Ersparnis/Jahr inkl. Wertverlust' : 'Ersparnis pro Jahr'),
      h('div', { class: 'kpi-v' }, fmt.eurSigned(saving)),
      h('div', { class: 'kpi-s' }, `${fmt.eurSigned(savingTotal)} über ${r.years} ${r.years === 1 ? 'Jahr' : 'Jahre'}`)),
    h('div', { class: 'kpi' },
      h('div', { class: 'kpi-l' }, tco ? 'Kosten pro Jahr (TCO)' : 'Laufende Kosten pro Jahr'),
      pair(s.ev[k], s.ice[k])),
    h('div', { class: 'kpi' },
      h('div', { class: 'kpi-l' }, 'Kosten pro 100 km'),
      pair(s.ev[k100], s.ice[k100], 2)),
    h('div', { class: 'kpi' },
      h('div', { class: 'kpi-l' }, own() ? 'Mehrpreis ggü. Weiterfahren' : 'Mehrpreis E-Auto'),
      h('div', { class: 'kpi-v' }, fmt.eurSigned(r.priceDiff)),
      h('div', { class: 'kpi-s' }, `${fmt.eur(R.ev.price)} vs. ${fmt.eur(R.ice.price)}`)),
    h('div', { class: 'kpi' },
      h('div', { class: 'kpi-l' }, 'Gesamtbilanz Haltedauer'),
      h('div', { class: 'kpi-v' }, fmt.eurSigned(s.balanceTotal)),
      h('div', { class: 'kpi-s' }, s.balanceTotal >= 0 ? 'zugunsten E-Auto (inkl. Kauf und Restwert)' : `zugunsten ${own() ? 'eigenes Auto' : 'Verbrenner'} (inkl. Kauf und Restwert)`)),
  );
}

function renderChart(card) {
  const r = RES, mode = S.view === 'tco' ? 'tco' : 'running';
  const be = r.breakEven[mode];
  let months = mode === 'tco' ? r.holdMonths : r.months;
  if (mode === 'running') {
    let endT = r.holdEnd.getTime();
    if (be.status === 'beyond') endT = Math.max(endT, be.date.getTime() + 365 * 86400000);
    months = months.filter((m) => m.start.getTime() < endT);
  }
  const startY = (car) => (mode === 'running' ? (car === 'ev' ? +R.ev.price : +R.ice.price) : 0);
  const first = months[0];
  const pts = (car) => [{ x: r.start.getTime(), y: startY(car), actual: first?.actual ?? false },
    ...months.map((m) => ({ x: m.end.getTime(), y: m.cum[car][mode], actual: m.actual }))];
  const evName = R.ev.name, iceName = R.ice.name;
  card.innerHTML = '';
  const host = h('div', { class: 'chart-host' });
  card.append(
    h('div', { class: 'card-head' },
      h('h3', null, mode === 'running' ? 'Kumulierte Kosten inkl. Kaufpreis' : 'Kumulierte Kosten inkl. Wertverlust'),
      h('div', { class: 'legend' },
        h('span', null, h('span', { class: 'sw ev' }), evName),
        h('span', null, h('span', { class: 'sw ice' }), iceName),
        h('span', null, h('span', { class: 'sw line' }), 'tatsächlich'),
        h('span', null, h('span', { class: 'sw dash' }), 'Prognose'))),
    host,
    h('p', { class: 'caption' }, mode === 'running'
      ? 'Startwert ist der Kaufpreis; danach kommen Energie und Steuer hinzu, die THG-Quote wird abgezogen. Wo sich die Linien kreuzen, hat die Ersparnis den Mehrpreis ausgeglichen.'
      : 'Linearer Wertverlust (Kaufpreis − Restwert) plus laufende Kosten über die Haltedauer.'));
  const markers = [];
  if (be.status === 'reached' || be.status === 'beyond') {
    const p = months.find((m) => m.end >= be.date);
    const y = p ? interpolateAt(months, be.date, 'ev', mode, startY('ev'), r.start) : 0;
    markers.push({ x: be.date.getTime(), y, label: `Break-even ${fmt.monthYear(be.date)}`, color: 'var(--ev)' });
  }
  requestAnimationFrame(() => lineChart(host, {
    height: 280, yZero: mode === 'tco',
    ariaLabel: `Kumulierte Kosten von ${evName} und ${iceName}. ${markers[0] ? markers[0].label : 'Kein Schnittpunkt im Zeitraum.'}`,
    series: [
      { name: evName, short: 'E-Auto', color: 'var(--ev)', points: pts('ev') },
      { name: iceName, short: own() ? 'Eigenes Auto' : 'Verbrenner', color: 'var(--ice)', points: pts('ice') },
    ],
    yFormat: (v, tip) => (tip ? fmt.eur(v) : Math.abs(v) >= 1000 ? fmt.num(v / 1000, 0) + ' T€' : fmt.num(v, 0) + ' €'),
    xFormat: (x) => fmt.monthYear(new Date(x)),
    markers,
    vlines: r.holdEnd.getTime() < months[months.length - 1].end.getTime() ? [{ x: r.holdEnd.getTime(), label: 'Ende Haltedauer' }] : [],
    tipExtra: (i) => {
      const m = i > 0 ? months[i - 1] : null;
      return m ? `<div class="tip-foot">Kilometerstand ${fmt.km(Math.round(m.odometerEnd))}</div>` : '';
    },
  }));
}
function interpolateAt(months, date, car, mode, y0, start) {
  let prevT = start.getTime(), prevY = y0;
  for (const m of months) {
    const t = m.end.getTime(), y = m.cum[car][mode];
    if (t >= date.getTime()) return prevY + (y - prevY) * (date.getTime() - prevT) / (t - prevT || 1);
    prevT = t; prevY = y;
  }
  return prevY;
}

function renderTable(card) {
  const r = RES, tco = S.view === 'tco';
  const key = tco ? 'tco' : 'running';
  card.innerHTML = '';
  const detailBtn = h('button', { type: 'button', class: 'btn ghost small', 'aria-pressed': String(showDetails), onclick: () => { showDetails = !showDetails; renderTable(card); } }, showDetails ? 'Aufschlüsselung ausblenden' : 'Aufschlüsselung zeigen');
  const cols = [
    ['Jahr', (y) => h('span', null, String(y.year), y.partial ? h('sup', { title: 'Teiljahr' }, '*') : null, y.actual ? null : h('span', { class: 'chip' }, 'Prognose'))],
    ['km', (y) => fmt.num(y.km)],
    ['Ø Sprit', (y) => (y.avgFuelPrice ? fmt.num(y.avgFuelPrice, 3) : '–')],
  ];
  if (showDetails) {
    cols.push(['E: Strom', (y) => fmt.eur(y.ev.energy)], ['E: Steuer', (y) => fmt.eur(y.ev.tax)], ['E: THG', (y) => fmt.eur(-y.ev.thg)]);
    if (tco) cols.push(['E: Wertverl.', (y) => fmt.eur(y.ev.dep)]);
  }
  cols.push(['E-Auto', (y) => h('b', null, fmt.eur(y.ev[key]))]);
  if (showDetails) {
    cols.push(['V: Sprit', (y) => fmt.eur(y.ice.energy)], ['V: Steuer', (y) => fmt.eur(y.ice.tax)]);
    if (tco) cols.push(['V: Wertverl.', (y) => fmt.eur(y.ice.dep)]);
  }
  cols.push([own() ? 'Eigenes Auto' : 'Verbrenner', (y) => h('b', null, fmt.eur(y.ice[key]))]);
  cols.push(['Ersparnis', (y) => fmt.eurSigned(tco ? y.savingTco : y.savingRunning)]);
  cols.push(tco ? ['kumuliert', (y) => fmt.eurSigned(y.cumSavingTco)] : ['Bilanz inkl. Mehrpreis', (y) => fmt.eurSigned(y.cumSavingRunning - r.priceDiff)]);

  const t = r.totals;
  const totalRow = {
    year: 'Summe', km: t.km,
    cells: {
      'E-Auto': fmt.eur(t.ev[key]), 'Verbrenner': fmt.eur(t.ice[key]), 'Eigenes Auto': fmt.eur(t.ice[key]),
      'Ersparnis': fmt.eurSigned(t.ice[key] - t.ev[key]),
      'E: Strom': fmt.eur(t.ev.energy), 'E: Steuer': fmt.eur(t.ev.tax), 'E: THG': fmt.eur(-t.ev.thg), 'E: Wertverl.': fmt.eur(t.ev.dep),
      'V: Sprit': fmt.eur(t.ice.energy), 'V: Steuer': fmt.eur(t.ice.tax), 'V: Wertverl.': fmt.eur(t.ice.dep),
    },
  };
  const table = h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, cols.map(([c]) => h('th', { scope: 'col' }, c)))),
    h('tbody', null, r.yearsTable.map((y) => h('tr', { class: y.actual ? '' : 'fc' }, cols.map(([, f]) => h('td', null, f(y)))))),
    h('tfoot', null, h('tr', null, cols.map(([c], i) => h('td', null, i === 0 ? 'Summe' : c === 'km' ? fmt.num(totalRow.km) : totalRow.cells[c] ?? '')))));
  card.append(
    h('div', { class: 'card-head' }, h('h3', null, 'Jahresübersicht'), detailBtn),
    h('div', { class: 'tbl-wrap', tabindex: '0', role: 'region', 'aria-label': 'Jahrestabelle' }, table),
    h('p', { class: 'caption' }, '* Teiljahr (Kauf bzw. Ende der Haltedauer im Jahr). „Prognose“: kein Zählerstand zum Folgejahr oder kein Spritpreis vorhanden – gerechnet mit geschätzten km und letztem Preisniveau.'));
}

function renderAssumptions(det) {
  const r = RES, meta = fuelMeta(), st = R.fuelStats;
  const iceTaxNow = iceAnnualTax({ ...R.ice, ccm: +R.ice.ccm, co2: +R.ice.co2 }, new Date().getUTCFullYear());
  const exEnd = evExemptionEnd(R.ev.firstReg);
  const fixed = R.ice.fuelPrice != null && R.ice.fuelPrice !== '';
  det.innerHTML = '';
  det.append(h('summary', null, h('h3', null, 'Annahmen & Datenstand')),
    h('ul', { class: 'assume' },
      h('li', null, h('b', null, 'Spritpreise: '), fixed ? `fest ${fmt.perLitre(+R.ice.fuelPrice)} (manuell).` :
        `${R.ice.fuel === 'diesel' ? 'Diesel' : 'Super E10'}, ${STATE_NAME[R.state]}, Monatsmittel bis ${fmt.ymLabel(st.last.ym)} (${meta.source}). ` +
        `Danach Prognose mit ${fmt.perLitre(r.forecastFuel)}. ${meta.approximate ? 'Ausgelieferte Werte sind Näherungen (Bundesmittel + geschätzter Länderzuschlag) – mit dem Update-Skript durch echte Tankerkönig-Monatsmittel ersetzen.' : ''}`),
      h('li', null, h('b', null, 'Strom: '), `${fmt.num(r.kwhPrice * 100, 1)} ct/kWh effektiv (${fmt.num(+R.ev.homeShare, 0)} % zu Hause à ${fmt.num(R.ev.homePrice * 100, 1)} ct, Rest unterwegs à ${fmt.num(R.ev.roadPrice * 100, 1)} ct, zzgl. ${fmt.num(+R.ev.loss, 1)} % Ladeverluste), über alle Jahre konstant.`),
      h('li', null, h('b', null, 'Kfz-Steuer: '), `Verbrenner ${fmt.eur(iceTaxNow, 2)}/Jahr nach KraftStG (Hubraum + CO₂-Staffel nach Erstzulassung ${fmt.date(parseDate(R.ice.firstReg))}). ` +
        (exEnd ? `E-Auto steuerfrei bis ${fmt.date(new Date(exEnd.getTime() - 86400000))}, danach gewichtsbezogen (halbiert, ca. ${fmt.eur(evAnnualTaxAfterExemption(+R.ev.weight), 2)}/Jahr).` : 'E-Auto ohne Steuerbefreiung.') + ' Tagesgenau anteilig.'),
      h('li', null, h('b', null, 'THG-Quote: '), `${fmt.eur(+R.ev.thg)} je Kalenderjahr ab ${THG_FIRST_YEAR}, auch in Teiljahren voll.`),
      h('li', null, h('b', null, 'Kilometer: '), `Jahre mit Zählerstand zum 1.1. des Folgejahres gelten als tatsächlich, sonst ${fmt.km(+R.kmPerYear)}/Jahr (anteilig). Beide Autos fahren dieselbe Strecke.`),
      h('li', null, h('b', null, 'Wertverlust: '), `linear über ${r.years} Jahre: E-Auto ${fmt.eur(R.ev.price - R.ev.residual)}, ${own() ? 'eigenes Auto' : 'Verbrenner'} ${fmt.eur(R.ice.price - R.ice.residual)}.`),
      h('li', null, h('b', null, 'Break-even: '), 'Zeitpunkt, an dem die kumulierte Ersparnis den Mehrpreis ausgleicht; monatsgenau, zwischen Monatsenden linear interpoliert. Gesucht wird bis 30 Jahre nach Kauf mit Prognosewerten.'),
      h('li', null, h('b', null, 'Nicht enthalten: '), 'Versicherung, Wartung, Reifen, Finanzierung, Förderprämien, Wallbox.'),
      h('li', null, h('b', null, 'Datenstand: '), `Fahrzeugdaten ${VEHICLE_DATA_STAND} (Listenpreise und WLTP-Werte gerundet, Basisvarianten), Spritpreise ${fmt.ymLabel(meta.stand)}, Kfz-Steuer nach KraftStG mit E-Auto-Befreiung für Erstzulassungen bis 31.12.2030.`)));
}

// ---------- Ablauf ----------
function compute() {
  R = resolve(S);
  E = validate(R);
  RES = null;
  if (!Object.keys(E).length) {
    try { RES = calculate(toCalcInput(R)); } catch (err) { console.error(err); E = { _: 'Berechnung fehlgeschlagen: ' + err.message }; }
  }
}
function runUpdaters() { for (const u of [...updaters]) u(); }
function commit() {
  save(S);
  compute();
  runUpdaters();
}

function render() {
  updaters = [];
  compute();
  const main = document.getElementById('main');
  main.innerHTML = '';
  main.append(S.onboarded ? pageEl() : wizardEl());
  runUpdaters();
}

function wizardEl() {
  const n = SECTIONS.length;
  const sec = SECTIONS[step];
  const stepErrors = () => Object.keys(E).filter((p) => sec.fields.includes(p) || (sec.id === 'km' && p.startsWith('odometer.')) || (sec.id === 'basis' && ['purchaseDate', 'years'].includes(p)));
  const next = h('button', { type: 'button', class: 'btn primary', onclick: () => {
    if (stepErrors().length) { document.getElementById(fid(stepErrors()[0]))?.focus(); return; }
    if (step < n - 1) { step++; render(); window.scrollTo({ top: 0 }); document.getElementById(`h-${SECTIONS[step].id}`)?.focus(); }
    else finishWizard();
  } }, step < n - 1 ? 'Weiter' : 'Ergebnis anzeigen');
  const back = h('button', { type: 'button', class: 'btn ghost', disabled: step === 0, onclick: () => { step--; render(); window.scrollTo({ top: 0 }); } }, 'Zurück');
  const card = sectionEl(sec, { numbered: step + 1 });
  card.querySelector('h2').setAttribute('tabindex', '-1');
  return h('div', { class: 'wizard' },
    h('div', { class: 'intro' },
      h('h1', null, 'Lohnt sich ein E-Auto für Sie?'),
      h('p', null, 'In sechs kurzen Schritten zum Break-even – ohne Anmeldung, alle Daten bleiben in Ihrem Browser.')),
    h('div', { class: 'progress', 'aria-label': `Schritt ${step + 1} von ${n}` },
      h('ol', null, SECTIONS.map((s, i) => h('li', { class: i < step ? 'done' : i === step ? 'current' : '', 'aria-current': i === step ? 'step' : null }, h('span', { class: 'pi' }, String(i + 1)), h('span', { class: 'pt' }, s.title))))),
    card,
    h('div', { class: 'wizard-nav' }, back, h('span', { class: 'step-count' }, `${step + 1} / ${n}`), next),
    h('p', { class: 'skip' }, h('button', { type: 'button', class: 'linkbtn', onclick: finishWizard }, 'Mit Standardwerten direkt zum Ergebnis')));
}
function finishWizard() {
  S.onboarded = true;
  save(S);
  render();
  window.scrollTo({ top: 0 });
}

function pageEl() {
  const inputs = h('div', { class: 'inputs-col' }, h('h2', { class: 'col-title' }, 'Eingaben'), SECTIONS.map((s) => sectionEl(s)));
  return h('div', { class: 'layout' }, resultsEl(), inputs);
}

// ---------- Kopfzeile: Theme, Export/Import ----------
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('theme-btn');
  if (btn) {
    const label = t === 'dark' ? 'Dunkel' : t === 'light' ? 'Hell' : 'Automatisch';
    btn.setAttribute('aria-label', `Farbschema: ${label} (wechseln)`);
    btn.title = `Farbschema: ${label}`;
    btn.dataset.mode = t || 'auto';
  }
}
function initHeader() {
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch { /* ignorieren */ }
  applyTheme(theme);
  document.getElementById('theme-btn').addEventListener('click', () => {
    const order = ['auto', 'dark', 'light'];
    const cur = document.getElementById('theme-btn').dataset.mode || 'auto';
    const nxt = order[(order.indexOf(cur) + 1) % order.length];
    try { nxt === 'auto' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, nxt); } catch { /* ignorieren */ }
    applyTheme(nxt === 'auto' ? null : nxt);
    render();
  });
  const menu = document.getElementById('menu');
  const close = () => menu.removeAttribute('open');
  document.getElementById('act-export').addEventListener('click', () => {
    const blob = new Blob([exportJSON(S)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `e-auto-rechner-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    close(); toast('Daten als JSON exportiert.');
  });
  const file = document.getElementById('import-file');
  document.getElementById('act-import').addEventListener('click', () => { file.click(); close(); });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      S = migrate(JSON.parse(await f.text()));
      S.onboarded = true;
      save(S); render(); toast('Daten importiert.');
    } catch (err) { toast('Import fehlgeschlagen: keine gültige Datei.', true); }
    file.value = '';
  });
  document.getElementById('act-wizard').addEventListener('click', () => { S.onboarded = false; step = 0; save(S); render(); close(); window.scrollTo({ top: 0 }); });
  document.getElementById('act-reset').addEventListener('click', () => {
    close();
    if (!confirm('Alle Eingaben auf Standardwerte zurücksetzen?')) return;
    S = defaultState(); step = 0; save(S); render(); toast('Zurückgesetzt.');
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
}
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.toggle('err', !!isErr); t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3200);
}

let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(runUpdaters, 150); });

initHeader();
render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

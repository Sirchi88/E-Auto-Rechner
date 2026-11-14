// Einstellungs-Schema: Neue Einstellungen hier ergänzen – der Admin-Bereich
// rendert sie automatisch. Typen: choice | number | toggle
export const SETTINGS_SCHEMA = [
  { section: 'Warm-up', key: 'warmupMin', label: 'Warm-up-Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min']], default: 3 },
  { section: '20-Switch', key: 'switchMin', label: '20-Switch-Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min']], default: 3 },
  { section: 'Around the Clock', key: 'atcSingleLimit', label: 'Fehlwurf-Grenze Single', hint: 'Darüber: „Empfehlung: Wiederholen“', type: 'number', min: 0, max: 200, step: 1, default: 5 },
  { section: 'Around the Clock', key: 'atcDoubleLimit', label: 'Fehlwurf-Grenze Doppel', hint: 'Darüber: „Empfehlung: Wiederholen“', type: 'number', min: 0, max: 500, step: 1, default: 30 },
  { section: 'Random Checkouts', key: 'coMin', label: 'Range von', type: 'number', min: 2, max: 170, step: 1, default: 20 },
  { section: 'Random Checkouts', key: 'coMax', label: 'Range bis', type: 'number', min: 2, max: 170, step: 1, default: 90 },
  { section: 'Random Checkouts', key: 'coMode', label: 'Standardmodus', type: 'choice', options: [['time', 'Zeit'], ['count', 'Anzahl']], default: 'count' },
  { section: 'Random Checkouts', key: 'coMinutes', label: 'Standard-Zeit', hint: 'Minuten', type: 'number', min: 1, max: 120, step: 1, default: 5 },
  { section: 'Random Checkouts', key: 'coCount', label: 'Standard-Anzahl', hint: '10–30 Checkouts', type: 'number', min: 10, max: 30, step: 1, default: 15 },
  { section: 'Random Checkouts', key: 'coShowPath', label: 'Checkout-Weg anzeigen', type: 'toggle', default: true },
  { section: 'Bereit fürs Match?', key: 'readyQuote', label: 'Mindest-Checkout-Quote', hint: 'in %', type: 'number', min: 0, max: 100, step: 5, default: 40 },
];

export const DEFAULT_LEEK_ORDER = ['warmup', 'sequence', 'atcSingle', 'atcDouble', 'switch', 'checkouts'];

export function defaultSettings() {
  const s = {};
  for (const f of SETTINGS_SCHEMA) s[f.key] = f.default;
  s.leekOrder = DEFAULT_LEEK_ORDER.map(id => ({ id, on: true }));
  return s;
}

export function normalizeSettings(raw, knownGameIds) {
  const s = { ...defaultSettings(), ...(raw || {}) };
  for (const f of SETTINGS_SCHEMA) {
    if (f.type === 'number') {
      let v = Number(s[f.key]);
      if (!Number.isFinite(v)) v = f.default;
      s[f.key] = Math.min(f.max, Math.max(f.min, Math.round(v)));
    } else if (f.type === 'choice') {
      if (!f.options.some(([v]) => v === s[f.key])) s[f.key] = f.default;
    } else if (f.type === 'toggle') {
      s[f.key] = !!s[f.key];
    }
  }
  if (s.coMin > s.coMax) [s.coMin, s.coMax] = [s.coMax, s.coMin];
  // Leek-Reihenfolge: unbekannte entfernen, neue Spiele hinten anhängen
  const seen = new Set();
  let order = Array.isArray(s.leekOrder) ? s.leekOrder.filter(o => o && knownGameIds.includes(o.id) && !seen.has(o.id) && seen.add(o.id)) : [];
  for (const id of knownGameIds) if (!seen.has(id)) order.push({ id, on: false });
  s.leekOrder = order.map(o => ({ id: o.id, on: !!o.on }));
  return s;
}

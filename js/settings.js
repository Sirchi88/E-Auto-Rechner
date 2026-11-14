// Einstellungs-Schema: Neue Einstellungen hier ergänzen – der Admin-Bereich
// rendert sie automatisch. Typen: choice | number | toggle
export const SETTINGS_SCHEMA = [
  { section: 'Allgemein', key: 'sound', label: 'Töne', hint: 'Kurze Klick-, Treffer- und Timer-Töne', type: 'toggle', default: true },
  { section: 'Allgemein', key: 'versus', label: '1vs1 im Startmenü', hint: 'Duell-Modus auf einem Gerät', type: 'toggle', default: true },

  { section: 'Warm-up & 20-Switch', key: 'warmupMin', label: 'Warm-up-Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min']], default: 3 },
  { section: 'Warm-up & 20-Switch', key: 'switchMin', label: '20-Switch-Dauer', type: 'choice', options: [[3, '3 Min'], [5, '5 Min']], default: 3 },

  { section: 'Around the Clock', key: 'atcMode', label: 'Standard-Modus', hint: 'Einfach: selbst zählen · Ausführlich: jeden Dart quittieren', type: 'choice', options: [['simple', 'Einfach'], ['detailed', 'Ausführlich']], default: 'detailed' },
  { section: 'Around the Clock', key: 'atcSingleLimit', label: 'Fehlwurf-Grenze Single', type: 'number', min: 0, max: 200, step: 1, default: 5 },
  { section: 'Around the Clock', key: 'atcDoubleLimit', label: 'Fehlwurf-Grenze Doppel', type: 'number', min: 0, max: 500, step: 1, default: 30 },
  { section: 'Around the Clock', key: 'atcTripleLimit', label: 'Fehlwurf-Grenze Triple', type: 'number', min: 0, max: 500, step: 1, default: 30 },

  { section: 'Random Checkouts', key: 'coMin', label: 'Range von', hint: 'Empfohlen: 20', type: 'number', min: 2, max: 170, step: 1, default: 20 },
  { section: 'Random Checkouts', key: 'coMax', label: 'Range bis', hint: 'Empfohlen: 90', type: 'number', min: 2, max: 170, step: 1, default: 90 },
  { section: 'Random Checkouts', key: 'coMode', label: 'Standardmodus', type: 'choice', options: [['count', 'Checks'], ['time', 'Zeit']], default: 'count' },
  { section: 'Random Checkouts', key: 'coCount', label: 'Checks benötigt', hint: 'Nur geschaffte Checkouts zählen', type: 'number', min: 1, max: 100, step: 1, default: 15 },
  { section: 'Random Checkouts', key: 'coMinutes', label: 'Standard-Zeit', hint: 'Minuten', type: 'number', min: 1, max: 120, step: 1, default: 5 },
  { section: 'Random Checkouts', key: 'coShowPath', label: 'Checkout-Weg anzeigen', type: 'toggle', default: true },

  { section: 'Ich liebe meine Doppel', key: 'dblMode', label: 'Standardmodus', type: 'choice', options: [['time', 'Zeit'], ['hits', 'Treffer']], default: 'time' },
  { section: 'Ich liebe meine Doppel', key: 'dblMinutes', label: 'Dauer', type: 'choice', options: [[3, '3'], [5, '5'], [7, '7 Min']], default: 5 },
  { section: 'Ich liebe meine Doppel', key: 'dblHits', label: 'Treffer-Ziel', type: 'number', min: 1, max: 200, step: 1, default: 20 },

  { section: '121', key: 'l121Variant', label: 'Standard-Variante', type: 'choice', options: [['classic', 'Klassisch'], ['leek', 'Leek'], ['grob', 'GROB Boys']], default: 'classic' },

  { section: 'Dran bleiben Junge', key: 'drillMin', label: 'Dauer', type: 'choice', options: [[3, '3'], [5, '5'], [7, '7 Min']], default: 5 },

  { section: 'Leek Survival', key: 'svDifficulty', label: 'Standard-Stufe', type: 'choice', options: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['insane', 'Insane']], default: 'normal' },
  { section: 'Leek Survival', key: 'svLivesEasy', label: 'Leben Easy', type: 'number', min: 1, max: 30, step: 1, default: 10 },
  { section: 'Leek Survival', key: 'svLivesNormal', label: 'Leben Normal', type: 'number', min: 1, max: 30, step: 1, default: 7 },
  { section: 'Leek Survival', key: 'svLivesHard', label: 'Leben Hard', type: 'number', min: 1, max: 30, step: 1, default: 5 },
  { section: 'Leek Survival', key: 'svLivesInsane', label: 'Leben Insane', type: 'number', min: 1, max: 30, step: 1, default: 3 },

  { section: '1vs1', key: 'vsChecks', label: 'Random Checkouts: Checks zum Sieg', type: 'number', min: 1, max: 30, step: 1, default: 5 },

  { section: 'Bereit fürs Match?', key: 'readyQuote', label: 'Mindest-Checkout-Quote', hint: 'in %', type: 'number', min: 0, max: 100, step: 5, default: 40 },
];

// Standard im Leek-Programm (weitere Spiele sind wählbar, aber anfangs aus)
export const DEFAULT_LEEK_ORDER = ['warmup', 'sequence', 'atcSingle', 'atcDouble', 'switch', 'checkouts'];

export function defaultSettings(gameIds = DEFAULT_LEEK_ORDER) {
  const s = {};
  for (const f of SETTINGS_SCHEMA) s[f.key] = f.default;
  s.leekOrder = [...DEFAULT_LEEK_ORDER.map(id => ({ id, on: true })), ...gameIds.filter(id => !DEFAULT_LEEK_ORDER.includes(id)).map(id => ({ id, on: false }))];
  s.customOrder = gameIds.map(id => ({ id, on: false }));
  s.dblCustom = ['D20', 'D10', 'D5'];
  s.vsNames = ['', ''];
  return s;
}

function normOrder(list, knownIds, defOn) {
  const seen = new Set();
  const order = Array.isArray(list) ? list.filter(o => o && knownIds.includes(o.id) && !seen.has(o.id) && seen.add(o.id)) : [];
  for (const id of knownIds) if (!seen.has(id)) order.push({ id, on: defOn(id) });
  return order.map(o => ({ id: o.id, on: !!o.on }));
}

export function normalizeSettings(raw, knownGameIds) {
  const s = { ...defaultSettings(knownGameIds), ...(raw || {}) };
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
  s.leekOrder = normOrder(s.leekOrder, knownGameIds, () => false);
  s.customOrder = normOrder(s.customOrder, knownGameIds, () => false);
  if (!Array.isArray(s.dblCustom) || !s.dblCustom.length) s.dblCustom = ['D20', 'D10', 'D5'];
  if (!Array.isArray(s.vsNames)) s.vsNames = ['', ''];
  return s;
}

export const svLives = (s, diff) => s[`svLives${diff[0].toUpperCase()}${diff.slice(1)}`];

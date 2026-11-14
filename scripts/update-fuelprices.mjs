#!/usr/bin/env node
// Erzeugt src/data/fuelprices.js aus der Tankerkönig-Historie.
//
// Datenquelle (kostenlos, Lizenz CC BY 4.0, Registrierung bei tankerkoenig.de erforderlich):
//   git clone https://tankerkoenig@dev.azure.com/tankerkoenig/tankerkoenig-data/_git/tankerkoenig-data
//   Struktur: prices/YYYY/MM/YYYY-MM-DD-prices.csv  (date,station_uuid,diesel,e5,e10,dieselchange,e5change,e10change)
//             stations/YYYY/MM/YYYY-MM-DD-stations.csv (uuid,name,brand,street,house_number,post_code,city,latitude,longitude,…)
//
// Aufruf:
//   node scripts/update-fuelprices.mjs --data /pfad/zu/tankerkoenig-data [--from 2018-01] [--to 2026-10] [--out src/data/fuelprices.js]
//
// Methode: Für jede Tankstelle und jeden Tag wird der zeitgewichtete Tagesdurchschnittspreis gebildet
// (jeder gemeldete Preis gilt bis zur nächsten Meldung bzw. Tagesende; der letzte Preis des Vortags gilt ab 0 Uhr).
// Je Bundesland und Monat wird daraus der Mittelwert über alle Tankstellen-Tage gebildet.
// Das Bundesland ergibt sich aus der Postleitzahl der Tankstelle (scripts/plz-bundesland.mjs).
import { createReadStream } from 'node:fs';
import { readdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { plzToState } from './plz-bundesland.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
if (!args.data) {
  console.error('Bitte --data /pfad/zu/tankerkoenig-data angeben (siehe Kopfkommentar).');
  process.exit(1);
}
const root = resolve(args.data);
const from = args.from || '2018-01';
const out = resolve(args.out || fileURLToPath(new URL('../src/data/fuelprices.js', import.meta.url)));
const STATES = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
const FUELS = ['diesel', 'e10'];

async function* csvRows(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line) continue;
    const cols = line.split(',');
    if (!header) { header = cols.map((c) => c.trim()); continue; }
    yield Object.fromEntries(header.map((h, i) => [h, cols[i]]));
  }
}
/** "2024-01-01 06:00:43+01" → ms */
function parseTime(str) {
  return Date.parse(String(str).trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
}
async function listDays(sub) {
  const files = [];
  for (const y of (await readdir(join(root, sub))).filter((d) => /^\d{4}$/.test(d)).sort()) {
    for (const m of (await readdir(join(root, sub, y))).filter((d) => /^\d{2}$/.test(d)).sort()) {
      const ym = `${y}-${m}`;
      if (ym < from || (args.to && ym > args.to)) continue;
      for (const f of (await readdir(join(root, sub, y, m))).filter((f) => f.endsWith('.csv')).sort()) files.push({ ym, file: join(root, sub, y, m, f), day: f.slice(0, 10) });
    }
  }
  return files;
}

// 1) Tankstellen → Bundesland (neueste Stationsliste je Monat reicht; alle Monate zusammenführen)
const stationState = new Map();
const stationFiles = await listDays('stations');
const lastPerMonth = new Map(stationFiles.map((f) => [f.ym, f.file]));
for (const file of lastPerMonth.values()) {
  for await (const r of csvRows(file)) {
    const st = plzToState(r.post_code);
    if (st) stationState.set(r.uuid, st);
  }
}
console.log(`${stationState.size} Tankstellen mit Bundesland.`);

// 2) Preise: zeitgewichtete Tagesmittel je Tankstelle → Monatsmittel je Land
const acc = {}; // acc[ym][state][fuel] = { sum, n }
const lastPrice = new Map(); // `${uuid}|${fuel}` → letzter Preis (Übertrag in den nächsten Tag)
const lastSeen = new Map(); // `${uuid}|${fuel}` → letzter Tag mit Meldung
const priceFiles = await listDays('prices');
let done = 0;
for (const { ym, file, day } of priceFiles) {
  const events = new Map(); // key → [[t, price], …]
  let tz = null; // Zeitzonen-Offset des Tages aus den Daten (+01 Winter, +02 Sommer)
  for await (const r of csvRows(file)) {
    const t = parseTime(r.date);
    tz ??= (/([+-]\d{2})(?::?\d{2})?$/.exec(r.date) || [])[1];
    for (const f of FUELS) {
      const p = +r[f];
      if (!Number.isFinite(t)) continue;
      if (!(p > 0.5 && p < 4)) continue; // Ausreißer/0-Meldungen ignorieren
      const key = `${r.station_uuid}|${f}`;
      if (!events.has(key)) events.set(key, []);
      events.get(key).push([t, p]);
    }
  }
  const dayStart = Date.parse(`${day}T00:00:00${tz || '+01'}:00`);
  const dayEnd = dayStart + 86400000;
  const keys = new Set([...events.keys(), ...lastPrice.keys()]);
  for (const key of keys) {
    const [uuid, f] = key.split('|');
    const st = stationState.get(uuid);
    if (!st) continue;
    const ev = (events.get(key) || []).sort((a, b) => a[0] - b[0]);
    let cur = lastPrice.get(key), tPrev = dayStart, wsum = 0, wt = 0;
    for (const [t, p] of ev) {
      const tt = Math.min(Math.max(t, dayStart), dayEnd);
      if (cur != null && tt > tPrev) { wsum += cur * (tt - tPrev); wt += tt - tPrev; }
      cur = p; tPrev = tt;
    }
    if (cur != null && dayEnd > tPrev) { wsum += cur * (dayEnd - tPrev); wt += dayEnd - tPrev; }
    if (!ev.length) { // keine Meldung heute: Station nur zählen, wenn sie in den letzten 7 Tagen aktiv war
      if (dayStart - (lastSeen.get(key) ?? -Infinity) > 7 * 86400000) continue;
    } else lastSeen.set(key, dayStart);
    if (wt > 0) {
      const a = ((acc[ym] ??= {})[st] ??= {})[f] ??= { sum: 0, n: 0 };
      a.sum += wsum / wt; a.n++;
    }
    if (cur != null) lastPrice.set(key, cur);
  }
  if (++done % 30 === 0) console.log(`${day} verarbeitet (${done}/${priceFiles.length})`);
}

// 3) Ausgabe
const months = Object.keys(acc).sort();
if (!months.length) { console.error('Keine Preisdaten gefunden.'); process.exit(1); }
const states = {};
for (const st of STATES) {
  states[st] = {};
  for (const f of FUELS) states[st][f] = months.map((m) => { const a = acc[m]?.[st]?.[f]; return a && a.n ? Math.round(a.sum / a.n * 1000) / 1000 : null; });
}
const national = {};
for (const f of FUELS) national[f] = months.map((m, i) => {
  const v = STATES.map((st) => states[st][f][i]).filter((x) => x != null);
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 1000) / 1000 : null;
});
const meta = {
  source: 'Tankerkönig-Historie (MTS-K), CC BY 4.0',
  method: 'Zeitgewichtete Tagesmittel je Tankstelle, Monatsmittel je Bundesland (PLZ-Zuordnung)',
  approximate: false,
  stand: months[months.length - 1],
  generated: new Date().toISOString().slice(0, 10),
};
const js = `// Monatsmittel der Spritpreise (€/l) je Bundesland – automatisch erzeugt von scripts/update-fuelprices.mjs.
// Nicht von Hand bearbeiten.
export const FUEL_DATA = ${JSON.stringify({ meta, start: months[0], national, states })};
`;
await writeFile(out, js);
console.log(`Geschrieben: ${out} (${months[0]} bis ${meta.stand}, ${(await stat(out)).size} Bytes)`);

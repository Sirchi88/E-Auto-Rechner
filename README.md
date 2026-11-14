# E-Auto-Rechner

Minimalistische PWA (Deutsch, mobile first, ohne Anmeldung und ohne Backend), die die Kosten eines E-Autos mit einem passenden Verbrenner **oder dem eigenen alten Auto** vergleicht und den **Break-even** berechnet.

- Beim ersten Start: Schritt-für-Schritt-Assistent (6 Schritte), danach alles auf einer Seite änderbar
- Daten bleiben im Browser (`localStorage`), Export/Import als JSON über das Menü
- Offline-fähig (Service Worker), installierbar, Hell-/Dunkel-Modus (automatisch oder manuell)

## Starten

Keine Abhängigkeiten, kein Build-Schritt – reine ES-Module.

```bash
npm start          # http://localhost:8080 (node scripts/serve.mjs)
npm test           # Rechenlogik, Steuer, Daten, Validierung, Update-Skript (node --test)
```

Für das Hosting genügt jeder statische Webserver (z. B. GitHub Pages); der Service Worker benötigt HTTPS oder `localhost`.

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/calc.js` | Rechenkern: monatsweise Simulation, Kalenderjahre 1.1.–31.12., Break-even (monatsgenau interpoliert) |
| `src/tax.js` | Kfz-Steuer nach KraftStG: Hubraum + CO₂-Staffel (je nach Erstzulassung), alte Regel vor 07/2009, E-Auto-Befreiung und Gewichtssteuer |
| `src/state.js` | Standardwerte, „automatische“ Felder, Validierung, Speichern, JSON-Export/-Import |
| `src/vehicles.js` | Suche mit Autovervollständigung, Filter, Verbrenner-Vorschläge |
| `src/fuel.js` | Spritpreis-Reihen je Bundesland, Hoch/Tief |
| `src/charts.js` | SVG-Liniendiagramme (tatsächlich durchgezogen, Prognose gestrichelt, Tooltip) |
| `src/app.js` | Oberfläche |
| `src/data/ev.js`, `src/data/ice.js` | Fahrzeugdaten (JSON-Zeilen im Code) |
| `src/data/fuelprices.js` | Monatsmittel Diesel/E10 je Bundesland ab 2018 |

## Rechenmodell

Pro Monat (aggregiert zu Kalenderjahren):

- **Energie**: km × Verbrauch × Preis. Strom: Mischpreis aus Ladeanteil zu Hause/unterwegs × (1 + Ladeverluste). Sprit: Monatsmittel des Bundeslands, danach letztes Preisniveau (oder eigener Wert).
- **Kfz-Steuer**: tagesgenau anteilig. E-Auto steuerfrei bei Erstzulassung bis 31.12.2030 für 10 Jahre, längstens bis 31.12.2035; danach Gewichtssteuer (halbiert).
- **THG-Quote**: je Kalenderjahr ab 2022, wird beim E-Auto abgezogen.
- **Wertverlust**: linear (Kaufpreis − Restwert) über die Haltedauer – nur in der Ansicht „TCO inkl. Wertverlust“.
- **Kilometer**: Jahre mit Zählerstand zum 1.1. des Folgejahres = tatsächlich (durchgezogen), sonst geschätzte km/Jahr (Prognose, gestrichelt).
- **Break-even**: Zeitpunkt (Monat/Jahr und km-Stand), an dem die kumulierte Ersparnis den Mehrpreis ausgleicht; Suche bis 30 Jahre nach Kauf.

Nicht enthalten: Versicherung, Wartung, Reifen, Finanzierung, Förderprämien.

## Spritpreise aktualisieren (Tankerkönig)

Die ausgelieferten Werte sind **Näherungen** (gerundete Bundes-Monatsmittel + geschätzter Länderzuschlag) – die App weist darauf hin. Echte Werte erzeugt das Update-Skript aus der Tankerkönig-Historie (CC BY 4.0, kostenlose Registrierung):

```bash
git clone https://tankerkoenig@dev.azure.com/tankerkoenig/tankerkoenig-data/_git/tankerkoenig-data
node scripts/update-fuelprices.mjs --data ./tankerkoenig-data --from 2018-01
```

Methode: zeitgewichtete Tagesmittel je Tankstelle, daraus Monatsmittel je Bundesland (Zuordnung über die PLZ, `scripts/plz-bundesland.mjs`). Das Skript überschreibt `src/data/fuelprices.js`; danach in `sw.js` die `VERSION` erhöhen.

## Datenstand

Fahrzeugdaten 11/2026 (Basis-/Volumenvarianten, Listenpreise und WLTP-Werte gerundet – in der App überschreibbar), Spritpreise bis 10/2026 (Näherung), Kfz-Steuer nach KraftStG. Alle Angaben ohne Gewähr.

`npm run icons` erzeugt die PNG-Icons aus `icons/icon.svg` (benötigt Playwright).

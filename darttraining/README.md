# Darttraining mit The Leek

Warm-up- und Einspiel-App für Steeldart (PWA, Deutsch, offline nutzbar, Daten nur lokal im Browser).

## Starten
Reine statische Web-App ohne Build-Schritt. Lokal z. B.:

```bash
cd darttraining
python3 -m http.server 8080
# → http://localhost:8080
```

Für die Installation als App (Homescreen) und den Offline-Modus muss die Seite über **HTTPS**
(oder `localhost`) ausgeliefert werden, z. B. per GitHub Pages / Netlify mit dem Ordner `darttraining/` als Wurzel.

## Tastatur (PC)
- Around the Clock: **Enter** = Treffer, **Leertaste** = Fehlwurf, **Backspace** = Undo
- Random Checkouts: **Enter** = Check, **Leertaste** = Fail, **Backspace** = Undo, **P** = Pause (Zeitmodus)
- Timer-Spiele: **Leertaste/Enter** = Start/Pause

## Aufbau
```
index.html, manifest.webmanifest, sw.js   PWA-Hülle & Offline-Cache
css/style.css                             Design (Farben aus dem Logo)
js/app.js                                 Navigation, Sessions, TheLeek Mode
js/settings.js                            Einstellungs-Schema (Admin wird daraus generiert)
js/store.js                               localStorage (Einstellungen, Sessions, Checkout-Runden)
js/games/*.js                             Spiele – registriert in js/games/registry.js
js/screens/*.js                           Auswertung, Statistik-Verlauf, Admin
js/checkouts.js                           Checkout-Wege (Double-Out)
```

### Neues Spiel ergänzen
1. Modul in `js/games/` anlegen mit `{ id, name, short, tracked, mount(root, ctx), summary(data, settings) }`.
   `ctx` bietet `settings`, `onKey(fn)` und `finish(data)`. `summary` liefert `{ value, note?, bad? }` –
   `bad: true` lässt den „Bereit fürs Match?“-Check scheitern.
2. In `js/games/registry.js` eintragen und Datei in `sw.js` (ASSETS) aufnehmen; `CACHE`-Version erhöhen.

### Neue Einstellung ergänzen
Eintrag in `SETTINGS_SCHEMA` (`js/settings.js`) – erscheint automatisch im Admin-Bereich.

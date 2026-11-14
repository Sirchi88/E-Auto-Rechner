// Spiele-Registry: Neues Spiel = Modul mit { id, name, short, tracked, info, mount(root, ctx), summary(data, settings) }
// anlegen und hier eintragen. Es erscheint dann automatisch in Einzel Trainings, im individuellen Programm,
// im Admin (Leek'sches Programm) und in der Statistik.
// ctx: { settings, leek (Setup überspringen, Standardwerte nutzen), autoStart, onKey(fn), finish(data) }
import warmup from './warmup.js';
import sequence from './sequence.js';
import { atcSingle, atcDouble, atcTriple } from './atc.js';
import switchGame from './switch.js';
import checkouts from './checkouts.js';
import doubles from './doubles.js';
import l121 from './l121.js';
import drill from './drill.js';
import survival from './survival.js';

export const GAMES = [warmup, sequence, atcSingle, atcDouble, atcTriple, switchGame, checkouts, doubles, l121, drill, survival];

// Kachel-Grafik + minimale Erklärung
const META = {
  warmup: ['🔥', 'Locker einwerfen – nur ein Timer.'],
  sequence: ['20', 'Je 12 Treffer: 20, 19, 18, 17, Bull.'],
  atcSingle: ['1→20', '1 bis 20 + Bull, Fehlwürfe zählen.'],
  atcDouble: ['D', 'D1 bis D20 + Bull.'],
  atcTriple: ['T', 'T1 bis T20 + Bull.'],
  switch: ['⇄', '1. Dart 20, Dart 2 + 3 auf 19.'],
  checkouts: ['✓', 'Zufällige Restzahl, 3 Darts.'],
  doubles: ['D♥', 'Doppel-Reihen, jeden Treffer zählen.'],
  l121: ['121', '9 Darts pro Zahl – wie hoch kommst du?'],
  drill: ['🔧', 'Deine Schwächen gezielt üben.'],
  survival: ['💚', 'Endlos mit Leben – Rekord jagen.'],
};
for (const g of GAMES) if (META[g.id]) { g.glyph = META[g.id][0]; g.tile = META[g.id][1]; }
export const GAME_IDS = GAMES.map(g => g.id);
export const gameById = id => GAMES.find(g => g.id === id);

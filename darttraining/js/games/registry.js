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
export const GAME_IDS = GAMES.map(g => g.id);
export const gameById = id => GAMES.find(g => g.id === id);

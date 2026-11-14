// Spiele-Registry: Neues Spiel = Modul mit { id, name, short, tracked, mount(root, ctx), summary(data, settings) }
// anlegen und hier eintragen. Es erscheint dann automatisch in der Auswahl, im Admin (TheLeek Mode) und in der Statistik.
import warmup from './warmup.js';
import sequence from './sequence.js';
import { atcSingle, atcDouble } from './atc.js';
import switchGame from './switch.js';
import checkouts from './checkouts.js';

export const GAMES = [warmup, sequence, atcSingle, atcDouble, switchGame, checkouts];
export const GAME_IDS = GAMES.map(g => g.id);
export const gameById = id => GAMES.find(g => g.id === id);

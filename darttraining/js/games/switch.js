import { h } from '../ui.js';
import { timedGame } from './timed.js';

export default timedGame({
  id: 'switch',
  name: '20-Switch',
  short: '1. Dart auf die 20, Dart 2 + 3 auf die 19.',
  settingKey: 'switchMin',
  title: '20-Switch',
  renderHint: () => h('div', { class: 'switch-box' },
    h('div', { class: 'sw-row' }, h('span', { class: 'sw-dart' }, '1. Dart'), h('span', { class: 'sw-arrow' }, '→'), h('b', {}, '20')),
    h('div', { class: 'sw-row' }, h('span', { class: 'sw-dart' }, '2. + 3. Dart'), h('span', { class: 'sw-arrow' }, '→'), h('b', {}, '19')),
    h('p', { class: 'hint' }, 'Jede Aufnahme gleich – egal wo der Dart landet.')),
  info: {
    lines: ['In jeder Aufnahme: 1. Dart auf die 20.', 'Dart 2 und 3 switchen auf die 19.', 'Egal wo der Dart landet – kein Zählen, nur der Timer.', 'Im TheLeek Trainingsprogramm fix 3 Minuten, sonst 3 oder 5 Minuten.'],
    steps: [
      { hl: ['SEG20'], cap: '1. Dart: auf die 20', darts: [['T20', true]] },
      { hl: ['SEG19'], cap: '2. Dart: auf die 19', darts: [['S19', true]] },
      { hl: ['SEG19'], cap: '3. Dart: nochmal 19', darts: [['T19', true]] },
    ],
  },
});

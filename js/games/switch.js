import { h } from '../ui.js';
import { timedGame } from './timed.js';

export default timedGame({
  id: 'switch',
  name: '20-Switch',
  short: 'Nach jedem Dart wechseln: 20 ↔ 19.',
  settingKey: 'switchMin',
  title: '20-Switch',
  renderHint: () => h('div', {},
    h('div', { class: 'switch-hint' }, '20 ↔ 19'),
    h('p', { class: 'hint' }, 'Erster Dart auf die 20, danach ', h('strong', {}, 'nach jedem Dart wechseln'), ' – egal wo er landet.')),
  info: {
    lines: ['Erster Dart auf die 20.', 'Danach nach jedem Dart wechseln: 20 → 19 → 20 → …', 'Egal wo der Dart landet – kein Zählen, nur der Timer.'],
    steps: [
      { hl: ['SEG20'], cap: 'Dart 1: auf die 20', darts: [['T20', true]] },
      { hl: ['SEG19'], cap: 'Dart 2: auf die 19', darts: [['S19', true]] },
      { hl: ['SEG20'], cap: 'Dart 3: wieder 20', darts: [['S20', true]] },
    ],
  },
});

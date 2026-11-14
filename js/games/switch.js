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
});

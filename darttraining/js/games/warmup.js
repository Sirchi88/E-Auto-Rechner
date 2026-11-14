import { h } from '../ui.js';
import { timedGame } from './timed.js';

export default timedGame({
  id: 'warmup',
  name: 'Warm-up',
  short: 'Freies Werfen, Arm aufwärmen – nur ein Timer.',
  settingKey: 'warmupMin',
  title: 'Warm-up',
  renderHint: () => h('p', { class: 'hint' }, 'Langsam werfen, ', h('strong', {}, 'ohne Ziel'), ' – einfach locker werden.'),
});

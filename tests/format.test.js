import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNum, inputNum, eur } from '../src/format.js';

test('Zahleneingabe deutsch', () => {
  assert.equal(parseNum('0,32'), 0.32);
  assert.equal(parseNum('39.995'), 39995);
  assert.equal(parseNum('1.5'), 1.5);
  assert.equal(parseNum(' 12 000 '), 12000);
  assert.equal(parseNum(''), null);
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.equal(inputNum(0.325), '0,325');
  assert.equal(eur(1234.5), '1.235 €');
});

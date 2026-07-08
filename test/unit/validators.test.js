import test from 'node:test';
import assert from 'node:assert/strict';
import { positiveNumber, parseCsv } from '../../server/utils/validators.js';

test('positiveNumber accepts only finite positive numbers', () => {
  assert.equal(positiveNumber('42', 7), 42);
  assert.equal(positiveNumber(0, 7), 7);
  assert.equal(positiveNumber(-1, 7), 7);
  assert.equal(positiveNumber('nope', 7), 7);
});

test('parseCsv trims empty items', () => {
  assert.deepEqual(parseCsv(' alpha, beta ,, gamma '), ['alpha', 'beta', 'gamma']);
  assert.deepEqual(parseCsv(null), []);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTitle, stableId } from '../server/ids.js';

test('stable ids ignore case, punctuation, and spacing', () => {
  assert.equal(stableId('reddit', 'Hello, World!'), stableId('reddit', '  hello   world '));
  assert.equal(stableId('reddit', 'Hello, World!'), stableId('reddit', 'HELLO WORLD'));
  assert.equal(normalizeTitle('SOL/USD — rips!'), 'sol usd rips');
});

test('stable ids change when the outlet or the headline changes', () => {
  assert.notEqual(stableId('reddit', 'Hello World'), stableId('hackernews', 'Hello World'));
  assert.notEqual(stableId('reddit', 'Hello World'), stableId('reddit', 'Hello Worlds'));
});

test('the same headline keeps its id across calls', () => {
  const first = stableId('x', 'Bonk mascot rally');
  const second = stableId('x', 'Bonk mascot rally');
  assert.equal(first, second);
  assert.equal(first.length, 16);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createCluster } from '../server/cluster.js';
import { stableId } from '../server/ids.js';
import { extractSignals, isUsefulPhrase } from '../server/phrases.js';

const JUNK = ['show', 'took', 'test', 'private', 'happy', 'new', 'coin'];

test('generic words are not topic keys', () => {
  for (const word of JUNK) {
    const signals = extractSignals(`They ${word} a ${word} today`);
    assert.equal(signals.keys.includes(word), false, word);
    assert.equal(isUsefulPhrase(word), false, word);
  }
});

test('generic verbs do not merge unrelated headlines', () => {
  const cluster = createCluster();
  const now = 1_700_000_000_000;
  const item = (source, title) => ({ id: stableId(source, title), source, title });
  cluster.ingest(item('reddit', 'Show HN: a private test that took off'), now);
  cluster.ingest(item('hackernews', 'They show a private happy test'), now + 1);
  assert.equal(cluster.list().length, 2);
  for (const topic of cluster.list()) {
    assert.equal(JUNK.includes(topic.label), false, topic.label);
  }
});

test('a real name still clusters', () => {
  const cluster = createCluster();
  const now = 1_700_000_000_000;
  const item = (source, title) => ({ id: stableId(source, title), source, title });
  const a = cluster.ingest(item('reddit', 'Bonk mascot rally'), now);
  const b = cluster.ingest(item('telegram', 'Bonk mascot watch'), now + 1);
  assert.equal(b.topic.id, a.topic.id);
  assert.equal(isUsefulPhrase(b.topic.label), true);
});

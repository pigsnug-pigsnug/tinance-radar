import assert from 'node:assert/strict';
import test from 'node:test';
import { createCluster } from '../server/cluster.js';
import { stableId } from '../server/ids.js';

function item(source, title) {
  return { id: stableId(source, title), source, title };
}

test('items that share a key phrase cluster, and three sources become multi-signal', () => {
  const cluster = createCluster({ windowMs: 6 * 60 * 60 * 1000, minSources: 3 });
  const now = 1_700_000_000_000;
  const a = cluster.ingest(item('reddit', 'Bonk mascot rally'), now);
  const b = cluster.ingest(item('hackernews', 'Bonk mascot continues'), now + 1000);
  const c = cluster.ingest(item('bluesky', 'The Bonk mascot is back'), now + 2000);
  assert.equal(a.duplicate, false);
  assert.equal(cluster.list().length, 1);
  assert.equal(c.topic.id, a.topic.id);
  assert.equal(b.topic.id, a.topic.id);
  assert.equal(c.topic.multi, true);
  assert.equal(c.topic.cross, 3);
  assert.deepEqual([...c.topic.sources].sort(), ['bluesky', 'hackernews', 'reddit']);
});

test('unrelated headlines stay in separate topics', () => {
  const cluster = createCluster();
  const now = 1_700_000_000_000;
  cluster.ingest(item('aljazeera', 'Federal Reserve minutes'), now);
  cluster.ingest(item('reddit', 'Cooking pasta tonight'), now);
  assert.equal(cluster.list().length, 2);
});

test('the same item does not add another velocity hit', () => {
  const cluster = createCluster();
  const now = 1_700_000_000_000;
  const first = cluster.ingest(item('reddit', 'Bonk mascot rally'), now);
  const again = cluster.ingest(item('reddit', 'Bonk mascot rally'), now + 5000);
  assert.equal(again.duplicate, true);
  assert.equal(cluster.bucketTotal(first.topic.id), 1);
});

test('same-source repeats do not count as multi-signal', () => {
  const cluster = createCluster({ minSources: 3 });
  const now = 1_700_000_000_000;
  cluster.ingest(item('reddit', 'Bonk mascot rally'), now);
  cluster.ingest(item('reddit', 'Bonk mascot continues'), now + 1000);
  const third = cluster.ingest(item('reddit', 'Bonk mascot returns'), now + 2000);
  assert.equal(third.topic.cross, 1);
  assert.equal(third.topic.multi, false);
});

test('multi-signal expires outside the window and survives a snapshot', () => {
  const windowMs = 60 * 1000;
  const cluster = createCluster({ windowMs, minSources: 3 });
  const now = 1_700_000_000_000;
  const first = cluster.ingest(item('reddit', 'Bonk mascot rally'), now);
  cluster.ingest(item('hackernews', 'Bonk mascot continues'), now);
  cluster.ingest(item('bluesky', 'The Bonk mascot is back'), now);
  assert.equal(cluster.get(first.topic.id).multi, true);

  cluster.rescore(now + windowMs + 1000);
  assert.equal(cluster.get(first.topic.id).multi, false);
  assert.equal(cluster.get(first.topic.id).cross, 0);

  const snap = cluster.snapshot();
  const restored = createCluster({ windowMs, minSources: 3 });
  restored.hydrate(snap);
  const replay = restored.ingest(item('reddit', 'Bonk mascot rally'), now + windowMs + 2000);
  assert.equal(replay.duplicate, true);
  assert.equal(restored.bucketTotal(first.topic.id), 3);

  const extra = restored.ingest(item('telegram', 'Bonk mascot watch'), now + windowMs + 3000);
  assert.equal(extra.duplicate, false);
  assert.equal(extra.topic.id, first.topic.id);
  assert.equal(restored.bucketTotal(first.topic.id), 4);
});

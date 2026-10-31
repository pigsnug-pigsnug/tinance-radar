import assert from 'node:assert/strict';
import test from 'node:test';
import { engagementHits, keepHnStory, keepRedditPost } from '../server/engagement.js';
import { createCluster } from '../server/cluster.js';
import { stableId } from '../server/ids.js';

test('reddit drops a 1-upvote hot post and keeps a 50-upvote one', () => {
  assert.equal(keepRedditPost({ title: 'Fuck it we ball', score: 1, num_comments: 1 }, { list: 'hot' }), false);
  assert.equal(
    keepRedditPost({ title: 'Binance hot wallet signed fifty delegations', score: 80, num_comments: 40 }, { list: 'hot' }),
    true,
  );
});

test('reddit rising can clear a lower bar', () => {
  assert.equal(keepRedditPost({ title: 'Something is moving fast now', score: 16, num_comments: 2 }, { list: 'rising' }), true);
  assert.equal(keepRedditPost({ title: 'Quiet post nobody touched', score: 2, num_comments: 0 }, { list: 'rising' }), false);
});

test('stickied daily threads and removed posts are ignored', () => {
  assert.equal(keepRedditPost({ title: 'Daily Crypto Discussion', score: 400, stickied: true }, { list: 'hot' }), false);
  assert.equal(keepRedditPost({ title: '[ Removed by Reddit ]', score: 10 }, { list: 'hot' }), false);
});

test('rss hot rows without a score still pass, unscored rising and new do not', () => {
  assert.equal(keepRedditPost({ title: 'North Korea and the Binance wallet' }, { list: 'hot' }), true);
  assert.equal(keepRedditPost({ title: 'North Korea and the Binance wallet' }, { list: 'top' }), true);
  assert.equal(keepRedditPost({ title: 'Is this a dusting attack on the chain', }, { list: 'rising' }), false);
  assert.equal(keepRedditPost({ title: 'North Korea and the Binance wallet' }, { list: 'new' }), false);
});

test('hacker news points threshold', () => {
  assert.equal(keepHnStory({ score: 12 }, 40), false);
  assert.equal(keepHnStory({ score: 40 }, 40), true);
  assert.equal(keepHnStory({ points: 12 }, 12), true);
});

test('engagement hits weight a busy post above a quiet one', () => {
  const cluster = createCluster();
  const now = 1_700_000_000_000;
  const item = (source, title) => ({ id: stableId(source, title), source, title });
  const first = cluster.ingest(item('reddit', 'Bonk mascot rally'), now, { hits: engagementHits({ score: 4 }) });
  cluster.ingest(item('hackernews', 'Bonk mascot continues'), now + 1, { hits: engagementHits({ score: 400, comments: 80 }) });
  assert.ok(cluster.bucketTotal(first.topic.id) > 2);
});

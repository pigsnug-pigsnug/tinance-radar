import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCards,
  excludedTopic,
  isFarm,
  isFresh,
  isPrimeTime,
  laneOf,
  passEngagement,
  screenItem,
  upvoteVelocity,
} from '../server/pipeline.js';

const NOW = Date.parse('2026-10-31T12:00:00Z');

function reddit(over = {}) {
  return {
    source: 'reddit',
    title: 'A raccoon stole a whole bag of donuts from a shop',
    url: 'https://www.reddit.com/r/aww/comments/abc/raccoon/',
    summary: 'The raccoon sat on the counter and ate them one by one. People cannot stop watching.',
    score: 400,
    comments: 40,
    publishedAt: NOW - 2 * 60 * 60 * 1000,
    subreddit: 'aww',
    ...over,
  };
}

test('content farms are rejected and never added as a source', () => {
  for (const host of [
    'https://nanoinform.com/a',
    'https://www.bytefreedom.com/b',
    'https://roxreport.com/c',
    'https://news.unlimitednewsjournal.com/d',
    'https://picturesoftechnology.com/e',
    'https://computerical.com/f',
    'https://virtualhiroba.com/g',
  ]) {
    assert.equal(isFarm(host), true, host);
    assert.equal(screenItem(reddit({ url: host, proofUrl: '' })), null);
  }
  assert.equal(isFarm('https://www.bbc.com/news/world'), false);
});

test('engagement requires reddit comment floor and upvote velocity, and HN points', () => {
  assert.equal(passEngagement(reddit({ comments: 2, score: 500 }), NOW), false);
  assert.equal(passEngagement(reddit({ comments: 10, score: 10, publishedAt: NOW - 10 * 60 * 60 * 1000 }), NOW), false);
  assert.equal(passEngagement(reddit(), NOW), true);
  assert.ok(upvoteVelocity(reddit(), NOW) > 25);
  assert.equal(passEngagement({ source: 'hackernews', score: 12 }, NOW), false);
  assert.equal(passEngagement({ source: 'hackernews', score: 80 }, NOW), true);
  assert.equal(passEngagement({ source: 'wikipedia', spike: false }, NOW), false);
  assert.equal(passEngagement({ source: 'wikipedia', spike: true }, NOW), true);
});

test('sports, religion, elections, gossip, and war are excluded everywhere', () => {
  assert.equal(excludedTopic('Premier League title race is back'), 'sports');
  assert.equal(excludedTopic('The pastor gave a long sermon'), 'religion');
  assert.equal(excludedTopic('Senate race polling moved overnight'), 'politics');
  assert.equal(excludedTopic('Red carpet photos after the breakup'), 'gossip');
  assert.equal(excludedTopic('Missile strike after the ceasefire'), 'war');
  assert.equal(excludedTopic('A warm bakery opened downtown'), '');
  assert.equal(screenItem(reddit({ title: 'NFL playoffs are on tonight', summary: 'Super Bowl talk' })), null);
});

test('eye-catch keeps breaking and funny lanes and drops dull items', () => {
  assert.equal(laneOf('Hospital reports a virus outbreak in the city'), 'breaking');
  assert.equal(laneOf('Hackers breached the city payment network'), 'breaking');
  assert.equal(laneOf('A raccoon went viral for stealing donuts'), 'funny');
  assert.equal(laneOf('Researchers published a paper about compiler flags'), '');
  assert.equal(laneOf('Missile strike hit the port'), '');
});

test('a trend is one card only after two sources agree', () => {
  const topic = {
    id: 't1',
    label: 'raccoon donuts',
    cross: 2,
    useful: true,
    sources: ['reddit', 'bbc'],
  };
  const items = [
    { ...reddit(), id: 'a', topicId: 't1', source: 'reddit' },
    {
      id: 'b',
      topicId: 't1',
      source: 'bbc',
      title: 'Raccoon shuts a shop after stealing donuts',
      url: 'https://www.bbc.com/news/raccoon-donuts',
      summary: 'Staff filmed the raccoon eating donuts on the counter. The clip is everywhere.',
      publishedAt: NOW - 20 * 60 * 1000,
      reach: true,
    },
  ];
  const cards = buildCards(items, [topic], { minSources: 2, now: NOW });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].lane, 'funny');
  assert.equal(cards[0].sources.length, 2);
  assert.equal(cards[0].proofUrl, 'https://www.bbc.com/news/raccoon-donuts');
  assert.equal(cards[0].fresh, true);
  assert.match(cards[0].ticker, /^\$[A-Z]{3,7}$/);
  assert.equal(cards[0].tweet.includes('#'), false);
  assert.equal(cards[0].tweet.includes('—'), false);

  const alone = buildCards(items.slice(0, 1), [{ ...topic, cross: 1, sources: ['reddit'] }], { minSources: 2, now: NOW });
  assert.equal(alone.length, 0);
});

test('duplicate links collapse and a dull two-source topic is dropped', () => {
  const topic = { id: 't2', label: 'compiler flags', cross: 2, useful: true, sources: ['hackernews', 'bbc'] };
  const items = [
    {
      id: 'a',
      topicId: 't2',
      source: 'hackernews',
      title: 'Compiler flags that shave a cycle',
      url: 'https://example.com/gcc',
      summary: 'A note about build times and compiler flags.',
      score: 90,
      publishedAt: NOW,
    },
    {
      id: 'b',
      topicId: 't2',
      source: 'bbc',
      title: 'Compiler flags that shave a cycle',
      url: 'https://example.com/gcc',
      summary: 'Same dull writeup.',
      publishedAt: NOW,
    },
    {
      id: 'c',
      topicId: 't2',
      source: 'guardian',
      title: 'More notes on compiler flags',
      url: 'https://www.theguardian.com/tech/compiler',
      summary: 'Another dull paragraph about build flags.',
      publishedAt: NOW,
    },
  ];
  assert.equal(buildCards(items, [topic], { minSources: 2, now: NOW }).length, 0);
});

test('fresh is under 30 minutes and prime time is 18:00-04:00 IST', () => {
  assert.equal(isFresh(NOW - 10 * 60 * 1000, NOW), true);
  assert.equal(isFresh(NOW - 50 * 60 * 1000, NOW), false);
  assert.equal(isPrimeTime(new Date('2026-10-31T14:30:00Z')), true);
  assert.equal(isPrimeTime(new Date('2026-10-31T08:00:00Z')), false);
});

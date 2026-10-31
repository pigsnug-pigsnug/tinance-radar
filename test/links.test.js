import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalUrl,
  gmgnUrl,
  googleNewsDecodeBody,
  parseGoogleNewsDecodeResponse,
  parseGoogleNewsSignature,
  xSearchUrl,
} from '../server/links.js';
import { createStore } from '../server/store.js';
import { createCluster } from '../server/cluster.js';
import { createBus } from '../server/bus.js';

const MINT = '4QzxXdGnjSpSMJHfQi16nHuPfQpiKfQaarYL1toZKbyp';

test('relative and placeholder urls are rejected, real ones pass', () => {
  assert.equal(canonicalUrl('/r/solana/comments/abc/title'), '');
  assert.equal(canonicalUrl('https://pump.fun'), '');
  assert.equal(canonicalUrl('https://pump.fun/'), '');
  assert.equal(canonicalUrl('https://t.me/cointelegraph'), '');
  assert.equal(canonicalUrl('https://news.google.com/rss/articles/CBMiabc'), '');
  assert.equal(canonicalUrl('https://getdaytrends.com/united-states/trend/Halloween/'), '');
  assert.equal(canonicalUrl('https://tools.explodingtopics.com/website-traffic-checker?q=x'), '');
  assert.equal(
    canonicalUrl('/r/solana/comments/abc/title/', 'https://www.reddit.com'),
    'https://www.reddit.com/r/solana/comments/abc/title/',
  );
  assert.equal(canonicalUrl('https://t.me/cointelegraph/72956'), 'https://t.me/cointelegraph/72956');
  assert.equal(canonicalUrl(`https://pump.fun/coin/${MINT}`), `https://pump.fun/coin/${MINT}`);
});

test('gmgn is the primary mint link', () => {
  assert.equal(gmgnUrl(MINT), `https://gmgn.ai/sol/token/${MINT}`);
  assert.equal(gmgnUrl('not-a-mint'), '');
  assert.equal(xSearchUrl('Bonk').startsWith('https://x.com/search?q=Bonk'), true);
});

test('google news signature and decode response yield the publisher url', () => {
  const html = '<div data-n-a-id="ART" data-n-a-ts="1793467523" data-n-a-sg="AdwtSY"></div>';
  const sig = parseGoogleNewsSignature(html);
  assert.deepEqual(sig, { id: 'ART', ts: '1793467523', sg: 'AdwtSY' });
  assert.match(googleNewsDecodeBody(sig), /ART/);
  const body = `)]}'\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://coinpedia.org/news/solana-leads/\\",1]"]]`;
  assert.equal(parseGoogleNewsDecodeResponse(body), 'https://coinpedia.org/news/solana-leads/');
  assert.equal(parseGoogleNewsDecodeResponse('https://news.google.com/rss/articles/x'), '');
});

test('the store drops items that are not absolute source urls', async () => {
  const store = createStore({
    cluster: createCluster(),
    persist: { mode: 'file', async load() { return null; }, async save() {} },
    bus: createBus(),
    config: { multiWindowMs: 3_600_000, minSources: 3, snapshotIntervalMs: 60_000, authPassword: '' },
  });
  store.ingestItems([
    { source: 'reddit', title: 'Bonk mascot rally is back', url: '/relative/nope' },
    { source: 'hackernews', title: 'Voyager marks a light day', url: 'https://science.nasa.gov/mission/voyager/' },
  ]);
  const items = [...store.items.values()];
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://science.nasa.gov/mission/voyager/');
});

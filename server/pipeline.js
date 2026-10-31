import { coinName, launchPack, tickerOf, xReplyUrl } from './launch-style.js';

export const CONTENT_FARMS = [
  'nanoinform.com',
  'bytefreedom.com',
  'roxreport.com',
  'unlimitednewsjournal.com',
  'picturesoftechnology.com',
  'computerical.com',
  'virtualhiroba.com',
];

export const ALLOWED_SOURCES = new Set([
  'reddit',
  'x',
  'aljazeera',
  'wikipedia',
  'hackernews',
  'bbc',
  'guardian',
]);

const BIG_REACH = new Set(['bbc', 'guardian', 'aljazeera', 'wikipedia', 'hackernews']);

const SPORTS = [
  'premier league',
  'champions league',
  'world cup',
  'super bowl',
  'touchdown',
  'nba',
  'nfl',
  'mlb',
  'nhl',
  'fifa',
  'uefa',
  'cricket',
  'wimbledon',
  'playoff',
  'playoffs',
  'hat trick',
  'scoreline',
  'grand prix',
  'formula 1',
  'world series',
];

const RELIGION = [
  'vatican',
  'mosque',
  'synagogue',
  'quran',
  'bible verse',
  'ramadan',
  'diocese',
  'pastor',
  'imam',
  'sermon',
];

const POLITICS = [
  'election',
  'elections',
  'senator',
  'senate race',
  'ballot',
  'democrat',
  'republican',
  'parliament',
  'campaign trail',
  'primary vote',
  'gop',
  'tory',
  'labour party',
  'presidential race',
  'white house',
];

const GOSSIP = ['kardashian', 'red carpet', 'paparazzi', 'dating rumor', 'breakup', 'engaged to'];

const WAR = ['invasion', 'airstrike', 'air strike', 'missile strike', 'ceasefire', 'battalion', 'artillery', 'gaza', 'troops deployed'];

const BREAKING = [
  'outbreak',
  'virus',
  'pandemic',
  'hack',
  'hacked',
  'hacker',
  'hackers',
  'breach',
  'breached',
  'ransomware',
  'leaked',
  'explosion',
  'earthquake',
  'tsunami',
  'wildfire',
  'flood',
  'derail',
  'blackout',
  'hostage',
  'disaster',
];

const FUNNY = [
  'squirrel',
  'raccoon',
  'panda',
  'capybara',
  'otter',
  'penguin',
  'koala',
  'sloth',
  'hedgehog',
  'octopus',
  'dolphin',
  'kitten',
  'puppy',
  'meme',
  'memes',
  'viral',
  'troll',
  'trolled',
  'weird',
  'awesome',
  'hilarious',
  'funny',
  'dog',
  'cat',
  'frog',
  'goose',
  'goat',
  'duck',
  'fox',
  'bear',
  'monkey',
  'whale',
  'shark',
  'pigeon',
  'parrot',
  'rabbit',
  'bunny',
  'hamster',
  'lizard',
  'crow',
  'chimp',
  'ape',
];

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isFarm(url) {
  const host = hostOf(url);
  return CONTENT_FARMS.some((farm) => host === farm || host.endsWith(`.${farm}`));
}

function hasPhrase(text, phrase) {
  const body = String(text || '').toLowerCase();
  if (phrase.includes(' ')) return body.includes(phrase);
  return new RegExp(`\\b${phrase}\\b`, 'i').test(body);
}

function hitList(text, list) {
  return list.find((phrase) => hasPhrase(text, phrase)) || '';
}

export function excludedTopic(text) {
  const blob = String(text || '');
  if (/\bwar\b/i.test(blob) || hitList(blob, WAR)) return 'war';
  if (hitList(blob, SPORTS)) return 'sports';
  if (hitList(blob, RELIGION)) return 'religion';
  if (hitList(blob, POLITICS)) return 'politics';
  if (hitList(blob, GOSSIP)) return 'gossip';
  return '';
}

export function upvoteVelocity(item, now = Date.now()) {
  const score = Number(item?.score) || 0;
  const ageH = Math.max(0.25, (now - (Number(item?.publishedAt) || now)) / 3_600_000);
  return score / ageH;
}

export function passEngagement(item, now = Date.now()) {
  const source = item?.source;
  if (source === 'reddit') {
    const comments = Number(item.comments) || 0;
    if (comments < 8) return false;
    const velocity = upvoteVelocity(item, now);
    return velocity >= 25 || ((Number(item.score) || 0) >= 150 && comments >= 15);
  }
  if (source === 'hackernews') return (Number(item.score) || 0) >= 40;
  if (source === 'wikipedia') return Boolean(item.spike);
  if (source === 'x' || source === 'bbc' || source === 'guardian' || source === 'aljazeera') return true;
  return false;
}

export function laneOf(text) {
  const blob = String(text || '');
  if (excludedTopic(blob)) return '';
  if (hitList(blob, BREAKING) || /\battack(?:ed|s)?\b/i.test(blob)) return 'breaking';
  if (hitList(blob, FUNNY)) return 'funny';
  return '';
}

export function isFresh(publishedAt, now = Date.now()) {
  const ts = Number(publishedAt) || 0;
  return ts > 0 && now - ts < 30 * 60 * 1000;
}

export function isPrimeTime(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  return hour >= 18 || hour < 4;
}

export function shortStory(parts) {
  const text = parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const sentences = text.split(/(?<=[.!?])\s+/).filter((line) => line.length > 20);
  const picked = (sentences.length ? sentences : [text]).slice(0, 3).join(' ');
  if (picked.length <= 340) return picked;
  return `${picked.slice(0, 337).trim()}…`;
}

export function screenItem(item, now = Date.now()) {
  if (!item?.title || !item?.url) return null;
  const source = String(item.source || '').toLowerCase();
  if (!ALLOWED_SOURCES.has(source)) return null;
  if (isFarm(item.url) || isFarm(item.proofUrl)) return null;
  const next = {
    ...item,
    source,
    score: Number(item.score) || 0,
    comments: Number(item.comments) || 0,
    reach: Boolean(item.reach) || BIG_REACH.has(source) || item.subreddit === 'all',
  };
  if (!passEngagement(next, now)) return null;
  const blob = `${next.title}\n${next.summary || ''}\n${next.body || ''}`;
  if (excludedTopic(blob)) return null;
  return next;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.url || item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildCards(items, topics, { minSources = 2, now = Date.now() } = {}) {
  const byTopic = new Map();
  for (const item of items || []) {
    if (!item?.topicId) continue;
    if (!byTopic.has(item.topicId)) byTopic.set(item.topicId, []);
    byTopic.get(item.topicId).push(item);
  }
  const cards = [];
  for (const topic of topics || []) {
    if ((topic.cross || 0) < minSources) continue;
    if (topic.useful === false) continue;
    const members = dedupe(byTopic.get(topic.id) || []);
    const sourceNames = [...new Set(members.map((item) => item.source))];
    if (sourceNames.length < minSources) continue;
    const blob = members.map((item) => `${item.title} ${item.summary || ''} ${item.body || ''}`).join('\n');
    if (excludedTopic(blob)) continue;
    const lane = laneOf(blob);
    if (!lane) continue;
    const pack = launchPack({ lane, text: blob, label: topic.label });
    const proof = members.find((item) => ['bbc', 'guardian', 'aljazeera', 'wikipedia', 'hackernews'].includes(item.source));
    const tweet = members.find((item) => item.source === 'x' || item.tweetId);
    const publishedAt = Math.max(...members.map((item) => Number(item.publishedAt) || 0));
    const reach = members.some((item) => item.reach);
    const rank =
      (lane === 'breaking' ? 80 : 50) +
      (reach ? 25 : 0) +
      sourceNames.length * 10 +
      Math.min(30, members.reduce((sum, item) => sum + (Number(item.comments) || 0), 0) / 10);
    cards.push({
      id: topic.id,
      itemId: members[0]?.id || '',
      title: topic.label,
      lane,
      summary: shortStory(members.map((item) => item.summary || item.title)),
      sources: members.slice(0, 6).map((item) => ({
        source: item.source,
        title: item.title,
        url: item.url,
      })),
      proofUrl: proof?.url || members.find((item) => item.url !== tweet?.url)?.url || '',
      tweetUrl: tweet?.url || '',
      tweetId: members.map((item) => item.tweetId).find(Boolean) || '',
      fresh: isFresh(publishedAt, now),
      reach,
      publishedAt,
      rank,
      name: pack.name,
      ticker: pack.ticker,
      tweet: pack.tweet,
      images: pack.images,
      postUrl: pack.postUrl,
      replyUrl: xReplyUrl(pack.tweet, members.map((item) => item.tweetId).find(Boolean) || ''),
      prime: isPrimeTime(new Date(now)),
    });
  }
  cards.sort((a, b) => b.rank - a.rank || b.publishedAt - a.publishedAt);
  return cards.slice(0, 40);
}

export function passesPipeline(item, now) {
  const screened = screenItem(item, now);
  if (!screened) return false;
  return Boolean(laneOf(`${screened.title}\n${screened.summary || ''}\n${screened.body || ''}`));
}

export { coinName, tickerOf };

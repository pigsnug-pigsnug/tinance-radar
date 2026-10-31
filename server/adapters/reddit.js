import { upvoteVelocity } from '../pipeline.js';
import { getJson, getText } from '../net.js';
import { parseTime } from '../time.js';
import { parseFeed } from '../xml.js';
import { keep, toItem } from './shape.js';

const SUBS = [
  { name: 'memecoins', sorts: ['hot', 'top'] },
  { name: 'solana', sorts: ['hot', 'top'] },
  { name: 'CryptoCurrency', sorts: ['hot', 'top'] },
  { name: 'wallstreetbets', sorts: ['hot', 'top'] },
  { name: 'aww', sorts: ['hot', 'top'] },
  { name: 'nextfuckinglevel', sorts: ['hot', 'top'] },
  { name: 'interestingasfuck', sorts: ['hot', 'top'] },
  { name: 'NatureIsFuckingLit', sorts: ['hot', 'top'] },
  { name: 'funny', sorts: ['hot', 'top'] },
  { name: 'all', sorts: ['top'] },
];

function absolutePost(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `https://www.reddit.com${raw}`;
  return '';
}

async function fromJson(sub, sort) {
  const url =
    sort === 'top'
      ? `https://www.reddit.com/r/${sub}/top.json?t=day&limit=25&raw_json=1`
      : `https://www.reddit.com/r/${sub}/${sort}.json?limit=25&raw_json=1`;
  const data = await getJson(url, { browser: true, timeoutMs: 8_000 });
  const children = data?.data?.children;
  if (!Array.isArray(children) || !children.length) throw new Error(`empty r/${sub}/${sort}`);
  return children
    .map((row) => row?.data)
    .filter(Boolean)
    .map((post) => ({
      title: post.title,
      url: absolutePost(post.permalink) || absolutePost(post.url),
      body: post.selftext || '',
      score: post.score,
      comments: post.num_comments,
      stickied: post.stickied,
      created: post.created_utc,
    }));
}

async function fromRss(sub, sort) {
  const url =
    sort === 'top'
      ? `https://www.reddit.com/r/${sub}/top.rss?t=day&limit=20`
      : `https://www.reddit.com/r/${sub}/${sort}.rss?limit=20`;
  const xml = await getText(url, {
    browser: true,
    accept: 'application/atom+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
  });
  const feed = parseFeed(xml);
  if (!feed.length) throw new Error(`empty r/${sub}/${sort}`);
  return feed.map((item) => ({
    title: item.title,
    url: absolutePost(item.link),
    body: item.summary || '',
    score: 0,
    comments: 0,
  }));
}

async function loadSort(sub, sort) {
  try {
    return await fromJson(sub, sort);
  } catch {
    return fromRss(sub, sort);
  }
}

export default {
  name: 'reddit',
  intervalMs: 5 * 60 * 1000,
  async fetch() {
    const now = Date.now();
    const jobs = SUBS.flatMap((sub) => sub.sorts.map((sort) => ({ sub: sub.name, sort })));
    const settled = await Promise.allSettled(jobs.map(({ sub, sort }) => loadSort(sub, sort).then((posts) => ({ sub, posts }))));
    const seen = new Set();
    const items = [];
    for (const row of settled) {
      if (row.status !== 'fulfilled') continue;
      const ranked = row.value.posts
        .filter((post) => post && !post.stickied && post.title && !/removed by reddit/i.test(post.title))
        .map((post) => ({ ...post, velocity: upvoteVelocity({ score: post.score, publishedAt: parseTime(post.created) || now }, now) }))
        .sort((a, b) => b.velocity - a.velocity);
      for (const post of ranked.slice(0, 8)) {
        const item = toItem({
          source: 'reddit',
          title: post.title,
          url: post.url,
          body: post.body,
          summary: post.body ? post.body.slice(0, 320) : `r/${row.value.sub}`,
          score: post.score,
          comments: post.comments,
          subreddit: row.value.sub.toLowerCase(),
          reach: row.value.sub.toLowerCase() === 'all',
          publishedAt: parseTime(post.created) || now,
          hits: Math.max(1, Math.round(post.velocity / 10)),
        });
        if (!item) continue;
        const key = item.url || item.title;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    }
    const kept = keep(items);
    if (!kept.length) {
      const reason = settled.find((entry) => entry.status === 'rejected')?.reason;
      throw new Error(reason?.message || 'reddit unavailable');
    }
    return kept;
  },
};

import { config } from '../config.js';
import { engagementHits, keepRedditPost } from '../engagement.js';
import { getJson, getText } from '../net.js';
import { parseTime } from '../time.js';
import { parseFeed } from '../xml.js';
import { keep, toItem } from './shape.js';

const SUBS = ['CryptoCurrency', 'solana', 'memecoins', 'CryptoMoonShots'];
const SORTS = ['hot', 'rising', 'top'];

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
      score: post.score,
      num_comments: post.num_comments,
      stickied: post.stickied,
      over_18: post.over_18,
      upvote_ratio: post.upvote_ratio,
      created: post.created_utc,
      list: sort,
    }));
}

async function fromRss(sub, sort) {
  const url =
    sort === 'top'
      ? `https://www.reddit.com/r/${sub}/top.rss?t=day&limit=25`
      : `https://www.reddit.com/r/${sub}/${sort}.rss?limit=25`;
  const xml = await getText(url, {
    browser: true,
    accept: 'application/atom+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
  });
  const feed = parseFeed(xml);
  if (!feed.length) throw new Error(`empty r/${sub}/${sort}`);
  return feed.map((item) => ({
    title: item.title,
    url: absolutePost(item.link),
    list: sort,
  }));
}

async function loadSort(sub, sort) {
  try {
    return await fromJson(sub, sort);
  } catch {
    return fromRss(sub, sort);
  }
}

function toRows(sub, posts) {
  const sol = sub.toLowerCase() === 'solana' || sub.toLowerCase() === 'memecoins';
  const thresholds = {
    minScore: config.redditMinScore,
    risingMinScore: config.redditRisingMinScore,
    risingMinComments: config.redditRisingMinComments,
  };
  return posts
    .filter((post) => keepRedditPost(post, { list: post.list, ...thresholds }))
    .map((post) => {
      const score = Number(post.score);
      const comments = Number(post.num_comments);
      const bits = [`r/${sub}`, post.list];
      if (Number.isFinite(score)) bits.push(`${score} upvotes`);
      if (Number.isFinite(comments)) bits.push(`${comments} comments`);
      return toItem({
        source: 'reddit',
        title: post.title,
        url: post.url,
        summary: bits.join(' · '),
        publishedAt: post.created ? parseTime(post.created) : Date.now(),
        tags: sol ? ['solana'] : [],
        hits: engagementHits({
          score: Number.isFinite(score) ? score : post.list === 'top' ? 80 : post.list === 'hot' ? 40 : 12,
          comments: Number.isFinite(comments) ? comments : 0,
        }),
      });
    });
}

export default {
  name: 'reddit',
  intervalMs: 3 * 60 * 1000,
  async fetch() {
    const jobs = SUBS.flatMap((sub) => SORTS.map((sort) => ({ sub, sort })));
    const settled = await Promise.allSettled(jobs.map(({ sub, sort }) => loadSort(sub, sort).then((posts) => ({ sub, posts }))));
    const seen = new Set();
    const items = [];
    for (const row of settled) {
      if (row.status !== 'fulfilled') continue;
      for (const item of toRows(row.value.sub, row.value.posts)) {
        if (!item) continue;
        const key = item.url || item.title;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    }
    const kept = keep(items);
    if (!kept.length) {
      const reason = settled.find((row) => row.status === 'rejected')?.reason;
      throw new Error(reason?.message || 'reddit unavailable');
    }
    return kept;
  },
};

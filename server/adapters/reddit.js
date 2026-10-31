import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

const SUBS = ['CryptoCurrency', 'solana', 'memecoins', 'CryptoMoonShots'];

async function subFeed(sub) {
  const xml = await getText(`https://www.reddit.com/r/${sub}/.rss?limit=15`, {
    browser: true,
    accept: 'application/atom+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
  });
  const feed = parseFeed(xml);
  if (!feed.length) throw new Error(`empty r/${sub}`);
  const sol = sub.toLowerCase() === 'solana' || sub.toLowerCase() === 'memecoins';
  return feed.slice(0, 12).map((item) =>
    toItem({
      source: 'reddit',
      title: item.title,
      url: item.link,
      summary: `r/${sub}${item.summary ? ` · ${item.summary.slice(0, 180)}` : ''}`,
      publishedAt: parseTime(item.pubDate),
      tags: sol ? ['solana'] : [],
    }),
  );
}

export default {
  name: 'reddit',
  intervalMs: 3 * 60 * 1000,
  async fetch() {
    const settled = await Promise.allSettled(SUBS.map(subFeed));
    const items = keep(settled.flatMap((row) => (row.status === 'fulfilled' ? row.value : [])));
    if (!items.length) {
      const reason = settled.find((row) => row.status === 'rejected')?.reason;
      throw new Error(reason?.message || 'reddit unavailable');
    }
    return items;
  },
};

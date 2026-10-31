import { resolveGoogleNewsArticle } from '../links.js';
import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

async function pool(list, limit, fn) {
  const out = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(list[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, () => worker()));
  return out;
}

export default {
  name: 'google-news',
  intervalMs: 5 * 60 * 1000,
  timeoutMs: 25_000,
  async fetch() {
    const xml = await getText(
      'https://news.google.com/rss/search?q=Solana+OR+%22pump.fun%22+when%3A1d&hl=en-US&gl=US&ceid=US:en',
    );
    const feed = parseFeed(xml);
    if (!feed.length) throw new Error('empty parse');
    const rows = await pool(feed.slice(0, 8), 3, async (item) => {
      const url = await resolveGoogleNewsArticle(item.link);
      if (!url) return null;
      return toItem({
        source: 'google-news',
        title: item.title,
        url,
        summary: item.summary,
        publishedAt: parseTime(item.pubDate),
        tags: ['solana'],
      });
    });
    const items = keep(rows);
    if (!items.length) throw new Error('no publisher urls decoded');
    return items;
  },
};

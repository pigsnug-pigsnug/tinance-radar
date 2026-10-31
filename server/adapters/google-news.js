import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

export default {
  name: 'google-news',
  intervalMs: 5 * 60 * 1000,
  async fetch() {
    const xml = await getText(
      'https://news.google.com/rss/search?q=Solana+OR+%22pump.fun%22+when%3A1d&hl=en-US&gl=US&ceid=US:en',
    );
    const feed = parseFeed(xml);
    if (!feed.length) throw new Error('empty parse');
    return keep(
      feed.slice(0, 20).map((item) =>
        toItem({
          source: 'google-news',
          title: item.title,
          url: item.link,
          summary: item.summary,
          publishedAt: parseTime(item.pubDate),
          tags: ['solana'],
        }),
      ),
    );
  },
};

import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

export default {
  name: 'google-trends',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const xml = await getText('https://trends.google.com/trending/rss?geo=US');
    const feed = parseFeed(xml);
    if (!feed.length) throw new Error('empty parse');
    return keep(
      feed.slice(0, 20).map((item) =>
        toItem({
          source: 'google-trends',
          title: item.title,
          url: `https://trends.google.com/trends/explore?geo=US&q=${encodeURIComponent(item.title)}`,
          summary: item.traffic ? `About ${item.traffic} US searches` : 'Google Trends, United States',
          publishedAt: parseTime(item.pubDate) || Date.now(),
        }),
      ),
    );
  },
};

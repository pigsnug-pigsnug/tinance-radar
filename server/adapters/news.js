import { getText } from '../net.js';
import { parseTime } from '../time.js';
import { parseFeed } from '../xml.js';
import { keep, toItem } from './shape.js';

const FEEDS = [
  { source: 'bbc', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', reach: true },
  { source: 'guardian', url: 'https://www.theguardian.com/world/rss', reach: true },
];

export default {
  name: 'news',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const settled = await Promise.allSettled(
      FEEDS.map(async (feed) => {
        const xml = await getText(feed.url, { browser: true });
        const rows = parseFeed(xml);
        if (!rows.length) throw new Error(`empty ${feed.source}`);
        return rows.slice(0, 15).map((item) =>
          toItem({
            source: feed.source,
            title: item.title,
            url: item.link,
            urlBase: feed.url,
            summary: item.summary,
            body: item.summary,
            publishedAt: parseTime(item.pubDate) || Date.now(),
            reach: feed.reach,
          }),
        );
      }),
    );
    const items = keep(settled.flatMap((row) => (row.status === 'fulfilled' ? row.value : [])));
    if (!items.length) {
      const reason = settled.find((row) => row.status === 'rejected')?.reason;
      throw new Error(reason?.message || 'news unavailable');
    }
    return items;
  },
};

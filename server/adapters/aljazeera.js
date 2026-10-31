import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

export default {
  name: 'aljazeera',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const xml = await getText('https://www.aljazeera.com/xml/rss/all.xml');
    const feed = parseFeed(xml);
    if (!feed.length) throw new Error('empty parse');
    return keep(
      feed.slice(0, 15).map((item) =>
        toItem({
          source: 'aljazeera',
          title: item.title,
          url: item.link,
          urlBase: 'https://www.aljazeera.com/',
          summary: item.summary,
          publishedAt: parseTime(item.pubDate),
        }),
      ),
    );
  },
};

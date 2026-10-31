import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { mentionsSolana } from '../phrases.js';
import { keep, toItem } from './shape.js';

export default {
  name: 'cointelegraph',
  intervalMs: 5 * 60 * 1000,
  async fetch() {
    const xml = await getText('https://cointelegraph.com/rss');
    const feed = parseFeed(xml);
    if (!feed.length) throw new Error('empty parse');
    return keep(
      feed
        .filter((item) => mentionsSolana(`${item.title} ${item.summary}`) || /\bsol\b/i.test(item.title))
        .slice(0, 15)
        .map((item) =>
          toItem({
            source: 'cointelegraph',
            title: item.title,
            url: item.link,
            urlBase: 'https://cointelegraph.com/',
            summary: item.summary,
            publishedAt: parseTime(item.pubDate),
            tags: ['solana'],
          }),
        ),
    );
  },
};

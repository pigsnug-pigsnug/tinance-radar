import { config } from '../config.js';
import { getText } from '../net.js';
import { parseFeed } from '../xml.js';
import { parseTime } from '../time.js';
import { mentionsSolana } from '../phrases.js';
import { keep, toItem } from './shape.js';

const SOLANA_CHANNEL = 'UC9AdQPUe4BdVJ8M9X7wxHUA';

export default {
  name: 'youtube',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const channels = config.youtubeChannelIds;
    if (!channels.length) throw new Error('set YOUTUBE_CHANNEL_IDS');
    const settled = await Promise.allSettled(
      channels.map(async (id) => {
        const xml = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`, {
          browser: true,
          accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
        });
        const feed = parseFeed(xml);
        if (!feed.length) throw new Error(`empty ${id}`);
        return feed.slice(0, 8).map((item) => {
          const sol = id === SOLANA_CHANNEL || mentionsSolana(`${item.title} ${item.summary}`);
          return toItem({
            source: 'youtube',
            title: item.title,
            url: item.link,
            urlBase: 'https://www.youtube.com/',
            summary: 'YouTube',
            publishedAt: parseTime(item.pubDate),
            tags: sol ? ['solana'] : [],
          });
        });
      }),
    );
    const items = keep(settled.flatMap((row) => (row.status === 'fulfilled' ? row.value : [])));
    if (!items.length) {
      const reason = settled.find((row) => row.status === 'rejected')?.reason;
      throw new Error(reason?.message || 'youtube unavailable');
    }
    return items;
  },
};

import { getJson } from '../net.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

export default {
  name: 'hn-solana',
  intervalMs: 5 * 60 * 1000,
  async fetch() {
    const data = await getJson(
      'https://hn.algolia.com/api/v1/search_by_date?query=solana&tags=story&hitsPerPage=20',
    );
    const hits = data?.hits || [];
    if (!Array.isArray(hits)) throw new Error('invalid algolia payload');
    return keep(
      hits.map((hit) =>
        toItem({
          source: 'hn-solana',
          title: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          summary: `${hit.points || 0} points · Algolia · solana`,
          publishedAt: parseTime(hit.created_at),
          tags: ['solana'],
        }),
      ),
    );
  },
};

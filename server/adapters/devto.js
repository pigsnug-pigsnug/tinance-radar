import { getJson } from '../net.js';
import { parseTime } from '../time.js';
import { mentionsSolana } from '../phrases.js';
import { keep, toItem } from './shape.js';

async function articles(query) {
  const rows = await getJson(`https://dev.to/api/articles?${query}`);
  if (!Array.isArray(rows)) throw new Error('invalid dev.to payload');
  return rows;
}

export default {
  name: 'devto',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const [top, solana] = await Promise.all([
      articles('per_page=20&top=7'),
      articles('tag=solana&per_page=15'),
    ]);
    const solanaTitles = new Set(solana.map((row) => String(row.title || '').toLowerCase()));
    const merged = [...solana, ...top];
    const seen = new Set();
    const items = [];
    for (const row of merged) {
      const key = String(row.title || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const text = `${row.title || ''} ${row.description || ''} ${(row.tag_list || []).join(' ')}`;
      const sol = solanaTitles.has(key) || mentionsSolana(text);
      items.push(
        toItem({
          source: 'devto',
          title: row.title,
          url: row.url || row.canonical_url,
          summary: row.description || '',
          publishedAt: parseTime(row.published_at),
          tags: sol ? ['solana'] : [],
        }),
      );
    }
    const kept = keep(items);
    if (!kept.length) throw new Error('empty dev.to');
    return kept;
  },
};

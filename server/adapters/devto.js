import { engagementHits } from '../engagement.js';
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
      const reactions = Number(row.public_reactions_count) || 0;
      if (!sol && reactions < 25) continue;
      if (sol && reactions < 3 && !solanaTitles.has(key)) continue;
      const canonical = String(row.canonical_url || '');
      const rawUrl = String(row.url || '');
      const url = canonical.startsWith('http')
        ? canonical
        : rawUrl.startsWith('http')
          ? rawUrl
          : rawUrl.startsWith('/')
            ? `https://dev.to${rawUrl}`
            : '';
      if (!url) continue;
      items.push(
        toItem({
          source: 'devto',
          title: row.title,
          url,
          summary: row.description || '',
          publishedAt: parseTime(row.published_at),
          tags: sol ? ['solana'] : [],
          hits: engagementHits({ reactions }),
        }),
      );
    }
    const kept = keep(items);
    if (!kept.length) throw new Error('empty dev.to');
    return kept;
  },
};

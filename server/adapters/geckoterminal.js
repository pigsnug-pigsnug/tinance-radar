import { getJson } from '../net.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default {
  name: 'geckoterminal',
  intervalMs: 2 * 60 * 1000,
  async fetch() {
    const data = await getJson('https://api.geckoterminal.com/api/v2/networks/solana/trending_pools');
    const pools = data?.data || [];
    if (!pools.length) throw new Error('empty trending pools');
    return keep(
      pools.slice(0, 15).map((pool) => {
        const attr = pool.attributes || {};
        const change = attr.price_change_percentage?.h1;
        const vol = attr.volume_usd?.h24;
        return toItem({
          source: 'geckoterminal',
          title: attr.name || 'Solana pool',
          url: attr.address ? `https://www.geckoterminal.com/solana/pools/${attr.address}` : 'https://www.geckoterminal.com/solana',
          summary: [
            vol ? `24h ${money(vol)}` : '',
            change != null ? `1h ${change}%` : '',
            attr.base_token_price_usd ? `$${Number(attr.base_token_price_usd).toPrecision(3)}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          publishedAt: parseTime(attr.pool_created_at) || Date.now(),
          tags: ['solana'],
        });
      }),
    );
  },
};

import { engagementHits } from '../engagement.js';
import { gmgnUrl } from '../links.js';
import { getJson } from '../net.js';
import { keep, toItem } from './shape.js';

async function lookup(addresses) {
  const map = new Map();
  if (!addresses.length) return map;
  try {
    const data = await getJson(
      `https://api.dexscreener.com/tokens/v1/solana/${addresses.slice(0, 30).join(',')}`,
    );
    const pairs = Array.isArray(data) ? data : data?.pairs || [];
    for (const pair of pairs) {
      const address = pair.baseToken?.address;
      if (!address || map.has(address)) continue;
      map.set(address, {
        symbol: pair.baseToken?.symbol || '',
        name: pair.baseToken?.name || '',
        price: pair.priceUsd,
        vol: pair.volume?.h24,
        liq: pair.liquidity?.usd,
      });
    }
  } catch {
    /* names are optional; the boost row still stands */
  }
  return map;
}

function solanaRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => row.chainId === 'solana' && row.tokenAddress);
}

export default {
  name: 'dexscreener',
  intervalMs: 2 * 60 * 1000,
  async fetch() {
    const [boosts, profiles] = await Promise.all([
      getJson('https://api.dexscreener.com/token-boosts/top/v1'),
      getJson('https://api.dexscreener.com/token-profiles/latest/v1'),
    ]);
    const top = solanaRows(boosts).slice(0, 10);
    const latest = solanaRows(profiles).slice(0, 8);
    const names = await lookup([...new Set([...top, ...latest].map((row) => row.tokenAddress))]);
    const items = [];
    for (const row of top) {
      const meta = names.get(row.tokenAddress);
      const label = meta?.symbol || meta?.name || `${row.tokenAddress.slice(0, 4)}…${row.tokenAddress.slice(-4)}`;
      items.push(
        toItem({
          source: 'dexscreener',
          title: `Boosted $${label}`,
          url: gmgnUrl(row.tokenAddress) || row.url,
          hits: engagementHits({ score: Number(row.totalAmount) || Number(meta?.vol) || 0 }),
          summary: [
            row.description,
            meta?.price ? `$${meta.price}` : '',
            meta?.vol ? `24h vol $${Math.round(meta.vol).toLocaleString('en-US')}` : '',
            row.totalAmount ? `${row.totalAmount} boosts` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          publishedAt: Date.now(),
          tags: ['solana'],
        }),
      );
    }
    for (const row of latest) {
      const meta = names.get(row.tokenAddress);
      const label = meta?.symbol || meta?.name || `${row.tokenAddress.slice(0, 4)}…${row.tokenAddress.slice(-4)}`;
      items.push(
        toItem({
          source: 'dexscreener',
          title: `New profile $${label}`,
          url: gmgnUrl(row.tokenAddress) || row.url,
          hits: engagementHits({ score: Number(row.totalAmount) || Number(meta?.vol) || 0 }),
          summary: row.description || 'Latest Solana token profile on DexScreener',
          publishedAt: Date.now(),
          tags: ['solana'],
        }),
      );
    }
    const kept = keep(items);
    if (!kept.length) throw new Error('no solana rows');
    return kept;
  },
};

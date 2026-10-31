import { gmgnUrl } from '../links.js';
import { getJson } from '../net.js';
import { keep, toItem } from './shape.js';

const KOTH = [
  'https://frontend-api-v3.pump.fun/coins/king-of-the-hill?includeNsfw=false',
  'https://frontend-api.pump.fun/coins/king-of-the-hill?includeNsfw=false',
];

const GRADS = [
  'https://frontend-api-v3.pump.fun/coins?offset=0&limit=12&sort=last_trade_timestamp&order=DESC&includeNsfw=false&complete=true',
  'https://frontend-api.pump.fun/coins?offset=0&limit=12&sort=last_trade_timestamp&order=DESC&includeNsfw=false&complete=true',
];

async function firstJson(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      return await getJson(url, { browser: true });
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(errors.join(' | ') || 'unreachable');
}

function asCoin(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.mint || row.name || row.symbol) return row;
  return null;
}

export default {
  name: 'pumpfun',
  intervalMs: 2 * 60 * 1000,
  async fetch() {
    const errors = [];
    const items = [];
    try {
      const data = await firstJson(KOTH);
      const coin = asCoin(data?.coin || data);
      if (!coin) throw new Error('koth payload empty');
      const name = coin.name || coin.symbol || 'king of the hill';
      items.push(
        toItem({
          source: 'pumpfun',
          title: `King of the hill: ${name}${coin.symbol ? ` ($${coin.symbol})` : ''}`,
          url: gmgnUrl(coin.mint),
          summary: coin.usd_market_cap
            ? `Market cap $${Math.round(coin.usd_market_cap).toLocaleString('en-US')}`
            : 'pump.fun king of the hill',
          publishedAt: Date.now(),
          tags: ['solana'],
          extra: { kind: 'koth', symbol: coin.symbol || '', marketCap: coin.usd_market_cap || 0, mint: coin.mint || '' },
        }),
      );
    } catch (error) {
      errors.push(`koth ${error.message}`);
    }
    try {
      const data = await firstJson(GRADS);
      const rows = Array.isArray(data) ? data : data?.coins || data?.items || [];
      if (!rows.length) throw new Error('no graduations');
      for (const coin of rows.slice(0, 8)) {
        const name = coin.name || coin.symbol;
        if (!name) continue;
        items.push(
          toItem({
            source: 'pumpfun',
            title: `Graduated ${name}${coin.symbol ? ` ($${coin.symbol})` : ''}`,
            url: gmgnUrl(coin.mint),
            summary: 'Completed the pump.fun bonding curve',
            publishedAt: coin.last_trade_timestamp ? coin.last_trade_timestamp * 1000 : Date.now(),
            tags: ['solana'],
            extra: { kind: 'graduation', symbol: coin.symbol || '' },
          }),
        );
      }
    } catch (error) {
      errors.push(`grads ${error.message}`);
    }
    const kept = keep(items);
    if (!kept.length) throw new Error(errors.join(' | ') || 'pump.fun rest unreachable');
    return kept;
  },
};

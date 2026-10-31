import { getJson } from '../net.js';
import { keep, toItem } from './shape.js';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}

export default {
  name: 'polymarket',
  intervalMs: 5 * 60 * 1000,
  async fetch() {
    const markets = await getJson(
      'https://gamma-api.polymarket.com/markets?closed=false&limit=40&order=volume24hr&ascending=false',
    );
    if (!Array.isArray(markets) || !markets.length) throw new Error('empty markets');
    const ranked = markets
      .map((market) => {
        const volume = num(market.volume24hr);
        const change = num(market.oneHourPriceChange);
        return { market, volume, change, heat: Math.log10(volume + 10) * (1 + Math.abs(change) * 12) };
      })
      .filter((row) => row.volume >= 20_000 || Math.abs(row.change) >= 0.04)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 10);
    const picked = ranked.length ? ranked : markets.slice(0, 8).map((market) => ({
      market,
      volume: num(market.volume24hr),
      change: num(market.oneHourPriceChange),
    }));
    return keep(
      picked.map(({ market, volume, change }) => {
        const slug = market.events?.[0]?.slug || market.slug;
        const sign = change > 0 ? '+' : '';
        return toItem({
          source: 'polymarket',
          title: market.question || market.slug,
          url: slug ? `https://polymarket.com/event/${slug}` : 'https://polymarket.com',
          summary: `24h vol ${money(volume)}${change ? ` · 1h ${sign}${(change * 100).toFixed(1)}¢` : ''}`,
          publishedAt: Date.now(),
        });
      }),
    );
  },
};

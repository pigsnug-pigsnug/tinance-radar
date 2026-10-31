import { getJson } from './net.js';

const CHAINS = [
  { id: 'solana', label: 'SOL' },
  { id: 'ethereum', label: 'ETH' },
  { id: 'bsc', label: 'BNB' },
  { id: 'base', label: 'BASE' },
];

async function chainVolume(id) {
  const data = await getJson(
    `https://api.llama.fi/overview/dexs/${id}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
  );
  return {
    volume24h: Number(data.total24h) || 0,
    change: Number(data.change_1d) || 0,
  };
}

export function startMarket({ store, status }) {
  const row = {
    name: 'market',
    state: 'idle',
    stale: false,
    failures: 0,
    lastOk: 0,
    lastError: '',
    intervalMs: 60_000,
    count: 0,
    detail: 'SOL price + DEX volume',
  };
  status.set('market', row);
  let previous = null;

  const tick = async () => {
    const chains = [];
    const errors = [];
    await Promise.all(
      CHAINS.map(async (chain, index) => {
        try {
          const vol = await chainVolume(chain.id);
          chains[index] = { ...chain, ...vol, stale: false };
        } catch (error) {
          errors.push(`${chain.label} ${error.message}`);
          const prev = previous?.chains?.find((item) => item.id === chain.id);
          chains[index] = prev ? { ...prev, stale: true } : { ...chain, volume24h: null, change: null, stale: true };
        }
      }),
    );
    let sol = previous?.sol || { usd: null, change24h: null };
    try {
      const price = await getJson(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true',
      );
      if (price?.solana?.usd != null) {
        sol = { usd: price.solana.usd, change24h: price.solana.usd_24h_change ?? null };
      }
    } catch (error) {
      errors.push(`SOL ${error.message}`);
      sol = { ...sol, stale: true };
    }
    const next = {
      updatedAt: Date.now(),
      sol,
      chains,
      stale: errors.length > 0,
      error: errors.join(' · '),
    };
    previous = next;
    store.setMarket(next);
    row.lastOk = Date.now();
    row.count = chains.filter((chain) => chain.volume24h != null).length;
    if (errors.length && !chains.some((chain) => chain.volume24h != null) && sol.usd == null) {
      row.failures += 1;
      row.state = 'error';
      row.lastError = errors.join(' · ');
      row.stale = true;
    } else {
      row.failures = 0;
      row.state = errors.length ? 'error' : 'ok';
      row.stale = errors.length > 0;
      row.lastError = errors.join(' · ');
      row.detail = sol.usd != null ? `SOL $${sol.usd}` : 'volume only';
    }
  };

  const loop = async () => {
    try {
      await tick();
    } catch (error) {
      row.state = 'error';
      row.lastError = error.message;
      row.failures += 1;
    }
    setTimeout(loop, 60_000);
  };
  setTimeout(loop, 800);
}

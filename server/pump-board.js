import { dexScreenerUrl, gmgnUrl, pumpFunUrl } from './links.js';

const NAME_STOP = new Set(['coin', 'token', 'sol', 'pump', 'fun', 'the', 'new', 'test', 'moon', 'inu']);

export function narrativeKey(symbol, name) {
  const raw = String(symbol || name || '')
    .toLowerCase()
    .replace(/^\$/, '')
    .replace(/[^a-z0-9]+/g, '');
  if (raw.length < 2 || raw.length > 16) return '';
  if (NAME_STOP.has(raw)) return '';
  return raw;
}

const DEFAULTS = {
  minMcapSol: 45,
  nearGradSol: 70,
  minTrades: 12,
  minBuySol: 8,
  tradeWindowMs: 3 * 60 * 1000,
  nameRepeat: 3,
  narrativeWindowMs: 30 * 60 * 1000,
  watchMs: 10 * 60 * 1000,
  maxWatch: 40,
  maxVisible: 30,
};

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function createPumpBoard(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const coins = new Map();
  const names = new Map();

  function blank(mint, now) {
    return {
      mint,
      name: '',
      symbol: '',
      marketCapSol: 0,
      firstMcap: 0,
      ts: now,
      createdAt: now,
      graduated: false,
      koth: false,
      trades: [],
    };
  }

  function ensure(mint, now) {
    let row = coins.get(mint);
    if (!row) {
      row = blank(mint, now);
      coins.set(mint, row);
    }
    return row;
  }

  function cleanLabel(value) {
    const text = String(value || '').replace(/^\$/, '').trim();
    if (!text || text.toLowerCase() === 'coin') return '';
    return text;
  }

  function applyIdentity(row, msg, now) {
    const name = cleanLabel(msg.name);
    const symbol = cleanLabel(msg.symbol);
    if (name) row.name = name.slice(0, 80);
    if (symbol) row.symbol = symbol.slice(0, 16);
    const mcap = num(msg.marketCapSol);
    if (mcap > 0) {
      if (!row.firstMcap) row.firstMcap = mcap;
      row.marketCapSol = mcap;
    }
    row.ts = now;
  }

  function noteName(row, now) {
    const key = narrativeKey(row.symbol, row.name);
    if (!key) return;
    let bucket = names.get(key);
    if (!bucket) {
      bucket = { key, label: row.symbol || row.name, hits: [] };
      names.set(key, bucket);
    }
    if (row.symbol) bucket.label = row.symbol;
    bucket.hits.push({ ts: now, mint: row.mint });
    const cutoff = now - cfg.narrativeWindowMs;
    bucket.hits = bucket.hits.filter((hit) => hit.ts >= cutoff).slice(-80);
  }

  function windowStats(row, now) {
    const cutoff = now - cfg.tradeWindowMs;
    row.trades = row.trades.filter((trade) => trade.ts >= cutoff).slice(-80);
    let buySol = 0;
    for (const trade of row.trades) {
      if (trade.side !== 'sell') buySol += trade.sol;
    }
    return { tradeCount: row.trades.length, buySol };
  }

  function hasTraction(row, now) {
    if (row.graduated || row.koth) return true;
    // Birth prints sit near ~30 SOL of virtual liquidity. Anything clearly above that
    // has already moved, which is the market-cap signal.
    if (row.marketCapSol >= cfg.minMcapSol) return true;
    const { tradeCount, buySol } = windowStats(row, now);
    if (tradeCount >= cfg.minTrades || buySol >= cfg.minBuySol) return true;
    return false;
  }

  function kindOf(row) {
    if (row.graduated) return 'graduation';
    if (row.koth) return 'koth';
    if (row.marketCapSol >= cfg.nearGradSol) return 'near-grad';
    return 'traction';
  }

  function rank(row, now) {
    const { buySol, tradeCount } = windowStats(row, now);
    const tier = row.graduated ? 400 : row.koth ? 300 : row.marketCapSol >= cfg.nearGradSol ? 200 : 100;
    return tier + row.marketCapSol + buySol * 4 + tradeCount;
  }

  function publicToken(row, now) {
    const { buySol, tradeCount } = windowStats(row, now);
    return {
      mint: row.mint,
      name: row.name || row.symbol || `${row.mint.slice(0, 4)}…${row.mint.slice(-4)}`,
      symbol: row.symbol || '',
      marketCapSol: Math.round(row.marketCapSol * 10) / 10,
      ts: row.ts,
      kind: kindOf(row),
      url: gmgnUrl(row.mint),
      pumpUrl: pumpFunUrl(row.mint),
      dexUrl: dexScreenerUrl(row.mint),
      buySol: Math.round(buySol * 10) / 10,
      trades: tradeCount,
    };
  }

  function prune(now) {
    const cutoff = now - cfg.narrativeWindowMs * 2;
    for (const [mint, row] of coins) {
      if (!row.graduated && !row.koth && row.ts < cutoff) coins.delete(mint);
    }
    if (coins.size > 500) {
      const oldest = [...coins.values()].sort((a, b) => a.ts - b.ts);
      for (const row of oldest.slice(0, coins.size - 400)) coins.delete(row.mint);
    }
  }

  return {
    create(msg, now = Date.now()) {
      const mint = msg?.mint || msg?.tokenAddress;
      if (!mint) return;
      const row = ensure(mint, now);
      row.createdAt = row.createdAt || now;
      applyIdentity(row, msg, now);
      if (!row.firstMcap) row.firstMcap = row.marketCapSol;
      noteName(row, now);
      prune(now);
    },
    trade(msg, now = Date.now()) {
      const mint = msg?.mint || msg?.tokenAddress;
      if (!mint) return;
      const row = ensure(mint, now);
      applyIdentity(row, msg, now);
      const side = msg.txType === 'sell' ? 'sell' : 'buy';
      const sol = Math.abs(num(msg.solAmount));
      if (sol > 0 || msg.txType) row.trades.push({ ts: now, side, sol });
      prune(now);
    },
    graduate(msg, now = Date.now()) {
      const mint = msg?.mint || msg?.tokenAddress;
      if (!mint) return;
      const row = ensure(mint, now);
      applyIdentity(row, msg, now);
      row.graduated = true;
      noteName(row, now);
      prune(now);
    },
    koth(coin, now = Date.now()) {
      const mint = coin?.mint;
      if (!mint) return;
      for (const row of coins.values()) row.koth = false;
      const row = ensure(mint, now);
      applyIdentity(
        row,
        {
          name: coin.name,
          symbol: coin.symbol,
          marketCapSol: coin.marketCapSol || (num(coin.usd_market_cap) ? cfg.nearGradSol : 0),
        },
        now,
      );
      row.koth = true;
      noteName(row, now);
    },
    label(mint, { name, symbol } = {}, now = Date.now()) {
      const row = coins.get(mint);
      if (!row) return;
      if (name) row.name = String(name).slice(0, 80);
      if (symbol) row.symbol = String(symbol).replace(/^\$/, '').slice(0, 16);
      noteName(row, now);
    },
    watchMints(now = Date.now()) {
      return [...coins.values()]
        .filter((row) => !row.graduated && now - row.createdAt <= cfg.watchMs)
        .sort((a, b) => b.marketCapSol - a.marketCapSol || b.createdAt - a.createdAt)
        .slice(0, cfg.maxWatch)
        .map((row) => row.mint);
    },
    snapshot(now = Date.now()) {
      const ranked = [...coins.values()].filter((row) => hasTraction(row, now)).sort((a, b) => rank(b, now) - rank(a, now));
      const seenNames = new Set();
      const tokens = [];
      for (const row of ranked) {
        const key = narrativeKey(row.symbol, row.name);
        if (key && seenNames.has(key)) continue;
        if (key) seenNames.add(key);
        const token = publicToken(row, now);
        if (!token.url) continue;
        tokens.push(token);
        if (tokens.length >= cfg.maxVisible) break;
      }
      const narratives = [...names.values()]
        .map((bucket) => {
          const cutoff = now - cfg.narrativeWindowMs;
          const hits = bucket.hits.filter((hit) => hit.ts >= cutoff);
          const mints = [...new Set(hits.map((hit) => hit.mint))];
          return {
            key: bucket.key,
            label: bucket.label || bucket.key,
            count: mints.length,
            mint: mints[0] || '',
            url: mints[0] ? gmgnUrl(mints[0]) : '',
          };
        })
        .filter((row) => row.count >= cfg.nameRepeat)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
      const koth = [...coins.values()].find((row) => row.koth);
      return {
        tokens,
        narratives,
        koth: koth ? publicToken(koth, now) : null,
      };
    },
  };
}

import { nextDelay } from '../backoff.js';
import { config } from '../config.js';
import { getJson } from '../net.js';
import { createPumpBoard } from '../pump-board.js';

const URL = 'wss://pumpportal.fun/api/data';

export function startPump({ store, status }) {
  const row = {
    name: 'pumpfun-ws',
    state: 'idle',
    stale: false,
    failures: 0,
    lastOk: 0,
    lastError: '',
    intervalMs: 0,
    count: 0,
    detail: 'connecting',
  };
  status.set('pumpfun-ws', row);
  const board = createPumpBoard(config.pump);
  let attempt = 0;
  let ws;
  let watchKey = '';
  let lastSnap = '';
  const ingested = new Set();
  const naming = new Set();

  const labelMint = (mint) => {
    if (!mint || naming.has(mint)) return;
    naming.add(mint);
    getJson(`https://api.dexscreener.com/tokens/v1/solana/${mint}`)
      .then((data) => {
        const pairs = Array.isArray(data) ? data : data?.pairs || [];
        const token = pairs[0]?.baseToken;
        if (!token?.symbol && !token?.name) return;
        board.label(mint, { name: token.name, symbol: token.symbol });
        publish();
      })
      .catch(() => {});
  };

  const publish = (now = Date.now()) => {
    const snap = board.snapshot(now);
    const fingerprint = JSON.stringify({
      mints: snap.tokens.map((token) => `${token.mint}:${token.kind}:${token.symbol}:${token.marketCapSol}`),
      names: snap.narratives.map((item) => `${item.key}:${item.count}`),
      koth: snap.koth?.mint || '',
    });
    if (fingerprint === lastSnap) return;
    lastSnap = fingerprint;
    row.count = snap.tokens.length;
    row.detail = `${snap.tokens.length} signals · ${snap.narratives.length} narratives`;
    const patch = {
      connected: row.state === 'ok',
      error: row.lastError || '',
    };
    // Don't blank a restored radar with an empty live board on the first creates.
    if (snap.tokens.length || snap.koth) {
      patch.tokens = snap.tokens;
      patch.koth = snap.koth;
    }
    if (snap.narratives.length) patch.narratives = snap.narratives;
    store.setRadar(patch);
    for (const token of snap.tokens) {
      if (!token.symbol) labelMint(token.mint);
    }
    for (const token of snap.tokens) {
      if (token.kind !== 'graduation' && token.kind !== 'koth') continue;
      const seenKey = `${token.kind}:${token.mint}`;
      if (ingested.has(seenKey)) continue;
      ingested.add(seenKey);
      const label = token.symbol ? `$${token.symbol}` : token.name;
      store.ingestItems([
        {
          source: 'pumpfun',
          title: token.kind === 'koth' ? `King of the hill: ${label}` : `Graduated ${label}`,
          url: token.url,
          summary:
            token.kind === 'koth'
              ? `${token.name} · ${token.marketCapSol} SOL`
              : `${token.name} migrated off the bonding curve`,
          publishedAt: token.ts || now,
          tags: ['solana'],
          extra: { kind: token.kind === 'koth' ? 'koth' : 'graduation', symbol: token.symbol, mint: token.mint },
        },
      ]);
    }
  };

  const syncWatch = () => {
    if (ws?.readyState !== 1) return;
    const keys = board.watchMints();
    const next = keys.join(',');
    if (!next || next === watchKey) return;
    watchKey = next;
    ws.send(JSON.stringify({ method: 'subscribeTokenTrade', keys }));
  };

  const connect = () => {
    try {
      ws = new WebSocket(URL);
    } catch (error) {
      row.state = 'error';
      row.lastError = error.message;
      row.failures += 1;
      setTimeout(connect, nextDelay(row.failures, 2000, 60_000));
      return;
    }
    ws.onopen = () => {
      attempt = 0;
      watchKey = '';
      row.failures = 0;
      row.state = 'ok';
      row.stale = false;
      row.lastError = '';
      row.lastOk = Date.now();
      row.detail = 'subscribed to traction, not every create';
      store.setRadar({ connected: true, error: '' });
      ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      ws.send(JSON.stringify({ method: 'subscribeMigration' }));
      syncWatch();
    };
    ws.onmessage = (ev) => {
      row.lastOk = Date.now();
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.message && !msg.mint && !msg.tokenAddress) {
        row.detail = String(msg.message).slice(0, 120);
        return;
      }
      const mint = msg.mint || msg.tokenAddress;
      if (!mint) return;
      const now = Date.now();
      const tx = String(msg.txType || '');
      if (tx === 'migrate' || tx === 'migration') board.graduate(msg, now);
      else if (tx === 'buy' || tx === 'sell') board.trade(msg, now);
      else board.create(msg, now);
      syncWatch();
      publish(now);
    };
    ws.onerror = () => {
      row.lastError = 'socket error';
    };
    ws.onclose = () => {
      attempt += 1;
      row.failures = attempt;
      row.state = 'error';
      row.stale = true;
      row.lastError = row.lastError || 'socket closed';
      store.setRadar({ connected: false, error: row.lastError });
      setTimeout(connect, nextDelay(attempt, 2000, 60_000));
    };
  };

  connect();
}

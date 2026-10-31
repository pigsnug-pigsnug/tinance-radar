import { nextDelay } from '../backoff.js';

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
  let attempt = 0;

  const connect = () => {
    let ws;
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
      row.failures = 0;
      row.state = 'ok';
      row.stale = false;
      row.lastError = '';
      row.lastOk = Date.now();
      row.detail = 'subscribed to creates + migrations';
      store.setRadar({ connected: true, error: '' });
      ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      ws.send(JSON.stringify({ method: 'subscribeMigration' }));
    };
    ws.onmessage = (ev) => {
      row.lastOk = Date.now();
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.message && !msg.mint) {
        row.detail = String(msg.message).slice(0, 120);
        return;
      }
      const mint = msg.mint || msg.tokenAddress;
      if (!mint) return;
      const kind = msg.txType === 'migrate' || msg.txType === 'migration' ? 'graduation' : 'create';
      const token = {
        mint,
        name: msg.name || 'new coin',
        symbol: msg.symbol || '',
        marketCapSol: Number(msg.marketCapSol || 0) || 0,
        ts: Date.now(),
        url: `https://pump.fun/coin/${mint}`,
        kind,
      };
      row.count += 1;
      if (kind === 'graduation') {
        const label = token.symbol ? `$${token.symbol}` : token.name;
        store.ingestItems([
          {
            source: 'pumpfun',
            title: `Graduated ${label}`,
            url: token.url,
            summary: `${token.name} migrated off the bonding curve`,
            publishedAt: Date.now(),
            tags: ['solana'],
            extra: { kind: 'graduation', symbol: token.symbol },
          },
        ]);
      }
      store.pushPumpToken(token);
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

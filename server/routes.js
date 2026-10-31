import { Router } from 'express';
import { getJson } from './net.js';

function fail(res, error) {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || 'error' });
}

export function createApi({ store, bus, ingest }) {
  const router = Router();

  router.get('/state', (_req, res) => {
    res.json(store.bootstrap({ health: ingest.health() }));
  });

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      time: Date.now(),
      persistence: store.bootstrap().config.persistence,
      sources: ingest.health(),
    });
  });

  router.get('/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const after = Number(req.headers['last-event-id'] || req.query.after || 0);
    const write = (record) => {
      res.write(`id: ${record.id}\nevent: ${record.event}\ndata: ${JSON.stringify(record.data)}\n\n`);
    };
    for (const record of bus.recent(Number.isFinite(after) ? after : 0)) write(record);
    const unsubscribe = bus.subscribe(write);
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });

  router.post('/refresh', async (_req, res) => {
    try {
      res.json(await ingest.refresh());
    } catch (error) {
      fail(res, error);
    }
  });

  router.post('/stars', (req, res) => {
    const item = store.resolveItem(req.body);
    if (!item) return res.status(400).json({ error: 'item required' });
    res.json(store.toggleStar(item));
  });

  router.post('/saves', (req, res) => {
    const item = store.resolveItem(req.body);
    if (!item) return res.status(400).json({ error: 'item required' });
    res.json(store.toggleSave(item));
  });

  router.put('/notes/:id', (req, res) => {
    const item = store.resolveItem(req.body);
    res.json({ note: store.setNote(req.params.id, req.body?.text, item) });
  });

  router.put('/watchwords', (req, res) => {
    res.json({ watchwords: store.setWatchwords(req.body?.words) });
  });

  router.post('/launches', (req, res) => {
    const item = store.resolveItem(req.body);
    if (!item) return res.status(400).json({ error: 'item required' });
    const topic = item.topicId ? store.topic(item.topicId) : null;
    const launch = store.addLaunch({
      itemId: item.id,
      title: item.title,
      url: item.url,
      source: item.source,
      topicId: topic?.id || item.topicId || '',
      topicLabel: topic?.label || '',
      score: topic?.score || 0,
      velocity: topic?.velocity || 0,
      acceleration: topic?.acceleration || 0,
      perHour: topic?.perHour || 0,
      cross: topic?.cross || 0,
      multi: Boolean(topic?.multi),
      note: req.body?.note || '',
    });
    res.json({ launch });
  });

  router.patch('/launches/:id', (req, res) => {
    const launch = store.patchLaunch(req.params.id, req.body || {});
    if (!launch) return res.status(404).json({ error: 'not found' });
    res.json({ launch });
  });

  router.delete('/launches/:id', (req, res) => {
    res.json({ ok: store.deleteLaunch(req.params.id) });
  });

  router.post('/desk/wallets', (req, res) => {
    try {
      res.json({ wallet: store.addWallet(req.body || {}) });
    } catch (error) {
      fail(res, error);
    }
  });

  router.delete('/desk/wallets/:id', (req, res) => {
    store.deleteWallet(req.params.id);
    res.json({ ok: true });
  });

  router.post('/desk/bills', (req, res) => {
    res.json({ bill: store.addBill(req.body || {}) });
  });

  router.patch('/desk/bills/:id', (req, res) => {
    const bill = store.patchBill(req.params.id, req.body || {});
    if (!bill) return res.status(404).json({ error: 'not found' });
    res.json({ bill });
  });

  router.delete('/desk/bills/:id', (req, res) => {
    store.deleteBill(req.params.id);
    res.json({ ok: true });
  });

  router.put('/desk/notes', (req, res) => {
    res.json({ notes: store.setDeskNotes(req.body?.notes) });
  });

  router.get('/coin', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.status(400).json({ error: 'query too short' });
    try {
      const data = await getJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
      const pairs = (data.pairs || []).slice(0, 12).map((pair) => ({
        chain: pair.chainId,
        dex: pair.dexId,
        name: `${pair.baseToken?.symbol || '?'}/${pair.quoteToken?.symbol || '?'}`,
        base: pair.baseToken?.name || '',
        symbol: pair.baseToken?.symbol || '',
        address: pair.baseToken?.address || '',
        price: pair.priceUsd || null,
        vol: pair.volume?.h24 ?? null,
        liq: pair.liquidity?.usd ?? null,
        change: pair.priceChange?.h24 ?? null,
        url: pair.url || '',
      }));
      res.json({ pairs });
    } catch (error) {
      res.status(502).json({ error: error.message || 'dexscreener unavailable' });
    }
  });

  return router;
}

import { config } from './config.js';
import { createBus } from './bus.js';
import { createPersist } from './persist.js';
import { createCluster } from './cluster.js';
import { createStore } from './store.js';
import { createRunner } from './runner.js';
import adapters from './adapters/index.js';
import { startIngest } from './ingest.js';
import { startBluesky } from './live/bluesky.js';
import { startPump } from './live/pump.js';
import { startMarket } from './market.js';
import { buildApp } from './app.js';

const persist = await createPersist(config.dataDir);
const bus = createBus();
const cluster = createCluster({
  windowMs: config.multiWindowMs,
  minSources: config.minSources,
});
const store = createStore({ cluster, persist, bus, config });
await store.hydrate();
store.startAutosave();

const status = new Map();
const runners = adapters.map((adapter) => createRunner(adapter));
for (const runner of runners) status.set(runner.name, runner.status());

const ingest = startIngest({ runners, store, bus, status });
startBluesky({ store, status });
startPump({ store, status });
startMarket({ store, status });

const app = buildApp({ store, bus, ingest });
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[tinance-radar] http://127.0.0.1:${config.port}`);
  if (!config.authPassword) {
    console.warn('[tinance-radar] AUTH_PASSWORD not set — auth disabled');
  }
});
server.requestTimeout = 0;
server.on('error', (error) => {
  console.error('[tinance-radar]', error.message);
  process.exit(1);
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  console.log('[tinance-radar] flushing state');
  try {
    await store.flush();
  } catch (error) {
    console.warn('[tinance-radar] flush failed:', error.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref?.();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

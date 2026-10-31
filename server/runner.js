import { nextDelay } from './backoff.js';

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createRunner(adapter, hooks = {}) {
  const timeoutMs = hooks.timeoutMs ?? adapter.timeoutMs ?? 15_000;
  const threshold = hooks.failureThreshold ?? 3;
  const base = hooks.baseBackoffMs ?? 5_000;
  const max = hooks.maxBackoffMs ?? 5 * 60_000;
  const rand = hooks.rand ?? Math.random;

  const runner = {
    name: adapter.name,
    intervalMs: adapter.intervalMs,
    state: 'idle',
    failures: 0,
    backoffMs: 0,
    openUntil: 0,
    lastOk: 0,
    lastError: '',
    lastItems: [],
    lastCount: 0,
    stale: false,
    async tick(now = Date.now()) {
      if (now < runner.openUntil) {
        runner.state = 'open';
        runner.stale = runner.lastItems.length > 0;
        return { items: runner.lastItems, stale: true, skipped: true, error: runner.lastError };
      }
      try {
        const items = await withTimeout(adapter.fetch(), timeoutMs);
        if (!Array.isArray(items)) throw new Error('adapter returned a non-array');
        runner.failures = 0;
        runner.backoffMs = 0;
        runner.openUntil = 0;
        runner.lastOk = now;
        runner.lastError = '';
        runner.lastCount = items.length;
        if (items.length) runner.lastItems = items;
        runner.stale = false;
        runner.state = 'ok';
        return { items, stale: false, skipped: false, error: '' };
      } catch (error) {
        runner.failures += 1;
        runner.lastError = error?.message || String(error);
        runner.backoffMs = nextDelay(runner.failures, base, max, rand);
        runner.stale = true;
        runner.state = runner.failures >= threshold ? 'open' : 'error';
        if (runner.state === 'open') runner.openUntil = now + runner.backoffMs;
        return {
          items: runner.lastItems,
          stale: true,
          skipped: false,
          error: runner.lastError,
        };
      }
    },
    status() {
      return {
        name: runner.name,
        state: runner.state,
        stale: runner.stale,
        failures: runner.failures,
        backoffMs: runner.backoffMs,
        openUntil: runner.openUntil,
        lastOk: runner.lastOk,
        lastError: runner.lastError,
        intervalMs: runner.intervalMs,
        count: runner.lastCount,
      };
    },
  };
  return runner;
}

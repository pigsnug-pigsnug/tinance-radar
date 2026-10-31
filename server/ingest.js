export function startIngest({ runners, store, bus, status }) {
  let sweeping = false;

  const sweepOne = async (runner) => {
    const result = await runner.tick();
    status.set(runner.name, runner.status());
    if (!result.error && !result.skipped) {
      if (result.items.length) store.ingestItems(result.items);
      console.log(`[tinance-radar] ${runner.name} ok ${result.items.length}`);
    } else if (result.skipped) {
      console.warn(`[tinance-radar] ${runner.name} circuit open — ${result.error || 'backing off'}`);
    } else {
      console.warn(`[tinance-radar] ${runner.name} ${result.error} (kept ${result.items.length})`);
    }
    return result;
  };

  const publishHealth = () => {
    bus.publish('health', { sources: [...status.values()] });
  };

  runners.forEach((runner, index) => {
    const loop = async () => {
      let result;
      try {
        result = await sweepOne(runner);
      } catch (error) {
        console.error(`[tinance-radar] ${runner.name}`, error);
        result = { error: error.message };
        status.set(runner.name, { ...runner.status(), state: 'error', lastError: error.message });
      }
      publishHealth();
      const wait =
        result?.error || result?.skipped
          ? Math.max(runner.intervalMs, runner.backoffMs || runner.intervalMs)
          : runner.intervalMs;
      setTimeout(loop, wait);
    };
    setTimeout(loop, 600 + index * 450);
  });

  const rescore = setInterval(() => {
    try {
      store.rescore();
    } catch (error) {
      console.warn('[tinance-radar] rescore failed:', error.message);
    }
  }, 30_000);
  if (rescore.unref) rescore.unref();

  return {
    health() {
      return [...status.values()];
    },
    async refresh() {
      if (sweeping) return { busy: true };
      sweeping = true;
      try {
        await Promise.all(runners.map((runner) => sweepOne(runner).catch((error) => ({ error: error.message }))));
        publishHealth();
        return { ok: true };
      } finally {
        sweeping = false;
      }
    },
  };
}

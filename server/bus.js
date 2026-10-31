export function createBus() {
  let seq = 0;
  const events = [];
  const listeners = new Set();
  return {
    get seq() {
      return seq;
    },
    publish(event, data) {
      const record = { id: ++seq, event, data, ts: Date.now() };
      // Radar, market, and health are snapshots. Keep one of each so a wake
      // does not replay hundreds of frames into the browser before the first click.
      if (event === 'radar' || event === 'market' || event === 'health' || event === 'cards' || event === 'solana') {
        const prev = events.findIndex((row) => row.event === event);
        if (prev !== -1) events.splice(prev, 1);
      }
      events.push(record);
      if (events.length > 400) events.shift();
      for (const listener of listeners) listener(record);
      return record;
    },
    recent(after = 0) {
      return events.filter((record) => record.id > after);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

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

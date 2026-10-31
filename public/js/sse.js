import { state, touch, upsertItems, upsertTopics } from './state.js';

export function connectStream(onChange) {
  const stream = new EventSource(`/api/stream?after=${state.seq}`);
  const takeId = (ev) => {
    if (ev.lastEventId) state.seq = Number(ev.lastEventId);
  };
  stream.addEventListener('batch', (ev) => {
    const data = JSON.parse(ev.data);
    takeId(ev);
    upsertItems(data.items);
    upsertTopics(data.topics);
    onChange('all');
  });
  stream.addEventListener('topics', (ev) => {
    takeId(ev);
    upsertTopics(JSON.parse(ev.data).topics);
    onChange('all');
  });
  stream.addEventListener('cards', (ev) => {
    takeId(ev);
    state.cards = JSON.parse(ev.data).cards || [];
    touch();
    onChange('all');
  });
  stream.addEventListener('solana', (ev) => {
    takeId(ev);
    state.solana = JSON.parse(ev.data).items || [];
    touch();
    onChange('all');
  });
  stream.addEventListener('health', (ev) => {
    takeId(ev);
    state.health = JSON.parse(ev.data).sources || [];
    touch();
    onChange('market');
  });
  stream.onopen = () => {
    state.stream = true;
    onChange('market');
  };
  stream.onerror = () => {
    state.stream = false;
    onChange('market');
  };
  return stream;
}

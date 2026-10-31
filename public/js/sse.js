import { pingAlert } from './alerts.js';
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
    for (const alert of data.alerts || []) pingAlert(alert);
    onChange('all');
  });
  stream.addEventListener('topics', (ev) => {
    takeId(ev);
    upsertTopics(JSON.parse(ev.data).topics);
    onChange('all');
  });
  stream.addEventListener('market', (ev) => {
    takeId(ev);
    state.market = JSON.parse(ev.data);
    touch();
    onChange('market');
  });
  stream.addEventListener('radar', (ev) => {
    takeId(ev);
    state.radar = JSON.parse(ev.data);
    touch();
    onChange('radar');
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

export const state = {
  items: new Map(),
  topics: new Map(),
  stars: new Map(),
  saves: new Map(),
  notes: new Map(),
  launches: [],
  desk: { wallets: [], bills: [], notes: '' },
  health: [],
  cards: [],
  solana: [],
  lane: 'all',
  config: { multiWindowH: 6, minSources: 2, auth: false, persistence: 'file' },
  tab: 'pulse',
  query: '',
  seq: 0,
  rev: 0,
  ready: false,
  error: '',
  stream: false,
};

export function touch() {
  state.rev += 1;
}

function fillMap(target, rows, key = 'id') {
  target.clear();
  for (const row of rows || []) {
    if (row && row[key]) target.set(row[key], row);
  }
}

export function applyBootstrap(data) {
  fillMap(state.items, data.items);
  fillMap(state.topics, data.topics);
  state.stars = new Map(Object.entries(data.stars || {}));
  state.saves = new Map(Object.entries(data.saves || {}));
  state.notes = new Map(Object.entries(data.notes || {}));
  state.launches = data.launches || [];
  state.desk = {
    wallets: data.desk?.wallets || [],
    bills: data.desk?.bills || [],
    notes: data.desk?.notes || '',
  };
  state.health = data.health || [];
  state.cards = data.cards || [];
  state.solana = data.solana || [];
  state.config = { ...state.config, ...(data.config || {}) };
  state.seq = data.seq || 0;
  state.ready = true;
  state.error = '';
  touch();
}

export function upsertItems(list) {
  for (const item of list || []) {
    if (!item?.id) continue;
    state.items.set(item.id, { ...state.items.get(item.id), ...item });
  }
  if (list?.length) touch();
}

export function upsertTopics(list) {
  for (const topic of list || []) {
    if (topic?.id) state.topics.set(topic.id, topic);
  }
  if (list?.length) touch();
}

export function itemById(id) {
  return (
    state.items.get(id) ||
    state.stars.get(id)?.item ||
    state.saves.get(id)?.item ||
    state.notes.get(id)?.item ||
    null
  );
}

export function visibleCards() {
  const query = state.query.trim().toLowerCase();
  return (state.cards || []).filter((card) => {
    if (state.lane !== 'all' && card.lane !== state.lane) return false;
    if (!query) return true;
    const blob = `${card.title} ${card.summary} ${card.name} ${card.ticker} ${(card.sources || []).map((row) => row.source).join(' ')}`.toLowerCase();
    return query.split(/\s+/).filter(Boolean).every((part) => blob.includes(part));
  });
}

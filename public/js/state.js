export const state = {
  items: new Map(),
  topics: new Map(),
  stars: new Map(),
  saves: new Map(),
  notes: new Map(),
  watchwords: [],
  launches: [],
  desk: { wallets: [], bills: [], notes: '' },
  market: null,
  radar: { tokens: [], graduations: [], koth: null, connected: false, error: '' },
  health: [],
  coin: { q: '', pairs: [], error: '', loading: false },
  config: { multiWindowH: 6, minSources: 3, auth: false, persistence: 'file' },
  tab: 'pulse',
  platform: 'all',
  query: '',
  mode: 'latest',
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
  state.watchwords = data.watchwords || [];
  state.launches = data.launches || [];
  state.desk = {
    wallets: data.desk?.wallets || [],
    bills: data.desk?.bills || [],
    notes: data.desk?.notes || '',
  };
  state.market = data.market || null;
  state.radar = data.radar || state.radar;
  state.health = data.health || [];
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

function matchesQuery(item, query) {
  if (!query) return true;
  const topic = state.topics.get(item.topicId);
  const blob = `${item.title} ${item.summary || ''} ${item.source} ${(item.phrases || []).join(' ')} ${topic?.label || ''}`.toLowerCase();
  return query.split(/\s+/).filter(Boolean).every((part) => blob.includes(part));
}

export function universe() {
  let rows = [...state.items.values()];
  if (state.tab === 'sol') rows = rows.filter((item) => (item.tags || []).includes('solana'));
  return rows;
}

export function platformCounts() {
  const counts = new Map();
  for (const item of universe()) counts.set(item.source, (counts.get(item.source) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function visibleItems() {
  const query = state.query.trim().toLowerCase();
  let rows;
  if (state.mode === 'starred') {
    rows = [...state.stars.values()].map((row) => state.items.get(row.item.id) || row.item).filter(Boolean);
  } else if (state.mode === 'saved') {
    rows = [...state.saves.values()].map((row) => state.items.get(row.item.id) || row.item).filter(Boolean);
  } else {
    rows = [...state.items.values()];
  }
  if (state.tab === 'sol') rows = rows.filter((item) => (item.tags || []).includes('solana'));
  if (state.platform !== 'all') rows = rows.filter((item) => item.source === state.platform);
  rows = rows.filter((item) => matchesQuery(item, query));
  if (state.mode === 'heat') {
    rows.sort(
      (a, b) =>
        (state.topics.get(b.topicId)?.score || 0) - (state.topics.get(a.topicId)?.score || 0) ||
        (b.publishedAt || 0) - (a.publishedAt || 0),
    );
  } else {
    rows.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0) || (b.fetchedAt || 0) - (a.fetchedAt || 0));
  }
  return rows;
}

export function hotTopics(limit = 8) {
  return [...state.topics.values()]
    .filter((topic) => topic && topic.useful !== false && topic.label)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

export function wordCloud() {
  const acc = new Map();
  for (const topic of state.topics.values()) {
    if (topic?.useful === false) continue;
    const weight = Math.max(1, topic.score);
    if (topic.label) acc.set(topic.label, (acc.get(topic.label) || 0) + weight * 1.3);
    for (const phrase of topic.phrases || []) acc.set(phrase, (acc.get(phrase) || 0) + weight);
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 36);
}

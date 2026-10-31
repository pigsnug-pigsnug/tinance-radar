import crypto from 'node:crypto';
import { stableId } from './ids.js';
import { isUsefulPhrase, mentionsSolana } from './phrases.js';
import { ALWAYS_SOL_SOURCES } from './config.js';
import { canonicalUrl, dexScreenerUrl, pumpFunUrl } from './links.js';

const ITEM_CAP = 400;

export function compactItem(item) {
  return {
    id: item.id,
    source: item.source,
    title: item.title,
    url: item.url || '',
    summary: item.summary || '',
    publishedAt: item.publishedAt || 0,
    fetchedAt: item.fetchedAt || 0,
    tickers: item.tickers || [],
    phrases: item.phrases || [],
    topicId: item.topicId || '',
    tags: item.tags || [],
  };
}

function publicTopic(topic, windowMs) {
  const phrases = Object.entries(topic.keys || {})
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 6)
    .map(([key]) => key);
  return {
    id: topic.id,
    label: topic.label,
    score: topic.score || 0,
    velocity: topic.velocity || 0,
    acceleration: topic.acceleration || 0,
    perHour: topic.perHour || 0,
    cross: topic.cross || 0,
    multi: Boolean(topic.multi),
    sources: topic.sources || [],
    phrases,
    firstSeen: topic.firstSeen || 0,
    lastSeen: topic.lastSeen || 0,
    windowH: Math.round((windowMs / 3_600_000) * 10) / 10,
    useful: isUsefulPhrase(topic.label),
  };
}

function escapeReg(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchWords(item, words) {
  const hay = `${item.title}\n${item.summary}`;
  const hits = [];
  for (const word of words) {
    const needle = String(word || '').trim();
    if (!needle) continue;
    if (needle.length <= 3) {
      const re = new RegExp(`(?:^|[^a-z0-9$])${escapeReg(needle)}(?:[^a-z0-9]|$)`, 'i');
      if (re.test(hay)) hits.push(needle);
    } else if (hay.toLowerCase().includes(needle.toLowerCase())) hits.push(needle);
  }
  return hits;
}

export function createStore({ cluster, persist, bus, config }) {
  const items = new Map();
  const user = {
    stars: {},
    saves: {},
    notes: {},
    watchwords: [],
    launches: [],
    desk: { wallets: [], bills: [], notes: '' },
  };
  const radar = {
    tokens: [],
    narratives: [],
    graduations: [],
    koth: null,
    connected: false,
    error: '',
    updatedAt: 0,
  };
  let market = null;
  let userTimer = null;
  let snapshotTimer = null;
  let radarTimer = null;

  function userSnapshot() {
    return {
      stars: user.stars,
      saves: user.saves,
      notes: user.notes,
      watchwords: user.watchwords,
      launches: user.launches,
      desk: user.desk,
    };
  }

  function scheduleUser() {
    clearTimeout(userTimer);
    userTimer = setTimeout(() => {
      persist.save({ user: userSnapshot() }).catch((error) => {
        console.warn('[tinance-radar] user save failed:', error.message);
      });
    }, 300);
  }

  function snapshotPayload() {
    const snap = cluster.snapshot();
    const ranked = [...items.values()].sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0)).slice(0, 300);
    let payload = {
      ...snap,
      items: ranked.map(compactItem),
      radar: {
        tokens: radar.tokens || [],
        narratives: radar.narratives || [],
        koth: radar.koth || null,
      },
      savedAt: Date.now(),
    };
    if (JSON.stringify(payload).length > 900_000) {
      payload = {
        ...payload,
        items: payload.items.slice(0, 120),
        topics: (payload.topics || []).slice(0, 80),
      };
    }
    return payload;
  }

  function publishRadar() {
    if (radarTimer) return;
    radarTimer = setTimeout(() => {
      radarTimer = null;
      bus.publish('radar', radar);
    }, 400);
  }

  function topicsPayload(list) {
    return (list || cluster.list())
      .map((topic) => publicTopic(topic, config.multiWindowMs))
      .sort((a, b) => b.score - a.score)
      .slice(0, 80);
  }

  return {
    items,
    user,
    radar,
    get market() {
      return market;
    },
    topic(id) {
      return cluster.get(id);
    },
    trackedPhrases() {
      return cluster
        .list()
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((topic) => topic.label)
        .filter((label) => label && label.length <= 32 && label.length >= 3 && isUsefulPhrase(label));
    },
    setMarket(next) {
      market = next;
      bus.publish('market', next);
    },
    setRadar(patch) {
      Object.assign(radar, patch, { updatedAt: Date.now() });
      publishRadar();
    },
    pushPumpToken(token) {
      radar.tokens.unshift(token);
      radar.tokens = radar.tokens.slice(0, 40);
      radar.updatedAt = Date.now();
      if (token.kind === 'graduation') {
        radar.graduations.unshift(token);
        radar.graduations = radar.graduations.slice(0, 12);
      }
      publishRadar();
    },
    async hydrate() {
      let data = null;
      try {
        data = await persist.load();
      } catch (error) {
        console.warn('[tinance-radar] hydrate failed:', error.message);
        return;
      }
      if (!data || typeof data !== 'object') return;
        if (data.snapshot) {
        cluster.hydrate(data.snapshot);
        cluster.scrubKeys(isUsefulPhrase);
        items.clear();
        for (const item of data.snapshot.items || []) {
          if (!item?.id) continue;
          const url = canonicalUrl(item.url);
          if (!url) continue;
          items.set(item.id, { ...item, url });
        }
        if (data.snapshot.radar && typeof data.snapshot.radar === 'object') {
          radar.tokens = Array.isArray(data.snapshot.radar.tokens) ? data.snapshot.radar.tokens : [];
          radar.narratives = Array.isArray(data.snapshot.radar.narratives) ? data.snapshot.radar.narratives : [];
          radar.koth = data.snapshot.radar.koth || null;
        }
        try {
          cluster.rescore(Date.now());
        } catch (error) {
          console.warn('[tinance-radar] rescore after hydrate failed:', error.message);
        }
      }
      const saved = data.user || {};
      user.stars = saved.stars || {};
      user.saves = saved.saves || {};
      user.notes = saved.notes || {};
      user.watchwords = Array.isArray(saved.watchwords) ? saved.watchwords : [];
      user.launches = Array.isArray(saved.launches) ? saved.launches : [];
      user.desk = {
        wallets: Array.isArray(saved.desk?.wallets) ? saved.desk.wallets : [],
        bills: Array.isArray(saved.desk?.bills) ? saved.desk.bills : [],
        notes: saved.desk?.notes || '',
      };
      console.log(`[tinance-radar] hydrated ${items.size} items, ${cluster.list().length} topics (${persist.mode})`);
    },
    ingestItems(rawItems, now = Date.now()) {
      const fresh = [];
      const alerts = [];
      const touched = new Map();
      let radarDirty = false;
      for (const raw of rawItems || []) {
        const title = String(raw.title || '').replace(/\s+/g, ' ').trim();
        if (title.length < 3) continue;
        const url = canonicalUrl(raw.url, raw.urlBase);
        if (!url) continue;
        const source = String(raw.source || 'unknown').toLowerCase();
        const id = stableId(source, title);
        const existing = items.get(id);
        const tags = new Set([...(raw.tags || []), ...(existing?.tags || [])]);
        if (ALWAYS_SOL_SOURCES.has(source) || mentionsSolana(`${title}\n${raw.summary || ''}`)) tags.add('solana');
        if (existing) {
          existing.tags = [...tags];
          continue;
        }
        const result = cluster.ingest({ id, source, title: raw.clusterTitle || title }, now, { hits: raw.hits });
        if (result.duplicate) continue;
        const item = {
          id,
          source,
          title,
          url,
          summary: String(raw.summary || '').replace(/\s+/g, ' ').trim().slice(0, 360),
          publishedAt: Number(raw.publishedAt) || now,
          fetchedAt: now,
          tickers: result.signals?.tickers || [],
          phrases: result.signals?.phrases || [],
          topicId: result.topic?.id || '',
          tags: [...tags],
        };
        items.set(id, item);
        const compact = compactItem(item);
        fresh.push(compact);
        if (result.topic) touched.set(result.topic.id, result.topic);
        for (const word of matchWords(item, user.watchwords)) {
          alerts.push({ itemId: id, word, title: item.title, source });
        }
        if (raw.extra?.kind === 'koth') {
          const mint = raw.extra.mint || '';
          radar.koth = {
            ...compact,
            mint,
            marketCap: raw.extra.marketCap || 0,
            symbol: raw.extra.symbol || '',
            pumpUrl: mint ? pumpFunUrl(mint) : '',
            dexUrl: mint ? dexScreenerUrl(mint) : '',
          };
          radarDirty = true;
        }
        if (raw.extra?.kind === 'graduation') {
          radar.graduations.unshift({ ...compact, kind: 'graduation', ts: now });
          radar.graduations = radar.graduations.slice(0, 12);
          radarDirty = true;
        }
      }
      if (items.size > ITEM_CAP) {
        const ranked = [...items.values()].sort((a, b) => (a.fetchedAt || 0) - (b.fetchedAt || 0));
        for (const item of ranked.slice(0, items.size - ITEM_CAP)) items.delete(item.id);
      }
      if (fresh.length) {
        const live = new Map(cluster.list().map((topic) => [topic.id, topic]));
        for (const item of items.values()) {
          if (item.topicId && !live.has(item.topicId)) {
            const topic = cluster.list().find((row) => row.itemIds?.includes(item.id));
            if (topic) item.topicId = topic.id;
          }
        }
      }
      const topics = [...touched.values()].map((topic) => publicTopic(topic, config.multiWindowMs));
      if (fresh.length || alerts.length || topics.length) {
        bus.publish('batch', { items: fresh, topics, alerts });
      }
      if (radarDirty) publishRadar();
      return { fresh, alerts, topics };
    },
    rescore(now = Date.now()) {
      cluster.rescore(now);
      const topics = topicsPayload();
      bus.publish('topics', { topics });
      return topics;
    },
    bootstrap(extra = {}) {
      const list = [...items.values()]
        .map(compactItem)
        .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0) || (b.fetchedAt || 0) - (a.fetchedAt || 0));
      return {
        seq: bus.seq,
        items: list,
        topics: topicsPayload(),
        stars: user.stars,
        saves: user.saves,
        notes: user.notes,
        watchwords: user.watchwords,
        launches: user.launches,
        desk: user.desk,
        market,
        radar,
        health: extra.health || [],
        config: {
          multiWindowH: config.multiWindowMs / 3_600_000,
          minSources: config.minSources,
          auth: Boolean(config.authPassword),
          persistence: persist.mode,
        },
      };
    },
    resolveItem(input) {
      const id = input?.item?.id || input?.id;
      if (id && items.has(id)) return compactItem(items.get(id));
      const item = input?.item || input;
      if (!item?.id || !item?.title) return null;
      return {
        id: String(item.id).slice(0, 40),
        source: String(item.source || '').slice(0, 40),
        title: String(item.title).slice(0, 300),
        url: canonicalUrl(item.url),
        summary: String(item.summary || '').slice(0, 400),
        publishedAt: Number(item.publishedAt) || 0,
        fetchedAt: Number(item.fetchedAt) || Date.now(),
        tickers: Array.isArray(item.tickers) ? item.tickers.slice(0, 12).map(String) : [],
        phrases: Array.isArray(item.phrases) ? item.phrases.slice(0, 12).map(String) : [],
        topicId: String(item.topicId || '').slice(0, 40),
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 8).map(String) : [],
      };
    },
    toggleStar(item) {
      if (!item?.id) return { starred: false };
      if (user.stars[item.id]) {
        delete user.stars[item.id];
        scheduleUser();
        return { starred: false };
      }
      user.stars[item.id] = { item, starredAt: Date.now() };
      scheduleUser();
      return { starred: true, star: user.stars[item.id] };
    },
    toggleSave(item) {
      if (!item?.id) return { saved: false };
      if (user.saves[item.id]) {
        delete user.saves[item.id];
        scheduleUser();
        return { saved: false };
      }
      user.saves[item.id] = { item, savedAt: Date.now() };
      scheduleUser();
      return { saved: true, save: user.saves[item.id] };
    },
    setNote(id, text, item) {
      const clean = String(text || '').slice(0, 2000).trim();
      if (!clean) delete user.notes[id];
      else {
        user.notes[id] = {
          text: clean,
          item: item || user.notes[id]?.item || null,
          updatedAt: Date.now(),
        };
      }
      scheduleUser();
      return user.notes[id] || null;
    },
    setWatchwords(words) {
      const next = [];
      const seen = new Set();
      for (const word of words || []) {
        const clean = String(word || '').trim().slice(0, 40);
        const key = clean.toLowerCase();
        if (!clean || seen.has(key) || next.length >= 40) continue;
        seen.add(key);
        next.push(clean);
      }
      user.watchwords = next;
      scheduleUser();
      return next;
    },
    addLaunch(input) {
      const itemId = String(input.itemId || '');
      const recent = user.launches.find((row) => row.itemId && row.itemId === itemId && Date.now() - row.openedAt < 60_000);
      if (recent) return recent;
      const launch = {
        id: crypto.randomUUID(),
        openedAt: Date.now(),
        itemId,
        title: String(input.title || '').slice(0, 240),
        url: canonicalUrl(input.url),
        source: String(input.source || '').slice(0, 40),
        topicId: String(input.topicId || '').slice(0, 40),
        topicLabel: String(input.topicLabel || '').slice(0, 80),
        score: Number(input.score) || 0,
        velocity: Number(input.velocity) || 0,
        acceleration: Number(input.acceleration) || 0,
        perHour: Number(input.perHour) || 0,
        cross: Number(input.cross) || 0,
        multi: Boolean(input.multi),
        note: String(input.note || '').slice(0, 2000),
        outcome: 'pending',
        outcomeNote: '',
      };
      user.launches.unshift(launch);
      user.launches = user.launches.slice(0, 400);
      scheduleUser();
      return launch;
    },
    patchLaunch(id, patch) {
      const launch = user.launches.find((row) => row.id === id);
      if (!launch) return null;
      if (patch.note != null) launch.note = String(patch.note).slice(0, 2000);
      if (patch.outcomeNote != null) launch.outcomeNote = String(patch.outcomeNote).slice(0, 2000);
      if (['pending', 'worked', 'failed', 'skipped'].includes(patch.outcome)) launch.outcome = patch.outcome;
      scheduleUser();
      return launch;
    },
    deleteLaunch(id) {
      const before = user.launches.length;
      user.launches = user.launches.filter((row) => row.id !== id);
      if (user.launches.length !== before) scheduleUser();
      return user.launches.length !== before;
    },
    addWallet(input) {
      const address = String(input.address || '').trim();
      if (!address) {
        const error = new Error('address required');
        error.status = 400;
        throw error;
      }
      if (/^[0-9a-fA-F]{64}$/.test(address) || /^[0-9a-fA-F]{128}$/.test(address) || address.length > 90) {
        const error = new Error('That looks like a secret, not a public address');
        error.status = 400;
        throw error;
      }
      const wallet = {
        id: crypto.randomUUID(),
        label: String(input.label || 'Wallet').trim().slice(0, 60) || 'Wallet',
        address: address.slice(0, 90),
        chain: ['solana', 'ethereum', 'bnb', 'base'].includes(input.chain) ? input.chain : 'solana',
        note: String(input.note || '').slice(0, 200),
      };
      user.desk.wallets.unshift(wallet);
      user.desk.wallets = user.desk.wallets.slice(0, 100);
      scheduleUser();
      return wallet;
    },
    deleteWallet(id) {
      user.desk.wallets = user.desk.wallets.filter((row) => row.id !== id);
      scheduleUser();
    },
    addBill(input) {
      const bill = {
        id: crypto.randomUUID(),
        name: String(input.name || 'Bill').trim().slice(0, 80) || 'Bill',
        amount: String(input.amount || '').slice(0, 24),
        currency: String(input.currency || 'USD').slice(0, 8) || 'USD',
        due: String(input.due || '').slice(0, 20),
        paid: Boolean(input.paid),
      };
      user.desk.bills.unshift(bill);
      user.desk.bills = user.desk.bills.slice(0, 100);
      scheduleUser();
      return bill;
    },
    patchBill(id, patch) {
      const bill = user.desk.bills.find((row) => row.id === id);
      if (!bill) return null;
      if (patch.paid != null) bill.paid = Boolean(patch.paid);
      if (patch.name != null) bill.name = String(patch.name).slice(0, 80);
      if (patch.amount != null) bill.amount = String(patch.amount).slice(0, 24);
      if (patch.due != null) bill.due = String(patch.due).slice(0, 20);
      scheduleUser();
      return bill;
    },
    deleteBill(id) {
      user.desk.bills = user.desk.bills.filter((row) => row.id !== id);
      scheduleUser();
    },
    setDeskNotes(notes) {
      user.desk.notes = String(notes || '').slice(0, 20_000);
      scheduleUser();
      return user.desk.notes;
    },
    startAutosave() {
      snapshotTimer = setInterval(() => {
        persist.save({ snapshot: snapshotPayload() }).catch((error) => {
          console.warn('[tinance-radar] snapshot failed:', error.message);
        });
      }, config.snapshotIntervalMs);
      if (snapshotTimer.unref) snapshotTimer.unref();
    },
    async flush() {
      clearTimeout(userTimer);
      clearTimeout(radarTimer);
      clearInterval(snapshotTimer);
      await persist.save({ snapshot: snapshotPayload(), user: userSnapshot() });
    },
  };
}

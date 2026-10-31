import { stableId, normalizeTitle } from './ids.js';
import { extractSignals, BROAD_TICKERS } from './phrases.js';
import { addHit, pruneBuckets, computeKinetics, topicScore } from './velocity.js';

const DAY = 24 * 60 * 60 * 1000;

function chooseLabel(signals, title) {
  const ticker = signals.tickers.find((t) => !BROAD_TICKERS.has(t));
  if (ticker) return `$${ticker}`;
  const phrase = signals.keys.find((key) => key.includes(' '));
  if (phrase) return phrase;
  if (signals.keys[0]) return signals.keys[0];
  return normalizeTitle(title).slice(0, 60) || 'untitled';
}

function relabel(topic) {
  const entries = Object.entries(topic.keys);
  if (!entries.length) return;
  entries.sort((a, b) => {
    const aTicker = a[0].startsWith('$') ? 1 : 0;
    const bTicker = b[0].startsWith('$') ? 1 : 0;
    if (bTicker !== aTicker) return bTicker - aTicker;
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });
  topic.label = entries[0][0];
}

export function createCluster(options = {}) {
  const windowMs = options.windowMs ?? 6 * 60 * 60 * 1000;
  const minSources = options.minSources ?? 3;
  const topics = new Map();
  const keyIndex = new Map();
  const seen = new Map();

  function removeTopic(id) {
    const topic = topics.get(id);
    if (!topic) return;
    for (const key of Object.keys(topic.keys || {})) {
      if (keyIndex.get(key) === id) keyIndex.delete(key);
    }
    topics.delete(id);
  }

  function blankTopic(label, now) {
    let id = stableId('topic', label);
    let n = 2;
    while (topics.has(id)) {
      id = stableId('topic', `${label}#${n}`);
      n += 1;
    }
    const topic = {
      id,
      label,
      keys: {},
      buckets: {},
      sightings: [],
      itemIds: [],
      sources: [],
      firstSeen: now,
      lastSeen: now,
      velocity: 0,
      acceleration: 0,
      perHour: 0,
      score: 0,
      cross: 0,
      multi: false,
    };
    topics.set(id, topic);
    return topic;
  }

  function mergeInto(keep, dropId) {
    const drop = topics.get(dropId);
    if (!drop || drop.id === keep.id) return;
    for (const [key, count] of Object.entries(drop.keys)) {
      keep.keys[key] = (keep.keys[key] || 0) + count;
      keyIndex.set(key, keep.id);
    }
    for (const [bucket, count] of Object.entries(drop.buckets)) {
      keep.buckets[bucket] = (keep.buckets[bucket] || 0) + count;
    }
    keep.sightings.push(...drop.sightings);
    keep.firstSeen = Math.min(keep.firstSeen, drop.firstSeen);
    keep.lastSeen = Math.max(keep.lastSeen, drop.lastSeen);
    for (const itemId of drop.itemIds) {
      if (!keep.itemIds.includes(itemId)) keep.itemIds.push(itemId);
    }
    topics.delete(drop.id);
    relabel(keep);
  }

  function claim(topic, keys) {
    const foreign = [];
    for (const key of keys) {
      topic.keys[key] = (topic.keys[key] || 0) + 1;
      const owner = keyIndex.get(key);
      if (!owner || owner === topic.id || !topics.has(owner)) keyIndex.set(key, topic.id);
      else foreign.push(owner);
    }
    return foreign;
  }

  function refresh(topic, now) {
    const cutoff = now - windowMs;
    topic.sightings = topic.sightings.filter((row) => row.ts >= cutoff).slice(-50);
    const sources = [...new Set(topic.sightings.map((row) => row.source))];
    topic.sources = sources;
    topic.cross = sources.length;
    topic.multi = sources.length >= minSources;
    pruneBuckets(topic.buckets, now);
    const kinetics = computeKinetics(topic.buckets, now);
    topic.perHour = kinetics.perHour;
    topic.velocity = kinetics.velocity;
    topic.acceleration = kinetics.acceleration;
    topic.score = topicScore(kinetics, {
      cross: topic.cross,
      multi: topic.multi,
      lastSeen: topic.lastSeen,
      now,
    });
  }

  function pruneSeen(now) {
    const cutoff = now - 2 * DAY;
    for (const [id, ts] of seen) {
      if (ts < cutoff) seen.delete(id);
    }
    if (seen.size > 4000) {
      const oldest = [...seen.entries()].sort((a, b) => a[1] - b[1]);
      for (const [id] of oldest.slice(0, seen.size - 4000)) seen.delete(id);
    }
  }

  function pruneTopics(now) {
    for (const [id, topic] of topics) {
      if (now - topic.lastSeen > DAY) removeTopic(id);
    }
    if (topics.size > 200) {
      const ranked = [...topics.values()].sort((a, b) => a.score - b.score);
      for (const topic of ranked) {
        if (topics.size <= 180) break;
        if (now - topic.lastSeen < 30 * 60 * 1000) continue;
        removeTopic(topic.id);
      }
    }
  }

  return {
    windowMs,
    minSources,
    get(id) {
      return topics.get(id) || null;
    },
    list() {
      return [...topics.values()];
    },
    ingest(item, now = Date.now(), opts = {}) {
      if (!item?.id || seen.has(item.id)) {
        return { duplicate: true, topic: null, signals: null };
      }
      const signals = extractSignals(item.title);
      const matched = new Set();
      for (const key of signals.keys) {
        const owner = keyIndex.get(key);
        if (owner && topics.has(owner)) matched.add(owner);
      }

      let topic;
      if (matched.size === 0) {
        topic = blankTopic(chooseLabel(signals, item.title), now);
      } else {
        const ids = [...matched];
        topic = topics.get(ids[0]);
        for (const id of ids) {
          const candidate = topics.get(id);
          if (candidate && candidate.firstSeen < topic.firstSeen) topic = candidate;
        }
        for (const id of ids) {
          if (id !== topic.id) mergeInto(topic, id);
        }
      }

      let foreign = claim(topic, signals.keys);
      let guard = 0;
      while (foreign.length && guard < 8) {
        guard += 1;
        for (const id of [...new Set(foreign)]) {
          if (id !== topic.id) mergeInto(topic, id);
        }
        foreign = [];
        for (const key of Object.keys(topic.keys)) {
          const owner = keyIndex.get(key);
          if (owner && owner !== topic.id && topics.has(owner)) foreign.push(owner);
          else keyIndex.set(key, topic.id);
        }
      }

      const hits = Math.max(1, Math.min(12, Number(opts.hits) || 1));
      addHit(topic.buckets, now, hits);
      topic.sightings.push({ source: item.source || 'unknown', ts: now, itemId: item.id });
      topic.lastSeen = now;
      if (!topic.itemIds.includes(item.id)) {
        topic.itemIds.push(item.id);
        if (topic.itemIds.length > 40) topic.itemIds.shift();
      }
      relabel(topic);
      refresh(topic, now);
      seen.set(item.id, now);
      pruneSeen(now);
      return { duplicate: false, topic, signals };
    },
    rescore(now = Date.now()) {
      for (const topic of topics.values()) refresh(topic, now);
      pruneTopics(now);
      return [...topics.values()];
    },
    snapshot() {
      return {
        version: 2,
        windowMs,
        minSources,
        topics: [...topics.values()].map((topic) => ({
          id: topic.id,
          label: topic.label,
          keys: topic.keys,
          buckets: topic.buckets,
          sightings: topic.sightings.slice(-40),
          itemIds: topic.itemIds.slice(-40),
          sources: topic.sources,
          firstSeen: topic.firstSeen,
          lastSeen: topic.lastSeen,
          velocity: topic.velocity,
          acceleration: topic.acceleration,
          perHour: topic.perHour,
          score: topic.score,
          cross: topic.cross,
          multi: topic.multi,
        })),
        seen: [...seen.entries()].slice(-4000).map(([id, ts]) => ({ id, ts })),
      };
    },
    hydrate(snap) {
      topics.clear();
      keyIndex.clear();
      seen.clear();
      if (!snap) return;
      for (const topic of snap.topics || []) {
        topics.set(topic.id, {
          sources: [],
          keys: {},
          buckets: {},
          sightings: [],
          itemIds: [],
          velocity: 0,
          acceleration: 0,
          perHour: 0,
          score: 0,
          cross: 0,
          multi: false,
          ...topic,
        });
        for (const key of Object.keys(topic.keys || {})) keyIndex.set(key, topic.id);
      }
      for (const row of snap.seen || []) {
        if (row && row.id) seen.set(row.id, row.ts || 0);
      }
    },
    bucketTotal(topicId) {
      const topic = topics.get(topicId);
      if (!topic) return 0;
      return Object.values(topic.buckets).reduce((sum, n) => sum + n, 0);
    },
  };
}

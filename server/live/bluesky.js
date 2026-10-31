import { nextDelay } from '../backoff.js';
import { config } from '../config.js';
import { mentionsSolana } from '../phrases.js';

const URL = 'wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
const DEFAULTS = ['solana', 'bonk', 'wif', 'pump.fun', 'jupiter', 'jito', 'popcat', 'pengu', 'moodeng'];

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(phrases) {
  return phrases.map((phrase) => {
    const body = escapeReg(phrase.toLowerCase());
    return {
      phrase,
      re: new RegExp(`(?:^|[^a-z0-9])${body}(?:[^a-z0-9]|$)`, 'i'),
    };
  });
}

export function startBluesky({ store, status }) {
  const row = {
    name: 'bluesky',
    state: 'idle',
    stale: false,
    failures: 0,
    lastOk: 0,
    lastError: '',
    intervalMs: 60_000,
    count: 0,
    detail: 'jetstream connecting',
  };
  status.set('bluesky', row);

  let attempt = 0;
  let matchers = compile(DEFAULTS);
  let counts = new Map();
  let messages = 0;
  let ws;

  const refreshPhrases = () => {
    const phrases = new Set(DEFAULTS);
    for (const word of store.user.watchwords || []) {
      const clean = String(word).trim().toLowerCase();
      if (clean.length >= 3 && clean.length <= 32 && clean.split(/\s+/).length <= 3) phrases.add(clean);
    }
    for (const label of store.trackedPhrases()) {
      const clean = label.trim().toLowerCase();
      if (clean.startsWith('$')) phrases.add(clean.slice(1));
      else if (clean.split(/\s+/).length <= 3) phrases.add(clean);
    }
    matchers = compile([...phrases].slice(0, 40));
  };

  const flush = () => {
    const minute = Math.floor(Date.now() / 60_000);
    const stamp = new Date(minute * 60_000).toISOString().slice(11, 16);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    counts = new Map();
    row.detail = `${messages} posts/min · tracking ${matchers.length}`;
    row.count = messages;
    messages = 0;
    const items = ranked
      .filter(([, count]) => count >= config.blueskyMinCount)
      .slice(0, 4)
      .map(([phrase, count]) => ({
        source: 'bluesky',
        title: `Bluesky · ${phrase} · ${count}/min · ${stamp}Z`,
        url: `https://bsky.app/search?q=${encodeURIComponent(phrase)}`,
        summary: `${count} public posts in the last minute mentioned “${phrase}”.`,
        publishedAt: Date.now(),
        clusterTitle: phrase,
        hits: count,
        tags: mentionsSolana(phrase) || phrase === 'solana' ? ['solana'] : [],
        extra: { phrase, count, minute },
      }));
    if (items.length) store.ingestItems(items);
  };

  const connect = () => {
    try {
      ws = new WebSocket(URL);
    } catch (error) {
      row.state = 'error';
      row.lastError = error.message;
      row.failures += 1;
      setTimeout(connect, nextDelay(row.failures, 2000, 60_000));
      return;
    }
    ws.onopen = () => {
      attempt = 0;
      row.failures = 0;
      row.state = 'ok';
      row.stale = false;
      row.lastError = '';
      row.lastOk = Date.now();
      row.detail = 'jetstream live';
    };
    ws.onmessage = (ev) => {
      messages += 1;
      row.lastOk = Date.now();
      const text = String(ev.data);
      if (text.length > 20_000 || !text.includes('"text"')) return;
      let record;
      try {
        record = JSON.parse(text);
      } catch {
        return;
      }
      const post = record?.commit?.record?.text;
      if (!post || record.commit.operation !== 'create') return;
      for (const matcher of matchers) {
        if (matcher.re.test(post)) counts.set(matcher.phrase, (counts.get(matcher.phrase) || 0) + 1);
      }
    };
    ws.onerror = () => {
      row.lastError = 'socket error';
    };
    ws.onclose = () => {
      attempt += 1;
      row.failures = attempt;
      row.state = 'error';
      row.stale = true;
      row.lastError = row.lastError || 'socket closed';
      setTimeout(connect, nextDelay(attempt, 2000, 60_000));
    };
  };

  refreshPhrases();
  connect();
  const phraseTimer = setInterval(refreshPhrases, 20_000);
  const flushTimer = setInterval(flush, 60_000);
  if (phraseTimer.unref) phraseTimer.unref();
  if (flushTimer.unref) flushTimer.unref();
}

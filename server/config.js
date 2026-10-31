const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const DEFAULT_YOUTUBE = ['UC9AdQPUe4BdVJ8M9X7wxHUA'];

export const config = {
  port: num(process.env.PORT, 4317),
  authPassword: process.env.AUTH_PASSWORD || '',
  authSecret: process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || '',
  multiWindowMs: num(process.env.MULTI_WINDOW_HOURS, 6) * 60 * 60 * 1000,
  minSources: num(process.env.MULTI_MIN_SOURCES, 3),
  snapshotIntervalMs: num(process.env.SNAPSHOT_INTERVAL_MS, 5 * 60 * 1000),
  dataDir: process.env.DATA_DIR || 'data',
  telegramChannels: list(process.env.TELEGRAM_CHANNELS || 'cointelegraph,WatcherGuru'),
  youtubeChannelIds: list(process.env.YOUTUBE_CHANNEL_IDS).length
    ? list(process.env.YOUTUBE_CHANNEL_IDS)
    : DEFAULT_YOUTUBE,
  blueskyMinCount: num(process.env.BLUESKY_MIN_COUNT, 5),
  redditMinScore: num(process.env.REDDIT_MIN_SCORE, 50),
  redditRisingMinScore: num(process.env.REDDIT_RISING_MIN_SCORE, 15),
  redditRisingMinComments: num(process.env.REDDIT_RISING_MIN_COMMENTS, 8),
  hnMinPoints: num(process.env.HN_MIN_POINTS, 40),
  hnSolanaMinPoints: num(process.env.HN_SOLANA_MIN_POINTS, 12),
  pump: {
    minMcapSol: num(process.env.PUMP_MIN_MCAP_SOL, 45),
    nearGradSol: num(process.env.PUMP_NEAR_GRAD_SOL, 70),
    minTrades: num(process.env.PUMP_MIN_TRADES, 12),
    minBuySol: num(process.env.PUMP_MIN_BUY_SOL, 8),
    tradeWindowMs: num(process.env.PUMP_TRADE_WINDOW_MS, 3 * 60 * 1000),
    nameRepeat: num(process.env.PUMP_NAME_REPEAT, 3),
    narrativeWindowMs: num(process.env.PUMP_NARRATIVE_WINDOW_MS, 30 * 60 * 1000),
  },
};

export const ALWAYS_SOL_SOURCES = new Set([
  'pumpfun',
  'geckoterminal',
  'dexscreener',
  'google-news',
  'hn-solana',
]);

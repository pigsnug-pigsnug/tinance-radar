const PLATFORMS = {
  reddit: 'Reddit',
  hackernews: 'HN',
  'hn-solana': 'HN · SOL',
  devto: 'DEV',
  'google-trends': 'Trends',
  x: 'X',
  tiktok: 'TikTok',
  aljazeera: 'Jazeera',
  'google-news': 'News',
  youtube: 'YouTube',
  cointelegraph: 'CoinTelegraph',
  decrypt: 'Decrypt',
  bluesky: 'Bluesky',
  dexscreener: 'Dex',
  geckoterminal: 'Gecko',
  pumpfun: 'pump.fun',
  wikipedia: 'Wiki',
  polymarket: 'Polymarket',
  telegram: 'Telegram',
  market: 'Market',
  'pumpfun-ws': 'pump socket',
};

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return esc(url.href);
  } catch {
    /* drop javascript: and junk */
  }
  return '';
}

export function ago(ts) {
  if (!ts) return '';
  const seconds = Math.max(0, (Date.now() - ts) / 1000);
  if (seconds < 45) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function platform(source) {
  return PLATFORMS[source] || source || '—';
}

export function istClock(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function signedInt(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? `+${n}` : String(n);
}

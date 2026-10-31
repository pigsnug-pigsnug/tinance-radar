const APP_UA = 'TinanceRadar/2.0 (personal research dashboard)';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export function httpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    /* ignore bad urls */
  }
  return '';
}

export async function getText(url, opts = {}) {
  const headers = {
    'user-agent': opts.ua || (opts.browser ? BROWSER_UA : APP_UA),
    accept: opts.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    ...opts.headers,
  };
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
    headers,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function getJson(url, opts = {}) {
  const text = await getText(url, { ...opts, accept: 'application/json, text/plain;q=0.9' });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid json');
  }
}

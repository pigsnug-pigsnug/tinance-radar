const PLACEHOLDER_HOSTS = new Set([
  'getdaytrends.com',
  'www.getdaytrends.com',
  'trends24.in',
  'www.trends24.in',
  'explodingtopics.com',
  'www.explodingtopics.com',
  'tools.explodingtopics.com',
]);

function decodeBasic(value) {
  return String(value || '')
    .trim()
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function isPlaceholder(url) {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (host === 'news.google.com' || host.endsWith('.news.google.com')) return true;
  if (PLACEHOLDER_HOSTS.has(host)) return true;
  if ((host === 'pump.fun' || host === 'www.pump.fun') && (path === '/' || path === '/board')) return true;
  if ((host === 'polymarket.com' || host === 'www.polymarket.com') && path === '/') return true;
  if (host.endsWith('geckoterminal.com') && (path === '/solana' || path === '/')) return true;
  if (host === 't.me' || host === 'telegram.me') {
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2) return true;
  }
  return false;
}

/** Absolute http(s) URL, or '' when the value is relative, a script URL, or a homepage placeholder. */
export function canonicalUrl(value, base) {
  const raw = decodeBasic(value);
  if (!raw || raw === '#' || raw.startsWith('javascript:') || raw.startsWith('data:')) return '';
  let url;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (isPlaceholder(url)) return '';
  return url.href;
}

const MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function gmgnUrl(mint) {
  const clean = String(mint || '').trim();
  if (!MINT.test(clean)) return '';
  return `https://gmgn.ai/sol/token/${clean}`;
}

export function pumpFunUrl(mint) {
  const clean = String(mint || '').trim();
  if (!MINT.test(clean)) return '';
  return `https://pump.fun/coin/${clean}`;
}

export function dexScreenerUrl(mint) {
  const clean = String(mint || '').trim();
  if (!MINT.test(clean)) return '';
  return `https://dexscreener.com/solana/${clean}`;
}

export function xSearchUrl(query) {
  const q = String(query || '').trim();
  if (!q) return '';
  return `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=live`;
}

export function tiktokSearchUrl(query) {
  const q = String(query || '').replace(/^#/, '').trim();
  if (!q) return '';
  if (/^[A-Za-z0-9_]{2,40}$/.test(q) && !q.includes(' ')) {
    return `https://www.tiktok.com/tag/${encodeURIComponent(q)}`;
  }
  return `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`;
}

export function articleIdFromGoogleNews(value) {
  const match = String(value || '').match(/\/articles\/([^/?#]+)/);
  return match ? match[1] : '';
}

export function parseGoogleNewsSignature(html) {
  const id = /data-n-a-id="([^"]+)"/.exec(html)?.[1];
  const ts = /data-n-a-ts="(\d+)"/.exec(html)?.[1];
  const sg = /data-n-a-sg="([^"]+)"/.exec(html)?.[1];
  if (!id || !ts || !sg) return null;
  return { id, ts, sg };
}

export function googleNewsDecodeBody({ id, ts, sg }) {
  const inner = [
    'garturlreq',
    [
      ['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
      'X',
      'X',
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    id,
    Number(ts),
    sg,
  ];
  const payload = [[['Fbv4je', JSON.stringify(inner), null, 'generic']]];
  return new URLSearchParams({ 'f.req': JSON.stringify(payload) }).toString();
}

export function parseGoogleNewsDecodeResponse(text) {
  const match = String(text || '').match(/https?:\/\/[^"\\\s]+/);
  if (!match) return '';
  return canonicalUrl(match[0].replace(/\\u0026/g, '&'));
}

const newsCache = new Map();

export async function resolveGoogleNewsArticle(articleUrl, fetchImpl = globalThis.fetch) {
  const id = articleIdFromGoogleNews(articleUrl);
  if (!id) return '';
  if (newsCache.has(id)) return newsCache.get(id);
  let resolved = '';
  try {
    const pageUrl = `https://news.google.com/rss/articles/${id}`;
    const page = await fetchImpl(pageUrl, {
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    });
    const html = await page.text();
    const sig = parseGoogleNewsSignature(html);
    if (sig) {
      const body = googleNewsDecodeBody(sig);
      const decoded = await fetchImpl(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body,
          signal: AbortSignal.timeout(8_000),
        },
      );
      resolved = parseGoogleNewsDecodeResponse(await decoded.text());
    }
  } catch {
    resolved = '';
  }
  if (newsCache.size > 400) {
    const oldest = newsCache.keys().next().value;
    newsCache.delete(oldest);
  }
  newsCache.set(id, resolved);
  return resolved;
}

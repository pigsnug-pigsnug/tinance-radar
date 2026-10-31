import { normalizeTitle } from './ids.js';

const STOP = new Set(
  `a an the of to and in on for with from by at as is are was were be been being this that it its or if vs via how why what who your you we they their not just than then over into about after before out up down off all any can will may more most other some such only own same so too very have has had but nor per our his her she him them he i me my`.split(
    /\s+/,
  ),
);

const BASE = new Set(
  `solana bitcoin ethereum crypto cryptocurrency btc eth token tokens coin coins memecoin memecoins blockchain defi nft nfts pump fun altcoin altcoins web3`.split(
    /\s+/,
  ),
);

/** Outlet names. They show up in our own titles and must not glue unrelated rows together. */
const PLATFORM = new Set(
  `bluesky reddit telegram wikipedia polymarket youtube tiktok nitter twitter dexscreener geckoterminal cointelegraph decrypt hackernews devto aljazeera`.split(
    /\s+/,
  ),
);

const NEWSY = new Set(
  `approved approval update updates report reports breaking launch launched launches listing listed price prices today official incoming massive huge alert alerts surge surges surged soars soaring soar crash crashes crashed dumps dump dumped rally rallies record high low week daily says said could would amid announced announces announcement reveal reveals revealed confirmed confirms confirmation according sources source people world year years time like new news video live post thread market markets trading trade trader traders million billion chart charts prediction predictions analysis first second next last best worst top big small here there now get got make made back still even also across against under between during without within another many much most why how what when where via ahead behind above below near early late tonight tomorrow yesterday monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december`.split(
    /\s+/,
  ),
);

export const BROAD_TICKERS = new Set(['SOL', 'BTC', 'ETH', 'BNB', 'USDT', 'USDC', 'USD']);

function isStrong(token) {
  return (
    token.length >= 4 &&
    !STOP.has(token) &&
    !NEWSY.has(token) &&
    !BASE.has(token) &&
    !PLATFORM.has(token) &&
    !/^\d+$/.test(token)
  );
}

function isSpecific(token) {
  return (
    token.length >= 3 &&
    !STOP.has(token) &&
    !NEWSY.has(token) &&
    !BASE.has(token) &&
    !PLATFORM.has(token) &&
    !/^\d+$/.test(token)
  );
}

export function isUsefulPhrase(phrase) {
  const parts = String(phrase || '')
    .toLowerCase()
    .replace(/^\$/, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return false;
  if (parts.some(isStrong)) return true;
  return parts.some((token) => BASE.has(token)) && parts.some(isSpecific);
}

function keepGram(tokens) {
  if (tokens.some(isStrong)) return true;
  if (tokens.some((t) => BASE.has(t)) && tokens.some(isSpecific)) return true;
  return false;
}

export function mentionsSolana(text) {
  return /(\bsolana\b|\$sol\b|pump\.fun|pumpfun|\braydium\b|\bjupiter\b|\bjito\b|\bbonk\b)/i.test(String(text || ''));
}

export function extractSignals(title) {
  const raw = String(title || '');
  const tickers = [];
  const seenTickers = new Set();
  for (const match of raw.matchAll(/\$([A-Za-z]{2,10})\b/g)) {
    const ticker = match[1].toUpperCase();
    if (!seenTickers.has(ticker)) {
      seenTickers.add(ticker);
      tickers.push(ticker);
    }
  }

  const keys = [];
  const seen = new Set();
  const add = (key) => {
    const value = String(key || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!value || value.length < 3 || seen.has(value) || keys.length >= 8) return;
    seen.add(value);
    keys.push(value);
  };

  for (const ticker of tickers) {
    if (!BROAD_TICKERS.has(ticker)) add(`$${ticker.toLowerCase()}`);
  }

  for (const match of raw.matchAll(/#([A-Za-z][A-Za-z0-9]{2,})/g)) {
    const token = match[1].toLowerCase();
    if (isStrong(token) || isSpecific(token)) add(token);
  }

  const proper = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const parts = buf.splice(0, buf.length);
    if (keepGram(parts)) proper.push(parts.join(' '));
  };
  for (const word of raw.replace(/https?:\/\/\S+/g, ' ').split(/\s+/)) {
    const clean = word.replace(/[^\p{L}\p{N}]/gu, '');
    if (!clean) {
      flush();
      continue;
    }
    const properNoun = /^[A-Z][a-z0-9]{2,}$/.test(clean) || /^[A-Z]{2,6}$/.test(clean);
    const lower = clean.toLowerCase();
    if (properNoun && !STOP.has(lower)) buf.push(lower);
    else flush();
    if (buf.length === 3) flush();
  }
  flush();
  for (const phrase of proper) add(phrase);

  const tokens = normalizeTitle(raw)
    .split(' ')
    .filter((token) => token && !STOP.has(token));

  for (let n = 3; n >= 2; n -= 1) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const slice = tokens.slice(i, i + n);
      if (keepGram(slice)) add(slice.join(' '));
    }
  }
  for (const token of tokens) {
    if (isStrong(token)) add(token);
  }

  return { tickers, keys, phrases: keys.slice(), norm: normalizeTitle(raw) };
}

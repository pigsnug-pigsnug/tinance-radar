import crypto from 'node:crypto';

export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable across process restarts. Same outlet + same headline => same id. */
export function stableId(source, title) {
  const key = `${String(source || '').trim().toLowerCase()}|${normalizeTitle(title)}`;
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 16);
}

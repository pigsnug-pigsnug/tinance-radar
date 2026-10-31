export function hasWholeWordSolana(text) {
  return /\bsolana\b/i.test(String(text || ''));
}

export function solanaInBody(title, body) {
  return hasWholeWordSolana(body) && String(body || '').trim().length > 0;
}

export function snippetAround(text, radius = 80) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const match = raw.match(/\bsolana\b/i);
  if (!match || match.index == null) return '';
  const start = Math.max(0, match.index - radius);
  const end = Math.min(raw.length, match.index + match[0].length + radius);
  const slice = raw.slice(start, end).trim();
  return `${start > 0 ? '…' : ''}${slice}${end < raw.length ? '…' : ''}`;
}

export function solanaCaptionHit(cues) {
  for (const cue of cues || []) {
    const text = String(cue?.text || '');
    if (!hasWholeWordSolana(text)) continue;
    const seconds = Math.max(0, Math.floor(Number(cue.start) || 0));
    return { seconds, snippet: snippetAround(text, 70) };
  }
  return null;
}

export function youtubeLink(videoId, seconds) {
  const id = String(videoId || '').trim();
  if (!id) return '';
  const t = Math.max(0, Math.floor(Number(seconds) || 0));
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&t=${t}s`;
}

export function toItem({ source, title, url, summary, publishedAt, tags, hits, extra }) {
  const clean = String(title || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 3) return null;
  return {
    source,
    title: clean,
    url: url || '',
    summary: String(summary || '').replace(/\s+/g, ' ').trim().slice(0, 360),
    publishedAt: publishedAt || Date.now(),
    tags: tags || [],
    hits,
    extra,
  };
}

export function keep(items) {
  return items.filter(Boolean);
}

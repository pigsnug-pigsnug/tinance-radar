export function toItem({
  source,
  title,
  url,
  summary,
  publishedAt,
  tags,
  hits,
  extra,
  score,
  comments,
  body,
  subreddit,
  spike,
  tweetId,
  postCount,
  proofUrl,
  reach,
}) {
  const clean = String(title || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 3) return null;
  return {
    source,
    title: clean,
    url: url || '',
    summary: String(summary || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    body: String(body || '').replace(/\s+/g, ' ').trim().slice(0, 1200),
    publishedAt: publishedAt || Date.now(),
    tags: tags || [],
    hits,
    extra,
    score: Number(score) || 0,
    comments: Number(comments) || 0,
    subreddit: subreddit || '',
    spike: Boolean(spike),
    tweetId: tweetId || '',
    postCount: postCount || '',
    proofUrl: proofUrl || '',
    reach: Boolean(reach),
  };
}

export function keep(items) {
  return items.filter(Boolean);
}

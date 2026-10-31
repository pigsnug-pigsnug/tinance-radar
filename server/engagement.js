export function engagementHits({ score = 0, comments = 0, points = 0, reactions = 0 } = {}) {
  const raw =
    Math.max(Number(score) || 0, Number(points) || 0, Number(reactions) || 0) +
    (Number(comments) || 0) * 0.6;
  if (raw < 2) return 1;
  return Math.max(1, Math.min(24, Math.round(Math.log2(raw + 1))));
}

export function keepRedditPost(
  post,
  { list = 'hot', minScore = 50, risingMinScore = 15, risingMinComments = 8 } = {},
) {
  if (!post) return false;
  if (post.stickied || post.over_18) return false;
  const title = String(post.title || '').trim();
  if (title.length < 8) return false;
  if (/removed by reddit/i.test(title)) return false;
  if (/^welcome to\b/i.test(title)) return false;
  if (/daily\s+\w*\s*discussion/i.test(title)) return false;
  const score = Number(post.score);
  const comments = Number(post.num_comments ?? post.comments);
  const hasScore = Number.isFinite(score);
  if (list === 'rising') {
    if (!hasScore) return false;
    if (score >= risingMinScore) return true;
    if (Number.isFinite(comments) && comments >= risingMinComments && score >= 5) return true;
    if (score >= 8 && Number(post.upvote_ratio) >= 0.9) return true;
    return false;
  }
  if (!hasScore) return list === 'hot' || list === 'top';
  if (score >= minScore) return true;
  if (score >= Math.round(minScore * 0.6) && Number.isFinite(comments) && comments >= 20) return true;
  return false;
}

export function keepHnStory(story, minPoints) {
  const points = Number(story?.score ?? story?.points);
  return Number.isFinite(points) && points >= minPoints;
}

export const BUCKET_MS = 5 * 60 * 1000;
export const WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function bucketStart(ts) {
  return Math.floor(ts / BUCKET_MS) * BUCKET_MS;
}

export function addHit(buckets, ts, n = 1) {
  const key = String(bucketStart(ts));
  buckets[key] = (buckets[key] || 0) + n;
}

export function pruneBuckets(buckets, now) {
  const cutoff = bucketStart(now) - WINDOW_MS;
  for (const key of Object.keys(buckets)) {
    if (Number(key) < cutoff) delete buckets[key];
  }
}

export function sumRange(buckets, start, end) {
  let total = 0;
  for (const [key, value] of Object.entries(buckets)) {
    const at = Number(key);
    if (at >= start && at < end) total += value;
  }
  return total;
}

/**
 * velocity = change in mentions/hour (last hour minus the hour before).
 * acceleration = change in that velocity versus the hour before that.
 */
export function computeKinetics(buckets, now) {
  const h0 = sumRange(buckets, now - HOUR, now + 1);
  const h1 = sumRange(buckets, now - 2 * HOUR, now - HOUR);
  const h2 = sumRange(buckets, now - 3 * HOUR, now - 2 * HOUR);
  const velocity = h0 - h1;
  const prevVelocity = h1 - h2;
  return {
    h0,
    h1,
    h2,
    perHour: h0,
    velocity,
    acceleration: velocity - prevVelocity,
  };
}

export function topicScore(kinetics, { cross = 0, multi = false, lastSeen = 0, now = Date.now() } = {}) {
  const ageH = Math.max(0, (now - lastSeen) / HOUR);
  const decay = Math.exp(-ageH / 5);
  const raw =
    kinetics.perHour * 1.4 +
    Math.max(0, kinetics.velocity) * 2.2 +
    Math.max(0, kinetics.acceleration) * 0.8 +
    cross * 7 +
    (multi ? 18 : 0);
  return Math.round(raw * decay * 10) / 10;
}

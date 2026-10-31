import { getJson } from '../net.js';
import { keep, toItem } from './shape.js';

const SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|Help:|File:|Template:|Category:|-|Undefined)$/;

function utcParts(offsetDays) {
  const date = new Date(Date.now() - offsetDays * 86_400_000);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return { y, m, d, label: `${y}-${m}-${d}` };
}

async function top(offset) {
  const { y, m, d, label } = utcParts(offset);
  const data = await getJson(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${d}`,
    { ua: 'TinanceRadar/2.0 (personal research dashboard; local use)' },
  );
  const articles = data?.items?.[0]?.articles || [];
  if (!articles.length) throw new Error(`empty pageviews ${label}`);
  return { label, articles };
}

export default {
  name: 'wikipedia',
  intervalMs: 30 * 60 * 1000,
  async fetch() {
    let recent;
    let prior = null;
    const errors = [];
    for (const offset of [1, 2]) {
      try {
        recent = await top(offset);
        break;
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (!recent) throw new Error(errors.join(' | ') || 'pageviews unavailable');
    try {
      const recentOffset = recent.label.endsWith(String(utcParts(1).d)) ? 2 : 3;
      prior = await top(recentOffset);
    } catch {
      prior = null;
    }
    const priorMap = new Map((prior?.articles || []).map((row) => [row.article, row]));
    const spikes = [];
    for (const row of recent.articles) {
      if (SKIP.test(row.article) || row.article.includes(':')) continue;
      if (row.rank > 40) break;
      const prev = priorMap.get(row.article);
      const fresh = !prev || prev.rank > 80;
      const jump = prev?.views > 0 && row.views / prev.views >= 1.75;
      if (prior && !fresh && !jump) continue;
      spikes.push({ ...row, prev });
      if (spikes.length >= 12) break;
    }
    if (!spikes.length) throw new Error('no pageview spike');
    return keep(
      spikes.map((row) => {
        const title = row.article.replace(/_/g, ' ');
        const prev = row.prev;
        const views = Number(row.views) || 0;
        const summary = prev?.views
          ? `People opened this page ${views.toLocaleString('en-US')} times on ${recent.label}. Yesterday it was #${prev.rank} with ${Number(prev.views).toLocaleString('en-US')} views.`
          : `This page jumped onto the most-read list at #${row.rank}, with ${views.toLocaleString('en-US')} views on ${recent.label}. It was not in yesterday's top pages.`;
        return toItem({
          source: 'wikipedia',
          title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(row.article)}`,
          summary,
          body: summary,
          spike: true,
          reach: true,
          publishedAt: Date.now(),
        });
      }),
    );
  },
};

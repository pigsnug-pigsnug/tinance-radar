import { load } from 'cheerio';
import { getJson, getText } from '../net.js';
import { keep, toItem } from './shape.js';

const TRENDS24 = [
  'https://trends24.in/tiktok/',
  'https://trends24.in/united-states/tiktok/',
];

async function fromTrends24() {
  const errors = [];
  for (const url of TRENDS24) {
    try {
      const html = await getText(url, { browser: true });
      const $ = load(html);
      const items = [];
      $('ol.trend-card__list')
        .first()
        .find('a.trend-link')
        .each((_, el) => {
          const title = $(el).text().replace(/\s+/g, ' ').trim();
          if (!title) return;
          items.push(
            toItem({
              source: 'tiktok',
              title,
              url: $(el).attr('href') || url,
              summary: 'TikTok trend via trends24',
              publishedAt: Date.now(),
            }),
          );
        });
      const kept = keep(items).slice(0, 20);
      if (kept.length) return kept;
      errors.push('empty parse');
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(errors.join(' | ') || 'trends24 tiktok miss');
}

async function fromCreativeCenter() {
  const data = await getJson(
    'https://ads.tiktok.com/creative_radar_api/v1/popular_trend/hashtag/list?page=1&limit=20&period=7&country_code=US&sort_by=popular',
    { browser: true },
  );
  const list = data?.data?.list || [];
  if (!list.length) throw new Error('empty creative center');
  return keep(
    list.slice(0, 15).map((row) => {
      const name = String(row.hashtag_name || '').replace(/^#/, '');
      return toItem({
        source: 'tiktok',
        title: `#${name}`,
        url: `https://www.tiktok.com/tag/${encodeURIComponent(name)}`,
        summary: `TikTok hashtag · ${Number(row.video_views || row.publish_cnt || 0).toLocaleString('en-US')} views`,
        publishedAt: Date.now(),
      });
    }),
  );
}

async function fromExploding() {
  const html = await getText('https://explodingtopics.com/', { browser: true });
  const $ = load(html);
  const items = [];
  const seen = new Set();
  $('a').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const match = text.match(/^(.{2,42}?)(\+\d[\d,]*%)$/);
    if (!match) return;
    const title = match[1].trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key) || /login|pricing|newsletter/i.test(title)) return;
    seen.add(key);
    const href = $(el).attr('href') || '/';
    items.push(
      toItem({
        source: 'tiktok',
        title,
        url: new URL(href, 'https://explodingtopics.com').href,
        summary: `Exploding Topics ${match[2]}. TikTok hashtag list was unreachable, so this is the public growth board.`,
        publishedAt: Date.now(),
      }),
    );
  });
  const kept = items.slice(0, 12);
  if (!kept.length) throw new Error('empty exploding topics');
  return kept;
}

export default {
  name: 'tiktok',
  intervalMs: 15 * 60 * 1000,
  async fetch() {
    const errors = [];
    for (const fn of [fromTrends24, fromCreativeCenter, fromExploding]) {
      try {
        return await fn();
      } catch (error) {
        errors.push(error.message);
      }
    }
    throw new Error(errors.join(' | '));
  },
};

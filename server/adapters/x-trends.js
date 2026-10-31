import { load } from 'cheerio';
import { getText } from '../net.js';
import { keep, toItem } from './shape.js';

function fromTrends24(html) {
  const $ = load(html);
  const items = [];
  $('ol.trend-card__list')
    .first()
    .find('a.trend-link')
    .each((_, el) => {
      const title = $(el).text().replace(/\s+/g, ' ').trim();
      const href = $(el).attr('href') || '';
      if (!title) return;
      items.push(
        toItem({
          source: 'x',
          title,
          url: href,
          summary: 'Trending on X right now · trends24.in United States',
          publishedAt: Date.now(),
        }),
      );
    });
  return keep(items).slice(0, 20);
}

function fromGetDayTrends(html) {
  const $ = load(html);
  const items = [];
  const seen = new Set();
  $('a[href*="/trend/"]').each((_, el) => {
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key) || title.length > 60) return;
    seen.add(key);
    const href = $(el).attr('href') || '';
    items.push(
      toItem({
        source: 'x',
        title,
        url: href.startsWith('http') ? href : `https://getdaytrends.com${href}`,
        summary: 'Trending on X · getdaytrends.com (trends24 was blocked)',
        publishedAt: Date.now(),
      }),
    );
  });
  return keep(items).slice(0, 20);
}

export default {
  name: 'x-trends',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const errors = [];
    try {
      const html = await getText('https://trends24.in/united-states/', { browser: true });
      const items = fromTrends24(html);
      if (items.length) return items;
      errors.push('trends24 empty parse');
    } catch (error) {
      errors.push(`trends24 ${error.message}`);
    }
    try {
      const html = await getText('https://getdaytrends.com/united-states/', { browser: true });
      const items = fromGetDayTrends(html);
      if (items.length) return items;
      errors.push('getdaytrends empty parse');
    } catch (error) {
      errors.push(`getdaytrends ${error.message}`);
    }
    throw new Error(errors.join(' | ') || 'x trends unavailable');
  },
};

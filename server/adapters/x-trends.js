import { load } from 'cheerio';
import { xSearchUrl } from '../links.js';
import { getText } from '../net.js';
import { keep, toItem } from './shape.js';

export function readTrends(html) {
  const $ = load(html);
  const items = [];
  const seen = new Set();
  $('a').each((_, el) => {
    const title = $(el).text().replace(/\s+/g, ' ').trim();
    const href = $(el).attr('href') || '';
    if (!title || title.length > 60 || seen.has(title.toLowerCase())) return;
    if (!/\/trend\//i.test(href) && !/trend-link/.test($(el).attr('class') || '')) return;
    seen.add(title.toLowerCase());
    const row = $(el).closest('tr, li, article');
    const around = `${row.text()} ${$(el).parent().text()}`;
    const count = around.match(/([\d,.]+)\s*([KMB])?\s*(?:tweets|posts)/i);
    let postCount = '';
    if (count) postCount = `${count[1]}${count[2] || ''} posts`;
    const status = around.match(/status\/(\d+)/);
    const rank = row.find('.pos').first().text().trim();
    items.push(
      toItem({
        source: 'x',
        title,
        url: xSearchUrl(title),
        summary: [
          rank ? `Number ${rank} on the US trend list.` : 'On the US trend list.',
          'It has held a spot over the last few hours.',
          postCount ? `About ${postCount}.` : 'The free list does not publish a post count.',
        ].join(' '),
        publishedAt: Date.now(),
        postCount,
        tweetId: status?.[1] || '',
        reach: true,
      }),
    );
  });
  return keep(items).slice(0, 15);
}

export default {
  name: 'x-trends',
  intervalMs: 10 * 60 * 1000,
  async fetch() {
    const errors = [];
    for (const url of ['https://getdaytrends.com/united-states/', 'https://trends24.in/united-states/']) {
      try {
        const html = await getText(url, { browser: true });
        const items = readTrends(html);
        if (items.length) return items;
        errors.push(`${url} empty`);
      } catch (error) {
        errors.push(`${url} ${error.message}`);
      }
    }
    throw new Error(errors.join(' | ') || 'x trends unavailable');
  },
};

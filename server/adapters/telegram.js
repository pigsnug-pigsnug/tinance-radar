import { load } from 'cheerio';
import { config } from '../config.js';
import { getText } from '../net.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

export default {
  name: 'telegram',
  intervalMs: 5 * 60 * 1000,
  async fetch() {
    const channels = config.telegramChannels;
    if (!channels.length) throw new Error('set TELEGRAM_CHANNELS');
    const settled = await Promise.allSettled(
      channels.map(async (channel) => {
        const html = await getText(`https://t.me/s/${encodeURIComponent(channel)}`, { browser: true });
        const $ = load(html);
        const messages = $('.tgme_widget_message').toArray();
        if (!messages.length) throw new Error(`empty @${channel}`);
        const start = Math.max(0, messages.length - 8);
        const items = [];
        for (const el of messages.slice(start)) {
          const text = $(el).find('.tgme_widget_message_text').first().text().replace(/\s+/g, ' ').trim();
          if (text.length < 12) continue;
          const href = $(el).find('a.tgme_widget_message_date').attr('href') || '';
          const when = $(el).find('a.tgme_widget_message_date time').attr('datetime') || '';
          if (!/\/\d+\/?$/.test(href)) continue;
          items.push(
            toItem({
              source: 'telegram',
              title: text.slice(0, 160),
              url: href,
              summary: `@${channel}`,
              publishedAt: parseTime(when) || Date.now(),
            }),
          );
        }
        if (!items.length) throw new Error(`no message links @${channel}`);
        return items;
      }),
    );
    const items = keep(settled.flatMap((row) => (row.status === 'fulfilled' ? row.value : [])));
    if (!items.length) {
      const reason = settled.find((row) => row.status === 'rejected')?.reason;
      throw new Error(reason?.message || 'telegram unavailable');
    }
    return items;
  },
};

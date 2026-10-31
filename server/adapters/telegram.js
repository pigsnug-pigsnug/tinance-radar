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
        const texts = $('.tgme_widget_message_text').toArray();
        const links = $('a.tgme_widget_message_date').toArray();
        if (!texts.length) throw new Error(`empty @${channel}`);
        const start = Math.max(0, texts.length - 8);
        const items = [];
        for (let i = start; i < texts.length; i += 1) {
          const text = $(texts[i]).text().replace(/\s+/g, ' ').trim();
          if (text.length < 12) continue;
          const href = links[i] ? $(links[i]).attr('href') : '';
          const when = links[i] ? $(links[i]).find('time').attr('datetime') : '';
          items.push(
            toItem({
              source: 'telegram',
              title: text.slice(0, 160),
              url: href || `https://t.me/${channel}`,
              summary: `@${channel}`,
              publishedAt: parseTime(when) || Date.now(),
            }),
          );
        }
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

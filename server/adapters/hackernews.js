import { config } from '../config.js';
import { engagementHits, keepHnStory } from '../engagement.js';
import { getJson } from '../net.js';
import { parseTime } from '../time.js';
import { keep, toItem } from './shape.js';

async function mapPool(list, limit, fn) {
  const out = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(list[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, () => worker()));
  return out;
}

export default {
  name: 'hackernews',
  intervalMs: 3 * 60 * 1000,
  async fetch() {
    const ids = await getJson('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!Array.isArray(ids) || !ids.length) throw new Error('empty front page');
    const stories = await mapPool(ids.slice(0, 15), 5, async (id) => {
      try {
        return await getJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      } catch {
        return null;
      }
    });
    const items = keep(
      stories.filter((story) => keepHnStory(story, config.hnMinPoints)).map((story) =>
        toItem({
          source: 'hackernews',
          title: story.title,
          url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
          urlBase: 'https://news.ycombinator.com/',
          summary: `${story.score || 0} points and ${story.descendants || 0} comments on Hacker News, posted by ${story.by || 'someone'}.`,
          score: story.score,
          comments: story.descendants,
          reach: true,
          publishedAt: parseTime(story.time),
          hits: engagementHits({ points: story.score, comments: story.descendants }),
        }),
      ),
    );
    if (!items.length) throw new Error('no stories parsed');
    return items;
  },
};

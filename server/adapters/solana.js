import { config } from '../config.js';
import { getJson, getText } from '../net.js';
import { parseTime } from '../time.js';
import { snippetAround, solanaCaptionHit, solanaInBody, youtubeLink } from '../solana-match.js';
import { keep, toItem } from './shape.js';

const CHANNELS = ['UC9AdQPUe4BdVJ8M9X7wxHUA'];

function githubHeaders() {
  const headers = {
    accept: 'application/vnd.github.text-match+json',
    'user-agent': 'TinanceRadar/2.0',
  };
  if (config.githubToken) headers.authorization = `Bearer ${config.githubToken}`;
  return headers;
}

async function githubReadmeHits() {
  const day = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await getJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(`Solana in:readme pushed:>${day}`)}&sort=updated&order=desc&per_page=5`,
    { headers: githubHeaders(), timeoutMs: 12_000 },
  );
  const repos = data?.items || [];
  const items = [];
  for (const repo of repos.slice(0, 4)) {
    let body = (repo.text_matches || []).map((match) => match.fragment).join(' ');
    if (!solanaInBody(repo.full_name, body) && !solanaInBody(repo.full_name, repo.description || '')) {
      try {
        const readme = await getText(`https://api.github.com/repos/${repo.full_name}/readme`, {
          headers: { accept: 'application/vnd.github.raw', 'user-agent': 'TinanceRadar/2.0', ...(config.githubToken ? { authorization: `Bearer ${config.githubToken}` } : {}) },
          timeoutMs: 10_000,
        });
        body = readme.slice(0, 4000);
      } catch {
        body = repo.description || '';
      }
    }
    if (!solanaInBody(repo.full_name || '', `${repo.description || ''}\n${body}`)) continue;
    const snippet = snippetAround(`${repo.description || ''} ${body}`);
    items.push(
      toItem({
        source: 'github',
        title: repo.full_name,
        url: repo.html_url,
        summary: snippet || repo.description || '',
        body: snippet,
        publishedAt: parseTime(repo.pushed_at) || Date.now(),
        tags: ['solana'],
      }),
    );
  }
  return items;
}

async function githubCodeHits() {
  if (!config.githubToken) return [];
  const data = await getJson(
    `https://api.github.com/search/code?q=${encodeURIComponent('Solana in:file')}&per_page=5`,
    { headers: githubHeaders(), timeoutMs: 12_000 },
  );
  return (data?.items || [])
    .map((row) => {
      const fragment = (row.text_matches || []).map((match) => match.fragment).join(' ');
      if (!solanaInBody(row.name, fragment)) return null;
      return toItem({
        source: 'github',
        title: `${row.repository?.full_name || 'repo'} · ${row.name}`,
        url: row.html_url,
        summary: snippetAround(fragment),
        body: fragment,
        publishedAt: Date.now(),
        tags: ['solana'],
      });
    })
    .filter(Boolean);
}

function captionTracks(html) {
  const at = html.indexOf('"captionTracks":');
  if (at < 0) return [];
  const start = html.indexOf('[', at);
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < html.length && i < start + 20000; i += 1) {
    if (html[i] === '[') depth += 1;
    else if (html[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1).replace(/\\u0026/g, '&'));
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

export function cuesFromTimedText(payload) {
  const events = payload?.events || [];
  return events.map((event) => ({
    start: (Number(event.tStartMs) || 0) / 1000,
    text: (event.segs || []).map((seg) => seg.utf8 || '').join(''),
  }));
}

async function captionHit(videoId) {
  const html = await getText(`https://www.youtube.com/watch?v=${videoId}`, { browser: true, timeoutMs: 12_000 });
  const tracks = captionTracks(html);
  const track = tracks.find((row) => row.languageCode === 'en' || row.languageCode === 'en-US') || tracks[0];
  if (!track?.baseUrl) return null;
  const raw = await getText(`${track.baseUrl}&fmt=json3`, { browser: true, timeoutMs: 10_000 });
  const hit = solanaCaptionHit(cuesFromTimedText(JSON.parse(raw)));
  return hit;
}

async function youtubeHits() {
  const channels = config.youtubeChannelIds?.length ? config.youtubeChannelIds : CHANNELS;
  const items = [];
  for (const channel of channels.slice(0, 2)) {
    let feed = [];
    try {
      const xml = await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel)}`, {
        browser: true,
        accept: 'application/atom+xml',
      });
      const ids = [...xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)].map((match) => match[1]).slice(0, 3);
      const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].map((match) => match[1]);
      feed = ids.map((id, index) => ({ id, title: titles[index + 1] || titles[index] || id }));
    } catch {
      continue;
    }
    for (const video of feed) {
      try {
        const hit = await captionHit(video.id);
        if (!hit) continue;
        items.push(
          toItem({
            source: 'youtube',
            title: video.title,
            url: youtubeLink(video.id, hit.seconds),
            summary: hit.snippet,
            body: hit.snippet,
            publishedAt: Date.now(),
            tags: ['solana'],
          }),
        );
      } catch {
        /* captions are optional */
      }
    }
  }
  return items;
}

async function redditBodyHits() {
  try {
    const data = await getJson('https://www.reddit.com/r/solana/hot.json?limit=15&raw_json=1', {
      browser: true,
      timeoutMs: 8_000,
    });
    return (data?.data?.children || [])
      .map((row) => row?.data)
      .filter((post) => post && solanaInBody(post.title, post.selftext || ''))
      .slice(0, 6)
      .map((post) =>
        toItem({
          source: 'reddit',
          title: post.title,
          url: post.permalink ? `https://www.reddit.com${post.permalink}` : '',
          summary: snippetAround(`${post.selftext || ''} ${post.title || ''}`),
          body: post.selftext || post.title,
          publishedAt: (post.created_utc || 0) * 1000 || Date.now(),
          tags: ['solana'],
        }),
      );
  } catch {
    return [];
  }
}

export async function scanSolana() {
  const settled = await Promise.allSettled([githubReadmeHits(), githubCodeHits(), youtubeHits(), redditBodyHits()]);
  return keep(settled.flatMap((row) => (row.status === 'fulfilled' ? row.value : []))).slice(0, 30);
}

export function startSolana({ store, status }) {
  const row = {
    name: 'solana-scan',
    state: 'idle',
    stale: false,
    failures: 0,
    lastOk: 0,
    lastError: '',
    intervalMs: 12 * 60 * 1000,
    count: 0,
    detail: 'github, captions, reddit bodies',
  };
  status.set('solana-scan', row);
  const run = async () => {
    try {
      const items = await scanSolana();
      store.setSolana(items.filter((item) => item?.url));
      row.state = 'ok';
      row.lastOk = Date.now();
      row.count = items.length;
      row.lastError = items.length ? '' : 'no Solana mentions in this pass';
      row.failures = 0;
    } catch (error) {
      row.failures += 1;
      row.state = 'error';
      row.lastError = error.message;
    }
    setTimeout(run, row.intervalMs);
  };
  setTimeout(run, 8_000);
}

export default {
  name: 'solana-scan',
  intervalMs: 12 * 60 * 1000,
  async fetch() {
    return scanSolana();
  },
};

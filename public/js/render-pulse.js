import { ago, esc, platform, safeUrl, signedInt } from './format.js';
import { hotTopics, platformCounts, state, visibleItems } from './state.js';

function badges(item) {
  const topic = state.topics.get(item.topicId);
  if (!topic) return '';
  const parts = [];
  if (topic.multi) {
    parts.push(`<button type="button" class="badge multi" data-action="why" data-id="${esc(item.id)}">Multi · ${topic.cross}</button>`);
  } else if (topic.cross >= 2) {
    parts.push(`<button type="button" class="badge srcs" data-action="why" data-id="${esc(item.id)}">${topic.cross} src</button>`);
  }
  const velClass = topic.velocity > 0 ? 'up' : topic.velocity < 0 ? 'down' : 'flat';
  parts.push(`<span class="badge vel ${velClass}">${signedInt(topic.velocity)}/h</span>`);
  if (Math.abs(topic.acceleration) >= 2) {
    const arrow = topic.acceleration > 0 ? '▲' : '▼';
    parts.push(`<span class="badge accel ${velClass}">${arrow}${Math.abs(Math.round(topic.acceleration))}</span>`);
  }
  parts.push(`<span class="badge score" title="Topic score">${Math.round(topic.score)}</span>`);
  return parts.join('');
}

function card(item) {
  const topic = state.topics.get(item.topicId);
  const href = safeUrl(item.url);
  const starred = state.stars.has(item.id);
  const saved = state.saves.has(item.id);
  const note = state.notes.get(item.id)?.text;
  const phrases = (item.phrases || []).slice(0, 4).map((phrase) => `<span>${esc(phrase)}</span>`).join('');
  const sol = (item.tags || []).includes('solana');
  return `<article class="card">
    <div class="card-top">
      <span class="plat">${esc(platform(item.source))}</span>
      ${sol ? '<span class="sol-mark" title="Solana">◎</span>' : ''}
      <span class="ago">${ago(item.publishedAt || item.fetchedAt)}</span>
      <span class="badges">${badges(item)}</span>
    </div>
    ${href ? `<a class="card-title" href="${href}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>` : `<h3 class="card-title">${esc(item.title)}</h3>`}
    ${item.summary ? `<p class="sum">${esc(item.summary)}</p>` : ''}
    <p class="phrases">${topic ? `<span class="topic">${esc(topic.label)}</span>` : ''}${phrases}</p>
    ${note ? `<p class="note-line">${esc(note)}</p>` : ''}
    <div class="card-actions">
      <button type="button" data-action="star" data-id="${esc(item.id)}" aria-pressed="${starred}">${starred ? 'Starred' : 'Star'}</button>
      <button type="button" data-action="save" data-id="${esc(item.id)}" aria-pressed="${saved}">${saved ? 'Saved' : 'Save'}</button>
      <button type="button" data-action="note" data-id="${esc(item.id)}">Note</button>
      <button type="button" data-action="launch" data-id="${esc(item.id)}">Launch</button>
      <button type="button" data-action="tweet" data-id="${esc(item.id)}">Tweet</button>
    </div>
  </article>`;
}

export function renderFeed(stage, { sol = false } = {}) {
  const scroll = stage.scrollTop;
  const rows = visibleItems().slice(0, 200);
  const counts = platformCounts();
  const modes = [
    ['latest', 'Latest'],
    ['heat', 'Heat'],
    ['starred', 'Starred'],
    ['saved', 'Saved'],
  ];
  const total = universeCount(sol);
  stage.innerHTML = `
    <div class="toolbar">
      <div class="chips" role="tablist" aria-label="Platforms">
        <button type="button" class="chip ${state.platform === 'all' ? 'on' : ''}" data-action="platform" data-id="all">All ${total}</button>
        ${counts
          .map(
            ([source, count]) =>
              `<button type="button" class="chip ${state.platform === source ? 'on' : ''}" data-action="platform" data-id="${esc(source)}">${esc(platform(source))} ${count}</button>`,
          )
          .join('')}
      </div>
      <div class="chips modes">
        ${modes
          .map(
            ([id, label]) =>
              `<button type="button" class="chip ${state.mode === id ? 'on' : ''}" data-action="mode" data-id="${id}">${label}</button>`,
          )
          .join('')}
      </div>
    </div>
    ${
      rows.length
        ? `<div class="feed">${rows.map(card).join('')}</div>`
        : `<div class="empty">
            <h2>${emptyTitle(sol)}</h2>
            <p>${emptyBody(sol)}</p>
          </div>`
    }`;
  stage.scrollTop = scroll;
}

function universeCount(sol) {
  let n = 0;
  for (const item of state.items.values()) {
    if (!sol || (item.tags || []).includes('solana')) n += 1;
  }
  return n;
}

function emptyTitle(sol) {
  if (!state.ready) return 'Opening the tape';
  if (state.error) return 'The desk did not open';
  if (state.query) return 'Nothing matches that search';
  if (state.mode === 'starred') return 'No stars yet';
  if (state.mode === 'saved') return 'Nothing saved';
  if (sol) return 'SOL web is quiet';
  return 'Sources are still sweeping';
}

function emptyBody(sol) {
  if (state.error) return state.error;
  if (state.query) return 'Clear the search or try a ticker, a name, or a source.';
  if (state.mode === 'starred') return 'Star a card and the snapshot stays here after it leaves the feed.';
  if (state.mode === 'saved') return 'Saves keep a copy of the item, not a live pointer.';
  if (sol) return 'Solana-tagged prints from news, DEX, pump, and YouTube land here. The first pass takes a minute.';
  const failed = state.health.filter((source) => source.state === 'error' || source.state === 'open').length;
  if (state.health.length && failed === state.health.length) return 'Every source failed its last fetch. Open Sources to see which circuits are open.';
  return 'The first pass takes under a minute. New items arrive on the live stream — no reload.';
}

export function renderRail(rail) {
  if (!rail) return;
  const scroll = rail.scrollTop;
  const editing = document.activeElement && rail.contains(document.activeElement);
  const draft = editing && document.activeElement.id === 'watch-input' ? document.activeElement.value : '';
  const topics = hotTopics(8);
  rail.innerHTML = `
    <section class="rail-block">
      <h2>Watch words</h2>
      <p class="hint">${state.watchwords.length ? 'A new hit pings once.' : 'Add a word. New matches ping once.'}</p>
      <form class="watch-form" data-action="watch-add">
        <input id="watch-input" type="text" maxlength="40" placeholder="bonk, etf, war…" value="${esc(draft)}" />
        <button type="submit">Add</button>
      </form>
      <ul class="watch-list">
        ${state.watchwords
          .map(
            (word) =>
              `<li><span>${esc(word)}</span><button type="button" data-action="watch-remove" data-id="${esc(word)}" aria-label="Remove ${esc(word)}">×</button></li>`,
          )
          .join('') || '<li class="quiet">None yet</li>'}
      </ul>
    </section>
    <section class="rail-block">
      <h2>Hot topics</h2>
      ${
        topics.length
          ? `<ol class="hot-list">${topics
              .map((topic) => {
                const cls = topic.velocity > 0 ? 'up' : topic.velocity < 0 ? 'down' : '';
                return `<li>
                  <button type="button" data-action="search" data-id="${esc(topic.label)}">${esc(topic.label)}</button>
                  <span class="hot-meta ${cls}">${signedInt(topic.velocity)}/h · ${Math.round(topic.score)}</span>
                </li>`;
              })
              .join('')}</ol>`
          : '<p class="hint">Topics appear once two headlines share a phrase.</p>'
      }
    </section>`;
  rail.scrollTop = scroll;
  if (editing) {
    const input = document.getElementById('watch-input');
    if (input) {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }
}

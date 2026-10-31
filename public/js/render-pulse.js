import { esc, platform } from './format.js';
import { state, visibleCards } from './state.js';

function sourceLinks(card) {
  return (card.sources || [])
    .map(
      (row) =>
        `<a class="src" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(platform(row.source))}</a>`,
    )
    .join('');
}

function card(row) {
  const fresh = row.fresh ? '<span class="badge fresh">Fresh</span>' : '';
  const prime = row.prime ? '<span class="badge prime">Prime time</span>' : '';
  const lane = row.lane === 'breaking' ? 'Breaking' : 'Funny';
  const images = (row.images || [])
    .map(
      (image) =>
        `<a class="big" href="${esc(image.url)}" target="_blank" rel="noopener noreferrer">${esc(image.style)}</a>`,
    )
    .join('');
  return `<article class="story ${row.prime ? 'on-prime' : ''} ${row.reach ? 'big-reach' : ''}">
    <div class="card-top">
      <span class="badge lane">${lane}</span>
      ${fresh}
      ${prime}
      ${row.reach ? '<span class="badge">Big source</span>' : ''}
    </div>
    <h2>${esc(row.title)}</h2>
    <p class="story-body">${esc(row.summary)}</p>
    <p class="src-row">${sourceLinks(row)}</p>
    <p class="proof">
      ${row.tweetUrl ? `<a href="${esc(row.tweetUrl)}" target="_blank" rel="noopener noreferrer">Source post</a>` : ''}
      ${row.proofUrl ? `<a href="${esc(row.proofUrl)}" target="_blank" rel="noopener noreferrer">Proof</a>` : ''}
    </p>
    <p class="coin-line"><strong>${esc(row.name)}</strong> <span class="ticker">${esc(row.ticker)}</span></p>
    <pre class="tweet">${esc(row.tweet)}</pre>
    <div class="story-actions">
      <button type="button" class="big" data-action="copy-tweet" data-id="${esc(row.id)}">Copy tweet</button>
      <a class="big" href="${esc(row.postUrl)}" target="_blank" rel="noopener noreferrer">Post to X</a>
      ${row.replyUrl ? `<a class="big" href="${esc(row.replyUrl)}" target="_blank" rel="noopener noreferrer">Reply launch</a>` : ''}
      <button type="button" class="big" data-action="launch" data-id="${esc(row.itemId)}">Log launch</button>
    </div>
    <p class="hint">Generate image</p>
    <div class="story-actions">${images}</div>
  </article>`;
}

export function renderFeed(stage) {
  const scroll = stage.scrollTop;
  const rows = visibleCards();
  const lanes = [
    ['all', 'All'],
    ['breaking', 'Breaking'],
    ['funny', 'Funny'],
  ];
  stage.innerHTML = `
    <div class="toolbar">
      <div class="chips" role="tablist" aria-label="Lanes">
        ${lanes
          .map(
            ([id, label]) =>
              `<button type="button" class="chip big ${state.lane === id ? 'on' : ''}" data-action="lane" data-id="${id}">${label}</button>`,
          )
          .join('')}
      </div>
    </div>
    ${
      rows.length
        ? `<div class="feed">${rows.map(card).join('')}</div>`
        : `<div class="empty">
            <h2>Nothing loud enough yet</h2>
            <p>A card shows up only when the same story is moving on at least two sources, and it is either breaking or funny. Dull news stays off the tape.</p>
          </div>`
    }`;
  stage.scrollTop = scroll;
}

import { esc, highlightSolana } from './format.js';
import { state } from './state.js';

export function renderSolana(stage) {
  const rows = state.solana || [];
  const scroll = stage.scrollTop;
  stage.innerHTML = `
    <div class="empty tight">
      <h2>Solana scanner</h2>
      <p>Whole word only, inside the text. GitHub READMEs, YouTube captions with a timestamp, and Reddit posts that say Solana in the body. Checked about every 12 minutes.</p>
    </div>
    ${
      rows.length
        ? `<div class="feed">${rows
            .map(
              (item) => `<article class="story">
                <div class="card-top"><span class="badge">${esc(item.source)}</span></div>
                <h2><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h2>
                <p class="story-body">${highlightSolana(item.summary || item.body || '')}</p>
              </article>`,
            )
            .join('')}</div>`
        : `<div class="empty"><h2>No Solana mentions this pass</h2><p>Captions and GitHub can be quiet. The next pass is in a few minutes. If GitHub code search is empty, set GITHUB_TOKEN. The README search still runs without it.</p></div>`
    }`;
  stage.scrollTop = scroll;
}

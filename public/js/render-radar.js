import { ago, esc, safeUrl, usd } from './format.js';
import { state, wordCloud } from './state.js';

function editing(root) {
  const active = document.activeElement;
  return Boolean(active && root?.contains(active) && ['INPUT', 'TEXTAREA'].includes(active.tagName));
}

export function renderRadar(stage) {
  if (!stage.querySelector('.radar')) {
    stage.innerHTML = `<div class="radar"><section id="prints"></section><section id="tools"></section></div>`;
  }
  renderPrints(stage.querySelector('#prints'));
  const tools = stage.querySelector('#tools');
  if (!editing(tools)) renderTools(tools);
}

function renderPrints(root) {
  const scroll = root.scrollTop;
  const tokens = state.radar?.tokens || [];
  const koth = state.radar?.koth;
  const live = state.radar?.connected;
  root.innerHTML = `
    <header class="panel-head">
      <h2>pump.fun</h2>
      <span class="pill ${live ? 'ok' : 'bad'}">${live ? 'socket live' : 'socket down'}</span>
    </header>
    ${
      koth
        ? `<a class="koth" href="${safeUrl(koth.url) || '#'}" target="_blank" rel="noopener noreferrer">
            <span>King of the hill</span>
            <strong>${esc(koth.title)}</strong>
          </a>`
        : ''
    }
    ${
      tokens.length
        ? `<ol class="prints">${tokens
            .map((token) => {
              const href = safeUrl(token.url);
              const name = token.symbol ? `$${esc(token.symbol)}` : esc(token.name);
              return `<li>
                <time>${ago(token.ts)}</time>
                <strong>${name}</strong>
                <span>${esc(token.name)}</span>
                <em>${token.marketCapSol ? `${Number(token.marketCapSol).toFixed(1)} SOL` : ''}</em>
                ${token.kind === 'graduation' ? '<b class="grad">graduated</b>' : ''}
                ${href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">open</a>` : ''}
              </li>`;
            })
            .join('')}</ol>`
        : `<div class="empty tight">
            <h2>${live ? 'Waiting for the next create' : 'pump.fun socket is reconnecting'}</h2>
            <p>${esc(state.radar?.error || 'New mints show up here. Graduations also land on Pulse.')}</p>
          </div>`
    }`;
  root.scrollTop = scroll;
}

function renderTools(root) {
  const words = wordCloud();
  const max = words[0]?.[1] || 1;
  const coin = state.coin;
  root.innerHTML = `
    <section class="panel">
      <header class="panel-head"><h2>Hot words</h2></header>
      ${
        words.length
          ? `<div class="cloud">${words
              .map(([word, weight]) => {
                const size = 12 + Math.round((weight / max) * 16);
                return `<button type="button" data-action="search" data-id="${esc(word)}" style="font-size:${size}px">${esc(word)}</button>`;
              })
              .join('')}</div>`
          : '<p class="hint">The cloud fills as topics pick up weight.</p>'
      }
    </section>
    <section class="panel">
      <header class="panel-head"><h2>Coin check</h2></header>
      <form class="coin-form" data-action="coin-check">
        <input id="coin-q" type="text" placeholder="Mint, ticker, or name" value="${esc(coin.q)}" autocomplete="off" />
        <button type="submit">${coin.loading ? 'Checking…' : 'Check'}</button>
      </form>
      ${coin.error ? `<p class="error">${esc(coin.error)}</p>` : ''}
      ${
        coin.pairs?.length
          ? `<ul class="pairs">${coin.pairs
              .map((pair) => {
                const href = safeUrl(pair.url);
                const change = Number(pair.change);
                const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
                return `<li>
                  <div>
                    <strong>${esc(pair.name)}</strong>
                    <span>${esc(pair.chain || '')} · ${esc(pair.dex || '')}</span>
                  </div>
                  <div class="pair-nums">
                    <b>${pair.price != null ? `$${Number(pair.price).toPrecision(3)}` : '—'}</b>
                    <span class="${cls}">${Number.isFinite(change) ? `${change.toFixed(1)}%` : ''}</span>
                    <span>vol ${usd(pair.vol)} · liq ${usd(pair.liq)}</span>
                  </div>
                  ${href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">Dex</a>` : ''}
                </li>`;
              })
              .join('')}</ul>`
          : '<p class="hint">DexScreener search. Solana pairs are the ones that matter for a launch.</p>'
      }
    </section>`;
}

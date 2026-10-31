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

function coinLabel(token) {
  const symbol = String(token.symbol || '').replace(/^\$/, '').trim();
  const name = String(token.name || '').trim();
  const symbolOk = symbol && symbol.toLowerCase() !== 'coin';
  const nameOk = name && name.toLowerCase() !== 'coin';
  if (symbolOk) return `$${symbol}`;
  if (nameOk) return name;
  if (token.mint) return `${token.mint.slice(0, 4)}…${token.mint.slice(-4)}`;
  return 'coin';
}

function renderPrints(root) {
  const scroll = root.scrollTop;
  const tokens = state.radar?.tokens || [];
  const koth = state.radar?.koth;
  const live = state.radar?.connected;
  const narratives = state.radar?.narratives || [];
  root.innerHTML = `
    <header class="panel-head">
      <h2>pump.fun</h2>
      <span class="pill ${live ? 'ok' : 'bad'}">${live ? 'signal' : 'socket down'}</span>
    </header>
    <p class="hint">Traction only: graduated, near graduation, king of the hill, or a real burst of buys. Fresh mints stay off this list.</p>
    ${
      narratives.length
        ? `<section class="narratives">
            <h3>Narrative clusters</h3>
            <ul>${narratives
              .map((row) => {
                const href = safeUrl(row.url);
                const label = esc(row.label);
                return `<li>${href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : `<strong>${label}</strong>`}<span>× ${row.count}</span></li>`;
              })
              .join('')}</ul>
          </section>`
        : ''
    }
    ${
      koth
        ? `<a class="koth" href="${safeUrl(koth.url) || '#'}" target="_blank" rel="noopener noreferrer">
            <span>King of the hill</span>
            <strong>${esc(koth.symbol ? `$${koth.symbol}` : koth.title || koth.name || '')}</strong>
            ${koth.marketCapSol ? `<em>${Number(koth.marketCapSol).toFixed(1)} SOL</em>` : ''}
          </a>`
        : ''
    }
    ${
      tokens.length
        ? `<ol class="prints">${tokens
            .map((token) => {
              const href = safeUrl(token.url);
              const pump = safeUrl(token.pumpUrl);
              const dex = safeUrl(token.dexUrl);
              const name = esc(coinLabel(token));
              const kind =
                token.kind === 'graduation' ? 'graduated' : token.kind === 'koth' ? 'koth' : token.kind === 'near-grad' ? 'near grad' : 'moving';
              return `<li>
                <time>${ago(token.ts)}</time>
                <strong>${href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a>` : name}</strong>
                <span>${esc(token.name && token.name.toLowerCase() !== 'coin' ? token.name : '')}</span>
                <em>${token.marketCapSol ? `${Number(token.marketCapSol).toFixed(1)} SOL` : ''}</em>
                <b class="grad">${kind}</b>
                ${pump ? `<a href="${pump}" target="_blank" rel="noopener noreferrer">pump</a>` : ''}
                ${dex ? `<a href="${dex}" target="_blank" rel="noopener noreferrer">dex</a>` : ''}
              </li>`;
            })
            .join('')}</ol>`
        : `<div class="empty tight">
            <h2>${live ? 'No coin is clearing the bar' : 'pump.fun socket is reconnecting'}</h2>
            <p>${esc(state.radar?.error || 'Creates are counted for narratives. A row appears after graduation, king of the hill, a market-cap move, or a burst of buys.')}</p>
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
                const dex = safeUrl(pair.dexUrl);
                const pump = safeUrl(pair.pumpUrl);
                const change = Number(pair.change);
                const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
                const title = href
                  ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(pair.name)}</a>`
                  : esc(pair.name);
                return `<li>
                  <div>
                    <strong>${title}</strong>
                    <span>${esc(pair.chain || '')} · ${esc(pair.dex || '')}</span>
                  </div>
                  <div class="pair-nums">
                    <b>${pair.price != null ? `$${Number(pair.price).toPrecision(3)}` : '—'}</b>
                    <span class="${cls}">${Number.isFinite(change) ? `${change.toFixed(1)}%` : ''}</span>
                    <span>vol ${usd(pair.vol)} · liq ${usd(pair.liq)}</span>
                  </div>
                  ${pump && pump !== href ? `<a href="${pump}" target="_blank" rel="noopener noreferrer">pump</a>` : ''}
                  ${dex && dex !== href ? `<a href="${dex}" target="_blank" rel="noopener noreferrer">Dex</a>` : ''}
                </li>`;
              })
              .join('')}</ul>`
          : '<p class="hint">DexScreener search. Solana pairs are the ones that matter for a launch.</p>'
      }
    </section>`;
}

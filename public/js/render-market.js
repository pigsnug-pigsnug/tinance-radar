import { pct, usd } from './format.js';
import { state } from './state.js';

const previous = new Map();
const flashes = new Map();
let lastHtml = '';

function chip({ key, label, value, delta, hint }) {
  const prior = previous.get(key);
  if (prior != null && prior !== value) {
    flashes.set(key, {
      dir: numeric(value) >= numeric(prior) ? 'flash-up' : 'flash-down',
      until: Date.now() + 700,
    });
  }
  previous.set(key, value);
  const active = flashes.get(key);
  const flash = active && active.until > Date.now() ? active.dir : '';
  const deltaClass = Number(delta) > 0 ? 'up' : Number(delta) < 0 ? 'down' : '';
  const deltaText = pct(delta);
  return `<div class="mkt ${flash}" data-key="${key}">
    <span class="mkt-k">${label}</span>
    <span class="mkt-v">${value}</span>
    ${deltaText ? `<span class="mkt-d ${deltaClass}">${deltaText}</span>` : ''}
    ${hint ? `<span class="mkt-h">${hint}</span>` : ''}
  </div>`;
}

function numeric(value) {
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function renderMarket() {
  const root = document.getElementById('market');
  if (!root) return;
  if (!state.market) {
    if (lastHtml !== 'wait') {
      lastHtml = 'wait';
      root.innerHTML = '<div class="mkt wait">Reading DEX volume…</div>';
    }
    return;
  }
  const sol = state.market.sol || {};
  const chips = [
    chip({
      key: 'sol-px',
      label: 'SOL',
      value: sol.usd != null ? `$${Number(sol.usd).toFixed(2)}` : '—',
      delta: sol.change24h,
    }),
  ];
  for (const chain of state.market.chains || []) {
    chips.push(
      chip({
        key: chain.id,
        label: chain.label,
        value: usd(chain.volume24h),
        delta: chain.change,
        hint: 'DEX',
      }),
    );
  }
  const html = chips.join('');
  if (html === lastHtml) return;
  lastHtml = html;
  root.innerHTML = html;
}

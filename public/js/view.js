import { istClock } from './format.js';
import { fillHealth, liveCount } from './render-health.js';
import { renderDesk } from './render-desk.js';
import { renderFeed } from './render-pulse.js';
import { renderSolana } from './render-solana.js';
import { renderWrite } from './render-write.js';
import { state } from './state.js';

let frame = 0;
let queued = false;
let held = false;
const pending = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => {
    held = true;
  });
  const release = () => {
    setTimeout(() => {
      held = false;
      if (pending.size) scheduleRender();
    }, 0);
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
}

function isEditing(root) {
  const active = document.activeElement;
  return Boolean(active && root?.contains(active) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
}

export function render({ force = false, scope = 'all' } = {}) {
  try {
    renderView({ force });
  } catch (error) {
    state.banner = error?.message || 'The desk hit a render error';
    paintMeta();
  }
}

function renderView({ force = false } = {}) {
  document.documentElement.dataset.theme = state.tab === 'sol' ? 'sol' : 'night';
  paintChrome();
  const stage = document.getElementById('stage');
  const rail = document.getElementById('rail');
  const skipStage = !force && isEditing(stage);
  queued = skipStage;
  if (!skipStage) {
    if (state.tab === 'desk') renderDesk(stage);
    else if (state.tab === 'sol') renderSolana(stage);
    else if (state.tab === 'write') renderWrite(stage);
    else renderFeed(stage);
  }
  if (rail) rail.hidden = true;
  paintMeta();
  const health = document.getElementById('health-dialog');
  if (health?.open) fillHealth();
  const logout = document.getElementById('logout-form');
  if (logout) logout.hidden = !state.config.auth;
}

export function scheduleRender(scope = 'all') {
  pending.add(scope);
  if (held) return;
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const scopes = new Set(pending);
    pending.clear();
    if (scopes.has('all') || scopes.size === 0) render();
    else render();
  });
}

export function renderIfQueued() {
  if (!queued) return;
  queued = false;
  scheduleRender();
}

function paintChrome() {
  document.querySelectorAll('[data-action="tab"]').forEach((button) => {
    const on = button.dataset.id === state.tab;
    button.setAttribute('aria-current', on ? 'page' : 'false');
  });
  const clock = document.getElementById('clock');
  if (clock && !clock.textContent) {
    clock.textContent = `${istClock()} IST`;
    clock.dateTime = new Date().toISOString();
  }
}

function paintMeta() {
  const meta = document.getElementById('meta');
  if (!meta) return;
  const { ok, total } = liveCount();
  const link = state.stream ? 'live' : 'reconnecting';
  const auth = state.config.auth ? 'auth on' : 'auth off';
  meta.textContent = `${state.items.size} on the tape · ${ok}/${total || '–'} sources ${link} · ${state.config.persistence} · ${auth} · multi ${state.config.multiWindowH}h / ${state.config.minSources}${state.banner ? ` · ${state.banner}` : ''}`;
}

export function tickClock() {
  const clock = document.getElementById('clock');
  if (!clock) return;
  clock.textContent = `${istClock()} IST`;
  clock.dateTime = new Date().toISOString();
}

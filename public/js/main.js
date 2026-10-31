import { api } from './api.js';
import { armAudioOnGesture } from './alerts.js';
import { bindActions } from './actions.js';
import { connectStream } from './sse.js';
import { applyBootstrap, state } from './state.js';
import { render, renderIfQueued, scheduleRender, tickClock } from './view.js';

armAudioOnGesture();
bindActions();

document.getElementById('q')?.addEventListener('input', (event) => {
  state.query = event.target.value;
  scheduleRender();
});

let notesTimer = 0;
document.addEventListener('input', (event) => {
  if (event.target.id !== 'desk-notes') return;
  state.desk.notes = event.target.value;
  const status = document.getElementById('notes-status');
  if (status) status.textContent = 'Saving…';
  clearTimeout(notesTimer);
  notesTimer = setTimeout(async () => {
    try {
      await api('/api/desk/notes', { method: 'PUT', body: { notes: state.desk.notes } });
      if (status?.isConnected) status.textContent = 'Saved';
    } catch (error) {
      if (status?.isConnected) status.textContent = error.message;
    }
  }, 450);
});

document.addEventListener('focusout', () => {
  setTimeout(renderIfQueued, 0);
});

window.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (event.key === '/' && !typing) {
    event.preventDefault();
    document.getElementById('q')?.focus();
    return;
  }
  if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
  const tabs = { 1: 'pulse', 2: 'radar', 3: 'sol', 4: 'desk' };
  if (tabs[event.key]) {
    state.tab = tabs[event.key];
    state.platform = 'all';
    render({ force: true });
  }
});

setInterval(tickClock, 1000);
tickClock();

async function boot() {
  try {
    const data = await api('/api/state');
    applyBootstrap(data);
    render({ force: true });
    connectStream((kind) => scheduleRender(kind || 'all'));
  } catch (error) {
    state.error = error.message;
    state.ready = true;
    const stage = document.getElementById('stage');
    if (stage) {
      stage.innerHTML = `<div class="empty"><h2>The desk did not open</h2><p>${error.message}</p></div>`;
    }
  }
}

boot();

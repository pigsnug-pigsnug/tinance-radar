import { ago, esc, platform } from './format.js';
import { state } from './state.js';

export function liveCount() {
  const ok = state.health.filter((source) => source.state === 'ok').length;
  return { ok, total: state.health.length };
}

export function fillHealth() {
  const dialog = document.getElementById('health-dialog');
  if (!dialog) return;
  const rows = [...state.health].sort((a, b) => a.name.localeCompare(b.name));
  dialog.innerHTML = `
    <form method="dialog">
      <header class="panel-head">
        <h2 id="health-title">Sources</h2>
        <button type="submit" value="close">Close</button>
      </header>
      <p class="hint">Each adapter keeps its last good pull. A stale row means the circuit is serving that snapshot while it backs off. Persistence: ${esc(state.config.persistence)}. Auth: ${state.config.auth ? 'on' : 'off'}.</p>
      <ul class="health-list">
        ${rows
          .map((source) => {
            const cls = source.state === 'ok' ? 'ok' : source.state === 'open' ? 'wait' : source.state === 'idle' ? 'idle' : 'bad';
            return `<li>
              <span class="pill ${cls}">${esc(source.state || 'idle')}</span>
              <strong>${esc(platform(source.name))}</strong>
              <span>${source.count ? `${source.count} last` : ''}${source.stale ? ' · stale' : ''}</span>
              <span>${source.lastOk ? ago(source.lastOk) : 'never'}</span>
              <em>${esc(source.lastError || source.detail || '')}</em>
            </li>`;
          })
          .join('') || '<li>No sources registered yet.</li>'}
      </ul>
    </form>`;
}

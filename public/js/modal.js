import { api } from './api.js';
import { esc } from './format.js';
import { itemById, state, touch } from './state.js';
import { buildTweets } from './tweetgen.js';

let drafts = [];

function dialog() {
  return document.getElementById('modal');
}

export function closeModal() {
  const node = dialog();
  if (node?.open) node.close();
}

export function openNote(id) {
  const item = itemById(id);
  if (!item) return;
  const existing = state.notes.get(id)?.text || '';
  const node = dialog();
  node.innerHTML = `
    <form method="dialog" class="sheet">
      <header class="panel-head">
        <h2>Note</h2>
        <button type="submit" value="close">Close</button>
      </header>
      <p class="hint">${esc(item.title)}</p>
      <textarea id="note-text" rows="6" maxlength="2000">${esc(existing)}</textarea>
      <div class="sheet-actions">
        <button type="button" data-action="note-save" data-id="${esc(id)}">Save note</button>
      </div>
    </form>`;
  node.showModal();
}

export async function saveNote(id) {
  const text = document.getElementById('note-text')?.value || '';
  const item = itemById(id);
  const result = await api(`/api/notes/${encodeURIComponent(id)}`, { method: 'PUT', body: { text, item } });
  if (result.note) state.notes.set(id, result.note);
  else state.notes.delete(id);
  touch();
  closeModal();
}

export function openTweet(id) {
  const item = itemById(id);
  if (!item) return;
  const topic = state.topics.get(item.topicId);
  drafts = buildTweets(item, topic);
  const node = dialog();
  node.innerHTML = `
    <form method="dialog" class="sheet">
      <header class="panel-head">
        <h2>Five angles</h2>
        <button type="submit" value="close">Close</button>
      </header>
      <p class="hint">${esc(item.title)}</p>
      ${drafts
        .map(
          (draft, index) => `<section class="draft">
            <div class="draft-top"><strong>${esc(draft.angle)}</strong><button type="button" data-action="copy" data-id="${index}">Copy</button></div>
            <pre>${esc(draft.text)}</pre>
          </section>`,
        )
        .join('')}
    </form>`;
  node.showModal();
}

export async function copyDraft(index) {
  const text = drafts[Number(index)]?.text || '';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  const button = document.querySelector(`[data-action="copy"][data-id="${index}"]`);
  if (button) {
    button.textContent = 'Copied';
    setTimeout(() => {
      if (button.isConnected) button.textContent = 'Copy';
    }, 1200);
  }
}

export async function openLaunch(id) {
  const item = itemById(id);
  if (!item) return;
  const node = dialog();
  node.innerHTML = `<form method="dialog" class="sheet"><header class="panel-head"><h2>Launch</h2></header><p class="hint">Logging the score…</p></form>`;
  node.showModal();
  const result = await api('/api/launches', { method: 'POST', body: { item } });
  const launch = result.launch;
  state.launches = [launch, ...state.launches.filter((row) => row.id !== launch.id)];
  touch();
  node.innerHTML = `
    <form method="dialog" class="sheet">
      <header class="panel-head">
        <h2>Launch logged</h2>
        <button type="submit" value="close">Close</button>
      </header>
      <p class="lede">${esc(launch.title)}</p>
      <dl class="score-grid">
        <div><dt>Topic</dt><dd>${esc(launch.topicLabel || '—')}</dd></div>
        <div><dt>Score</dt><dd>${Number(launch.score || 0).toFixed(1)}</dd></div>
        <div><dt>Velocity</dt><dd>${Math.round(launch.velocity || 0)}/h</dd></div>
        <div><dt>Sources</dt><dd>${launch.cross || 0}${launch.multi ? ' · multi' : ''}</dd></div>
      </dl>
      <label>Note for the log
        <textarea id="launch-note" rows="3" maxlength="2000">${esc(launch.note || '')}</textarea>
      </label>
      <label>Outcome
        <select id="launch-outcome">
          <option value="pending" selected>Pending</option>
          <option value="worked">Worked</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </label>
      <div class="sheet-actions">
        <button type="button" data-action="launch-save" data-id="${esc(launch.id)}">Update log</button>
      </div>
    </form>`;
}

export async function saveLaunch(id) {
  const note = document.getElementById('launch-note')?.value || '';
  const outcome = document.getElementById('launch-outcome')?.value || 'pending';
  const result = await api(`/api/launches/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { note, outcome },
  });
  state.launches = state.launches.map((row) => (row.id === id ? result.launch : row));
  touch();
  closeModal();
}

export function showWhy(id, anchor) {
  const item = itemById(id);
  const topic = item && state.topics.get(item.topicId);
  const pop = document.getElementById('pop');
  if (!topic || !pop) return;
  const hours = topic.windowH || state.config.multiWindowH || 6;
  pop.innerHTML = `<strong>${esc(topic.label)}</strong>
    <p>${topic.multi ? 'Multi-signal.' : 'Building.'} ${topic.cross} source${topic.cross === 1 ? '' : 's'} inside ${hours}h${topic.sources?.length ? `: ${esc(topic.sources.join(', '))}` : ''}.</p>
    <p>Phrases: ${esc((topic.phrases || []).join(', ') || '—')}</p>`;
  pop.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const width = 280;
  pop.style.top = `${Math.min(window.innerHeight - 140, rect.bottom + 8)}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
}

import { esc, safeUrl } from './format.js';
import { state } from './state.js';

function watchBlock() {
  return `<section class="panel">
    <header class="panel-head"><h2>Watch words</h2><p>A new hit pings once, on any tab, after you have clicked the page.</p></header>
    <form class="watch-form" data-action="watch-add">
      <input id="watch-input" type="text" maxlength="40" placeholder="bonk, raccoon, hack…" />
      <button type="submit" class="big">Add</button>
    </form>
    <ul class="watch-list">
      ${state.watchwords
        .map(
          (word) =>
            `<li><span>${esc(word)}</span><button type="button" data-action="watch-remove" data-id="${esc(word)}" aria-label="Remove ${esc(word)}">×</button></li>`,
        )
        .join('') || '<li class="quiet">None yet</li>'}
    </ul>
  </section>`;
}

const OUTCOMES = [
  ['pending', 'Pending'],
  ['worked', 'Worked'],
  ['failed', 'Failed'],
  ['skipped', 'Skipped'],
];

function editingNotes() {
  return document.activeElement?.id === 'desk-notes';
}

export function renderDesk(stage) {
  const notesDraft = editingNotes() ? document.activeElement.value : state.desk.notes || '';
  const scroll = stage.scrollTop;
  stage.innerHTML = `
    <div class="desk">
      ${watchBlock()}
      <section class="panel desk-launches">
        <header class="panel-head">
          <h2>Launch log</h2>
          <p>Score is frozen when the launch modal opens. Mark the outcome later and see which band you actually trust.</p>
        </header>
        ${
          state.launches.length
            ? `<div class="table-wrap"><table>
                <thead><tr><th>When</th><th>Title</th><th>Topic</th><th>Score</th><th>Vel</th><th>Outcome</th><th></th></tr></thead>
                <tbody>
                  ${state.launches
                    .map((launch) => {
                      const href = safeUrl(launch.url);
                      const when = new Date(launch.openedAt).toLocaleString('en-GB', { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                      return `<tr>
                        <td class="mono">${esc(when)}</td>
                        <td>${href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(launch.title)}</a>` : esc(launch.title)}</td>
                        <td>${esc(launch.topicLabel || '—')}${launch.multi ? ' · multi' : ''}</td>
                        <td class="mono">${Number(launch.score || 0).toFixed(0)}</td>
                        <td class="mono">${Math.round(launch.velocity || 0)}/h</td>
                        <td>
                          <select data-action="outcome" data-id="${esc(launch.id)}">
                            ${OUTCOMES.map(([id, label]) => `<option value="${id}" ${launch.outcome === id ? 'selected' : ''}>${label}</option>`).join('')}
                          </select>
                        </td>
                        <td><button type="button" data-action="launch-delete" data-id="${esc(launch.id)}">Delete</button></td>
                      </tr>
                      ${launch.note || launch.outcomeNote ? `<tr class="sub"><td></td><td colspan="6">${esc(launch.outcomeNote || launch.note)}</td></tr>` : ''}`;
                    })
                    .join('')}
                </tbody>
              </table></div>`
            : `<div class="empty tight"><h2>No launches logged</h2><p>Open Launch on any pulse item. The topic score at that moment is written here and does not move.</p></div>`
        }
      </section>
      <div class="desk-grid">
        <section class="panel">
          <header class="panel-head"><h2>Wallets</h2><p>Public addresses only. A 64-character hex string is refused.</p></header>
          <form class="stack-form" data-action="wallet-add">
            <input id="wallet-label" placeholder="Label" maxlength="60" />
            <input id="wallet-address" placeholder="Address" maxlength="90" required />
            <select id="wallet-chain">
              <option value="solana">Solana</option>
              <option value="ethereum">Ethereum</option>
              <option value="bnb">BNB</option>
              <option value="base">Base</option>
            </select>
            <input id="wallet-note" placeholder="Note" maxlength="200" />
            <button type="submit">Add wallet</button>
          </form>
          <ul class="plain-list">
            ${state.desk.wallets
              .map(
                (wallet) => `<li>
                  <div><strong>${esc(wallet.label)}</strong> <span class="plat">${esc(wallet.chain)}</span></div>
                  <code>${esc(wallet.address)}</code>
                  ${wallet.note ? `<p>${esc(wallet.note)}</p>` : ''}
                  <button type="button" data-action="wallet-delete" data-id="${esc(wallet.id)}">Remove</button>
                </li>`,
              )
              .join('') || '<li class="quiet">No wallets</li>'}
          </ul>
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Bills</h2><p>RPC, domains, the stuff that comes due while you are watching a chart.</p></header>
          <form class="stack-form" data-action="bill-add">
            <input id="bill-name" placeholder="Name" maxlength="80" required />
            <input id="bill-amount" placeholder="Amount" maxlength="24" />
            <input id="bill-due" type="date" />
            <button type="submit">Add bill</button>
          </form>
          <ul class="plain-list">
            ${state.desk.bills
              .map(
                (bill) => `<li class="${bill.paid ? 'paid' : ''}">
                  <label><input type="checkbox" data-action="bill-paid" data-id="${esc(bill.id)}" ${bill.paid ? 'checked' : ''} /> ${esc(bill.name)}</label>
                  <span class="mono">${esc(bill.amount)} ${esc(bill.currency || 'USD')} ${bill.due ? `· due ${esc(bill.due)}` : ''}</span>
                  <button type="button" data-action="bill-delete" data-id="${esc(bill.id)}">Remove</button>
                </li>`,
              )
              .join('') || '<li class="quiet">No bills</li>'}
          </ul>
        </section>
      </div>
      <section class="panel">
        <header class="panel-head"><h2>Notes</h2><p>Scratch space for the shift. Saves on its own.</p></header>
        <textarea id="desk-notes" rows="8" maxlength="20000" placeholder="What you are waiting on, who you owe, what score you will actually launch at.">${esc(notesDraft)}</textarea>
        <p class="hint" id="notes-status"></p>
      </section>
    </div>`;
  stage.scrollTop = scroll;
  if (editingNotes()) {
    const box = document.getElementById('desk-notes');
    if (box) {
      box.focus();
      const end = box.value.length;
      box.setSelectionRange(end, end);
    }
  }
}

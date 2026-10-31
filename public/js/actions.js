import { api } from './api.js';
import { closeModal, copyDraft, openLaunch, openNote, openTweet, saveLaunch, saveNote, showWhy } from './modal.js';
import { grokImageUrl, grokWriteUrl } from './render-write.js';
import { fillHealth } from './render-health.js';
import { itemById, state, touch } from './state.js';
import { render } from './view.js';

async function guard(fn) {
  try {
    await fn();
  } catch (error) {
    if (error.message === 'auth') return;
    state.banner = error.message;
    touch();
    render({ force: true });
  }
}

const handlers = {
  tab(id) {
    state.tab = id;
    state.platform = 'all';
    state.banner = '';
    touch();
    render({ force: true });
  },
  platform(id) {
    state.platform = id;
    touch();
    render({ force: true });
  },
  lane(id) {
    state.lane = id;
    touch();
    render({ force: true });
  },
  'copy-tweet'(id) {
    const card = (state.cards || []).find((row) => row.id === id);
    const text = card?.tweet || '';
    if (!text) return;
    return navigator.clipboard?.writeText(text).catch(() => {});
  },
  'open-grok'() {
    const text = document.getElementById('grok-seed')?.value || '';
    window.open(grokWriteUrl(text), '_blank', 'noopener');
  },
  'open-imagine'() {
    const text = document.getElementById('grok-seed')?.value || '';
    window.open(grokImageUrl(text), '_blank', 'noopener');
  },
  mode(id) {
    state.mode = id;
    touch();
    render({ force: true });
  },
  search(id) {
    state.query = id;
    const input = document.getElementById('q');
    if (input) input.value = id;
    if (state.tab === 'desk') state.tab = 'pulse';
    touch();
    render({ force: true });
  },
  why(id, el) {
    showWhy(id, el);
  },
  star(id) {
    return guard(async () => {
      const item = itemById(id);
      if (!item) return;
      const result = await api('/api/stars', { method: 'POST', body: { item } });
      if (result.starred) state.stars.set(id, result.star);
      else state.stars.delete(id);
      touch();
      render({ force: true });
    });
  },
  save(id) {
    return guard(async () => {
      const item = itemById(id);
      if (!item) return;
      const result = await api('/api/saves', { method: 'POST', body: { item } });
      if (result.saved) state.saves.set(id, result.save);
      else state.saves.delete(id);
      touch();
      render({ force: true });
    });
  },
  note(id) {
    openNote(id);
  },
  tweet(id) {
    openTweet(id);
  },
  launch(id) {
    return guard(async () => {
      try {
        await openLaunch(id);
      } catch (error) {
        closeModal();
        throw error;
      }
    });
  },
  copy(id) {
    return copyDraft(id);
  },
  'note-save'(id) {
    return guard(() => saveNote(id).then(() => render({ force: true })));
  },
  'launch-save'(id) {
    return guard(() => saveLaunch(id).then(() => render({ force: true })));
  },
  health() {
    const dialog = document.getElementById('health-dialog');
    fillHealth();
    dialog.showModal();
  },
  sweep(_id, el) {
    return guard(async () => {
      const button = el?.id === 'sweep' ? el : document.getElementById('sweep');
      button.disabled = true;
      button.textContent = 'Sweeping';
      try {
        await api('/api/refresh', { method: 'POST', body: {} });
        state.banner = '';
      } finally {
        button.disabled = false;
        button.textContent = 'Sweep';
        render();
      }
    });
  },
  async 'watch-add'() {
    const input = document.getElementById('watch-input');
    const word = input?.value.trim();
    if (!word) return;
    input.value = '';
    return guard(async () => {
      const words = [...state.watchwords, word];
      const result = await api('/api/watchwords', { method: 'PUT', body: { words } });
      state.watchwords = result.watchwords;
      touch();
      render({ force: true });
    });
  },
  'watch-remove'(word) {
    return guard(async () => {
      const words = state.watchwords.filter((item) => item !== word);
      const result = await api('/api/watchwords', { method: 'PUT', body: { words } });
      state.watchwords = result.watchwords;
      touch();
      render({ force: true });
    });
  },
  outcome(id, el) {
    return guard(async () => {
      const result = await api(`/api/launches/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { outcome: el.value },
      });
      state.launches = state.launches.map((row) => (row.id === id ? result.launch : row));
      touch();
      render({ force: true });
    });
  },
  'launch-delete'(id) {
    if (!confirm('Remove this launch from the log?')) return;
    return guard(async () => {
      await api(`/api/launches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.launches = state.launches.filter((row) => row.id !== id);
      touch();
      render({ force: true });
    });
  },
  'wallet-add'() {
    return guard(async () => {
      const wallet = await api('/api/desk/wallets', {
        method: 'POST',
        body: {
          label: document.getElementById('wallet-label')?.value,
          address: document.getElementById('wallet-address')?.value,
          chain: document.getElementById('wallet-chain')?.value,
          note: document.getElementById('wallet-note')?.value,
        },
      });
      state.desk.wallets.unshift(wallet.wallet);
      state.banner = '';
      touch();
      render({ force: true });
    });
  },
  'wallet-delete'(id) {
    return guard(async () => {
      await api(`/api/desk/wallets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.desk.wallets = state.desk.wallets.filter((row) => row.id !== id);
      touch();
      render({ force: true });
    });
  },
  'bill-add'() {
    return guard(async () => {
      const bill = await api('/api/desk/bills', {
        method: 'POST',
        body: {
          name: document.getElementById('bill-name')?.value,
          amount: document.getElementById('bill-amount')?.value,
          due: document.getElementById('bill-due')?.value,
        },
      });
      state.desk.bills.unshift(bill.bill);
      touch();
      render({ force: true });
    });
  },
  'bill-paid'(id, el) {
    return guard(async () => {
      const result = await api(`/api/desk/bills/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { paid: el.checked },
      });
      state.desk.bills = state.desk.bills.map((row) => (row.id === id ? result.bill : row));
      touch();
      render({ force: true });
    });
  },
  'bill-delete'(id) {
    return guard(async () => {
      await api(`/api/desk/bills/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.desk.bills = state.desk.bills.filter((row) => row.id !== id);
      touch();
      render({ force: true });
    });
  },
  'coin-check'() {
    return guard(async () => {
      const q = document.getElementById('coin-q')?.value.trim() || '';
      if (q.length < 2) {
        state.coin = { ...state.coin, q, error: 'Type at least two characters.', loading: false };
        render({ force: true });
        return;
      }
      state.coin = { q, pairs: [], error: '', loading: true };
      render({ force: true });
      const data = await api(`/api/coin?q=${encodeURIComponent(q)}`);
      state.coin = {
        q,
        pairs: data.pairs || [],
        error: data.pairs?.length ? '' : 'No pairs for that query.',
        loading: false,
      };
      render({ force: true });
    });
  },
};

export function bindActions() {
  document.addEventListener('click', (event) => {
    const pop = document.getElementById('pop');
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    const button = target.closest('[data-action]');
    if (pop && !pop.hidden && !target.closest('#pop') && button?.dataset.action !== 'why') {
      pop.hidden = true;
    }
    if (!button || (button.closest('form[data-action]') && button.type === 'submit')) return;
    if (button.tagName === 'SELECT' || button.matches('input[type="checkbox"]')) return;
    const fn = handlers[button.dataset.action];
    if (!fn) return;
    event.preventDefault();
    fn(button.dataset.id || '', button);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('form[data-action]') || (event.target?.dataset?.action ? event.target : null);
    if (!form?.dataset?.action) return;
    event.preventDefault();
    handlers[form.dataset.action]?.('', form);
  });

  document.addEventListener('change', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const fn = handlers[el.dataset.action];
    if (!fn) return;
    fn(el.dataset.id || '', el);
  });

  document.getElementById('modal')?.addEventListener('close', () => {
    closeModal();
    render();
  });
}

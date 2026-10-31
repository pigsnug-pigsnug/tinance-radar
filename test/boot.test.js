import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFilePersist } from '../server/persist.js';
import { buildApp } from '../server/app.js';
import { createBus } from '../server/bus.js';
import { requestIsSecure } from '../server/auth.js';

test('a corrupt state file falls back to the backup', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tinance-'));
  await writeFile(path.join(dir, 'state.json'), '{not json');
  await writeFile(
    path.join(dir, 'state.json.bak'),
    JSON.stringify({ user: { desk: { notes: 'kept' } }, snapshot: { items: [] } }),
  );
  const persist = createFilePersist(dir);
  const data = await persist.load();
  assert.equal(data.user.desk.notes, 'kept');
});

test('a missing state file boots empty instead of throwing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tinance-'));
  const persist = createFilePersist(dir);
  assert.equal(await persist.load(), null);
});

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

test('health answers on a fresh process with no snapshot', async () => {
  const app = buildApp({
    store: {
      bootstrap: () => ({ items: [], topics: [], radar: { tokens: [] }, config: {} }),
    },
    bus: createBus(),
    ingest: { health: () => [], async refresh() { return { ok: true }; } },
  });
  const server = await listen(app);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  } finally {
    server.close();
  }
});

test('secure cookies follow the first forwarded proto, including a proxy chain', () => {
  assert.equal(requestIsSecure({ secure: false, headers: { 'x-forwarded-proto': 'https' } }), true);
  assert.equal(requestIsSecure({ secure: false, headers: { 'x-forwarded-proto': 'https,http' } }), true);
  assert.equal(requestIsSecure({ secure: false, headers: { 'x-forwarded-proto': 'http' } }), false);
});

test('login behind an https proxy sets a Secure cookie and the api accepts it', async () => {
  const previous = process.env.AUTH_PASSWORD;
  process.env.AUTH_PASSWORD = 'desk-pass';
  const app = buildApp({
    store: {
      bootstrap: () => ({ ok: true, items: [], topics: [] }),
    },
    bus: createBus(),
    ingest: { health: () => [], async refresh() { return { ok: true }; } },
  });
  const server = await listen(app);
  try {
    const { port } = server.address();
    const login = await fetch(`http://127.0.0.1:${port}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-proto': 'https,http' },
      body: 'password=desk-pass',
      redirect: 'manual',
    });
    const cookie = login.headers.get('set-cookie') || '';
    assert.match(cookie, /Secure/);
    assert.match(cookie, /tr_session=/);
    const api = await fetch(`http://127.0.0.1:${port}/api/state`, {
      headers: { cookie: cookie.split(';')[0], 'x-forwarded-proto': 'https' },
    });
    assert.equal(api.status, 200);
  } finally {
    server.close();
    if (previous == null) delete process.env.AUTH_PASSWORD;
    else process.env.AUTH_PASSWORD = previous;
  }
});

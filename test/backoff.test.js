import assert from 'node:assert/strict';
import test from 'node:test';
import { nextDelay } from '../server/backoff.js';
import { createRunner } from '../server/runner.js';

test('backoff doubles until the cap', () => {
  assert.equal(nextDelay(1, 1000, 8000, () => 0), 1000);
  assert.equal(nextDelay(2, 1000, 8000, () => 0), 2000);
  assert.equal(nextDelay(3, 1000, 8000, () => 0), 4000);
  assert.equal(nextDelay(6, 1000, 8000, () => 0), 8000);
});

test('the circuit opens, serves the last good snapshot, and skips calls while open', async () => {
  let calls = 0;
  const runner = createRunner(
    {
      name: 'fake',
      intervalMs: 1000,
      async fetch() {
        calls += 1;
        if (calls === 1) return [{ title: 'kept' }];
        throw new Error('down');
      },
    },
    { failureThreshold: 3, baseBackoffMs: 1000, maxBackoffMs: 8000, rand: () => 0, timeoutMs: 50 },
  );

  const ok = await runner.tick(1_000);
  assert.equal(ok.stale, false);
  assert.equal(ok.items[0].title, 'kept');

  const firstFail = await runner.tick(2_000);
  assert.equal(firstFail.stale, true);
  assert.equal(firstFail.items[0].title, 'kept');
  assert.equal(runner.state, 'error');
  assert.equal(runner.backoffMs, 1000);

  await runner.tick(3_000);
  await runner.tick(4_000);
  assert.equal(runner.state, 'open');
  assert.ok(runner.openUntil > 4_000);

  const skippedAt = calls;
  const skipped = await runner.tick(runner.openUntil - 1);
  assert.equal(skipped.skipped, true);
  assert.equal(calls, skippedAt);
  assert.equal(skipped.items[0].title, 'kept');

  await runner.tick(runner.openUntil + 1);
  assert.equal(calls, skippedAt + 1);
});

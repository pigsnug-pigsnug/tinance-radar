import assert from 'node:assert/strict';
import test from 'node:test';
import { addHit, computeKinetics, topicScore } from '../server/velocity.js';

test('velocity is the change in mentions per hour and acceleration is the change in velocity', () => {
  const now = 10_000_000_000;
  const buckets = {};
  addHit(buckets, now - 150 * 60 * 1000, 2);
  addHit(buckets, now - 90 * 60 * 1000, 2);
  addHit(buckets, now - 20 * 60 * 1000, 10);
  const kinetics = computeKinetics(buckets, now);
  assert.equal(kinetics.h0, 10);
  assert.equal(kinetics.h1, 2);
  assert.equal(kinetics.h2, 2);
  assert.equal(kinetics.velocity, 8);
  assert.equal(kinetics.acceleration, 8);
  assert.equal(kinetics.perHour, 10);
});

test('recency decay lowers the score and multi-source confirmation raises it', () => {
  const now = 10_000_000_000;
  const kinetics = { perHour: 4, velocity: 2, acceleration: 0 };
  const fresh = topicScore(kinetics, { cross: 1, multi: false, lastSeen: now, now });
  const stale = topicScore(kinetics, { cross: 1, multi: false, lastSeen: now - 10 * 60 * 60 * 1000, now });
  const multi = topicScore(kinetics, { cross: 3, multi: true, lastSeen: now, now });
  assert.ok(fresh > stale);
  assert.ok(multi > fresh);
});

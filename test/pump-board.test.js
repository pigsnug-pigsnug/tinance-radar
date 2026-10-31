import assert from 'node:assert/strict';
import test from 'node:test';
import { createPumpBoard } from '../server/pump-board.js';

const mint = (n) => (`B${'abcdefghij'[n]}bonk` + 'a'.repeat(40)).slice(0, 44);
const NOW = 1_700_000_000_000;

test('fresh creates stay off the tape and repeated names become a narrative', () => {
  const board = createPumpBoard({ nameRepeat: 3, minMcapSol: 45 });
  for (let i = 0; i < 4; i += 1) {
    board.create({ mint: mint(i), name: 'Mochi Cat', symbol: 'MOCHI', marketCapSol: 28 }, NOW + i);
  }
  const snap = board.snapshot(NOW + 4);
  assert.equal(snap.tokens.length, 0);
  assert.equal(snap.narratives.length, 1);
  assert.equal(snap.narratives[0].label, 'MOCHI');
  assert.equal(snap.narratives[0].count, 4);
  assert.match(snap.narratives[0].url, /^https:\/\/gmgn\.ai\/sol\/token\//);
});

test('graduation, market-cap move, and buy bursts surface once per name', () => {
  const board = createPumpBoard({ minMcapSol: 45, nearGradSol: 70, minTrades: 3, minBuySol: 5 });
  const quiet = mint(1);
  const moved = mint(2);
  const burst = mint(3);
  const grad = mint(4);
  const gradCopy = mint(5);
  board.create({ mint: quiet, name: 'Quiet', symbol: 'QUIET', marketCapSol: 28 }, NOW);
  board.create({ mint: moved, name: 'Runner', symbol: 'RUN', marketCapSol: 28 }, NOW);
  board.trade({ mint: moved, txType: 'buy', solAmount: 2, marketCapSol: 52 }, NOW + 1000);
  board.create({ mint: burst, name: 'Burst', symbol: 'BURST', marketCapSol: 29 }, NOW);
  for (let i = 0; i < 3; i += 1) {
    board.trade({ mint: burst, txType: 'buy', solAmount: 2, marketCapSol: 31 }, NOW + 2000 + i);
  }
  board.graduate({ mint: grad, name: 'Done', symbol: 'DONE', marketCapSol: 85 }, NOW + 3000);
  board.graduate({ mint: gradCopy, name: 'Done', symbol: 'DONE', marketCapSol: 90 }, NOW + 4000);
  const snap = board.snapshot(NOW + 5000);
  const symbols = snap.tokens.map((token) => token.symbol).sort();
  assert.deepEqual(symbols, ['BURST', 'DONE', 'RUN']);
  const done = snap.tokens.find((token) => token.symbol === 'DONE');
  assert.equal(done.url, `https://gmgn.ai/sol/token/${done.mint}`);
  assert.match(done.pumpUrl, /^https:\/\/pump\.fun\/coin\//);
  assert.match(done.dexUrl, /^https:\/\/dexscreener\.com\/solana\//);
  assert.equal(snap.tokens.filter((token) => token.symbol === 'DONE').length, 1);
  assert.equal(snap.tokens.some((token) => token.symbol === 'QUIET'), false);
});

test('the same mint does not appear twice', () => {
  const board = createPumpBoard();
  const id = mint(9);
  board.graduate({ mint: id, name: 'Once', symbol: 'ONCE', marketCapSol: 90 }, NOW);
  board.graduate({ mint: id, name: 'Once', symbol: 'ONCE', marketCapSol: 95 }, NOW + 1);
  const snap = board.snapshot(NOW + 2);
  assert.equal(snap.tokens.length, 1);
  assert.equal(snap.tokens[0].marketCapSol, 95);
});

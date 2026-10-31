import assert from 'node:assert/strict';
import test from 'node:test';
import { hasWholeWordSolana, solanaCaptionHit, solanaInBody, snippetAround, youtubeLink } from '../server/solana-match.js';

test('Solana must be a whole word inside the body, not just the title', () => {
  assert.equal(hasWholeWordSolana('solanawallet launched'), false);
  assert.equal(hasWholeWordSolana('the Solana network halted'), true);
  assert.equal(solanaInBody('Solana price', 'Markets were quiet today.'), false);
  assert.equal(solanaInBody('Daily notes', 'A validator on Solana missed the slot.'), true);
});

test('caption hits return a timestamp and the youtube link uses it', () => {
  const hit = solanaCaptionHit([
    { start: 12, text: 'welcome back to the show' },
    { start: 95.4, text: 'and then the Solana validator just stopped' },
  ]);
  assert.equal(hit.seconds, 95);
  assert.match(hit.snippet, /Solana/);
  assert.equal(youtubeLink('abc123', 95), 'https://www.youtube.com/watch?v=abc123&t=95s');
  assert.equal(solanaCaptionHit([{ start: 4, text: 'no chain mentioned' }]), null);
});

test('the snippet keeps the match in the middle of a long body', () => {
  const body = `${'word '.repeat(40)}Solana halted the slot ${'more '.repeat(40)}`;
  const snippet = snippetAround(body, 30);
  assert.match(snippet, /Solana/);
  assert.ok(snippet.length < body.length);
});

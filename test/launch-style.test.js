import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coinName,
  grokImagineUrl,
  grokPrompt,
  grokUrl,
  imagePrompts,
  launchTweet,
  pickVibe,
  tickerOf,
  xPostUrl,
  xReplyUrl,
} from '../server/launch-style.js';

test('names follow the reference shapes and tickers are 3-7 capital letters', () => {
  assert.match(coinName('A raccoon stole donuts'), /^The [A-Z][a-z]+ Raccoon$/);
  assert.equal(coinName('Justice rally after Matt Furie went missing'), 'Justice For Matt Furie');
  assert.equal(coinName('Cases in northeast Nigeria. The two people were isolated.').includes('Nigeria The'), false);
  assert.equal(coinName('People quoted "make me rich make no mistakes" all day', 'funny'), 'make me rich make no mistakes');
  const ticker = tickerOf('The Drooling Squirrel');
  assert.match(ticker, /^[A-Z]{3,7}$/);
  assert.equal(tickerOf('Paco'), 'PACO');
  assert.equal(tickerOf('Lecornu Extra Words').length <= 7, true);
});

test('hype and story tweets stay in the degen voice', () => {
  const hype = launchTweet({
    lane: 'funny',
    name: 'The Fugitive Raccoon',
    ticker: 'RACCOON',
    hook: 'this raccoon ate a cable and left the building',
    summary: 'The clip is everywhere.',
  });
  assert.equal(pickVibe('funny', 'raccoon'), 'hype');
  assert.match(hype, /NAME IS RACCOON/);
  assert.equal(hype.includes('#'), false);
  assert.equal(hype.includes('—'), false);
  assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(hype), false);

  const story = launchTweet({
    lane: '',
    name: 'Clippy',
    ticker: 'CLIPPY',
    hook: 'Clippy showed up again',
    summary: 'An old AI agent revival is making the rounds. People want it back on the timeline.',
  });
  assert.match(story, /official currency/);
  assert.equal(story.includes('#'), false);
  assert.equal(pickVibe('', 'clippy AI agent revival'), 'story');
});

test('image prompts cover the three styles and grok links carry the prompt', () => {
  const images = imagePrompts('The Drooling Squirrel');
  assert.equal(images.length, 3);
  assert.match(images[0].text, /glowing yellow gold outline/);
  assert.match(images[1].text, /candid phone photo/);
  assert.match(images[2].text, /MS Paint/);
  assert.match(images[0].text, /square 1:1/);
  const url = grokImagineUrl(images[0].text);
  assert.equal(url.startsWith('https://grok.com/?q='), true);
  const write = grokUrl('raino the dog');
  assert.equal(write.startsWith('https://grok.com/?q='), true);
  const decoded = decodeURIComponent(write.split('?q=')[1]);
  assert.match(decoded, /NAME IS RAINO/);
  assert.match(decoded, /Clippy/);
  assert.match(decoded, /raino the dog/);
});

test('post and reply intents point at X', () => {
  assert.equal(xPostUrl('hello desk').startsWith('https://x.com/intent/post?text='), true);
  assert.equal(xReplyUrl('hello', '12345'), 'https://x.com/intent/post?in_reply_to=12345&text=hello');
  assert.equal(xReplyUrl('hello', ''), '');
});

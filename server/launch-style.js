const ADJECTIVES = ['Drooling', 'Fugitive', 'Loud', 'Sleepy', 'Wild', 'Tiny', 'Golden', 'Lost'];

const ANIMALS = [
  'squirrel',
  'red panda',
  'raccoon',
  'dog',
  'cat',
  'frog',
  'goose',
  'capybara',
  'pigeon',
  'otter',
  'penguin',
  'fox',
  'bear',
  'monkey',
  'goat',
  'duck',
  'whale',
  'shark',
  'octopus',
  'koala',
  'sloth',
  'panda',
];

const STYLE_GUIDE = `Names look like "The [adjective] [animal]" (The Drooling Squirrel, The Fugitive Red Panda, The ANTI-AI Raccoon), "Justice For [person]", the subject's own name, the tweet's exact punchline, or "[Word]coin".
Tickers are 3-7 ALL CAPS characters, usually the subject's own name ($PACO, $KODA, $REX, $LECORNU, $RAINO). One launch per trend.
Tweets sound like a real degen typing fast. Never poetic. Never AI-sounding. No hashtags. No emoji spam. No em dashes.
Hype style (breaking drama, animals, viral clips):
NEW DOG ANTI-AI MASCOT, THIS DOG RAN AWAY FROM HIS HOME AND BROKE A WHOLE DATA CENTER HIMSELF EATING A CABLE
THIS IS GOING GIGA VIRAL STARTING A REAL ANTI AI CULT
THIS HAVE 500M POTENTIAL EVEN ON TIKTOK ITS STARTING A WHOLE CULT
NAME IS RAINO
Story style (tech, AI, crypto-meta, revivals):
Instead of running Clippy coins, why dont we actually just run Clippy on the pad? We can revive the AI Agent and let it roam free with Open Problems on the WWW pad
We can finally run a clippy coin properly.
The official account literally tweeted it's own currency in 2013.
It never saw the light of day.
With the revival of Clippy today, it's time to create his official currency.
Image prompt styles, square 1:1: (a) one subject, photoreal, cut out with a thick glowing yellow/gold outline, simple background, no text; (b) warm real-photo look with golden glow light, like a candid phone photo; (c) clean icon or crude MS Paint doodle on a solid background.`;

function hash(seed) {
  let n = 0;
  for (const ch of String(seed || '')) n = (n + ch.charCodeAt(0) * 13) % 997;
  return n;
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function findAnimal(text) {
  const hay = String(text || '').toLowerCase();
  const found = ANIMALS.filter((animal) => new RegExp(`\\b${animal}\\b`, 'i').test(hay));
  found.sort((a, b) => b.length - a.length);
  return found[0] || '';
}

export function findPerson(text) {
  const skip = new Set(['The', 'This', 'That', 'When', 'What', 'Will', 'With', 'From', 'They', 'Have', 'Been', 'And', 'For', 'More', 'After', 'Into']);
  const sentences = String(text || '').split(/[.!?\n]+/);
  for (const sentence of sentences) {
    const match = sentence.match(/\b([A-Z][a-z]{2,}) ([A-Z][a-z]{2,})\b/);
    if (!match) continue;
    if (skip.has(match[1]) || skip.has(match[2])) continue;
    return `${match[1]} ${match[2]}`;
  }
  return '';
}

export function findPunchline(text) {
  const match = String(text || '').match(/[“"]([^”"]{8,42})[”"]/);
  return match ? match[1].trim() : '';
}

export function coinName(text, lane = '') {
  const blob = String(text || '');
  const punch = findPunchline(blob);
  if (punch && lane !== 'breaking') return punch;
  const animal = findAnimal(blob);
  if (animal) {
    const adj = ADJECTIVES[hash(blob) % ADJECTIVES.length];
    return `The ${adj} ${titleCase(animal)}`;
  }
  const person = findPerson(blob);
  if (person && /killed|died|missing|arrested|victim|justice/i.test(blob)) return `Justice For ${person}`;
  if (person) return person;
  const word = (blob.match(/\b[A-Za-z]{4,12}\b/g) || []).find((token) => !/^(this|that|with|from|have|been|they|will|just|into|about|after|before|there|their|would|could)$/i.test(token));
  return `${titleCase(word || 'Meme')}coin`;
}

export function tickerOf(name) {
  const parts = String(name || '')
    .replace(/[“”"']/g, '')
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ''))
    .filter((part) => part && !/^(the|for|and|coin)$/i.test(part));
  let word = (parts[parts.length - 1] || 'MEME').toUpperCase();
  if (word.length > 7) word = word.slice(0, 7);
  if (word.length < 3) word = `${word}X`.padEnd(3, 'X').slice(0, 3);
  return word;
}

export function pickVibe(lane, text) {
  if (lane === 'funny' || lane === 'breaking') return 'hype';
  if (/\b(ai|agent|clippy|crypto|bitcoin|solana|revival|history|protocol)\b/i.test(text || '')) return 'story';
  return 'hype';
}

function cleanTweet(text) {
  return String(text || '')
    .replace(/[—–]/g, ', ')
    .replace(/#[A-Za-z0-9_]+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 420);
}

export function launchTweet({ lane = '', name, ticker, hook, summary }) {
  const vibe = pickVibe(lane, `${hook} ${summary}`);
  const safeName = name || 'Meme';
  const safeTicker = tickerOf(ticker || safeName);
  const line = cleanTweet(hook || summary || safeName).replace(/\s+/g, ' ');
  if (vibe === 'hype') {
    return cleanTweet(
      [
        `NEW ${safeName.toUpperCase()}, ${line.toUpperCase()}`,
        'THIS IS GOING GIGA VIRAL STARTING A REAL CULT',
        'THIS HAVE REAL POTENTIAL EVEN ON TIKTOK ITS STARTING A WHOLE CULT',
        `NAME IS ${safeTicker}`,
      ].join('\n'),
    );
  }
  const beat = cleanTweet(summary || hook || '').split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  return cleanTweet(
    [
      line,
      `We can finally run a ${safeName} coin properly.`,
      beat,
      'It never saw the light of day.',
      `With this on the timeline, it's time to create the official currency.`,
      `Ticker is $${safeTicker}.`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
}

export function imagePrompts(name) {
  const subject = name || 'the subject';
  return [
    {
      style: 'Cutout',
      text: `One ${subject}, photoreal, cut out with a thick glowing yellow gold outline, simple background, no text, square 1:1`,
    },
    {
      style: 'Candid',
      text: `Warm real photo of ${subject}, golden glow light, candid phone photo of the subject, no text, square 1:1`,
    },
    {
      style: 'Doodle',
      text: `Clean recognizable icon of ${subject}, crude MS Paint doodle on a solid background, no text, square 1:1`,
    },
  ];
}

export function grokPrompt(userText) {
  return `${STYLE_GUIDE}

The user typed this narrative. Write four things and nothing else:
1. the full launch tweet
2. a coin name
3. a $TICKER
4. an image prompt

Narrative:
${String(userText || '').trim()}`;
}

export function grokUrl(userText) {
  return `https://grok.com/?q=${encodeURIComponent(grokPrompt(userText))}`;
}

export function grokImagineUrl(prompt) {
  const text = `Generate this image in Grok Imagine. ${prompt}`;
  return `https://grok.com/?q=${encodeURIComponent(text)}`;
}

export function xPostUrl(text) {
  return `https://x.com/intent/post?text=${encodeURIComponent(String(text || '').slice(0, 280))}`;
}

export function xReplyUrl(text, tweetId) {
  const id = String(tweetId || '').replace(/\D/g, '');
  if (!id) return '';
  return `https://x.com/intent/post?in_reply_to=${id}&text=${encodeURIComponent(String(text || '').slice(0, 240))}`;
}

export function launchPack({ lane, text, label }) {
  const blob = `${label || ''}\n${text || ''}`;
  const name = coinName(blob, lane);
  const ticker = tickerOf(name);
  const hook = String(label || name);
  const summary = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  const tweet = launchTweet({ lane, name, ticker, hook, summary });
  const images = imagePrompts(name).map((image) => ({
    ...image,
    url: grokImagineUrl(image.text),
  }));
  return {
    name,
    ticker: `$${ticker}`,
    tweet,
    images,
    postUrl: xPostUrl(tweet),
    vibe: pickVibe(lane, blob),
  };
}

export { STYLE_GUIDE };

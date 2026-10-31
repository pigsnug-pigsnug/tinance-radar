import { esc } from './format.js';

const GUIDE = `Names look like "The [adjective] [animal]" (The Drooling Squirrel, The Fugitive Red Panda), "Justice For [person]", the subject's own name, a punchline, or "[Word]coin".
Tickers are 3-7 ALL CAPS ($PACO, $KODA, $REX, $LECORNU, $RAINO).
Tweets sound like a real degen typing fast. No hashtags. No emoji spam. No em dashes.
Hype reference:
NEW DOG ANTI-AI MASCOT, THIS DOG RAN AWAY FROM HIS HOME AND BROKE A WHOLE DATA CENTER HIMSELF EATING A CABLE
THIS IS GOING GIGA VIRAL STARTING A REAL ANTI AI CULT
THIS HAVE 500M POTENTIAL EVEN ON TIKTOK ITS STARTING A WHOLE CULT
NAME IS RAINO
Story reference:
Instead of running Clippy coins, why dont we actually just run Clippy on the pad?
We can finally run a clippy coin properly.
The official account literally tweeted it's own currency in 2013.
It never saw the light of day.
With the revival of Clippy today, it's time to create his official currency.`;

export function grokWriteUrl(text) {
  const prompt = `${GUIDE}

Write four things: the full launch tweet, a coin name, a $TICKER, and an image prompt.

Narrative:
${String(text || '').trim()}`;
  return `https://grok.com/?q=${encodeURIComponent(prompt)}`;
}

export function grokImageUrl(text) {
  const prompt = `Generate this image in Grok Imagine. One subject from this narrative, square 1:1, no text. ${String(text || '').trim()}`;
  return `https://grok.com/?q=${encodeURIComponent(prompt)}`;
}

export function renderWrite(stage) {
  const draft = document.getElementById('grok-seed')?.value || '';
  stage.innerHTML = `
    <section class="story write-box">
      <h2>Write tweet</h2>
      <p class="story-body">Type the narrative. Grok opens in a new tab with the style guide already in the prompt. You use your own Grok login. This app does not call an API.</p>
      <textarea id="grok-seed" rows="6" placeholder="raino the dog that ate the cable">${esc(draft)}</textarea>
      <div class="story-actions">
        <button type="button" class="big" data-action="open-grok">Open in Grok</button>
        <button type="button" class="big" data-action="open-imagine">Open in Grok Imagine</button>
      </div>
    </section>`;
}

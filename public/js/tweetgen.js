import { platform } from './format.js';

function clip(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean;
}

export function buildTweets(item, topic) {
  const title = clip(item.title);
  const link = item.url || '';
  const src = platform(item.source);
  const label = topic?.label ? `“${topic.label}”` : 'this';
  const score = topic ? topic.score.toFixed(0) : null;
  const vel = topic ? Math.round(topic.velocity) : null;
  const velBit = vel == null ? '' : vel > 0 ? `velocity +${vel}/h` : `velocity ${vel}/h`;
  const sources = topic?.sources?.length ? topic.sources.join(', ') : src;
  return [
    {
      angle: 'Wire',
      text: `${title}\n\nFirst print I trust is ${src}.${velBit ? ` ${velBit}.` : ''}\n${link}`.trim(),
    },
    {
      angle: 'Fade',
      text: `If you are screenshotting this, you are late or you are the distribution.\n\n"${title}"\n${link}`.trim(),
    },
    {
      angle: 'Tape',
      text: `Tape, not timeline.\n${title}\n${topic ? `${label} · score ${score} · ${topic.cross} sources` : src}${velBit ? ` · ${velBit}` : ''}\n${link}`.trim(),
    },
    {
      angle: 'Thread',
      text: `A narrative is stacking and it is still early enough to read.\n\n1/ ${title}\n2/ Also on ${sources}\n3/ I care about the next hour, not the quote-tweet\n${link}`.trim(),
    },
    {
      angle: 'Launch',
      text: `If this peaks, the coin will not wait for a second read.\n\n${title}${score != null ? `\nScore at attention: ${score}` : ''}\n${link}`.trim(),
    },
  ];
}

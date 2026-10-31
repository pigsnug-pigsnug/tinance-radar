const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeXml(raw) {
  let text = String(raw || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = text.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : _;
  });
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  text = text.replace(/&([a-z]+);/gi, (match, name) => (name in NAMED ? NAMED[name] : match));
  return text;
}

export function stripTags(value) {
  let text = decodeXml(value);
  if (text.includes('&')) text = decodeXml(text);
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickLink(block) {
  const tags = [...block.matchAll(/<link\b([^>]*)\/?>/gi)];
  let fallback = '';
  for (const tag of tags) {
    const attrs = tag[1] || '';
    const href = (attrs.match(/href=["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    const rel = ((attrs.match(/rel=["']([^"']+)["']/i) || [])[1] || '').toLowerCase();
    if (!rel || rel.includes('alternate')) return decodeXml(href);
    if (!fallback) fallback = href;
  }
  const text = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
  if (text) return decodeXml(text[1]).trim();
  return decodeXml(fallback);
}

function field(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, 'i'));
  return match ? match[1].trim() : '';
}

export function parseFeed(xml) {
  const chunks = [...String(xml || '').matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  return chunks
    .map((match) => {
      const body = match[2];
      const title = stripTags(field(body, 'title'));
      const summary = stripTags(
        field(body, 'description') || field(body, 'summary') || field(body, 'content'),
      ).slice(0, 400);
      const pubDate = stripTags(field(body, 'pubDate') || field(body, 'published') || field(body, 'updated'));
      const traffic = stripTags(field(body, 'ht:approx_traffic'));
      return { title, link: pickLink(body), summary, pubDate, traffic };
    })
    .filter((item) => item.title);
}

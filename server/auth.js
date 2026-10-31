import crypto from 'node:crypto';

const COOKIE = 'tr_session';

export function authEnabled() {
  return Boolean(process.env.AUTH_PASSWORD);
}

function secret() {
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || '';
}

export function signSession() {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const body = Buffer.from(JSON.stringify({ v: 1, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token) {
  if (!authEnabled()) return true;
  if (!token || !secret()) return false;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return false;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function checkPassword(password) {
  const expected = process.env.AUTH_PASSWORD || '';
  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.alloc(32, 1), Buffer.alloc(32, 2));
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function requestIsSecure(req) {
  const forwarded = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return Boolean(req?.secure || forwarded === 'https');
}

export function sessionCookie(token, req) {
  const secure = requestIsSecure(req);
  const parts = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(req) {
  const secure = requestIsSecure(req);
  const parts = [`${COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

const attempts = new Map();

export function allowLogin(ip) {
  const key = ip || 'local';
  const now = Date.now();
  const row = attempts.get(key) || { n: 0, reset: now + 10 * 60 * 1000 };
  if (now > row.reset) {
    row.n = 0;
    row.reset = now + 10 * 60 * 1000;
  }
  row.n += 1;
  attempts.set(key, row);
  return row.n <= 8;
}

export function requireAuth(req, res, next) {
  if (!authEnabled()) return next();
  const cookies = parseCookies(req.headers.cookie);
  if (verifySession(cookies[COOKIE])) return next();
  if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) {
    res.status(401).json({ error: 'auth required' });
    return;
  }
  res.redirect('/login');
}

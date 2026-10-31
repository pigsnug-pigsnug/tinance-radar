import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  allowLogin,
  authEnabled,
  checkPassword,
  clearCookie,
  requireAuth,
  sessionCookie,
  signSession,
} from './auth.js';
import { createApi } from './routes.js';
import { bustModuleSpecifiers } from './assets.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(root, '../public');
const assetVersion = crypto.randomBytes(4).toString('hex');

function publicFile(urlPath) {
  const rel = String(urlPath || '').replace(/^\/+/, '');
  if (!rel || rel.includes('\0')) return null;
  const file = path.resolve(publicDir, rel);
  if (file !== publicDir && !file.startsWith(publicDir + path.sep)) return null;
  return file;
}

const LOGIN_ERRORS = {
  '1': 'Wrong password.',
  '2': 'Too many attempts. Wait a few minutes.',
};

export function buildApp({ store, bus, ingest }) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        "style-src-attr 'unsafe-inline'",
        "font-src https://fonts.gstatic.com data:",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ].join('; '),
    );
    next();
  });

  app.get('/health', (_req, res) => {
    const sources = ingest.health();
    const live = sources.filter((source) => source.state === 'ok').length;
    res.json({ ok: true, time: Date.now(), sources: sources.length, live });
  });

  app.get('/login', (req, res) => {
    if (!authEnabled()) return res.redirect('/');
    sendHtml(res, 'login.html', { __ERROR__: LOGIN_ERRORS[String(req.query.e || '')] || '' });
  });

  app.post('/login', (req, res) => {
    if (!authEnabled()) return res.redirect('/');
    if (!allowLogin(req.ip)) return res.redirect('/login?e=2');
    if (!checkPassword(req.body.password || '')) return res.redirect('/login?e=1');
    res.setHeader('Set-Cookie', sessionCookie(signSession(), req));
    res.redirect('/');
  });

  app.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', clearCookie(req));
    res.redirect(authEnabled() ? '/login' : '/');
  });

  app.get('/', requireAuth, (_req, res) => {
    sendHtml(res, 'index.html');
  });

  app.use('/api', requireAuth, createApi({ store, bus, ingest }));

  app.get(/^\/js\/[\w./-]+\.js$/, (req, res, next) => {
    const file = publicFile(req.path);
    const jsDir = path.join(publicDir, 'js') + path.sep;
    if (!file || !file.startsWith(jsDir) || !fs.existsSync(file)) return next();
    const code = bustModuleSpecifiers(fs.readFileSync(file, 'utf8'), assetVersion);
    res.setHeader('Cache-Control', 'no-cache');
    res.type('js').send(code);
  });

  app.get(/^\/css\/[\w./-]+\.css$/, (req, res, next) => {
    const file = publicFile(req.path);
    const cssDir = path.join(publicDir, 'css') + path.sep;
    if (!file || !file.startsWith(cssDir) || !fs.existsSync(file)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('css').send(fs.readFileSync(file));
  });

  app.use(
    express.static(publicDir, {
      index: false,
      etag: true,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) res.status(404).json({ error: 'not found' });
    else res.status(404).type('txt').send('Not found');
  });

  return app;
}

function sendHtml(res, name, replacements = {}) {
  const file = path.join(root, 'views', name);
  let html = fs.readFileSync(file, 'utf8').replaceAll('__V__', assetVersion);
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value);
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
}

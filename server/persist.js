import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function queue(persist) {
  let chain = Promise.resolve();
  persist.save = ((save) => (partial) => {
    chain = chain.then(() => save(partial), () => save(partial));
    return chain;
  })(persist.save.bind(persist));
  return persist;
}

export function parseServiceAccount(raw) {
  let text = String(raw || '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }
  if (!text.startsWith('{')) text = Buffer.from(text, 'base64').toString('utf8');
  return JSON.parse(text);
}

export function createFilePersist(dir) {
  const file = path.join(dir, 'state.json');
  let memory = null;
  const persist = {
    mode: 'file',
    async load() {
      try {
        const raw = await readFile(file, 'utf8');
        memory = JSON.parse(raw);
        return memory;
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        console.warn('[tinance-radar] state file unreadable:', error.message);
        return null;
      }
    },
    async save(partial) {
      if (!memory) {
        try {
          memory = JSON.parse(await readFile(file, 'utf8'));
        } catch {
          memory = {};
        }
      }
      if (partial.snapshot) memory.snapshot = partial.snapshot;
      if (partial.user) memory.user = partial.user;
      await mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(memory));
      await rename(tmp, file);
    },
  };
  return queue(persist);
}

async function createFirestorePersist(raw) {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const credentials = parseServiceAccount(raw);
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials) });
  }
  const db = getFirestore();
  const snapRef = db.doc('radar/snapshot');
  const userRef = db.doc('radar/user');
  const persist = {
    mode: 'firestore',
    async load() {
      const [snap, user] = await Promise.all([snapRef.get(), userRef.get()]);
      return {
        snapshot: snap.exists ? snap.data() : null,
        user: user.exists ? user.data() : null,
      };
    },
    async save(partial) {
      const jobs = [];
      if (partial.snapshot) jobs.push(snapRef.set(partial.snapshot));
      if (partial.user) jobs.push(userRef.set(partial.user));
      await Promise.all(jobs);
    },
  };
  return queue(persist);
}

export async function createPersist(dir) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.warn(`[tinance-radar] FIREBASE_SERVICE_ACCOUNT not set — local file persistence (${dir}/state.json)`);
    return createFilePersist(dir);
  }
  try {
    const persist = await createFirestorePersist(raw);
    console.log('[tinance-radar] Firestore persistence enabled');
    return persist;
  } catch (error) {
    console.warn('[tinance-radar] Firebase init failed, using local file:', error.message);
    return createFilePersist(dir);
  }
}

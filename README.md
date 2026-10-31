# Tinance Radar v2

## Quick start

Run locally:

```bash
npm install
npm start
```

Open http://127.0.0.1:4317

Deploy on Render from `main`. Set `AUTH_PASSWORD` (and `FIREBASE_SERVICE_ACCOUNT` if you want the desk to sync). Start command is `npm start`. Health check is `/health`.

Personal trend desk for Solana launches. It watches free public sources only. A story hits Pulse when it clears the filter and shows up on at least two sources.

The browser is vanilla ES modules. There is no build step. The server is Node.js and Express. User data and the velocity snapshot live in Firestore when you configure it, and in a local JSON file when you do not.

## Run locally

```bash
npm install
npm start
```

Open http://127.0.0.1:4317

With no environment variables the process prints a warning, **auth is off**, and state is written to `data/state.json`. Set variables in the shell or in a `.env` file you load yourself (this repo does not read `.env` automatically). See `.env.example`.

```bash
npm test
```

## What you can do

- **Pulse** — one feed. Breaking or funny stories only, and only after two sources agree. Each card has a short summary, the source links, a coin name and ticker, a launch tweet, Post to X, and three image prompts that open in Grok.
- **Solana** — a slower scan (about every 12 minutes) for the whole word Solana inside GitHub READMEs, YouTube captions (with a timestamp), and Reddit post bodies.
- **Desk** — launch log, watch words (they ping in the page), wallets, bills, notes.
- **Write tweet** — type a narrative and open Grok or Grok Imagine with the style guide already in the link. No API key.

Free sources that answered here: BBC world RSS, Guardian world RSS, Al Jazeera, Wikipedia pageviews, Hacker News, Reddit listings when they are not blocked, getdaytrends for X trend names. AP's RSS returned 403. Reuters' old RSS is gone. trends24 sits behind a Cloudflare check from this network. GitHub code search returns 401 unless `GITHUB_TOKEN` is set; README search works without it. YouTube captions are best-effort and skipped when a video has none. X post counts and reply-to tweet ids are not on the free trend list, so Reply launch appears only when an id is actually known.

## Architecture

```
adapters ──tick──▶ runner (timeout, backoff, circuit, last-good snapshot)
                         │
                         ▼
                    store.ingestItems
                         │  stable id = sha1(source + normalized title)
                         │  cluster by tickers / names / 2–3 word phrases
                         │  5-minute buckets, 24h window
                         ▼
                    SSE bus ──▶ browser Map
                         │
                    every 5 min
                         ▼
              Firestore radar/snapshot + radar/user
              or data/state.json
```

Stars, saves, and notes store a **snapshot of the item**, so they remain after it scrolls off the live tape.

A topic is **multi-signal** when it is seen on at least `MULTI_MIN_SOURCES` (default 3) distinct outlets inside `MULTI_WINDOW_HOURS` (default 6). The tooltip lists those outlets and the phrases that glued the headlines together.

Velocity for a topic:

- `perHour` — mentions in the last hour
- `velocity` — that rate minus the previous hour
- `acceleration` — velocity minus the hour before that
- score — those terms, plus a cross-source bonus and a multi-signal bonus, times an exponential decay on `lastSeen`

Repeat fetches of the same headline do not add another hit. The seen-id set is part of the snapshot, so a restart does not replay the tape into the buckets.

Each source is an adapter: `{ name, intervalMs, fetch() }` returning normalized items. The runner times out, doubles the backoff, and after 3 failures opens a circuit. While the circuit is open the last successful batch is kept and the source is marked stale on `/api/health`. One dead scraper does not blank the desk.

HTML is `Cache-Control: no-store`. JS and CSS are served with a long cache and a query string that changes every process start, so a Railway deploy cannot leave you on a stale bundle.

Auth, when `AUTH_PASSWORD` is set, is an httpOnly HMAC cookie. Firestore is touched only with `firebase-admin` on the server. The browser never receives a Firebase key. The old client-side PIN is gone.

## Sources

| Adapter | What it reads | Cadence |
| --- | --- | --- |
| `reddit` | Hot and top from the whitelist, including r/all top. Ranked by upvote velocity | 5 min |
| `hackernews` | Front page, points floor | 3 min |
| `x-trends` | US trend names from getdaytrends, with trends24 as a fallback | 10 min |
| `aljazeera` | Al Jazeera RSS | 10 min |
| `wikipedia` | Pageview spikes versus the day before, in plain language | 30 min |
| `news` | BBC world RSS and Guardian world RSS | 10 min |
| `solana-scan` | GitHub READMEs, optional code search, YouTube captions, Reddit bodies | 12 min |

Every Pulse item still has to pass the filter: no content farms, enough engagement, no sports, religion, elections, gossip, or war, then two sources at once, then a breaking or funny lane.

If a host is blocked, that row in **Sources** goes `error` or `open` and the rest of the desk keeps running. `/health` is a small public check for Railway. `/api/health` is the full panel (and requires the cookie when auth is on).

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | Defaults to `4317`. Railway sets this. |
| `AUTH_PASSWORD` | Unlocks the desk. Empty means auth is disabled. |
| `AUTH_SECRET` | HMAC key for the cookie. Defaults to `AUTH_PASSWORD`. |
| `FIREBASE_SERVICE_ACCOUNT` | Service-account JSON, one line, or base64 of that JSON. |
| `MULTI_WINDOW_HOURS` | Multi-signal window. Default `6`. |
| `MULTI_MIN_SOURCES` | Outlets required before a Pulse card. Default `2`. |
| `SNAPSHOT_INTERVAL_MS` | How often the topic/item snapshot is written. Default `300000`. |
| `DATA_DIR` | File fallback directory. Default `data`. |
| `GITHUB_TOKEN` | Optional. Unlocks GitHub code search. README search works without it. |
| `YOUTUBE_CHANNEL_IDS` | Comma-separated channel ids for the caption scan. Default is Solana’s channel. |
| `HN_MIN_POINTS` | Hacker News floor. Default `40`. |

## Firestore

1. Create a Firebase project and a Firestore database in **Native** mode. Production rules that deny all client access are correct — the browser never talks to Firebase.
2. Create a service account with the **Cloud Datastore User** role (or Firebase Admin SDK Administrator).
3. Download the JSON key. On Railway, set `FIREBASE_SERVICE_ACCOUNT` to the raw JSON (one line) or to its base64:

   ```bash
   base64 -w0 service-account.json
   ```

4. Collections are created on first write: `radar/snapshot` (topics, buckets, seen ids, recent items) and `radar/user` (stars, saves, notes, watch words, launches, desk). You do not need to create them by hand.

A snapshot every 5 minutes is about 288 writes a day, far under the Spark free quota, as long as you are not snapshotting on every headline. User edits write the user document only.

If the env var is missing or the Admin SDK fails to initialize, the server logs a warning and uses `data/state.json`.

## Railway

`railway.json` uses Nixpacks, `npm start`, and healthcheck path `/health`. A `Procfile` is also included (`web: npm start`).

1. Create a Railway project from this repo.
2. Set `AUTH_PASSWORD` and, if you want sync across devices, `FIREBASE_SERVICE_ACCOUNT`.
3. Deploy. The service listens on Railway’s `PORT`.
4. Open the generated URL, sign in, and confirm **Sources** shows live rows.

The cookie is marked `Secure` when the request is HTTPS (Railway’s proxy sets `x-forwarded-proto`).

## Tests

`npm test` covers:

- stable ids (case, punctuation, outlet)
- topic clustering, the 3-source multi-signal rule, window expiry, and snapshot hydrate
- velocity, acceleration, recency decay
- exponential backoff and the circuit breaker keeping the last good batch

## Limits

- One operator. The password is the whole account; there is no multi-user model.
- Reddit’s `.json` endpoints often 403 a datacenter. The RSS fallback has no upvote counts, so those rows fail the velocity check instead of being guessed.
- trends24 is often a Cloudflare challenge. getdaytrends still supplies trend names. It does not give post counts or tweet ids.
- AP’s RSS returned 403 from this network. Reuters no longer publishes the old public RSS.
- GitHub code search is 401 without `GITHUB_TOKEN`. README search is unauthenticated.
- YouTube caption tracks are missing on a lot of videos. Those videos are skipped.
- Topic phrases are heuristic. Broad words (`solana`, `bitcoin`, `etf` alone) are not cluster keys, on purpose, so the whole tape does not collapse into one topic.
- This is a reading desk, not a trading bot. It does not place orders or hold keys. Wallet rows reject strings that look like private keys.

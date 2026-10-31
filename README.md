# Tinance Radar v2

## Quick start

Run locally:

```bash
npm install
npm start
```

Open http://127.0.0.1:4317

Deploy to Railway: create a service from this repo, set `AUTH_PASSWORD` (and `FIREBASE_SERVICE_ACCOUNT` if you want the desk to sync), then deploy. The start command is `npm start` and the healthcheck is `/health`. Step-by-step is in [Railway](#railway).

Personal trend desk for timing Solana memecoin launches. It watches free public sources, clusters headlines into topics, and scores whether a narrative is speeding up across platforms.

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

- **Pulse** — mixed feed with platform chips, search, latest/heat/starred/saved. Multi-signal badge opens a “why” note (sources and shared phrases). Velocity is mentions-per-hour change, not “seen again this cycle.” Star, save, note, launch, and tweet on each card. Buttons are one delegated listener (`data-action` / `data-id`) over a long-lived `Map`, so a deploy cannot orphan them.
- **Radar** — live pump.fun creates over the pumpportal socket, king-of-the-hill when the REST API answers, a topic word cloud, and a DexScreener coin check.
- **SOL Web** — the same tape filtered to Solana, in `#9945FF`, with a ◎ mark.
- **Desk** — launch log (score frozen at open, outcome edited later), public wallets, bills, and a notes pad.
- **Watch words** — stored on the server. A new matching item pushes an SSE event and the page plays a short Web Audio ping after you have clicked once.
- **Market strip** — SOL/USD from CoinGecko, plus 24h DEX volume for Solana, Ethereum, BNB Chain, and Base from DeFiLlama. Cells flash when the number changes.

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
| `reddit` | Atom/RSS for r/CryptoCurrency, r/solana, r/memecoins, r/CryptoMoonShots | 3 min |
| `google-trends` | Google Trends RSS, United States | 10 min |
| `hackernews` | Firebase top stories | 3 min |
| `hn-solana` | Algolia `search_by_date` for solana | 5 min |
| `devto` | Dev.to API, top week + `tag=solana` | 10 min |
| `x-trends` | trends24.in United States. If that host blocks the server, getdaytrends.com is the fallback and the row says so | 10 min |
| `tiktok` | trends24 TikTok pages, then TikTok Creative Center, then Exploding Topics growth chips if those are blocked | 15 min |
| `aljazeera` | Al Jazeera all-news RSS | 10 min |
| `google-news` | Google News RSS for Solana / pump.fun | 5 min |
| `youtube` | Channel RSS. Default is the official Solana channel | 10 min |
| `cointelegraph` | CoinTelegraph RSS, kept when it mentions Solana | 5 min |
| `decrypt` | Decrypt RSS, same filter | 5 min |
| `dexscreener` | Latest Solana token profiles and top boosts | 2 min |
| `geckoterminal` | Trending Solana pools | 2 min |
| `pumpfun` | King of the hill and recent graduations, when the REST host answers | 2 min |
| `pumpfun-ws` | `wss://pumpportal.fun/api/data` creates and migrations | live |
| `wikipedia` | Pageviews top articles, spikes versus the previous day | 30 min |
| `polymarket` | Gamma markets with heavy 24h volume or a fast hourly move | 5 min |
| `telegram` | Public `t.me/s/<channel>` previews | 5 min |
| `bluesky` | Jetstream firehose. Counts tracked phrases per minute. Not an X login. | live |
| `market` | DeFiLlama chain DEX volume + CoinGecko SOL/USD | 1 min |

Nitter is not used.

If a host is blocked, that row in **Sources** goes `error` or `open` and the rest of the desk keeps running. `/health` is a small public check for Railway. `/api/health` is the full panel (and requires the cookie when auth is on).

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | Defaults to `4317`. Railway sets this. |
| `AUTH_PASSWORD` | Unlocks the desk. Empty means auth is disabled. |
| `AUTH_SECRET` | HMAC key for the cookie. Defaults to `AUTH_PASSWORD`. |
| `FIREBASE_SERVICE_ACCOUNT` | Service-account JSON, one line, or base64 of that JSON. |
| `MULTI_WINDOW_HOURS` | Multi-signal window. Default `6`. |
| `MULTI_MIN_SOURCES` | Outlets required. Default `3`. |
| `SNAPSHOT_INTERVAL_MS` | How often the topic/item snapshot is written. Default `300000`. |
| `DATA_DIR` | File fallback directory. Default `data`. |
| `TELEGRAM_CHANNELS` | Comma-separated public channels. Default `cointelegraph,WatcherGuru`. |
| `YOUTUBE_CHANNEL_IDS` | Comma-separated channel ids. Default is Solana’s channel. |
| `BLUESKY_MIN_COUNT` | Mentions in a minute before a Bluesky row is emitted. Default `5`. |

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
- Bluesky is the public Jetstream firehose filtered down to a few dozen phrases. It is a mention counter, not a search index, and a small host can feel it.
- pump.fun’s REST API often blocks datacenter IPs. The websocket path is the one that usually works; king-of-the-hill fails soft.
- trends24 TikTok pages 404. The TikTok adapter falls through to Creative Center and then to Exploding Topics, and says so in the summary when it does.
- Reddit’s `.json` endpoints often 403 this kind of host. The Atom feed on `www.reddit.com` is what the adapter uses.
- CoinGecko’s free price route rate-limits. The last SOL price is kept and marked stale.
- Topic phrases are heuristic. Broad words (`solana`, `bitcoin`, `etf` alone) are not cluster keys, on purpose, so the whole tape does not collapse into one topic.
- This is a reading desk, not a trading bot. It does not place orders or hold keys. Wallet rows reject strings that look like private keys.

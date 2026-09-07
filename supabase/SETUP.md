# KHChess → Supabase storage setup

Prepared 2026-09-07. Goal: games, moves, messages, leaderboard, profiles and the
admin AI-model choice survive Render redeploys.

## Why this design

- Motia streams use `storageType: 'default'` → file-based on Render's **ephemeral**
  disk. Every deploy/instance-restart wipes ALL game state. Motia has no Postgres
  backend option (checked `motia@0.6.4-beta.131` dist).
- Streams do **two jobs**: (a) persist state, (b) fan out realtime updates to
  connected clients over `/ws`. The design keeps `streams.*.set()` (realtime
  intact) and adds a Supabase write next to it; on boot, state is rehydrated
  FROM Supabase back into the streams.

## Current state of Supabase in the app

The auth code (Supabase email login, `/auth` step, `auth-provider`) is already
built but **non-functional** — all Supabase env values are placeholders:

| Location | Key | Value today |
|---|---|---|
| Render (api) | SUPABASE_URL | `https://placeholder.supabase.co` |
| Render (api) | SUPABASE_ANON_KEY | `placeholder` |
| Render (api) | SUPABASE_SERVICE_ROLE_KEY | `placeholder` |
| Vercel (app) | VITE_SUPABASE_URL | placeholder |
| Vercel (app) | VITE_SUPABASE_ANON_KEY | placeholder |

So **a real Supabase project is prerequisite #0** — it also unlocks email
login (required for the keovoin@gmail.com admin panel) in one shot.

## Files

- `supabase/001_init.sql` — full schema (6 tables + indexes + RLS locked down).
  Idempotent, paste-and-run in Supabase SQL Editor.
  - `profiles` (all user kinds: supabase/telegram/guest ids)
  - `games` (state jsonb + status denormalized)
  - `game_moves` (append-only history)
  - `game_messages` (sidechat + system)
  - `leaderboard` (per provider:model)
  - `ai_config` (single row; admin's model choice survives redeploys)
  - RLS: enabled on all tables, NO policies → direct client access denied;
    API writes with the service-role key (bypasses RLS).

## Access map (who writes/reads what)

| Table | Written by | Read by |
|---|---|---|
| profiles | auth steps (login/guest/telegram) | admin stats, game roles |
| games | create/move/end-game services | get-game, admin, AI step |
| game_moves | move service | (history) |
| game_messages | send-message step | (sidechat) |
| leaderboard | game-ended step (score gen) | leaderboard page, admin |
| ai_config | admin PUT /admin/ai-config | create-game + AI step defaults |

Stream method call sites to touch (all in `api/`):
`chessGame.get/set/getGroup` (17), `chessGameMessage.set` (5),
`chessLiveAiGames.set/get/getGroup/delete` (5), `chessLeaderboard.set/get` (4),
`chessGameMove.set/get/getGroup` (4), `chessSidechatMessage.set` (1).
`streams.*.send()` (realtime) stays untouched.

## Phases

### Phase 0 — prerequisites (USER, ~10 min)
1. Create a Supabase project (free tier is plenty):
   https://new.supabase.com → pick region **Singapore** (closest to players).
2. In Dashboard → Settings → API, copy:
   - `Project URL`  → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` public key → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret, never to frontend)
3. Paste `supabase/001_init.sql` into Dashboard → SQL Editor → Run.
4. Dashboard → Authentication → Providers: enable **Email** (needed for admin
   login), optionally Google.
5. Send the Project URL + anon key (safe to share) and tell me when the
   service-role key is copied — I set it on Render directly (it stays secret).

### Phase 1 — env + auth live (ME, after Phase 0)
- Set the 3 Supabase env vars on Render via API; set VITE_ vars in
  `app/.env` (Vercel rebuilds on push).
- Verify: sign in with a test email → `POST /auth` issues a real JWT with
  email → `keovoin@gmail.com` (once you have a Supabase account on that
  email) passes the admin allowlist end-to-end.

### Phase 2 — persistence layer (ME)
- New `api/services/db/supabase.ts`: service-role client + small query helpers.
- New `api/services/db/repo.ts`: `gameRepo`, `moveRepo`, `messageRepo`,
  `leaderboardRepo`, `profileRepo`, `aiConfigRepo` — each mirroring the
  existing stream call sites.
- Wrap each `streams.X.set(...)` call site with the matching repo write
  (best-effort: log-and-continue if Supabase fails, so the game never breaks
  on a DB blip).
- `ai-config.ts`: read/write `ai_config` table (keeps admin model choice
  durable); in-memory cache as before.

### Phase 3 — boot rehydration + migration (ME)
- At API boot: pull all non-completed games from `games` → `streams.chessGame.set()`
  each → players can resume in-progress games after any deploy.
- One-time: leaderboard rows and existing games are ephemeral now (wiped on
  every deploy), so there is no legacy data to migrate — the DB simply starts
  accumulating.
- Verify: create game → move → redeploy → game still fetches + resumes;
  admin model change survives redeploy.

### Phase 4 — cleanup
- Drop any leftover file-state assumptions; update SESSION_LOG + this doc.
- Optional later: game history page backed by `game_moves`.

## Cost / limits
- Supabase free tier: 500 MB DB, 2 GB storage, 50k MAU auth — far above this
  app's needs. No payment required.
- No schema changes expected after init; migrations appended as `002_*.sql`.

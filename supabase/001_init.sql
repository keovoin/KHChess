-- KHChess → Supabase storage (paste into Supabase Dashboard → SQL Editor → Run)
-- Idempotent: safe to re-run.

-- 1) profiles — every user type: Supabase-auth (uuid), telegram (tg:xxx), guest (guest:xxx)
create table if not exists public.profiles (
  id          text primary key,
  name        text not null default '',
  profile_pic text not null default '',
  email       text not null default '',
  created_at  timestamptz not null default now()
);

-- 2) games — full GameSchema kept as jsonb (source of truth), status denormalized for queries
create table if not exists public.games (
  id         text primary key,
  state      jsonb not null,
  status     text  not null default 'pending',   -- pending | completed | draw
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_status_idx on public.games (status);
create index if not exists games_created_idx on public.games (created_at desc);

-- 3) game_moves — append-only history
create table if not exists public.game_moves (
  id          bigint generated always as identity primary key,
  game_id     text not null references public.games(id) on delete cascade,
  move_number int  not null,
  color       text not null,
  from_sq     text not null,
  to_sq       text not null,
  piece       text,
  fen_after   text,
  created_at  timestamptz not null default now()
);
create index if not exists game_moves_game_idx on public.game_moves (game_id, move_number);

-- 4) game_messages — sidechat + system messages
create table if not exists public.game_messages (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id) on delete cascade,
  sender_id  text,
  body       text not null,
  kind       text not null default 'chat',       -- chat | system
  created_at timestamptz not null default now()
);
create index if not exists game_messages_game_idx on public.game_messages (game_id, id);

-- 5) leaderboard — keyed by provider:model
create table if not exists public.leaderboard (
  id                   text primary key,          -- '<provider>:<model>'
  provider             text not null,
  model                text not null,
  games_played         int not null default 0,
  victories            int not null default 0,
  checkmates           int not null default 0,
  draws                int not null default 0,
  illegal_moves        int not null default 0,
  sum_centipawn_scores numeric not null default 0,
  sum_highest_swing    numeric not null default 0,
  sum_turns            int,
  updated_at           timestamptz not null default now()
);

-- 6) ai_config — single row; admin's chosen model survives redeploys
create table if not exists public.ai_config (
  id         int primary key default 1 check (id = 1),
  provider   text not null default 'openai',
  model      text not null default 'Qwen3.8-27B',
  updated_at timestamptz not null default now()
);
insert into public.ai_config (id, provider, model) values (1, 'openai', 'Qwen3.8-27B')
  on conflict (id) do nothing;

-- Security: all app reads/writes go through the API with the service-role key
-- (bypasses RLS). Lock direct client access to everything except profiles-read.
alter table public.profiles       enable row level security;
alter table public.games          enable row level security;
alter table public.game_moves     enable row level security;
alter table public.game_messages  enable row level security;
alter table public.leaderboard    enable row level security;
alter table public.ai_config      enable row level security;
-- (no policies created = deny all direct access; service role is unaffected)

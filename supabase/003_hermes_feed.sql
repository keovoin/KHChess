-- 003: Hermes LIVE FEED — agent progress + replies streamed to the status page.
-- FLAT one-line statements (Telegram paste-safe — multiline version triggered
-- a 42601 error when line breaks got mangled by the messenger).
-- Idempotent: safe to re-run.

create table if not exists public.hermes_feed (id bigint generated always as identity primary key, kind text not null default 'progress', text text not null, instruction_id bigint, created_at timestamptz not null default now());
-- kind: 'progress' | 'reply' | 'system'  ·  instruction_id: which instruction this line is about (nullable)

alter table public.hermes_feed enable row level security;

drop policy if exists "anon can read feed" on public.hermes_feed;
create policy "anon can read feed" on public.hermes_feed for select to anon using (true);

drop policy if exists "service role writes feed" on public.hermes_feed;
create policy "service role writes feed" on public.hermes_feed for all to service_role using (true) with check (true);

-- Agent writes via: profiles/video-extractor-agent/scripts/feed.py "message" [--kind progress|reply|system] [--instr N]

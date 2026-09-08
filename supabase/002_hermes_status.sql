-- KHChess status page: status feed + instruction inbox
-- Idempotent: safe to re-run.

create table if not exists public.hermes_status (
  id bigint generated always as identity primary key,
  status_code text not null default 'ok',
  title text not null default '',
  block text not null default '',
  awaiting text default '',
  metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.hermes_status enable row level security;
drop policy if exists "anon can read latest status" on public.hermes_status;
create policy "anon can read latest status" on public.hermes_status
  for select to anon using (true);
drop policy if exists "service role writes status" on public.hermes_status;
create policy "service role writes status" on public.hermes_status
  for all to service_role using (true) with check (true);

create table if not exists public.hermes_instructions (
  id bigint generated always as identity primary key,
  passcode text not null,
  instruction text not null,
  status text not null default 'pending',
  response text default '',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.hermes_instructions enable row level security;
drop policy if exists "anon can read instruction status" on public.hermes_instructions;
create policy "anon can read instruction status" on public.hermes_instructions
  for select to anon using (true);

-- Passcode gate: the ONLY write path is this RPC. Stored passcode in a
-- service-role-only table; function is security definer so it can check it.
create table if not exists public.hermes_config (
  key text primary key,
  value text not null
);

insert into public.hermes_config (key, value)
  values ('instruction_passcode', 'Juniper@123')
  on conflict (key) do nothing;

alter table public.hermes_config enable row level security;
drop policy if exists "service role only config" on public.hermes_config;
create policy "service role only config" on public.hermes_config
  for all to service_role using (true) with check (true);

create or replace function public.hermes_submit_instruction(
  p_passcode text,
  p_instruction text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  expected text;
  new_id bigint;
begin
  select value into expected from hermes_config where key = 'instruction_passcode';
  if expected is null or p_passcode is null or p_passcode <> expected then
    raise exception 'bad passcode';
  end if;
  if length(trim(p_instruction)) < 2 then
    raise exception 'instruction too short';
  end if;
  insert into hermes_instructions (passcode, instruction, status)
  values (p_passcode, p_instruction, 'pending')
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.hermes_submit_instruction(text, text) from public, authenticated;
grant execute on function public.hermes_submit_instruction(text, text) to anon;

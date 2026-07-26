-- ============================================================
-- Aftercare — demo-mode additions (2026-07-26)
--
-- ADDITIVE. supabase/schema.sql is the frozen contract and is not
-- touched: nothing here changes an existing table, column or policy.
-- Apply this the same way the schema was applied — paste into the
-- Supabase SQL editor — then check it with `npm run demo:check`.
--
-- Why a table: the public demo has ceilings on paid work (Claude,
-- ElevenLabs, guest records) and serverless gives no memory between
-- requests. An in-process counter resets on every cold start, which
-- means no cap at all. A row is the only honest place to keep it.
-- ============================================================

create table if not exists usage_counters (
  key        text primary key,      -- 'anthropic:usd_micros', 'elevenlabs:chars', …
  used       bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- RLS on with NO policies: this table is service-role only, matching the
-- posture of schema.sql §SECURITY. Nothing signed in can read or move a
-- counter, which is the point — a spend ceiling a client can edit is not one.
alter table usage_counters enable row level security;

-- Increment and read in one round trip. Concurrency matters here: two
-- requests reading, adding and writing separately would lose one of the
-- spends, and a cap that undercounts is worse than no cap because it looks
-- like it is working. `n` may be negative — that is how a reservation is
-- rolled back when it turns out to be over budget.
create or replace function bump_usage(k text, n bigint)
returns bigint
language sql
volatile
set search_path = public
as $$
  insert into usage_counters as u (key, used, updated_at)
  values (k, greatest(n, 0), now())
  on conflict (key) do update
    set used = greatest(u.used + n, 0), updated_at = now()
  returning u.used;
$$;

-- Not SECURITY DEFINER, and not callable by the browser: the function runs
-- as its caller, so RLS still applies to anyone but the service role.
revoke execute on function bump_usage(text, bigint) from public;

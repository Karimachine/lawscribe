-- Migration: 007_add_generate_rate_limits
-- Backs the basic server-side rate limiter added to /api/generate
-- (client/api/_lib/rateLimit.js) -- closes the cost-abuse gap flagged in
-- that route's history and in the pre-existing TODO on
-- client/src/lib/demoRateLimit.js (a client-side, localStorage-only
-- limiter for the public homepage demo, explicitly documented there as
-- "NOT a real rate limit -- trivially bypassed", pending exactly this
-- server-side counterpart).
--
-- `identity` is either `user:<uuid>` for an authenticated caller or
-- `ip:<address>` for an anonymous one (the public demo) -- one table, not
-- two, since the two identity kinds are mutually exclusive per request
-- and never need to be joined against each other.
create table if not exists public.generate_rate_limits (
  identity text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (identity, window_start)
);

create index if not exists idx_generate_rate_limits_window_start on public.generate_rate_limits(window_start);

-- RLS enabled with NO policies at all, deliberately -- same pattern as
-- subscriptions (003_create_subscriptions.sql). This table is only ever
-- touched by generate.js's service-role client (which bypasses RLS
-- entirely, so this changes nothing about how rate limiting actually
-- works), but the anon/publishable key is public by design (shipped in
-- the frontend bundle) and Supabase grants that role table-level access
-- to public-schema tables by default. Without RLS, someone could hit
-- Supabase's REST API directly with that key and delete/manipulate rows
-- here -- e.g. clearing their own identity's counter right before
-- hitting the limit -- defeating the rate limiter entirely. With RLS on
-- and zero policies, that's denied by default regardless of table-level
-- grants; only the service-role client can touch this table at all.
alter table public.generate_rate_limits enable row level security;

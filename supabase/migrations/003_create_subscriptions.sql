-- Migration: 003_create_subscriptions
-- Stripe subscription billing state, one row per user. Unlike
-- clients/documents (added before RLS was in place), RLS is enabled here
-- from the start.
--
-- Only a SELECT policy is granted to users. There are deliberately no
-- insert/update/delete policies -- with RLS enabled and no policy for an
-- action, that action is denied by default for any request using the
-- publishable key. All writes happen server-side via the service-role
-- client, from client/api/billing/create-checkout-session.js (to persist
-- stripe_customer_id up front) and client/api/billing/webhook.js (to keep
-- status in sync with Stripe), both of which bypass RLS entirely.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create unique index if not exists idx_subscriptions_stripe_customer_id on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

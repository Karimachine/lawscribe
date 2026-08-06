-- Migration: 004_add_cancel_at_period_end
-- Adds cancel_at_period_end to subscriptions, so a Stripe Portal
-- cancellation (which sets status to stay 'active' until the period
-- actually ends) can be distinguished from a normal renewal.
--
-- Safe on the existing table/rows: adding a column with a constant
-- NOT NULL DEFAULT is a metadata-only change in Postgres (no table
-- rewrite, no lock escalation) -- the single existing row (and any future
-- ones) reads as cancel_at_period_end = false until a webhook sets it
-- otherwise.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

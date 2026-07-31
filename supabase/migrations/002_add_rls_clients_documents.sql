-- Migration: 002_add_rls_clients_documents
-- Adds Row Level Security to `clients` and `documents`, matching the
-- pattern already used for `api_keys` in 001_create_api_keys.sql.
--
-- Note: unlike api_keys.user_id (uuid), both clients.user_id and
-- documents.user_id are stored as `text` (confirmed via the live schema),
-- so auth.uid() is cast to text before comparing.
--
-- IMPORTANT: this migration alone does not close the actual live exposure.
-- The value currently deployed as the app's "anon" key is a mislabeled
-- service_role key, which bypasses RLS entirely by design. These policies
-- are necessary but not sufficient until that key is replaced/rotated.

alter table public.clients enable row level security;

create policy "Users can view own clients"
  on public.clients for select
  using (auth.uid()::text = user_id);

create policy "Users can insert own clients"
  on public.clients for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update own clients"
  on public.clients for update
  using (auth.uid()::text = user_id);

create policy "Users can delete own clients"
  on public.clients for delete
  using (auth.uid()::text = user_id);

alter table public.documents enable row level security;

create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid()::text = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid()::text = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid()::text = user_id);

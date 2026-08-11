-- Migration: 005_add_organizations
-- Phase 1 of team-member support for the Firm tier ($99/mo). Adds the org
-- data model and a nullable org_id on clients/documents only. Does NOT
-- touch clients/documents RLS policies or query logic -- org-aware access
-- control (query rewrite in clients.js/documents.js, RLS updates) is
-- Phase 2. Org provisioning itself happens server-side in the Stripe
-- webhook handler (client/api/billing/webhook.js) via the service-role
-- client, which bypasses RLS entirely -- the policies below matter for
-- any future direct frontend read, the same pattern already used for
-- `subscriptions` (see 003_create_subscriptions.sql), not for
-- provisioning itself.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text,
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Defense-in-depth beyond the application-level "does an org already exist
-- for this owner" check in webhook.js: even under a concurrent/duplicate
-- webhook delivery, the DB itself refuses a second org for the same owner
-- rather than silently creating one.
create unique index if not exists idx_organizations_owner_user_id on public.organizations(owner_user_id);

create table if not exists public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_organization_members_user_id on public.organization_members(user_id);

-- SECURITY DEFINER helper so the organization_members SELECT policy below
-- can check "which orgs does this user belong to" without recursively
-- re-applying its own policy to itself -- a naive
-- `org_id in (select org_id from organization_members where user_id = auth.uid())`
-- policy written directly on organization_members is the well-known
-- Postgres RLS self-reference pitfall for membership/join tables. Running
-- as the function owner bypasses RLS for this one internal lookup only.
create or replace function public.get_user_org_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from public.organization_members where user_id = uid;
$$;

alter table public.organizations enable row level security;

create policy "Members can view their own org"
  on public.organizations for select
  using (id in (select public.get_user_org_ids(auth.uid())));

create policy "Owner can update their own org"
  on public.organizations for update
  using (owner_user_id = auth.uid());

create policy "Owner can delete their own org"
  on public.organizations for delete
  using (owner_user_id = auth.uid());

-- No insert policy: organizations are only ever created server-side (the
-- webhook's service-role client), same as subscriptions in
-- 003_create_subscriptions.sql.

alter table public.organization_members enable row level security;

create policy "Members can view members of their own org"
  on public.organization_members for select
  using (org_id in (select public.get_user_org_ids(auth.uid())));

create policy "Owner can add members to their own org"
  on public.organization_members for insert
  with check (
    exists (
      select 1 from public.organizations o
      where o.id = org_id and o.owner_user_id = auth.uid()
    )
  );

create policy "Owner can remove members from their own org"
  on public.organization_members for delete
  using (
    exists (
      select 1 from public.organizations o
      where o.id = org_id and o.owner_user_id = auth.uid()
    )
  );

-- Nullable org_id on clients/documents -- Phase 1 only adds the column and
-- backfills it (via webhook.js) for newly-provisioned Firm orgs. Existing
-- RLS policies on these two tables (002_add_rls_clients_documents.sql) are
-- deliberately untouched here; both tables are read/written exclusively
-- through the service-role API routes today anyway (see that migration's
-- own note on this), so org-aware filtering is a query-logic change in
-- Phase 2, not an RLS change.
alter table public.clients add column if not exists org_id uuid references public.organizations(id);
alter table public.documents add column if not exists org_id uuid references public.organizations(id);

create index if not exists idx_clients_org_id on public.clients(org_id);
create index if not exists idx_documents_org_id on public.documents(org_id);

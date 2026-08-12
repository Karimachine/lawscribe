-- Migration: 006_org_aware_rls
-- Phase 2 of team-member support. Replaces the user_id-only RLS policies
-- on clients/documents (002_add_rls_clients_documents.sql) with org-aware
-- versions: a row is visible/writable if it's your own OR it belongs to
-- an org you're a member of.
--
-- IMPORTANT: as with 002's own note, these policies are not the primary
-- access-control layer for clients/documents today -- every API route
-- uses the service-role client (bypasses RLS) and enforces access in
-- application code instead (see client/api/_lib/org.js,
-- getOrgAccessContext, used by clients.js/documents.js). These policies
-- are defense-in-depth for any future direct frontend read, same
-- reasoning as 002. Critically, RLS as written here has no concept of
-- "the org owner's subscription lapsed" -- that revocation is enforced at
-- the query level (org.js), NOT here, because RLS can only see org_id
-- membership, not billing state. A member of a lapsed org is still,
-- technically, RLS-permitted to read/write org rows; the API layer is
-- what actually withholds that access in practice.
--
-- Uses the get_user_org_ids() SECURITY DEFINER helper from
-- 005_add_organizations.sql rather than a raw
-- `select org_id from organization_members where user_id = auth.uid()`
-- subquery -- referencing organization_members directly from here would
-- have that subquery re-filtered by organization_members' own RLS policy
-- (itself calling get_user_org_ids()), which is still correct but does
-- redundant double-filtering. Going straight to the helper avoids that.

drop policy if exists "Users can view own clients" on public.clients;
drop policy if exists "Users can insert own clients" on public.clients;
drop policy if exists "Users can update own clients" on public.clients;
drop policy if exists "Users can delete own clients" on public.clients;

create policy "Users can view own or org clients"
  on public.clients for select
  using (
    auth.uid()::text = user_id
    or org_id in (select public.get_user_org_ids(auth.uid()))
  );

create policy "Users can insert own or org clients"
  on public.clients for insert
  with check (
    auth.uid()::text = user_id
    and (org_id is null or org_id in (select public.get_user_org_ids(auth.uid())))
  );

create policy "Users can update own or org clients"
  on public.clients for update
  using (
    auth.uid()::text = user_id
    or org_id in (select public.get_user_org_ids(auth.uid()))
  );

create policy "Users can delete own or org clients"
  on public.clients for delete
  using (
    auth.uid()::text = user_id
    or org_id in (select public.get_user_org_ids(auth.uid()))
  );

drop policy if exists "Users can view own documents" on public.documents;
drop policy if exists "Users can insert own documents" on public.documents;
drop policy if exists "Users can update own documents" on public.documents;
drop policy if exists "Users can delete own documents" on public.documents;

create policy "Users can view own or org documents"
  on public.documents for select
  using (
    auth.uid()::text = user_id
    or org_id in (select public.get_user_org_ids(auth.uid()))
  );

create policy "Users can insert own or org documents"
  on public.documents for insert
  with check (
    auth.uid()::text = user_id
    and (org_id is null or org_id in (select public.get_user_org_ids(auth.uid())))
  );

create policy "Users can update own or org documents"
  on public.documents for update
  using (
    auth.uid()::text = user_id
    or org_id in (select public.get_user_org_ids(auth.uid()))
  );

create policy "Users can delete own or org documents"
  on public.documents for delete
  using (
    auth.uid()::text = user_id
    or org_id in (select public.get_user_org_ids(auth.uid()))
  );

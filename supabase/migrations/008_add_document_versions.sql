-- Migration: 008_add_document_versions
-- v1 of document edit history: capture-only, no restore UI yet (see
-- TODO.md). Snapshots a document's PRE-edit state into this table right
-- before each overwrite (client/api/documents.js's PUT handler) -- the
-- live `documents` row remains the current state and is never itself
-- inserted here, only past states are. A document with zero edits since
-- creation has zero rows here, which is correct, not missing data.
--
-- No version cap in v1 (unbounded growth, one row per real Update
-- Document click -- not autosave/per-keystroke, so growth is naturally
-- bounded by actual user actions at current usage levels). Tracked as a
-- known trade-off in TODO.md, revisit if usage patterns change.
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  title text,
  prompt text,
  content text,
  -- Who made the edit that pushed this snapshot into history -- nullable
  -- because deleting the editing user's auth.users row (account deletion)
  -- must not be blocked by, or cascade-delete, past version history that
  -- other people may still care about (an org's shared document history
  -- outliving one former member, same grandfathering principle used
  -- elsewhere in this app -- see client/api/account/delete.js).
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Every real read path is "all versions for one document, newest first"
-- (both the minimal list endpoint and the future restore UI) -- a
-- composite index serves that directly instead of a table scan + sort.
create index if not exists idx_document_versions_document_id on public.document_versions(document_id, created_at desc);

-- Same pattern as generate_rate_limits/subscriptions: zero policies.
-- Every read/write of this table goes through the service-role client in
-- client/api/documents.js -- RLS here exists purely so the public anon
-- key (shipped in the frontend bundle) can't read or write it directly,
-- not because the frontend is expected to query it itself.
alter table public.document_versions enable row level security;

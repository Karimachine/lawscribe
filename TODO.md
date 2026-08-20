# TODO

Tracked follow-ups that were deliberately deferred, so they don't quietly become permanent.

- **Publish LawScribe API docs** (added 2026-08-20). `POST /api/generate`,
  `GET /api/documents`, and `GET /api/documents?id=...` now accept a
  LawScribe API key (`Authorization: Bearer lsk_live_...` or
  `X-API-Key: <key>`, issued from the Keys page) in addition to a session.
  Auth was shipped first, on purpose, with docs as an explicit fast-follow
  — but there is currently no published reference (request/response shape,
  error codes, rate limits) for anyone calling it outside the app. Needs a
  real docs page before this is genuinely usable by an external caller.

- **Document version history: restore UI** (planned fast-follow, not yet
  started as of 2026-08-20). v1 is capture-only: a `document_versions` row
  is snapshotted right before each overwrite, holding only *past* states.
  The live `documents` row is the current state and is deliberately never
  itself inserted into `document_versions`. When the restore/browse UI is
  built, it must not render the version list as the whole story — synthesize
  a "Current" entry at the top from the live `documents` row (labeled
  distinctly, not pulled from the versions table), with the real snapshot
  rows below it as "Previous versions." Otherwise the most recent state
  appears to be missing from its own history, which isn't a bug, just an
  artifact of pre-edit snapshotting -- worth getting the UI copy right so
  it doesn't read as one.

- **Document version history: no cap on versions per document** (known
  trade-off, accepted for v1 as of 2026-08-20). `document_versions` grows
  by one row per real "Update Document" save, unbounded -- no pruning of
  old versions, no max-per-document limit. `PUT /api/documents` also has
  no rate limiting of its own (unlike `/api/generate`), so a valid
  authenticated user could in principle inflate a document's history by
  hammering the edit endpoint. Accepted for now given the current
  manual-save UX (not autosave) and low usage/document volume -- revisit
  (e.g. cap at the last N versions per document, prune oldest, or add
  rate limiting to the PUT route) if real usage patterns or abuse make
  this a real storage/cost concern.

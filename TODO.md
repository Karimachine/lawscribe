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

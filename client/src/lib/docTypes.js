// Re-exports the canonical list from client/lib/docTypes.js (shared with
// the backend, which validates/gates documentType against the same data in
// client/api/generate.js) -- kept here too so every existing frontend
// import site (`from '../lib/docTypes'` / `from '../../lib/docTypes'`)
// keeps working unchanged.
export { docTypes, demoDocTypes, isDocTypeUnlocked } from '../../lib/docTypes.js';

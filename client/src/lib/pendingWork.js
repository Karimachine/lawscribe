// Preserves in-progress document content across a forced re-login caused
// by a session-expiry 401 (see handlePotentialSessionExpiry in
// AppShell.jsx) -- so a user who gets logged out mid-save doesn't lose
// what they typed. Two independent slots: one for an unsaved *new*
// document (the generate/save flow), one for an in-progress *edit* of an
// existing one. Both expire after 24h so a stale, long-abandoned draft
// doesn't reappear unexpectedly on a much later login.
const PENDING_SAVE_KEY = 'lawscribe_pending_save';
const PENDING_EDIT_KEY = 'lawscribe_pending_edit';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readPending(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage`, error);
    return null;
  }
}

function writePending(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch (error) {
    // Best-effort only -- a full/blocked localStorage must never prevent
    // showing the session-expired message itself.
    console.error(`Failed to write ${key} to localStorage`, error);
  }
}

function clearPending(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear ${key} from localStorage`, error);
  }
}

export const stashPendingSave = (payload) => writePending(PENDING_SAVE_KEY, payload);
export const readPendingSave = () => readPending(PENDING_SAVE_KEY);
export const clearPendingSave = () => clearPending(PENDING_SAVE_KEY);

export const stashPendingEdit = (payload) => writePending(PENDING_EDIT_KEY, payload);
export const readPendingEdit = () => readPending(PENDING_EDIT_KEY);
export const clearPendingEdit = () => clearPending(PENDING_EDIT_KEY);

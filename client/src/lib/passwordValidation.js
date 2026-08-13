// Shared password-strength rule -- minimum 8 characters, at least 1
// number, at least 1 letter. Applied identically everywhere a password is
// set or changed (signup, reset-password, change-password) so the rule
// and its wording can't drift between the three surfaces.
//
// Takes `t` (the translate function from usePreferences()) so callers get
// back already-translated, requirement-specific messages -- e.g.
// ["At least 8 characters", "At least 1 number"] -- rather than a single
// generic "invalid password" string. Every caller already has `t` in
// scope, so this adds no new plumbing.
const MIN_LENGTH = 8;

export function validatePassword(password, t) {
  const value = password || '';
  const errors = [];

  if (value.length < MIN_LENGTH) {
    errors.push(t('password_requirementLength'));
  }
  if (!/[0-9]/.test(value)) {
    errors.push(t('password_requirementNumber'));
  }
  if (!/[a-zA-Z]/.test(value)) {
    errors.push(t('password_requirementLetter'));
  }

  return { valid: errors.length === 0, errors };
}

// Joins a validatePassword() errors array into the single-string shape
// this codebase's error UI expects (one <p className="auth-error">, not a
// list) -- e.g. "Password needs: At least 8 characters, At least 1 number".
export function formatPasswordErrors(errors, t) {
  return `${t('password_missingRequirementsPrefix')} ${errors.join(', ')}`;
}

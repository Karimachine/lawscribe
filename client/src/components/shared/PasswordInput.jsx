import { useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';

// Visibility state is local useState, so it always starts hidden on mount
// and is never persisted -- satisfies "reset to hidden every mount" for free.
function PasswordInput({ value, onChange, autoComplete }) {
  const [visible, setVisible] = useState(false);
  const { t } = usePreferences();

  return (
    <div className="password-field">
      <input type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? t('password_hide') : t('password_show')}
      >
        {visible ? t('password_hide') : t('password_show')}
      </button>
    </div>
  );
}

export default PasswordInput;

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { docTypes, isDocTypeUnlocked } from '../lib/docTypes';
import { generateDocument } from '../lib/generateDocument';
import { usePreferences } from '../context/PreferencesContext';
import { languageOptions } from '../lib/translations';
import PasswordInput from '../components/shared/PasswordInput';
import { plans } from '../lib/plans';
import { PENDING_CHECKOUT_PLAN_KEY } from '../components/home/PricingSection';
import { validatePassword, formatPasswordErrors } from '../lib/passwordValidation';
import DocumentViewModal from '../components/shared/DocumentViewModal';
import Footer from '../components/shared/Footer';
import { stashPendingSave, readPendingSave, clearPendingSave, stashPendingEdit, readPendingEdit, clearPendingEdit } from '../lib/pendingWork';

const LIST_PAGE_LIMIT = 20;

// The authenticated app (dashboard, clients, API keys, and the sign in /
// sign up form). Business logic here is unchanged from the original
// single-page App.jsx — only the routing mechanism was swapped from
// hand-rolled pushState/popstate to react-router, so it can coexist with
// the new public marketing routes.
function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme, language, setLanguage, t } = usePreferences();

  const [activeDoc, setActiveDoc] = useState(docTypes[0]);
  const [promptText, setPromptText] = useState(docTypes[0].prompt);
  const [generatedText, setGeneratedText] = useState('');
  // Which locked (Pro/Firm-only) doc type the user most recently clicked
  // on Free tier, if any -- drives the inline upgrade prompt below the
  // type grid. null means no locked type has been clicked (or the prompt
  // was dismissed by picking an unlocked type instead).
  const [lockedDocTypeClicked, setLockedDocTypeClicked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveUpgradeUrl, setSaveUpgradeUrl] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [savedDocs, setSavedDocs] = useState([]);
  const [documentsError, setDocumentsError] = useState('');
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [documentsTotal, setDocumentsTotal] = useState(0);
  const [clients, setClients] = useState([]);
  const [clientsError, setClientsError] = useState('');
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [stats, setStats] = useState({ documentsCount: 0, clientsCount: 0 });
  const [statsError, setStatsError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [keysError, setKeysError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', case_type: '' });
  const [clientError, setClientError] = useState('');
  const [clientUpgradeUrl, setClientUpgradeUrl] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [clientSuccess, setClientSuccess] = useState(false);
  const [clientDeleteError, setClientDeleteError] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocContent, setEditDocContent] = useState('');
  const [docUpdateLoading, setDocUpdateLoading] = useState(false);
  const [docUpdateError, setDocUpdateError] = useState('');
  const [docUpdateSuccessId, setDocUpdateSuccessId] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [docDeleteError, setDocDeleteError] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);
  const [pdfDownloadError, setPdfDownloadError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [restoredNotice, setRestoredNotice] = useState('');
  const restoredNoticeTimeoutRef = useRef(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [keysLoading, setKeysLoading] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState(null);
  const [justCreatedKey, setJustCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [revokeError, setRevokeError] = useState(null);
  const [revokeSuccessId, setRevokeSuccessId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);
  const [newEmailValue, setNewEmailValue] = useState('');
  const [changeEmailError, setChangeEmailError] = useState('');
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [changeEmailSuccess, setChangeEmailSuccess] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  // Team support (Phase 3, UI only -- backend from Phase 1/2). teamOrg is
  // null for a solo user with no org; teamMembers is the full roster
  // (email/role/joined) for whoever's org the logged-in user belongs to,
  // used both by the Team page and by the creator-indicator lookups on
  // the Clients/Documents lists below.
  const [teamOrg, setTeamOrg] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamAddEmail, setTeamAddEmail] = useState('');
  const [teamAddLoading, setTeamAddLoading] = useState(false);
  const [teamAddError, setTeamAddError] = useState('');
  const [teamAddSuccess, setTeamAddSuccess] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [teamRemoveError, setTeamRemoveError] = useState(null);
  const settingsRef = useRef(null);
  const revokeSuccessTimeoutRef = useRef(null);
  const clientSuccessTimeoutRef = useRef(null);
  const docUpdateSuccessTimeoutRef = useRef(null);
  const changePasswordSuccessTimeoutRef = useRef(null);
  const clientsListRef = useRef(null);
  const documentsListRef = useRef(null);

  const loadSavedDocs = async (token, page = 1) => {
    setDocumentsLoading(true);
    setDocumentsError('');
    try {
      const response = await fetch(`/api/documents?page=${page}&limit=${LIST_PAGE_LIMIT}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedDocs(data.documents || []);
        setDocumentsTotal(data.total ?? 0);
        setDocumentsPage(data.page ?? page);
      } else {
        setDocumentsError(t('dashboard_loadDocsErrorGeneric'));
      }
    } catch (error) {
      console.error('Failed to load saved documents', error);
      setDocumentsError(t('dashboard_loadDocsErrorGeneric'));
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadClients = async (token, page = 1) => {
    setClientsLoading(true);
    setClientsError('');
    try {
      const response = await fetch(`/api/clients?page=${page}&limit=${LIST_PAGE_LIMIT}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
        setClientsTotal(data.total ?? 0);
        setClientsPage(data.page ?? page);
      } else {
        setClientsError(t('clients_loadErrorGeneric'));
      }
    } catch (error) {
      console.error('Failed to load clients', error);
      setClientsError(t('clients_loadErrorGeneric'));
    } finally {
      setClientsLoading(false);
    }
  };

  const loadStats = async (token) => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const response = await fetch('/api/stats', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setStats({ documentsCount: data.documentsCount ?? 0, clientsCount: data.clientsCount ?? 0 });
      } else {
        setStatsError(t('dashboard_loadStatsErrorGeneric'));
      }
    } catch (error) {
      console.error('Failed to load stats', error);
      setStatsError(t('dashboard_loadStatsErrorGeneric'));
    } finally {
      setStatsLoading(false);
    }
  };

  const loadApiKeys = async (token) => {
    setKeysLoading(true);
    setKeysError('');
    try {
      const response = await fetch('/api/keys', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      } else {
        setKeysError(t('keys_loadErrorGeneric'));
      }
    } catch (error) {
      console.error('Failed to load API keys', error);
      setKeysError(t('keys_loadErrorGeneric'));
    } finally {
      setKeysLoading(false);
    }
  };

  // Read directly via the RLS-scoped Supabase client rather than a custom
  // API route -- the "Users can view own subscription" policy from the
  // 003_create_subscriptions migration already limits this to the caller's
  // own row, so there's nothing a server route would add here.
  const loadSubscription = async () => {
    setSubscriptionLoading(true);
    setSubscriptionError('');
    try {
      const { data, error } = await supabase.from('subscriptions').select('*').maybeSingle();
      if (error) throw error;
      setSubscription(data || null);
    } catch (error) {
      console.error('Failed to load subscription', error);
      setSubscriptionError(t('billing_loadErrorGeneric'));
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // org: null for a solo user (never shown a Team nav tab/page at all --
  // see hasTeam below). members carries email/role/joined_at for the
  // caller's own org, reused for both the Team page and the
  // "Added by <email>" indicators on Clients/Documents.
  const loadTeam = async (token) => {
    setTeamLoading(true);
    setTeamError('');
    try {
      const response = await fetch('/api/team', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTeamOrg(data.org || null);
        setTeamMembers(data.members || []);
      } else {
        setTeamError(t('team_loadErrorGeneric'));
      }
    } catch (error) {
      console.error('Failed to load team', error);
      setTeamError(t('team_loadErrorGeneric'));
    } finally {
      setTeamLoading(false);
    }
  };

  // Idempotent: only actually inserts a row the first time it's called for
  // a given user (see create-free-subscription.js). Called on every
  // session establish, not just right after signUp(), because signUp()
  // doesn't hand back a session when email confirmation is required --
  // there'd be nothing to authenticate this call with at that point.
  const ensureFreePlan = async (token) => {
    try {
      await fetch('/api/billing?action=create-free-subscription', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to ensure free plan', error);
    }
  };

  // Detects a stale/expired-session 401 on a write request. Auto-refresh
  // is enabled by default in supabase-js, but its refresh timer is a
  // plain setInterval, which browsers throttle or pause in backgrounded
  // tabs -- a documented supabase-js limitation (its own source has a
  // comment acknowledging this exact case), not a misconfiguration here.
  // When a long-backgrounded tab regains focus, there's a real window
  // where a write can race ahead of the pending refresh and hit the
  // server with an already-expired token. Returns true if this response
  // was a session-expiry 401 (the caller should stop -- this already
  // handled it); false otherwise, so the caller's existing error
  // handling runs as normal.
  const handlePotentialSessionExpiry = (response) => {
    if (response.status === 401) {
      setSessionExpired(true);
      return true;
    }
    return false;
  };

  // The session is already unusable by the time this fires -- signing out
  // clears any dead local session state before sending the user to log
  // back in, rather than leaving a half-dead session for /login to trip
  // over.
  const reauthenticate = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Runs once per successful session establish (see fetchSession below).
  // A no-op in the common case -- readPendingSave/readPendingEdit return
  // null unless a session-expiry 401 actually stashed something. Restores
  // into form state rather than auto-resubmitting, so nothing gets
  // written on the user's behalf without their own explicit save.
  const restorePendingWork = () => {
    const showRestoredNotice = (message) => {
      setRestoredNotice(message);
      if (restoredNoticeTimeoutRef.current) {
        clearTimeout(restoredNoticeTimeoutRef.current);
      }
      restoredNoticeTimeoutRef.current = setTimeout(() => setRestoredNotice(''), 6000);
    };

    const pendingSave = readPendingSave();
    if (pendingSave) {
      const matchingType = docTypes.find((docType) => docType.title === pendingSave.title);
      if (matchingType) setActiveDoc(matchingType);
      setPromptText(pendingSave.prompt || '');
      setGeneratedText(pendingSave.content || '');
      clearPendingSave();
      showRestoredNotice(t('session_restoredSaveNotice'));
      return;
    }

    const pendingEdit = readPendingEdit();
    if (pendingEdit) {
      setEditingDocId(pendingEdit.id);
      setEditDocTitle(pendingEdit.title || '');
      setEditDocContent(pendingEdit.content || '');
      clearPendingEdit();
      showRestoredNotice(t('session_restoredEditNotice'));
    }
  };

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session || null);
        setUser(data?.session?.user || null);
        const token = data?.session?.access_token;
        if (token) {
          await Promise.all([
            loadSavedDocs(token),
            loadClients(token),
            loadStats(token),
            loadApiKeys(token),
            ensureFreePlan(token),
            loadTeam(token),
            // Loaded broadly (not just on /app/billing, see the pathname-
            // gated effect below) so the Team-owner "shared access paused"
            // banner on Clients/Documents can compute ownerOrgActive
            // wherever the owner happens to be in the app.
            loadSubscription()
          ]);
          restorePendingWork();
        }
      } catch (error) {
        console.warn('Auth session error:', error);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user || null);
      if (session?.access_token) {
        await Promise.all([
          loadSavedDocs(session.access_token),
          loadClients(session.access_token),
          loadStats(session.access_token),
          loadApiKeys(session.access_token),
          ensureFreePlan(session.access_token),
          loadTeam(session.access_token),
          loadSubscription()
        ]);
      } else {
        setSavedDocs([]);
        setDocumentsError('');
        setDocumentsPage(1);
        setDocumentsTotal(0);
        setClients([]);
        setClientsError('');
        setClientsPage(1);
        setClientsTotal(0);
        setStats({ documentsCount: 0, clientsCount: 0 });
        setStatsError('');
        setApiKeys([]);
        setKeysError('');
        setJustCreatedKey(null);
        setRevokeError(null);
        setRevokeSuccessId(null);
        setEditingClientId(null);
        setEditingDocId(null);
        setDocDeleteError(null);
        setDocUpdateSuccessId(null);
        setViewingDoc(null);
        setPdfDownloadingId(null);
        setPdfDownloadError(null);
        setSubscription(null);
        setSubscriptionError('');
        setTeamOrg(null);
        setTeamMembers([]);
        setTeamError('');
        setTeamAddEmail('');
        setTeamAddError('');
        setTeamAddSuccess(false);
        setTeamRemoveError(null);
        setLockedDocTypeClicked(null);
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!user && location.pathname !== '/login') {
      navigate('/login');
    } else if (user && location.pathname === '/login') {
      const pendingPlan = localStorage.getItem(PENDING_CHECKOUT_PLAN_KEY);
      if (pendingPlan && session?.access_token) {
        localStorage.removeItem(PENDING_CHECKOUT_PLAN_KEY);
        startCheckoutForPlan(pendingPlan, session.access_token);
      } else {
        navigate('/app');
      }
    }
  }, [user, location.pathname, navigate, session]);

  useEffect(() => {
    if (location.pathname === '/app/billing' && session?.access_token) {
      loadSubscription();
    }
  }, [location.pathname, session]);

  useEffect(() => {
    if (!settingsOpen) return;

    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  // Warn on tab close/refresh while a newly-generated key hasn't been
  // dismissed yet -- it can never be retrieved again after this point.
  useEffect(() => {
    if (!justCreatedKey) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [justCreatedKey]);

  useEffect(
    () => () => {
      if (revokeSuccessTimeoutRef.current) {
        clearTimeout(revokeSuccessTimeoutRef.current);
      }
      if (clientSuccessTimeoutRef.current) {
        clearTimeout(clientSuccessTimeoutRef.current);
      }
      if (docUpdateSuccessTimeoutRef.current) {
        clearTimeout(docUpdateSuccessTimeoutRef.current);
      }
      if (restoredNoticeTimeoutRef.current) {
        clearTimeout(restoredNoticeTimeoutRef.current);
      }
    },
    []
  );

  const closeMobileNav = () => setMobileNavOpen(false);

  // In-app navigation (nav bar) unmounts AppShell and loses justCreatedKey
  // just as surely as leaving the tab -- gate it the same way.
  const guardedNavigate = (path) => {
    closeMobileNav();
    if (justCreatedKey && !window.confirm(t('keys_unsavedKeyWarning'))) {
      return;
    }
    navigate(path);
  };

  // Mirrors the exact orgActive || isActivePaidPlan(subscription) shape
  // the backend uses in generate.js/documents.js -- a Firm team member
  // has no subscription row of their own (only the org owner does), so
  // this can't be a plain subscription check alone or every non-owner
  // member would be incorrectly greyed out of Pro-only types too.
  // teamOrg.active is populated identically for owner and member alike
  // (see team.js), so no separate owner/member branch is needed here.
  const hasFullDocTypeAccess = Boolean(
    (subscription &&
      (subscription.status === 'active' || subscription.status === 'trialing') &&
      (subscription.plan === 'pro' || subscription.plan === 'firm')) ||
      teamOrg?.active === true
  );

  const activeDocButton = (doc) => {
    if (!isDocTypeUnlocked(doc, hasFullDocTypeAccess)) {
      // Locked type -- don't switch the active selection, just surface
      // the upgrade prompt. The real restriction is server-side
      // (generate.js rejects it regardless); this is purely UX so a Free
      // user isn't left guessing why nothing happened.
      setLockedDocTypeClicked(doc);
      return;
    }
    setLockedDocTypeClicked(null);
    setActiveDoc(doc);
    setPromptText(doc.prompt);
    setGeneratedText('');
    setSaveError('');
    setSaveSuccess(false);
  };

  const handleAuthChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const signIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const signUp = async () => {
    setAuthError('');

    // Client-side only -- Supabase's own minimum is currently below this
    // (see passwordValidation.js), so this is a UX improvement, not the
    // actual enforcement boundary. Deliberately not applied to signIn():
    // an existing account's password predates this rule and must not be
    // rejected retroactively just because it's shorter or simpler.
    const { valid, errors } = validatePassword(form.password, t);
    if (!valid) {
      setAuthError(formatPasswordErrors(errors, t));
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email: form.email, password: form.password });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  const openForgotPassword = () => {
    setResetEmail(form.email);
    setResetError('');
    setResetSuccess(false);
    setShowForgotPassword(true);
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetError('');
    setResetSuccess(false);
  };

  const requestPasswordReset = async () => {
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      // Generic wording regardless of outcome -- never confirms or denies
      // whether an account exists for the submitted email.
      setResetSuccess(true);
    } catch (error) {
      console.error('Failed to request password reset', error);
      setResetError(t('login_resetErrorGeneric'));
    } finally {
      setResetLoading(false);
    }
  };

  const signOut = async () => {
    closeMobileNav();

    if (justCreatedKey && !window.confirm(t('keys_unsavedKeyWarning'))) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSavedDocs([]);
    setDocumentsError('');
    setDocumentsPage(1);
    setDocumentsTotal(0);
    setClients([]);
    setClientsError('');
    setClientsPage(1);
    setClientsTotal(0);
    setStats({ documentsCount: 0, clientsCount: 0 });
    setStatsError('');
    setApiKeys([]);
    setKeysError('');
    setJustCreatedKey(null);
    setRevokeError(null);
    setRevokeSuccessId(null);
    setEditingClientId(null);
    setEditingDocId(null);
    setDocDeleteError(null);
    setDocUpdateSuccessId(null);
    setViewingDoc(null);
    setPdfDownloadingId(null);
    setPdfDownloadError(null);
    setSettingsOpen(false);
    setTeamOrg(null);
    setTeamMembers([]);
    setTeamError('');
    setTeamAddEmail('');
    setTeamAddError('');
    setTeamAddSuccess(false);
    setTeamRemoveError(null);
    setLockedDocTypeClicked(null);
    navigate('/login');
  };

  const changePassword = async () => {
    setChangePasswordError('');
    setChangePasswordSuccess(false);

    const { valid, errors } = validatePassword(changePasswordForm.newPassword, t);
    if (!valid) {
      setChangePasswordError(formatPasswordErrors(errors, t));
      return;
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setChangePasswordError(t('settings_passwordsDontMatch'));
      return;
    }

    setChangePasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: changePasswordForm.currentPassword
      });
      if (signInError) {
        setChangePasswordError(t('settings_currentPasswordIncorrect'));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: changePasswordForm.newPassword });
      if (updateError) throw updateError;

      setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangePasswordSuccess(true);
      if (changePasswordSuccessTimeoutRef.current) {
        clearTimeout(changePasswordSuccessTimeoutRef.current);
      }
      changePasswordSuccessTimeoutRef.current = setTimeout(() => setChangePasswordSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to change password', error);
      // error here is always a real Supabase Auth error (thrown from
      // updateError above, the only throw in this try block) -- its
      // .message is already user-presentable, same pattern already used
      // correctly in signIn() and ResetPasswordPage.jsx.
      setChangePasswordError(error?.message || t('settings_changePasswordErrorGeneric'));
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const changeEmail = async () => {
    setChangeEmailError('');
    setChangeEmailSuccess(false);

    if (!newEmailValue.trim()) {
      setChangeEmailError(t('settings_changeEmailErrorGeneric'));
      return;
    }

    setChangeEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmailValue.trim() });
      if (error) throw error;

      setNewEmailValue('');
      setChangeEmailSuccess(true);
    } catch (error) {
      console.error('Failed to change email', error);
      // Same reasoning as changePassword above -- error is a real Supabase
      // Auth error (e.g. "email already in use"), not a generic exception.
      setChangeEmailError(error?.message || t('settings_changeEmailErrorGeneric'));
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE' || !session?.access_token || deleteAccountLoading) {
      return;
    }

    setDeleteAccountLoading(true);
    setDeleteAccountError('');
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (handlePotentialSessionExpiry(response)) {
        setDeleteAccountLoading(false);
        return;
      }
      if (!response.ok) {
        // Prefer the server's own message (e.g. org_has_members' "Remove
        // all other team members before deleting your account.") over the
        // generic fallback -- set directly here rather than thrown+caught
        // below, so a genuinely unexpected exception (network failure,
        // etc.) is the only thing that ever falls through to the catch
        // block's generic message.
        const data = await response.json().catch(() => ({}));
        setDeleteAccountError(data?.message || data?.error || t('settings_deleteAccountErrorGeneric'));
        setDeleteAccountLoading(false);
        return;
      }

      await supabase.auth.signOut();
      navigate('/account-deleted');
    } catch (error) {
      console.error('Failed to delete account', error);
      setDeleteAccountError(t('settings_deleteAccountErrorGeneric'));
      setDeleteAccountLoading(false);
    }
  };

  // Only called from the post-login "resume checkout" effect below --
  // initiating checkout for a plan the user chose *before* signing in.
  // Subscribing itself always happens from the public pricing page now
  // (see PricingSection.jsx); this page only shows/manages the current
  // plan.
  const startCheckoutForPlan = async (plan, token) => {
    if (!token) return;

    try {
      const response = await fetch('/api/billing?action=create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      if (!data.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Failed to resume checkout after login', error);
      navigate('/app/billing');
    }
  };

  const openBillingPortal = async () => {
    if (!session?.access_token) return;

    setPortalLoading(true);
    setPortalError('');
    try {
      const response = await fetch('/api/billing?action=create-portal-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (handlePotentialSessionExpiry(response)) {
        setPortalLoading(false);
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPortalError(data?.message || data?.error || t('billing_portalErrorGeneric'));
        setPortalLoading(false);
        return;
      }
      if (!data.url) {
        throw new Error('No portal URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Failed to open billing portal', error);
      setPortalError(t('billing_portalErrorGeneric'));
      setPortalLoading(false);
    }
  };

  const generateDoc = async () => {
    if (!session?.access_token) {
      setAuthError('Please sign in to generate documents.');
      return;
    }

    setLoading(true);
    setGeneratedText('');
    setSaveError('');
    setSaveSuccess(false);

    try {
      const content = await generateDocument({
        prompt: promptText,
        documentType: activeDoc.title,
        accessToken: session.access_token
      });
      setGeneratedText(content || 'Document generated successfully.');
    } catch (error) {
      console.error('Failed to generate document', error);
      if (error.status === 401) {
        setSessionExpired(true);
        setGeneratedText('');
        return;
      }
      if (error.status === 429) {
        setGeneratedText(error.serverMessage || t('dashboard_generateRateLimited'));
        return;
      }
      if (error.status === 403) {
        // Defense in depth -- the UI already locks Pro-only types before
        // this call is ever made, so reaching this branch means client
        // state was stale (e.g. a plan just changed in another tab), not
        // that the lock/prompt above was bypassed. Server response is the
        // source of truth either way.
        setGeneratedText(error.serverMessage || t('dashboard_docTypeLockedMessage'));
        return;
      }
      setGeneratedText('There was a problem generating the document.');
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async () => {
    if (!session?.access_token) {
      setSaveError(t('dashboard_signInToSave'));
      return;
    }

    if (!generatedText.trim()) {
      setSaveError(t('dashboard_nothingToSave'));
      return;
    }

    setSaveLoading(true);
    setSaveError('');
    setSaveUpgradeUrl('');
    setSaveSuccess(false);

    try {
      const saveResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ title: activeDoc.title, prompt: promptText, content: generatedText })
      });

      const saveData = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) {
        if (handlePotentialSessionExpiry(saveResponse)) {
          stashPendingSave({ title: activeDoc.title, prompt: promptText, content: generatedText });
          return;
        }
        // Free tier's monthly document cap (see documents.js) -- shown as
        // the server's own message plus an upgrade link, not folded into
        // the generic error path below.
        if (saveData?.error === 'free_tier_limit_reached') {
          setSaveError(saveData.message || t('dashboard_saveErrorGeneric'));
          setSaveUpgradeUrl(saveData.upgradeUrl || '/app/billing');
          return;
        }
        setSaveError(saveData?.message || saveData?.error || t('dashboard_saveErrorGeneric'));
        return;
      }

      setSaveSuccess(true);
      await loadSavedDocs(session.access_token, 1);
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to save document', error);
      setSaveError(t('dashboard_saveErrorGeneric'));
    } finally {
      setSaveLoading(false);
    }
  };

  const startEditDoc = (doc) => {
    setEditingDocId(doc.id);
    setEditDocTitle(doc.title || '');
    setEditDocContent(doc.content || '');
    setDocUpdateError('');
  };

  const cancelEditDoc = () => {
    setEditingDocId(null);
    setEditDocTitle('');
    setEditDocContent('');
    setDocUpdateError('');
  };

  const submitDocUpdate = async (id) => {
    if (!session?.access_token) {
      setDocUpdateError(t('dashboard_signInToSave'));
      return;
    }

    const original = savedDocs.find((doc) => doc.id === id);

    setDocUpdateLoading(true);
    setDocUpdateError('');

    try {
      const response = await fetch(`/api/documents?id=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: editDocTitle.trim() || 'Generated Document',
          prompt: original?.prompt || '',
          content: editDocContent
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (handlePotentialSessionExpiry(response)) {
          stashPendingEdit({ id, title: editDocTitle, content: editDocContent });
          return;
        }
        setDocUpdateError(data?.message || data?.error || t('dashboard_docUpdateErrorGeneric'));
        return;
      }

      setSavedDocs((prev) => prev.map((doc) => (doc.id === id ? data : doc)));
      setEditingDocId(null);
      setDocUpdateSuccessId(id);
      if (docUpdateSuccessTimeoutRef.current) {
        clearTimeout(docUpdateSuccessTimeoutRef.current);
      }
      docUpdateSuccessTimeoutRef.current = setTimeout(() => setDocUpdateSuccessId(null), 3000);
    } catch (error) {
      console.error('Failed to update document', error);
      setDocUpdateError(t('dashboard_docUpdateErrorGeneric'));
    } finally {
      setDocUpdateLoading(false);
    }
  };

  const deleteDocument = async (id) => {
    if (!window.confirm(t('dashboard_confirmDeleteDocument'))) {
      return;
    }

    if (!session?.access_token) {
      return;
    }

    setDeletingDocId(id);
    setDocDeleteError(null);

    try {
      const response = await fetch(`/api/documents?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (handlePotentialSessionExpiry(response)) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setDocDeleteError({ id, message: data?.message || data?.error || t('dashboard_docDeleteErrorGeneric') });
        return;
      }

      if (editingDocId === id) {
        cancelEditDoc();
      }
      await loadSavedDocs(session.access_token, 1);
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to delete document', error);
      setDocDeleteError({ id, message: t('dashboard_docDeleteErrorGeneric') });
    } finally {
      setDeletingDocId(null);
    }
  };

  const openViewDoc = (doc) => {
    setViewingDoc(doc);
  };

  const closeViewDoc = () => {
    setViewingDoc(null);
  };

  // Closes the view modal and hands off to the existing edit-in-place
  // flow -- the modal itself has no edit capability of its own.
  const editFromViewDoc = () => {
    if (viewingDoc) {
      startEditDoc(viewingDoc);
    }
    setViewingDoc(null);
  };

  const downloadDocumentPdf = async (doc) => {
    if (!session?.access_token) return;

    setPdfDownloadingId(doc.id);
    setPdfDownloadError(null);

    try {
      const response = await fetch(`/api/documents?id=${doc.id}&format=pdf`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Server sets Content-Disposition with a sanitized filename, but a
      // blob download via an <a download> click doesn't read that header
      // -- the filename below is derived the same way, just client-side.
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(doc.title || 'document').trim().replace(/[^a-z0-9 _-]/gi, '').replace(/\s+/g, '-') || 'document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF', error);
      setPdfDownloadError({ id: doc.id, message: t('dashboard_downloadPdfError') });
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const handleClientChange = (field, value) => {
    setClientForm((prev) => ({ ...prev, [field]: value }));
  };

  const startEditClient = (client) => {
    setEditingClientId(client.id);
    setClientForm({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      case_type: client.case_type || ''
    });
    setClientError('');
    setClientSuccess(false);
  };

  const cancelEditClient = () => {
    setEditingClientId(null);
    setClientForm({ name: '', email: '', phone: '', case_type: '' });
    setClientError('');
    setClientSuccess(false);
  };

  const submitClientForm = async () => {
    if (!session?.access_token) {
      setClientError('Please sign in to manage clients.');
      return;
    }

    const isEditing = Boolean(editingClientId);

    setClientLoading(true);
    setClientError('');
    setClientUpgradeUrl('');
    setClientSuccess(false);

    try {
      const response = await fetch(isEditing ? `/api/clients?id=${editingClientId}` : '/api/clients', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(clientForm)
      });

      const data = await response.json();
      if (!response.ok) {
        if (handlePotentialSessionExpiry(response)) return;
        // Free tier's 0-client cap (see clients.js) -- shown as the
        // server's own message plus an upgrade link, same pattern as the
        // document save limit above.
        if (data?.error === 'free_tier_client_limit') {
          setClientError(data.message || t('clients_saveErrorGeneric'));
          setClientUpgradeUrl(data.upgradeUrl || '/app/billing');
          return;
        }
        setClientError(data?.message || data?.error || t('clients_saveErrorGeneric'));
        return;
      }

      if (isEditing) {
        setClients((prev) => prev.map((client) => (client.id === data.id ? data : client)));
        setEditingClientId(null);
        setClientSuccess(true);
        if (clientSuccessTimeoutRef.current) {
          clearTimeout(clientSuccessTimeoutRef.current);
        }
        clientSuccessTimeoutRef.current = setTimeout(() => setClientSuccess(false), 3000);
      } else {
        // Re-fetch page 1 rather than splicing locally -- a new client
        // always sorts first (created_at desc), but only the server knows
        // the real total/page-1 contents once pagination is in play.
        await loadClients(session.access_token, 1);
      }

      setClientForm({ name: '', email: '', phone: '', case_type: '' });
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to save client', error);
      setClientError(t('clients_saveErrorGeneric'));
    } finally {
      setClientLoading(false);
    }
  };

  const removeClient = async (id) => {
    // Separate from the API keys confirm-before-revoke work below -- same
    // gap, flagged by the same audit, applied consistently here.
    if (!window.confirm(t('clients_confirmDelete'))) {
      return;
    }

    if (!session?.access_token) {
      return;
    }

    setClientDeleteError(null);

    try {
      const response = await fetch(`/api/clients?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (handlePotentialSessionExpiry(response)) return;
      if (!response.ok) {
        // Previously silent -- a failed delete showed nothing at all, not
        // even a generic message, so there was no fallback to fix here;
        // this adds the missing error state itself, same shape as
        // docDeleteError above.
        const data = await response.json().catch(() => ({}));
        setClientDeleteError({ id, message: data?.message || data?.error || t('clients_deleteErrorGeneric') });
        return;
      }
      if (editingClientId === id) {
        cancelEditClient();
      }
      await loadClients(session.access_token, 1);
      await loadStats(session.access_token);
    } catch (error) {
      console.error('Failed to delete client', error);
      setClientDeleteError({ id, message: t('clients_deleteErrorGeneric') });
    }
  };

  const createApiKey = async () => {
    if (justCreatedKey) {
      setApiKeyError(t('keys_dismissFirst'));
      return;
    }

    if (!session?.access_token) {
      setApiKeyError('Please sign in to create API keys.');
      return;
    }

    setApiKeyLoading(true);
    setApiKeyError('');

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name: apiKeyName.trim() || 'Default key' })
      });

      const data = await response.json();
      if (!response.ok) {
        if (handlePotentialSessionExpiry(response)) return;
        setApiKeyError(data?.message || data?.error || t('keys_createErrorGeneric'));
        return;
      }

      setJustCreatedKey(data.key);
      setApiKeyName('');
      await loadApiKeys(session.access_token);
    } catch (error) {
      console.error('Failed to create API key', error);
      setApiKeyError(t('keys_createErrorGeneric'));
    } finally {
      setApiKeyLoading(false);
    }
  };

  const revokeApiKey = async (id) => {
    if (!session?.access_token) {
      return;
    }

    if (!window.confirm(t('keys_confirmRevoke'))) {
      return;
    }

    setRevokingKeyId(id);
    setRevokeError(null);
    setRevokeSuccessId(null);
    if (revokeSuccessTimeoutRef.current) {
      clearTimeout(revokeSuccessTimeoutRef.current);
    }

    try {
      const response = await fetch(`/api/keys?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (handlePotentialSessionExpiry(response)) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setRevokeError({ id, message: data?.message || data?.error || t('keys_revokeErrorGeneric') });
        return;
      }

      if (justCreatedKey?.id === id) {
        setJustCreatedKey(null);
      }

      setRevokeSuccessId(id);
      revokeSuccessTimeoutRef.current = setTimeout(() => setRevokeSuccessId(null), 3000);
      await loadApiKeys(session.access_token);
    } catch (error) {
      console.error('Failed to revoke API key', error);
      setRevokeError({ id, message: t('keys_revokeErrorGeneric') });
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyApiKey = async () => {
    if (!justCreatedKey?.fullKey) return;
    try {
      await navigator.clipboard.writeText(justCreatedKey.fullKey);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy API key', error);
    }
  };

  const submitAddTeamMember = async () => {
    if (!session?.access_token) return;

    const email = teamAddEmail.trim();
    if (!email) {
      setTeamAddError(t('team_addErrorGeneric'));
      return;
    }

    setTeamAddLoading(true);
    setTeamAddError('');
    setTeamAddSuccess(false);

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (handlePotentialSessionExpiry(response)) return;
        // Map the two known error cases to clear messages; anything else
        // falls back to a generic message rather than showing raw
        // server error text.
        if (data?.error === 'user_not_found') {
          setTeamAddError(t('team_addErrorUserNotFound'));
        } else if (data?.error === 'already_member') {
          setTeamAddError(t('team_addErrorAlreadyMember'));
        } else {
          setTeamAddError(t('team_addErrorGeneric'));
        }
        return;
      }

      setTeamAddEmail('');
      setTeamAddSuccess(true);
      await loadTeam(session.access_token);
    } catch (error) {
      console.error('Failed to add team member', error);
      setTeamAddError(t('team_addErrorGeneric'));
    } finally {
      setTeamAddLoading(false);
    }
  };

  const removeTeamMember = async (memberUserId) => {
    // Same confirm-before-destructive-action pattern as client/document
    // delete and key revoke above.
    if (!window.confirm(t('team_confirmRemove'))) {
      return;
    }

    if (!session?.access_token) return;

    setRemovingMemberId(memberUserId);
    setTeamRemoveError(null);

    try {
      const response = await fetch('/api/team', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: memberUserId })
      });

      if (handlePotentialSessionExpiry(response)) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setTeamRemoveError({ id: memberUserId, message: data?.message || data?.error || t('team_removeErrorGeneric') });
        return;
      }

      await loadTeam(session.access_token);
    } catch (error) {
      console.error('Failed to remove team member', error);
      setTeamRemoveError({ id: memberUserId, message: t('team_removeErrorGeneric') });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const formatDate = (iso) => (iso ? new Date(iso).toLocaleString() : 'Never');

  const clientsTotalPages = Math.max(1, Math.ceil(clientsTotal / LIST_PAGE_LIMIT));
  const documentsTotalPages = Math.max(1, Math.ceil(documentsTotal / LIST_PAGE_LIMIT));

  const goToClientsPage = async (page) => {
    if (!session?.access_token) return;
    await loadClients(session.access_token, page);
    clientsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goToDocumentsPage = async (page) => {
    if (!session?.access_token) return;
    await loadSavedDocs(session.access_token, page);
    documentsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isLoginPage = location.pathname === '/login';
  const isDashboard = location.pathname === '/app';
  const isClients = location.pathname === '/app/clients';
  const isApiKeys = location.pathname === '/app/keys';
  const isBilling = location.pathname === '/app/billing';
  const isTeam = location.pathname === '/app/team';
  const currentPlan = plans.find((plan) => plan.id === subscription?.plan) || plans[0];

  // hasTeam gates the nav tab entirely -- a user who never belongs to an
  // org never sees an empty Team page. isTeamOwner drives the
  // add/remove-member controls (never relies on the backend's 403 alone --
  // the UI simply doesn't offer an action that would fail for a non-owner).
  const hasTeam = Boolean(teamOrg);
  const myMembership = teamMembers.find((member) => member.user_id === user?.id);
  const isTeamOwner = myMembership?.role === 'owner';
  const memberEmailByUserId = Object.fromEntries(teamMembers.map((member) => [member.user_id, member.email]));

  // Owner path: their own subscription (already loaded for the Billing
  // page, same isActivePaidPlan definition used server-side in
  // _lib/plan.js) *is* the org's shared-access state -- reliable without
  // any backend change, computed the same way it always has been.
  const ownerOrgActive =
    isTeamOwner &&
    Boolean(
      subscription &&
        (subscription.status === 'active' || subscription.status === 'trialing') &&
        (subscription.plan === 'pro' || subscription.plan === 'firm')
    );
  // Member path (Phase 3.5): a non-owner member has no subscription row
  // of their own and RLS correctly blocks them from reading the owner's,
  // so this can only come from the server -- team.js's GET response now
  // includes org.active, computed there via the same getOrgAccessContext
  // used by clients.js/documents.js.
  const showOwnerPausedBanner = hasTeam && isTeamOwner && !ownerOrgActive;
  const showMemberPausedBanner = hasTeam && !isTeamOwner && teamOrg?.active === false;
  const showPausedBanner = showOwnerPausedBanner || showMemberPausedBanner;
  const orgOwnerEmail = teamMembers.find((member) => member.role === 'owner')?.email;

  // Derived straight from the rows actually returned by the API, not from
  // a guessed "is sharing active" flag -- so it's never wrong: if access
  // is currently paused, the API has already narrowed the list to the
  // caller's own rows server-side (Phase 2), and this just labels them.
  const creatorLabel = (rowUserId) => {
    if (!hasTeam) return null;
    if (rowUserId === user?.id) return t('team_addedByYou');
    const email = memberEmailByUserId[rowUserId];
    return `${t('team_addedByLabel')} ${email || t('team_unknownMember')}`;
  };

  return (
    <div className="app-shell">
      <nav className="nav">
        <button className="nav-logo" onClick={() => guardedNavigate('/app')}>
          Law<span>Scribe</span>
        </button>

        <button
          type="button"
          className="nav-toggle"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`nav-links ${mobileNavOpen ? 'open' : ''}`}>
          <button className="nav-link" onClick={() => guardedNavigate('/app')}>
            {t('nav_dashboard')}
          </button>
          <button className="nav-link" onClick={() => guardedNavigate('/app/clients')}>
            {t('nav_clients')}
          </button>
          <button className="nav-link" onClick={() => guardedNavigate('/app/keys')}>
            {t('nav_apiKeys')}
          </button>
          <button className="nav-link" onClick={() => guardedNavigate('/app/billing')}>
            {t('nav_billing')}
          </button>
          {hasTeam && (
            <button className="nav-link" onClick={() => guardedNavigate('/app/team')}>
              {t('nav_team')}
            </button>
          )}
          {user ? (
            <button className="nav-cta" onClick={signOut}>
              {t('nav_signOut')}
            </button>
          ) : (
            <button
              className="nav-cta"
              onClick={() => {
                closeMobileNav();
                navigate('/login');
              }}
            >
              {t('nav_signIn')}
            </button>
          )}
        </div>
      </nav>

      {sessionExpired && !isLoginPage && (
        <div className="session-expired-banner">
          {t('session_expiredMessage')}{' '}
          <button type="button" className="link-button" onClick={reauthenticate}>
            {t('session_expiredAction')}
          </button>
        </div>
      )}

      <main>
        {isLoginPage && (
          <section className="auth-section">
            <div className="auth-panel">
              {!showForgotPassword ? (
                <>
                  <h2>{t('login_title')}</h2>
                  <label>{t('login_email')}</label>
                  <input type="email" value={form.email} onChange={(e) => handleAuthChange('email', e.target.value)} />
                  <label>{t('login_password')}</label>
                  <PasswordInput
                    value={form.password}
                    onChange={(e) => handleAuthChange('password', e.target.value)}
                    autoComplete="current-password"
                  />
                  <p className="field-hint">{t('login_passwordHint')}</p>
                  <div className="forgot-password-row">
                    <button type="button" className="link-button" onClick={openForgotPassword}>
                      {t('login_forgotPassword')}
                    </button>
                  </div>
                  {authError && <p className="auth-error">{authError}</p>}
                  <div className="auth-actions">
                    <button disabled={authLoading} onClick={signIn}>
                      {authLoading ? t('login_signingIn') : t('login_signIn')}
                    </button>
                    <button disabled={authLoading} className="secondary" onClick={signUp}>
                      {authLoading ? t('login_registering') : t('login_createAccount')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2>{t('login_forgotTitle')}</h2>
                  <p>{t('login_forgotSubtitle')}</p>
                  {!resetSuccess ? (
                    <>
                      <label>{t('login_email')}</label>
                      <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                      {resetError && <p className="auth-error">{resetError}</p>}
                      <div className="auth-actions">
                        <button disabled={resetLoading} onClick={requestPasswordReset}>
                          {resetLoading ? t('login_sendingReset') : t('login_sendReset')}
                        </button>
                        <button className="secondary" onClick={closeForgotPassword}>
                          {t('login_backToSignIn')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="save-success">{t('login_resetSent')}</p>
                      <div className="auth-actions">
                        <button className="secondary" onClick={closeForgotPassword}>
                          {t('login_backToSignIn')}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {isDashboard && (
          <section className="dashboard-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('dashboard_label')}</span>
                <h2>
                  {t('dashboard_welcome')}
                  {user?.email ? `, ${user.email}` : ''}
                </h2>
                <p>{t('dashboard_subtitle')}</p>
              </div>

              <div className="settings-wrap" ref={settingsRef}>
                <button
                  type="button"
                  className="settings-trigger"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((open) => !open)}
                >
                  ⚙ {t('settings_title')}
                </button>

                {settingsOpen && (
                  <div className="settings-panel">
                    <div className="settings-section">
                      <h4>{t('settings_account')}</h4>
                      <p className="settings-account-email">
                        {t('settings_signedInAs')} {user?.email}
                      </p>
                    </div>

                    <div className="settings-section">
                      <h4>{t('settings_changePassword')}</h4>
                      <label>{t('settings_currentPassword')}</label>
                      <PasswordInput
                        value={changePasswordForm.currentPassword}
                        onChange={(e) =>
                          setChangePasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                        }
                        autoComplete="current-password"
                      />
                      <label>{t('settings_newPassword')}</label>
                      <PasswordInput
                        value={changePasswordForm.newPassword}
                        onChange={(e) => setChangePasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        autoComplete="new-password"
                      />
                      <p className="field-hint">{t('settings_passwordHint')}</p>
                      <label>{t('settings_confirmNewPassword')}</label>
                      <PasswordInput
                        value={changePasswordForm.confirmPassword}
                        onChange={(e) =>
                          setChangePasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        autoComplete="new-password"
                      />
                      {changePasswordError && <p className="auth-error">{changePasswordError}</p>}
                      {changePasswordSuccess && <p className="save-success">{t('settings_changePasswordSuccess')}</p>}
                      <div className="auth-actions">
                        <button disabled={changePasswordLoading} onClick={changePassword}>
                          {changePasswordLoading ? t('settings_changingPassword') : t('settings_changePasswordButton')}
                        </button>
                      </div>
                    </div>

                    <div className="settings-section">
                      <h4>{t('settings_changeEmail')}</h4>
                      <label>{t('settings_newEmail')}</label>
                      <input type="email" value={newEmailValue} onChange={(e) => setNewEmailValue(e.target.value)} />
                      {changeEmailError && <p className="auth-error">{changeEmailError}</p>}
                      {changeEmailSuccess && <p className="save-success">{t('settings_changeEmailSuccess')}</p>}
                      <div className="auth-actions">
                        <button disabled={changeEmailLoading} onClick={changeEmail}>
                          {changeEmailLoading ? t('settings_changingEmail') : t('settings_changeEmailButton')}
                        </button>
                      </div>
                    </div>

                    <div className="settings-section">
                      <h4>{t('settings_appearance')}</h4>
                      <div className="settings-row">
                        <span>{t('settings_darkMode')}</span>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                          <span className="toggle-switch-track" />
                        </label>
                      </div>
                    </div>

                    <div className="settings-section">
                      <h4>{t('settings_language')}</h4>
                      <select
                        className="settings-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {languageOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="settings-section settings-danger-zone">
                      <h4>{t('settings_dangerZone')}</h4>
                      <p>{t('settings_deleteAccountBody')}</p>
                      <label>{t('settings_deleteAccountConfirmLabel')}</label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                      />
                      {deleteAccountError && <p className="auth-error">{deleteAccountError}</p>}
                      <div className="auth-actions">
                        <button
                          className="danger"
                          disabled={deleteConfirmText !== 'DELETE' || deleteAccountLoading}
                          onClick={deleteAccount}
                        >
                          {deleteAccountLoading ? t('settings_deletingAccount') : t('settings_deleteAccountButton')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {restoredNotice && <p className="save-success dashboard-restored-notice">{restoredNotice}</p>}

            {showPausedBanner && (
              <div className="team-paused-banner">
                {isTeamOwner ? (
                  <>
                    {t('team_pausedBanner')} <Link to="/app/billing">{t('team_pausedBannerLink')}</Link>
                  </>
                ) : (
                  <>
                    {t('team_pausedBannerMemberPrefix')} {orgOwnerEmail || t('team_unknownOwner')}{' '}
                    {t('team_pausedBannerMemberSuffix')}
                  </>
                )}
              </div>
            )}

            {statsError ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <p className="auth-error">{statsError}</p>
                  <button disabled={statsLoading} onClick={() => loadStats(session.access_token)}>
                    {statsLoading ? t('common_retrying') : t('common_tryAgain')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>{t('dashboard_statDocuments')}</h3>
                  <p>{stats.documentsCount}</p>
                </div>
                <div className="stat-card">
                  <h3>{t('dashboard_statClients')}</h3>
                  <p>{stats.clientsCount}</p>
                </div>
              </div>
            )}

            <div className="dashboard-grid">
              <div className="dashboard-panel">
                <h3>{t('dashboard_generateTitle')}</h3>
                <div className="doc-types">
                  {docTypes.map((doc) => {
                    const locked = !isDocTypeUnlocked(doc, hasFullDocTypeAccess);
                    return (
                      <button
                        key={doc.id}
                        className={`doc-option ${doc.id === activeDoc.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                        onClick={() => activeDocButton(doc)}
                        aria-pressed={doc.id === activeDoc.id}
                      >
                        <span>{doc.title}</span>
                        {locked && <span className="doc-option-lock">{t('dashboard_docTypeLockedBadge')}</span>}
                      </button>
                    );
                  })}
                </div>
                {lockedDocTypeClicked && (
                  <div className="doc-type-upgrade-prompt">
                    <strong>{lockedDocTypeClicked.title}</strong> {t('dashboard_docTypeLockedMessage')}{' '}
                    {/* Plain <a>, not a react-router Link -- #pricing lives on the
                        marketing homepage outside AppShell's routes (same reasoning
                        as the Billing page's "Change plan" link just above it). */}
                    <a href="/#pricing">{t('dashboard_docTypeUpgradeLink')}</a>
                  </div>
                )}
                <label>{t('dashboard_promptLabel')}</label>
                <textarea className="dashboard-textarea" value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={7} />
                <button className="btn-primary generate-action" onClick={generateDoc} disabled={loading}>
                  {loading ? t('dashboard_generating') : t('dashboard_generate')}
                </button>
                {generatedText && (
                  <div className="output-panel">
                    <h4>{t('dashboard_generatedTitle')}</h4>
                    <textarea
                      className="dashboard-textarea"
                      value={generatedText}
                      onChange={(e) => {
                        setGeneratedText(e.target.value);
                        setSaveSuccess(false);
                      }}
                      rows={10}
                    />
                    {saveError && (
                      <p className="auth-error">
                        {saveError}
                        {saveUpgradeUrl && (
                          <>
                            {' '}
                            <Link to={saveUpgradeUrl}>{t('dashboard_upgradeLink')}</Link>
                          </>
                        )}
                      </p>
                    )}
                    {saveSuccess && <p className="save-success">{t('dashboard_saveSuccess')}</p>}
                    <button className="btn-primary generate-action" onClick={saveDocument} disabled={saveLoading}>
                      {saveLoading ? t('dashboard_saving') : t('dashboard_saveDocument')}
                    </button>
                  </div>
                )}
              </div>
              <div className="dashboard-panel">
                <h3 ref={documentsListRef}>{t('dashboard_savedTitle')}</h3>
                {documentsError ? (
                  <div>
                    <p className="auth-error">{documentsError}</p>
                    <button disabled={documentsLoading} onClick={() => loadSavedDocs(session.access_token, documentsPage)}>
                      {documentsLoading ? t('common_retrying') : t('common_tryAgain')}
                    </button>
                  </div>
                ) : savedDocs.length === 0 ? (
                  <p>{t('dashboard_noSaved')}</p>
                ) : (
                  <ul className="client-list">
                    {savedDocs.map((doc) =>
                      editingDocId === doc.id ? (
                        <li key={doc.id}>
                          <div style={{ width: '100%' }}>
                            <label>{t('dashboard_docTitleLabel')}</label>
                            <input type="text" value={editDocTitle} onChange={(e) => setEditDocTitle(e.target.value)} />
                            <label>{t('dashboard_generatedTitle')}</label>
                            <textarea
                              className="dashboard-textarea"
                              value={editDocContent}
                              onChange={(e) => setEditDocContent(e.target.value)}
                              rows={8}
                            />
                            {docUpdateError && <p className="auth-error">{docUpdateError}</p>}
                            <div className="auth-actions">
                              <button disabled={docUpdateLoading} onClick={() => submitDocUpdate(doc.id)}>
                                {docUpdateLoading ? t('dashboard_saving') : t('dashboard_updateDocument')}
                              </button>
                              <button className="secondary" onClick={cancelEditDoc}>
                                {t('common_cancel')}
                              </button>
                            </div>
                          </div>
                        </li>
                      ) : (
                        <li key={doc.id}>
                          <div>
                            <strong>{doc.title}</strong>
                            {hasTeam && <div className="creator-note">{creatorLabel(doc.user_id)}</div>}
                            {docUpdateSuccessId === doc.id && <p className="save-success">{t('dashboard_docUpdateSuccess')}</p>}
                            {docDeleteError?.id === doc.id && <p className="auth-error">{docDeleteError.message}</p>}
                            {pdfDownloadError?.id === doc.id && <p className="auth-error">{pdfDownloadError.message}</p>}
                          </div>
                          <div className="auth-actions">
                            <button className="btn-secondary" onClick={() => openViewDoc(doc)}>
                              {t('dashboard_viewDocument')}
                            </button>
                            <button
                              className="btn-secondary"
                              disabled={pdfDownloadingId === doc.id}
                              onClick={() => downloadDocumentPdf(doc)}
                            >
                              {pdfDownloadingId === doc.id ? t('dashboard_downloadingPdf') : t('dashboard_downloadPdf')}
                            </button>
                            <button className="btn-secondary" onClick={() => startEditDoc(doc)}>
                              {t('dashboard_editDocument')}
                            </button>
                            <button
                              className="danger"
                              disabled={deletingDocId === doc.id}
                              onClick={() => deleteDocument(doc.id)}
                            >
                              {deletingDocId === doc.id ? t('dashboard_deleting') : t('dashboard_deleteDocument')}
                            </button>
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                )}
                {!documentsError && documentsTotalPages > 1 && (
                  <div className="auth-actions">
                    <button
                      className="secondary"
                      disabled={documentsLoading || documentsPage <= 1}
                      onClick={() => goToDocumentsPage(documentsPage - 1)}
                    >
                      {documentsLoading ? t('common_loading') : t('common_previous')}
                    </button>
                    <span>
                      {t('common_page')} {documentsPage} {t('common_of')} {documentsTotalPages}
                    </span>
                    <button
                      className="secondary"
                      disabled={documentsLoading || documentsPage >= documentsTotalPages}
                      onClick={() => goToDocumentsPage(documentsPage + 1)}
                    >
                      {documentsLoading ? t('common_loading') : t('common_next')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {isClients && (
          <section className="clients-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('clients_label')}</span>
                <h2>{t('clients_title')}</h2>
                <p>{t('clients_subtitle')}</p>
              </div>
            </div>

            {showPausedBanner && (
              <div className="team-paused-banner">
                {isTeamOwner ? (
                  <>
                    {t('team_pausedBanner')} <Link to="/app/billing">{t('team_pausedBannerLink')}</Link>
                  </>
                ) : (
                  <>
                    {t('team_pausedBannerMemberPrefix')} {orgOwnerEmail || t('team_unknownOwner')}{' '}
                    {t('team_pausedBannerMemberSuffix')}
                  </>
                )}
              </div>
            )}

            <div className="clients-grid">
              <div className="client-panel">
                <h3>{editingClientId ? t('clients_editTitle') : t('clients_addTitle')}</h3>
                <label>{t('clients_name')}</label>
                <input type="text" value={clientForm.name} onChange={(e) => handleClientChange('name', e.target.value)} />
                <label>{t('clients_email')}</label>
                <input type="email" value={clientForm.email} onChange={(e) => handleClientChange('email', e.target.value)} />
                <label>{t('clients_phone')}</label>
                <input type="text" value={clientForm.phone} onChange={(e) => handleClientChange('phone', e.target.value)} />
                <label>{t('clients_caseType')}</label>
                <input type="text" value={clientForm.case_type} onChange={(e) => handleClientChange('case_type', e.target.value)} />
                {clientError && (
                  <p className="auth-error">
                    {clientError}
                    {clientUpgradeUrl && (
                      <>
                        {' '}
                        <Link to={clientUpgradeUrl}>{t('clients_upgradeLink')}</Link>
                      </>
                    )}
                  </p>
                )}
                {clientSuccess && <p className="save-success">{t('clients_updateSuccess')}</p>}
                <div className="auth-actions">
                  <button className="btn-primary" disabled={clientLoading} onClick={submitClientForm}>
                    {clientLoading
                      ? t('clients_saving')
                      : editingClientId
                        ? t('clients_update')
                        : t('clients_save')}
                  </button>
                  {editingClientId && (
                    <button className="secondary" onClick={cancelEditClient}>
                      {t('common_cancel')}
                    </button>
                  )}
                </div>
              </div>

              <div className="client-panel">
                <h3 ref={clientsListRef}>{t('clients_listTitle')}</h3>
                {clientsError ? (
                  <div>
                    <p className="auth-error">{clientsError}</p>
                    <button disabled={clientsLoading} onClick={() => loadClients(session.access_token, clientsPage)}>
                      {clientsLoading ? t('common_retrying') : t('common_tryAgain')}
                    </button>
                  </div>
                ) : clients.length === 0 ? (
                  <p>{t('clients_noClients')}</p>
                ) : (
                  <ul className="client-list">
                    {clients.map((client) => (
                      <li key={client.id}>
                        <div>
                          <strong>{client.name}</strong>
                          <div>{client.email}</div>
                          <div>{client.phone}</div>
                          {hasTeam && <div className="creator-note">{creatorLabel(client.user_id)}</div>}
                          {clientDeleteError?.id === client.id && <p className="auth-error">{clientDeleteError.message}</p>}
                        </div>
                        <div className="auth-actions">
                          <button className="btn-secondary" onClick={() => startEditClient(client)}>
                            {t('clients_edit')}
                          </button>
                          <button className="danger" onClick={() => removeClient(client.id)}>
                            {t('clients_delete')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {!clientsError && clientsTotalPages > 1 && (
                  <div className="auth-actions">
                    <button
                      className="secondary"
                      disabled={clientsLoading || clientsPage <= 1}
                      onClick={() => goToClientsPage(clientsPage - 1)}
                    >
                      {clientsLoading ? t('common_loading') : t('common_previous')}
                    </button>
                    <span>
                      {t('common_page')} {clientsPage} {t('common_of')} {clientsTotalPages}
                    </span>
                    <button
                      className="secondary"
                      disabled={clientsLoading || clientsPage >= clientsTotalPages}
                      onClick={() => goToClientsPage(clientsPage + 1)}
                    >
                      {clientsLoading ? t('common_loading') : t('common_next')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {isApiKeys && (
          <section className="clients-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('keys_label')}</span>
                <h2>{t('keys_title')}</h2>
                <p>{t('keys_subtitle')}</p>
              </div>
            </div>

            <div className="clients-grid">
              <div className="client-panel">
                <h3>{t('keys_createTitle')}</h3>
                <label>{t('keys_nameLabel')}</label>
                <input
                  type="text"
                  placeholder="Default key"
                  value={apiKeyName}
                  maxLength={50}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  disabled={!!justCreatedKey}
                />
                {apiKeyError && <p className="auth-error">{apiKeyError}</p>}
                <button className="btn-primary" disabled={apiKeyLoading || !!justCreatedKey} onClick={createApiKey}>
                  {apiKeyLoading ? t('keys_creating') : t('keys_create')}
                </button>

                {justCreatedKey && (
                  <div className="output-panel">
                    <h4>{t('keys_copyNowTitle')}</h4>
                    <p>{t('keys_copyNowBody')}</p>
                    <p className="api-key-value">{justCreatedKey.fullKey}</p>
                    <div className="auth-actions">
                      <button className="btn-secondary" onClick={copyApiKey}>
                        {copied ? t('keys_copied') : t('keys_copy')}
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setJustCreatedKey(null);
                          setCopied(false);
                        }}
                      >
                        {t('keys_doneCopied')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="client-panel">
                <h3>{t('keys_yourKeys')}</h3>
                {keysLoading ? (
                  <p>{t('keys_loading')}</p>
                ) : keysError ? (
                  <div>
                    <p className="auth-error">{keysError}</p>
                    <button onClick={() => loadApiKeys(session.access_token)}>{t('common_tryAgain')}</button>
                  </div>
                ) : apiKeys.length === 0 ? (
                  <p>{t('keys_noKeys')}</p>
                ) : (
                  <ul className="client-list">
                    {apiKeys.map((key) => (
                      <li key={key.id} className={key.revoked_at ? 'revoked' : ''}>
                        <div>
                          <strong>{key.name}</strong>
                          <div>{key.key_prefix}…</div>
                          <div>
                            {t('keys_created')} {formatDate(key.created_at)}
                          </div>
                          <div>
                            {t('keys_lastUsed')} {formatDate(key.last_used_at)}
                          </div>
                          <div>
                            {key.revoked_at ? (
                              <>
                                <span className="key-badge">{t('keys_revoked')}</span> {formatDate(key.revoked_at)}
                              </>
                            ) : (
                              t('keys_active')
                            )}
                          </div>
                          {revokeError?.id === key.id && <p className="auth-error">{revokeError.message}</p>}
                          {revokeSuccessId === key.id && <p className="save-success">{t('keys_revokeSuccess')}</p>}
                        </div>
                        {!key.revoked_at && (
                          <button
                            className="danger"
                            disabled={revokingKeyId === key.id}
                            onClick={() => revokeApiKey(key.id)}
                          >
                            {revokingKeyId === key.id ? t('keys_revoking') : t('keys_revoke')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {isBilling && (
          <section className="clients-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('billing_label')}</span>
                <h2>{t('billing_title')}</h2>
                <p>{t('billing_subtitle')}</p>
              </div>
            </div>

            <div className="clients-grid">
              <div className="client-panel">
                <div className={`plan ${currentPlan.id === 'pro' ? 'featured' : ''}`}>
                  <div className="plan-name">{currentPlan.name}</div>
                  <div className="plan-price">
                    {currentPlan.price}
                    <span>{currentPlan.period}</span>
                  </div>
                  <p className="plan-desc">{currentPlan.description}</p>
                  <div className="plan-divider" />
                  {currentPlan.features.map((feature) => (
                    <p key={feature} className="plan-feature">
                      {feature}
                    </p>
                  ))}
                  {currentPlan.id === 'free' && (
                    <a href="/#pricing" className="plan-btn">
                      {t('billing_viewPlans')}
                    </a>
                  )}
                </div>
              </div>

              <div className="client-panel">
                <h3>{t('billing_yourSubscription')}</h3>
                {subscriptionLoading ? (
                  <p>{t('billing_loading')}</p>
                ) : subscriptionError ? (
                  <div>
                    <p className="auth-error">{subscriptionError}</p>
                    <button onClick={loadSubscription}>{t('common_tryAgain')}</button>
                  </div>
                ) : !subscription?.status ? (
                  <p>{t('billing_noSubscription')}</p>
                ) : (
                  <>
                    <p>
                      {t('billing_statusLabel')} <strong>{subscription.status}</strong>
                    </p>
                    {subscription.current_period_end && (
                      <p>
                        {subscription.cancel_at_period_end ? t('billing_cancelsLabel') : t('billing_renewsLabel')}{' '}
                        {formatDate(subscription.current_period_end)}
                      </p>
                    )}
                  </>
                )}
                {subscription?.stripe_subscription_id && (
                  <>
                    {portalError && <p className="auth-error">{portalError}</p>}
                    <div className="auth-actions">
                      <button disabled={portalLoading} onClick={openBillingPortal}>
                        {portalLoading ? t('billing_openingPortal') : t('billing_manageButton')}
                      </button>
                    </div>
                    <p>
                      {/* Plain <a>, not a react-router Link -- matches the
                          existing Free-tier "View plans" pattern (same
                          element type just above), since #pricing lives on
                          the marketing homepage outside AppShell's routes
                          and needs a real navigation + anchor scroll, not a
                          client-side route change. PricingSection's own
                          handleManageOrSwitch() is already current-plan-
                          aware and routes a tier switch through the Stripe
                          portal -- reused as-is rather than duplicating a
                          second plan-picker UI here. */}
                      <a href="/#pricing">{t('billing_changePlanLink')}</a>
                    </p>
                  </>
                )}
                {isTeamOwner && (
                  <p>
                    <Link to="/app/team">{t('billing_manageTeamLink')}</Link>
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {isTeam && (
          <section className="clients-page">
            <div className="page-header">
              <div>
                <span className="section-label">{t('team_label')}</span>
                <h2>{t('team_title')}</h2>
                <p>{t('team_subtitle')}</p>
              </div>
            </div>

            <div className="clients-grid">
              <div className="client-panel">
                <h3>{t('team_membersTitle')}</h3>
                {teamLoading ? (
                  <p>{t('common_loading')}</p>
                ) : teamError ? (
                  <div>
                    <p className="auth-error">{teamError}</p>
                    <button onClick={() => loadTeam(session.access_token)}>{t('common_tryAgain')}</button>
                  </div>
                ) : (
                  <ul className="client-list">
                    {teamMembers.map((member) => (
                      <li key={member.user_id}>
                        <div>
                          <strong>{member.email}</strong>
                          <div>
                            <span className={`role-badge ${member.role === 'owner' ? 'role-badge-owner' : ''}`}>
                              {member.role === 'owner' ? t('team_roleOwner') : t('team_roleMember')}
                            </span>
                          </div>
                          <div>
                            {t('team_joinedLabel')} {formatDate(member.created_at)}
                          </div>
                          {teamRemoveError?.id === member.user_id && (
                            <p className="auth-error">{teamRemoveError.message}</p>
                          )}
                        </div>
                        {isTeamOwner && member.role !== 'owner' && (
                          <button
                            className="danger"
                            disabled={removingMemberId === member.user_id}
                            onClick={() => removeTeamMember(member.user_id)}
                          >
                            {removingMemberId === member.user_id ? t('team_removing') : t('team_removeButton')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="client-panel">
                {isTeamOwner ? (
                  <>
                    <h3>{t('team_addTitle')}</h3>
                    <label>{t('team_addEmailLabel')}</label>
                    <input type="email" value={teamAddEmail} onChange={(e) => setTeamAddEmail(e.target.value)} />
                    {teamAddError && <p className="auth-error">{teamAddError}</p>}
                    {teamAddSuccess && <p className="save-success">{t('team_addSuccess')}</p>}
                    <div className="auth-actions">
                      <button className="btn-primary" disabled={teamAddLoading} onClick={submitAddTeamMember}>
                        {teamAddLoading ? t('team_adding') : t('team_addButton')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p>{t('team_readOnlyNote')}</p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {viewingDoc && (
        <DocumentViewModal
          doc={viewingDoc}
          onClose={closeViewDoc}
          onEdit={editFromViewDoc}
          onDownloadPdf={() => downloadDocumentPdf(viewingDoc)}
          pdfLoading={pdfDownloadingId === viewingDoc.id}
          pdfError={pdfDownloadError?.id === viewingDoc.id ? pdfDownloadError.message : ''}
        />
      )}

      <Footer />
    </div>
  );
}

export default AppShell;

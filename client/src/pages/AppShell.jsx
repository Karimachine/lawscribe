import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { docTypes } from '../lib/docTypes';
import { generateDocument } from '../lib/generateDocument';
import { usePreferences } from '../context/PreferencesContext';
import { languageOptions } from '../lib/translations';
import PasswordInput from '../components/shared/PasswordInput';
import { plans } from '../lib/plans';
import { PENDING_CHECKOUT_PLAN_KEY } from '../components/home/PricingSection';

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
  const [clientLoading, setClientLoading] = useState(false);
  const [clientSuccess, setClientSuccess] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [editDocContent, setEditDocContent] = useState('');
  const [docUpdateLoading, setDocUpdateLoading] = useState(false);
  const [docUpdateError, setDocUpdateError] = useState('');
  const [docUpdateSuccessId, setDocUpdateSuccessId] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [docDeleteError, setDocDeleteError] = useState(null);
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
            ensureFreePlan(token)
          ]);
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
          ensureFreePlan(session.access_token)
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
        setSubscription(null);
        setSubscriptionError('');
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

  const activeDocButton = (doc) => {
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
    setAuthLoading(true);
    setAuthError('');
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
    setSettingsOpen(false);
    navigate('/login');
  };

  const changePassword = async () => {
    setChangePasswordError('');
    setChangePasswordSuccess(false);

    if (changePasswordForm.newPassword.length < 8) {
      setChangePasswordError(t('settings_passwordTooShort'));
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
      setChangePasswordError(t('settings_changePasswordErrorGeneric'));
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
      setChangeEmailError(t('settings_changeEmailErrorGeneric'));
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

      if (!response.ok) {
        throw new Error('Failed to delete account');
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

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const data = await response.json();
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
      const content = await generateDocument({ prompt: promptText, documentType: activeDoc.title });
      setGeneratedText(content || 'Document generated successfully.');
    } catch (error) {
      console.error('Failed to generate document', error);
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
        // Free tier's monthly document cap (see documents.js) -- shown as
        // the server's own message plus an upgrade link, not folded into
        // the generic error path below.
        if (saveData?.error === 'free_tier_limit_reached') {
          setSaveError(saveData.message || t('dashboard_saveErrorGeneric'));
          setSaveUpgradeUrl(saveData.upgradeUrl || '/app/billing');
          return;
        }
        throw new Error(saveData?.error || 'Failed to save document');
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
        throw new Error(data?.error || 'Failed to update document');
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

      if (!response.ok) {
        throw new Error('Failed to delete document');
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
        throw new Error(data?.error || 'Unable to save client');
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

    try {
      const response = await fetch(`/api/clients?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (response.ok) {
        if (editingClientId === id) {
          cancelEditClient();
        }
        await loadClients(session.access_token, 1);
        await loadStats(session.access_token);
      }
    } catch (error) {
      console.error('Failed to delete client', error);
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
        throw new Error(data?.error || 'Unable to create API key');
      }

      setJustCreatedKey(data.key);
      setApiKeyName('');
      await loadApiKeys(session.access_token);
    } catch (error) {
      console.error('Failed to create API key', error);
      setApiKeyError('Unable to create API key. Please try again.');
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

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
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
  const currentPlan = plans.find((plan) => plan.id === subscription?.plan) || plans[0];

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
                  {docTypes.map((doc) => (
                    <button
                      key={doc.id}
                      className={`doc-option ${doc.id === activeDoc.id ? 'active' : ''}`}
                      onClick={() => activeDocButton(doc)}
                    >
                      <span>{doc.title}</span>
                    </button>
                  ))}
                </div>
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
                            {docUpdateSuccessId === doc.id && <p className="save-success">{t('dashboard_docUpdateSuccess')}</p>}
                            {docDeleteError?.id === doc.id && <p className="auth-error">{docDeleteError.message}</p>}
                          </div>
                          <div className="auth-actions">
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
                {clientError && <p className="auth-error">{clientError}</p>}
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
                  </>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <a href="#" className="footer-logo">
          Law<span>Scribe</span>
        </a>
        <div className="footer-links">
          <Link to="/privacy">{t('footer_privacy')}</Link>
          <Link to="/terms">{t('footer_terms')}</Link>
          <a href="#">Help</a>
          <a href="#">Contact</a>
        </div>
        <div className="footer-copy">© 2026 LawScribe. Not a law firm.</div>
      </footer>
    </div>
  );
}

export default AppShell;

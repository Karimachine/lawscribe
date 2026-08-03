import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { error: documentsError } = await supabase.from('documents').delete().eq('user_id', user.id);
  if (documentsError) {
    console.error('Failed to delete documents during account deletion:', documentsError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  const { error: clientsError } = await supabase.from('clients').delete().eq('user_id', user.id);
  if (clientsError) {
    console.error('Failed to delete clients during account deletion:', clientsError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  const { error: keysError } = await supabase.from('api_keys').delete().eq('user_id', user.id);
  if (keysError) {
    console.error('Failed to delete API keys during account deletion:', keysError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error('Failed to delete auth user during account deletion:', deleteUserError);
    return res.status(500).json({ error: 'Unable to delete account' });
  }

  return res.status(204).end();
}

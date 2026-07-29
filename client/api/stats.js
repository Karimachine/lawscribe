import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const missingVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variable(s): ${missingVars.join(', ')}`);
    return res.status(500).json({ error: `Server misconfigured: missing ${missingVars.join(', ')}` });
  }

  const supabase = getSupabaseAdmin();

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const [documentsResult, clientsResult] = await Promise.all([
      supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
    ]);

    if (documentsResult.error) {
      console.error('Supabase count error (documents):', documentsResult.error);
      return res.status(500).json({ error: 'Unable to fetch stats' });
    }

    if (clientsResult.error) {
      console.error('Supabase count error (clients):', clientsResult.error);
      return res.status(500).json({ error: 'Unable to fetch stats' });
    }

    return res.status(200).json({
      documentsCount: documentsResult.count || 0,
      clientsCount: clientsResult.count || 0
    });
  }

  res.setHeader('Allow', 'GET');
  return res.status(405).json({ error: 'Method not allowed' });
}
import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { getOrgAccessContext } from './_lib/org.js';

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
    // Org-active: counts are org-wide (every member's documents/clients
    // count toward the same total), matching what the list endpoints now
    // return in that state. Otherwise unchanged -- per-user.
    const orgContext = await getOrgAccessContext(supabase, user.id);
    const orgActive = orgContext?.active === true;

    let documentsQuery = supabase.from('documents').select('*', { count: 'exact', head: true });
    let clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true });

    if (orgActive) {
      documentsQuery = documentsQuery.eq('org_id', orgContext.orgId);
      clientsQuery = clientsQuery.eq('org_id', orgContext.orgId);
    } else {
      documentsQuery = documentsQuery.eq('user_id', user.id);
      clientsQuery = clientsQuery.eq('user_id', user.id);
    }

    const [documentsResult, clientsResult] = await Promise.all([documentsQuery, clientsQuery]);

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
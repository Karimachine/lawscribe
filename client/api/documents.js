import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';
import { parsePagination } from './_lib/pagination.js';

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
    const { page, limit, from, to } = parsePagination(req.query);

    const { data, error, count } = await supabase
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch documents' });
    }

    return res.status(200).json({
      documents: data || [],
      total: count ?? 0,
      page,
      limit
    });
  }

  if (req.method === 'POST') {
    const { title, prompt, content } = req.body || {};
    if (!prompt || !content) {
      return res.status(400).json({ error: 'Prompt and content are required.' });
    }

    const insert = {
      user_id: user.id,
      title: title || 'Generated Document',
      prompt,
      content
    };

    const { data, error } = await supabase.from('documents').insert([insert]).select().single();
    if (error) {
      console.error('Supabase insert error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ error: 'Unable to save document' });
    }

    return res.status(201).json(data);
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

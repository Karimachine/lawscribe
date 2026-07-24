import { getSupabaseAdmin, getUserFromToken } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  const user = await getUserFromToken(supabase, req.headers.authorization);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch documents' });
    }

    return res.status(200).json(data || []);
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

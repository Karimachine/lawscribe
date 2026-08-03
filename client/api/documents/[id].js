import { getSupabaseAdmin, getUserFromToken } from '../_lib/supabaseAdmin.js';

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

  const { id } = req.query || {};
  if (!id) {
    return res.status(400).json({ error: 'Document id is required.' });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const { title, prompt, content } = req.body || {};
    if (!prompt || !content) {
      return res.status(400).json({ error: 'Prompt and content are required.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        title: title || 'Generated Document',
        prompt,
        content
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Supabase update error:', error);
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase delete error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return res.status(500).json({ error: 'Unable to delete document' });
    }

    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, PATCH, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

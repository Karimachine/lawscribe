const express = require('express');
const supabase = require('../utils/supabaseClient');

const router = express.Router();

async function getUserFromToken(authHeader) {
  if (!supabase) return null;
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// GET /api/documents - list documents for authenticated user
router.get('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch documents' });
    }

    return res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

// POST /api/documents - save a generated document
router.post('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { title, prompt, content } = req.body;
    if (!prompt || !content) return res.status(400).json({ error: 'Prompt and content are required.' });

    const insert = {
      user_id: user.id,
      title: title || 'Generated Document',
      prompt,
      content
    };

    const { data, error } = await supabase.from('documents').insert([insert]).select().single();
    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Unable to save document' });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({ error: 'Unable to save document' });
  }
});

module.exports = router;

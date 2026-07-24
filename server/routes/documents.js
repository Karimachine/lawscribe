const express = require('express');
const supabase = require('../utils/supabaseClient');
const { getUserFromToken } = require('../utils/auth');

const router = express.Router();

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// If supabase is not configured, respond with a helpful 500 for all routes
if (!supabase) {
  router.use((req, res) => {
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' });
  });

  module.exports = router;
  return;
}

// GET /api/documents - list documents for authenticated user
router.get('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return unauthorized(res);
    }

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
    if (!user) {
      return unauthorized(res);
    }

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

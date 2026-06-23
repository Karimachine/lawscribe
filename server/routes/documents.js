const express = require('express');
const supabase = require('../utils/supabaseClient');
const Document = require('../models/Document');

const router = express.Router();

async function getUserFromToken(authHeader) {
  if (!supabase) {
    return null;
  }
  
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

router.get('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const docs = await Document.find({ userId: user.id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, prompt, content } = req.body;
    if (!prompt || !content) {
      return res.status(400).json({ error: 'Prompt and content are required.' });
    }

    const doc = new Document({
      userId: user.id,
      title: title || 'Generated Document',
      prompt,
      content
    });

    await doc.save();
    res.status(201).json(doc);
  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({ error: 'Unable to save document' });
  }
});

module.exports = router;

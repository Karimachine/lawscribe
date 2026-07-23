const express = require('express');
const supabase = require('../utils/supabaseClient');
const { getUserFromToken } = require('../utils/auth');

const router = express.Router();

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

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
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Unable to fetch documents' });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return unauthorized(res);
    }

    const { title, prompt, content } = req.body;
    if (!prompt || !content) {
      return res.status(400).json({ error: 'Prompt and content are required.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert([
        {
          user_id: user.id,
          title: title || 'Generated Document',
          prompt,
          content
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({ error: 'Unable to save document' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return unauthorized(res);
    }

    const { title, prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    let content;

    if (!anthropicKey) {
      content = `Preview: Unable to generate document because Anthropic API key is not configured. Prompt was: ${prompt}`;
    } else {
      const completePrompt = `Write a complete legal document based on the request below. Return only the document text.

Human: ${prompt}

Assistant:`;

      const response = await fetch('https://api.anthropic.com/v1/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': anthropicKey
        },
        body: JSON.stringify({
          model: 'claude-3.5',
          prompt: completePrompt,
          max_tokens_to_sample: 1200,
          temperature: 0.2,
          top_p: 1
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Claude request failed: ${response.status} ${body}`);
      }

      const responseBody = await response.json();
      content = (responseBody.completion || '').trim();
    }

    const { data, error } = await supabase
      .from('documents')
      .insert([
        {
          user_id: user.id,
          title: title || 'Generated Document',
          prompt,
          content
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error generating document:', error);
    res.status(500).json({ error: 'Unable to generate document' });
  }
});

module.exports = router;

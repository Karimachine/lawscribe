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
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Unable to fetch clients' });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return unauthorized(res);
    }

    const { name, email, phone, case_type } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const { data, error } = await supabase
      .from('clients')
      .insert([
        {
          user_id: user.id,
          name,
          email,
          phone: phone || null,
          case_type: case_type || null
        }
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Unable to create client' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
      return unauthorized(res);
    }

    const clientId = req.params.id;
    const { data, error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    res.json({ success: true, deleted: data });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Unable to delete client' });
  }
});

module.exports = router;

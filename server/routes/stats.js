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

    const [documentsRes, clientsRes] = await Promise.all([
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    if (documentsRes.error || clientsRes.error) {
      throw documentsRes.error || clientsRes.error;
    }

    res.json({
      documentsCount: documentsRes.count || 0,
      clientsCount: clientsRes.count || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Unable to fetch stats' });
  }
});

module.exports = router;

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase configuration missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('Tip: copy .env.example to .env and fill in your Supabase keys.');
  module.exports = null;
} else {
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized');
    module.exports = client;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    module.exports = null;
  }
}

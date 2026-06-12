const fs = require('fs');
const path = require('path');

function readEnv(file) {
  const src = fs.readFileSync(file, 'utf8');
  return src.split(/\r?\n/).filter(Boolean).reduce((acc, line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx);
      const v = line.slice(idx + 1);
      acc[k] = v;
    }
    return acc;
  }, {});
}

async function main() {
  const env = readEnv(path.join(__dirname, '..', '.env'));
  const anon = env.SUPABASE_ANON_KEY;
  const url = env.SUPABASE_URL;
  if (!anon || !url) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const email = `user${timestamp}@test.local`;
  const password = 'TestPass123!@';

  console.log('Signing up user', email);
  const signupRes = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const signup = await signupRes.json();
  console.log('Signup response:', signup);
  const token = signup.access_token;
  if (!token) {
    console.error('No access token returned from signup; aborting.');
    process.exit(1);
  }

  console.log('Saving document...');
  const saveRes = await fetch('http://localhost:4000/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: 'Smoke Test', prompt: 'Smoke prompt', content: 'Generated content' }),
  });
  const save = await saveRes.json();
  console.log('Save response:', save);

  console.log('Fetching documents...');
  const getRes = await fetch('http://localhost:4000/api/documents', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const docs = await getRes.json();
  console.log('Documents:', docs);
}

main().catch((err) => { console.error(err); process.exit(1); });

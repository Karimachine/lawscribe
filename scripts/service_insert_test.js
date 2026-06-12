const fs = require('fs');
const path = require('path');

function readEnv(file) {
  const src = fs.readFileSync(file, 'utf8');
  return src.split(/\r?\n/).filter(Boolean).reduce((acc, line) => {
    const idx = line.indexOf('=');
    if (idx > 0) {
      acc[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return acc;
  }, {});
}

async function main() {
  const env = readEnv(path.join(__dirname, '..', '.env'));
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.SUPABASE_URL;
  if (!serviceKey || !url) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const insert = { user_id: 'test-service', title: 'Service Insert Test', prompt: 'svc', content: 'content from service role' };

  const res = await fetch(`${url}/rest/v1/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation'
    },
    body: JSON.stringify([insert])
  });

  const data = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', data);
}

main().catch(e => { console.error(e); process.exit(1); });

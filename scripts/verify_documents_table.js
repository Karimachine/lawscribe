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
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const res = await fetch(`${url}/rest/v1/documents?select=id&limit=1`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  });

  if (res.status === 404) {
    console.error('Table `documents` not found in Supabase.');
    console.error('Run supabase/create_documents_table.sql in your Supabase SQL editor.');
    process.exit(1);
  }

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text || 'No rows returned');
  if (res.status >= 200 && res.status < 300) {
    console.log('The `documents` table exists and is accessible.');
  } else {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

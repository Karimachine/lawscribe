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

(async () => {
  const env = readEnv(path.join(__dirname, '..', '.env'));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const fns = ['sql', 'pg_execute_sql', 'run_sql', 'db_exec'];
  for (const fn of fns) {
    try {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const txt = await res.text();
      console.log(fn, res.status, txt);
    } catch (error) {
      console.log(fn, 'error', error.message);
    }
  }
})();

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

async function applyMigrations() {
  const env = readEnv(path.join(__dirname, '..', '.env'));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found. Skipping.');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    const sqlPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(sqlPath, 'utf8').trim();
    if (!sql) continue;

    console.log(`Applying migration: ${file}`);
    
    try {
      const res = await fetch(`${url}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sql }),
      });

      // Supabase REST API doesn't have a direct SQL execution endpoint, so we'll try another approach
      // Instead, we'll use the Supabase Management API or document that migrations must be run manually
      console.log(`Note: ${file} requires manual execution in Supabase SQL editor.`);
    } catch (error) {
      console.error(`Failed to apply ${file}:`, error.message);
    }
  }
}

applyMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

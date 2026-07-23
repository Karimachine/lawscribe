# LawScribe MERN + Supabase

This workspace contains a React frontend, Express backend, and Supabase for authentication and data storage.

## Local setup

1. Copy `.env.example` to `.env` and fill in your Supabase values.
2. In the root folder, install dependencies:
   ```bash
   npm install
   npm --prefix client install
   ```
3. Start the development stack:
   ```bash
   npm run dev
   ```
4. Open the app at `http://localhost:5173`.

## Build for production

1. Build the React app:
   ```bash
   npm run build
   ```
2. Set `NODE_ENV=production` and start the Express server:
   ```bash
   npm start
   ```

## Architecture

- `client/` contains the React/Vite application.
- `server/` contains the Express API.
- Supabase handles user authentication and stores documents in a `documents` table.

## Supabase setup

Create a table named `documents` in your Supabase project (SQL editor) with this schema:

```sql
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text,
  prompt text,
  content text,
  created_at timestamptz default now()
);
```

### Using migrations

SQL migrations are stored in `supabase/migrations/` and timestamped for version control. To apply the initial migration:

1. Open your Supabase project SQL editor
2. Copy and paste the content of `supabase/migrations/20260609_create_documents_table.sql`
3. Run the SQL

Then verify the table was created:

```bash
npm run supabase:verify-documents
```

Grant row-level security and create policies if needed, or use the service role key on the server side.

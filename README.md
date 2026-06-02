# LawScribe MERN + Supabase

This workspace now contains a MERN-style application with React frontend, Express backend, MongoDB data storage, and Supabase authentication.

## Local setup

1. Copy `.env.example` to `.env` and fill in your Supabase and MongoDB values.
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
- `server/` contains the Express API and MongoDB models.
- Supabase handles user authentication.
- Documents are saved in MongoDB through the Express API.

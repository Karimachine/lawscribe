Local setup and troubleshooting
------------------------------

1) Ensure Node.js & npm are installed

- Preferred: run the helper in PowerShell from the project root:

  .\setup.ps1

- Or install Node LTS from https://nodejs.org and verify:

  node -v
  npm -v

2) Install project dependencies

```powershell
cd "C:\Users\ferra\OneDrive\Desktop\lawscribe"
npm install
npm --prefix client install
```

3) Ensure MongoDB is running locally

- If you have MongoDB installed as a service, make sure the service is started.
- If running manually, start `mongod` with your `--dbpath`.

4) Start dev servers

```powershell
npm run dev
```

5) Verify endpoints

```powershell
# API
curl http://localhost:4000/api/documents

# Client (Vite)
open http://localhost:5173
```

Troubleshooting
- If `npm` is not found, install Node.js (see step 1) or run `setup.ps1`.
- If MongoDB connection fails, confirm `MONGO_URI` in `.env` and that the DB is reachable.
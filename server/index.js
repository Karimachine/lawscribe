const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const cors = require('cors');
const documentsRouter = require('./routes/documents');

const app = express();
const PORT = process.env.PORT || 4000;
// Helpful startup information
console.log('Starting server', { env: process.env.NODE_ENV || 'development', port: PORT });
// Using Supabase for authentication and data storage; no MongoDB required.

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/documents', documentsRouter);

// simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// global error handlers to aid debugging
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection at:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

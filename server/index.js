require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const syncRoutes         = require('./routes/sync');
const sessionsRoutes     = require('./routes/sessions');
const settingsRoutes     = require('./routes/settings-route');
const blockedSitesRoutes = require('./routes/blocked-sites-route');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: (origin, cb) => {
    // Permite: sem origem (curl/server), extensões Chrome/Edge, e qualquer origem web
    if (!origin || origin.startsWith('chrome-extension://')) return cb(null, true);
    cb(null, true); // aberto — restringir por domínio em produção se necessário
  },
  allowedHeaders: ['Content-Type', 'X-Sync-Code'],
}));

app.use(express.json());

// API Routes
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/sync',          syncRoutes);
app.use('/api/sessions',      sessionsRoutes);
app.use('/api/settings',      settingsRoutes);
app.use('/api/blocked-sites', blockedSitesRoutes);

// Serve static frontend
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🍅 Meu Pomodoro rodando em http://localhost:${PORT}`);
});

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─── Seed de sites de notícias populares ─────────────────────────────────────
const NEWS_SEED_DOMAINS = [
  // Nacionais
  'g1.globo.com', 'oglobo.globo.com', 'ge.globo.com', 'gshow.globo.com',
  'uol.com.br', 'folha.uol.com.br', 'estadao.com.br', 'veja.abril.com.br',
  'r7.com', 'terra.com.br', 'ig.com.br', 'correiobraziliense.com.br',
  'metropoles.com.br', 'cartacapital.com.br', 'agenciabrasil.ebc.com.br',
  'gazetadopovo.com.br', 'valor.globo.com', 'exame.com', 'infomoney.com.br',
  'tecmundo.com.br', 'tudocelular.com', 'canaltech.com.br', 'olhardigital.com.br',
  'hypeness.com.br', 'b9.com.br', 'brasildefato.com.br', 'operamundi.uol.com.br',
  'poder360.com.br', 'theintercept.com', 'agenciapublica.org',
  // Redes sociais e entretenimento
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'reddit.com', 'youtube.com', 'twitch.tv',
  'linkedin.com', 'threads.net', 'bluesky.app',
  // Internacionais
  'cnn.com', 'bbc.com', 'nytimes.com', 'theguardian.com',
  'reuters.com', 'apnews.com', 'news.google.com', 'msn.com',
  'huffpost.com', 'buzzfeed.com', 'vice.com', 'slate.com',
  'washingtonpost.com', 'wsj.com', 'ft.com', 'economist.com',
];

async function seedBlockedSites(client, userId) {
  if (!NEWS_SEED_DOMAINS.length) return;
  const placeholders = NEWS_SEED_DOMAINS.map((_, i) => `($1, $${i + 2})`).join(', ');
  const values = [userId, ...NEWS_SEED_DOMAINS];
  await client.query(
    `INSERT INTO blocked_sites (user_id, domain) VALUES ${placeholders}
     ON CONFLICT (user_id, domain) DO NOTHING`,
    values
  );
}

function generateSyncCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 (confusos)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/sync/register — cria novo usuário e retorna Sync Code
router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    let syncCode;
    for (let attempt = 0; attempt < 10; attempt++) {
      syncCode = generateSyncCode();
      const { rows } = await client.query(
        'SELECT id FROM users WHERE sync_code = $1',
        [syncCode]
      );
      if (rows.length === 0) break;
    }

    const { rows } = await client.query(
      'INSERT INTO users (sync_code) VALUES ($1) RETURNING id, sync_code',
      [syncCode]
    );
    const user = rows[0];

    // Prefs padrão de configurações
    const defaultPrefs = {
      cycle: 'classic',
      alertStyle: 'gradual',
      volume: 70,
      activeCategories: ['physical', 'creative', 'reflection', 'organize', 'visual'],
      blockMode: 'focus',
    };
    await client.query(
      'INSERT INTO settings (user_id, preferences) VALUES ($1, $2)',
      [user.id, JSON.stringify(defaultPrefs)]
    );

    // Seed de sites de notícias bloqueados
    await seedBlockedSites(client, user.id);

    res.status(201).json({ syncCode: user.sync_code, userId: user.id });
  } catch (err) {
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  } finally {
    client.release();
  }
});

// POST /api/sync/link — vincula este dispositivo a um Sync Code existente
router.post('/link', async (req, res) => {
  const { syncCode } = req.body;
  if (!syncCode) return res.status(400).json({ error: 'syncCode é obrigatório' });

  try {
    const { rows } = await pool.query(
      'SELECT id, sync_code FROM users WHERE sync_code = $1',
      [syncCode.toUpperCase().trim()]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sync code não encontrado' });
    }
    res.json({ userId: rows[0].id, syncCode: rows[0].sync_code });
  } catch (err) {
    console.error('link error:', err.message);
    res.status(500).json({ error: 'Erro ao vincular dispositivo' });
  }
});

module.exports = router;

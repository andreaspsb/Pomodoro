const express = require('express');
const router = express.Router();
const pool = require('../db');

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

    const defaultPrefs = {
      cycle: 'classic',
      alertStyle: 'gradual',
      volume: 70,
      activeCategories: ['physical', 'creative', 'reflection', 'organize', 'visual'],
    };
    await client.query(
      'INSERT INTO settings (user_id, preferences) VALUES ($1, $2)',
      [user.id, JSON.stringify(defaultPrefs)]
    );

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

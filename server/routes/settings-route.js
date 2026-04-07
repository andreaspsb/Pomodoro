const express = require('express');
const router = express.Router();
const pool = require('../db');

async function requireUser(req, res, next) {
  const syncCode = (req.headers['x-sync-code'] || '').toUpperCase().trim();
  if (!syncCode) return res.status(401).json({ error: 'Header X-Sync-Code é obrigatório' });
  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE sync_code = $1', [syncCode]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Sync code inválido' });
    req.userId = rows[0].id;
    next();
  } catch {
    res.status(500).json({ error: 'Erro de autenticação' });
  }
}

// GET /api/settings
router.get('/', requireUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT preferences FROM settings WHERE user_id = $1', [req.userId]
    );
    res.json(rows[0]?.preferences || {});
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar preferências' });
  }
});

// PUT /api/settings
router.put('/', requireUser, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (user_id, preferences, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET preferences = $2, updated_at = NOW()`,
      [req.userId, JSON.stringify(req.body)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar preferências' });
  }
});

module.exports = router;

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza uma string de domínio removendo protocolo, www e paths.
 * Ex: "https://www.g1.globo.com/politica" → "g1.globo.com"
 */
function normalizeDomain(raw) {
  try {
    const s = raw.trim().toLowerCase();
    // Se não tiver protocolo, adiciona para URL constructor funcionar
    const withProto = s.startsWith('http') ? s : `https://${s}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./, '');
  } catch {
    // Fallback: apenas tira www. e paths manualmente
    return raw.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/blocked-sites — lista todos os domínios do usuário
router.get('/', requireUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT domain, added_at FROM blocked_sites WHERE user_id = $1 ORDER BY domain ASC',
      [req.userId]
    );
    res.json({ domains: rows.map(r => r.domain), count: rows.length });
  } catch (err) {
    console.error('blocked-sites GET error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar sites bloqueados' });
  }
});

// POST /api/blocked-sites — adiciona um ou múltiplos domínios
// Body: { domains: string[] }  ou  { domain: string }
router.post('/', requireUser, async (req, res) => {
  const raw = req.body.domains ?? (req.body.domain ? [req.body.domain] : []);
  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ error: 'Envie ao menos um domínio em "domains" (array)' });
  }

  const normalized = [...new Set(raw.map(normalizeDomain).filter(Boolean))];
  if (normalized.length === 0) {
    return res.status(400).json({ error: 'Nenhum domínio válido encontrado' });
  }

  try {
    // INSERT em lote com ON CONFLICT DO NOTHING para deduplicar
    const placeholders = normalized
      .map((_, i) => `($1, $${i + 2})`)
      .join(', ');
    const values = [req.userId, ...normalized];

    await pool.query(
      `INSERT INTO blocked_sites (user_id, domain) VALUES ${placeholders}
       ON CONFLICT (user_id, domain) DO NOTHING`,
      values
    );
    res.status(201).json({ ok: true, added: normalized });
  } catch (err) {
    console.error('blocked-sites POST error:', err.message);
    res.status(500).json({ error: 'Erro ao adicionar sites bloqueados' });
  }
});

// DELETE /api/blocked-sites/:domain — remove um domínio específico
router.delete('/:domain', requireUser, async (req, res) => {
  const domain = normalizeDomain(req.params.domain);
  try {
    const result = await pool.query(
      'DELETE FROM blocked_sites WHERE user_id = $1 AND domain = $2',
      [req.userId, domain]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Domínio não encontrado na lista' });
    }
    res.json({ ok: true, removed: domain });
  } catch (err) {
    console.error('blocked-sites DELETE/:domain error:', err.message);
    res.status(500).json({ error: 'Erro ao remover domínio' });
  }
});

// DELETE /api/blocked-sites — limpa toda a lista do usuário
router.delete('/', requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM blocked_sites WHERE user_id = $1',
      [req.userId]
    );
    res.json({ ok: true, removed: result.rowCount });
  } catch (err) {
    console.error('blocked-sites DELETE all error:', err.message);
    res.status(500).json({ error: 'Erro ao limpar lista de sites bloqueados' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db');

async function requireUser(req, res, next) {
  const syncCode = (req.headers['x-sync-code'] || '').toUpperCase().trim();
  if (!syncCode) return res.status(401).json({ error: 'Header X-Sync-Code é obrigatório' });

  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE sync_code = $1',
      [syncCode]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Sync code inválido' });
    req.userId = rows[0].id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erro de autenticação' });
  }
}

// POST /api/sessions
router.post('/', requireUser, async (req, res) => {
  const { cycleType, mode, durationMin, completed, extended, startedAt, endedAt } = req.body;

  if (!cycleType || !mode || !durationMin || !startedAt || !endedAt) {
    return res.status(400).json({ error: 'Campos obrigatórios: cycleType, mode, durationMin, startedAt, endedAt' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO sessions
        (user_id, cycle_type, mode, duration_min, completed, extended, started_at, ended_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [req.userId, cycleType, mode, durationMin, completed ?? true, extended ?? false, startedAt, endedAt]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error('sessions POST error:', err.message);
    res.status(500).json({ error: 'Erro ao salvar sessão' });
  }
});

// GET /api/sessions?period=today|week|month|all
router.get('/', requireUser, async (req, res) => {
  const periodMap = {
    today: "INTERVAL '1 day'",
    week:  "INTERVAL '7 days'",
    month: "INTERVAL '30 days'",
    all:   "INTERVAL '10 years'",
  };
  const interval = periodMap[req.query.period] || periodMap.today;

  try {
    const { rows: sessions } = await pool.query(
      `SELECT id, cycle_type, mode, duration_min, completed, extended, started_at, ended_at
       FROM sessions
       WHERE user_id = $1
         AND mode = 'focus'
         AND completed = true
         AND ended_at >= NOW() - ${interval}
       ORDER BY ended_at DESC`,
      [req.userId]
    );

    const totalPomodoros = sessions.length;
    const totalFocusMinutes = sessions.reduce((sum, s) => sum + s.duration_min, 0);

    // Streak: dias consecutivos com pelo menos 1 pomodoro
    const { rows: days } = await pool.query(
      `SELECT DISTINCT DATE(ended_at) AS day
       FROM sessions
       WHERE user_id = $1 AND mode = 'focus' AND completed = true
       ORDER BY day DESC`,
      [req.userId]
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < days.length; i++) {
      const day = new Date(days[i].day);
      const diffDays = Math.round((today - day) / 86400000);
      if (diffDays === i || (i === 0 && diffDays === 1)) streak++;
      else break;
    }

    res.json({ totalPomodoros, totalFocusMinutes, streak, sessions });
  } catch (err) {
    console.error('sessions GET error:', err.message);
    res.status(500).json({ error: 'Erro ao buscar sessões' });
  }
});

module.exports = router;

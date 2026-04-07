require('dotenv').config();
const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔧 Executando migrations...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sync_code  VARCHAR(7) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
        cycle_type   VARCHAR(20) NOT NULL,
        mode         VARCHAR(15) NOT NULL,
        duration_min INTEGER NOT NULL,
        completed    BOOLEAN DEFAULT TRUE,
        extended     BOOLEAN DEFAULT FALSE,
        started_at   TIMESTAMPTZ NOT NULL,
        ended_at     TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_ended
        ON sessions(user_id, ended_at DESC);

      CREATE TABLE IF NOT EXISTS settings (
        user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        preferences JSONB DEFAULT '{}',
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ Migrations concluídas com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

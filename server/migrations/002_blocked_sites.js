/**
 * Migration 002 — Bloqueador de sites
 * Cria a tabela blocked_sites para armazenar a lista de domínios bloqueados por usuário
 */

async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS blocked_sites (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      domain     VARCHAR(253) NOT NULL,
      added_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, domain)
    );

    CREATE INDEX IF NOT EXISTS idx_blocked_sites_user
      ON blocked_sites(user_id);
  `);
}

module.exports = { up };

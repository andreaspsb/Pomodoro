require('dotenv').config();
const pool = require('./db');
const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔧 Iniciando runner de migrations…');

    // Garante que a tabela de controle existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Descobre os arquivos de migration em ordem
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js'))
      .sort(); // ordem alfanumérica: 001_, 002_, etc.

    for (const file of files) {
      const version = file.replace('.js', '');

      // Verifica se já foi aplicada
      const { rows } = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );
      if (rows.length > 0) {
        console.log(`  ⏭  ${file} — já aplicada, pulando.`);
        continue;
      }

      // Aplica a migration
      console.log(`  ▶  Aplicando ${file}…`);
      const migration = require(path.join(MIGRATIONS_DIR, file));
      await migration.up(client);

      // Registra como aplicada
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      console.log(`  ✅ ${file} aplicada com sucesso.`);
    }

    console.log('\n✅ Todas as migrations estão atualizadas!');
  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

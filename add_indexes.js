const Database = require('better-sqlite3');
const path = require('path');

// ===============================
// CONFIG
// ===============================
const DB_PATH = path.resolve(__dirname, 'credilink.db');
const BATCH = 300000; // agressivo, mas seguro pra 32GB RAM

// ===============================
// CONEXÃO
// ===============================
const db = new Database(DB_PATH);
console.log('⚡ SQLite conectado');

// ===============================
// PRAGMAS — PERFORMANCE REAL
// ===============================
db.exec(`
  PRAGMA journal_mode = OFF;        -- MAIS RÁPIDO PRA INDEXAR
  PRAGMA synchronous = OFF;
  PRAGMA temp_store = MEMORY;

  PRAGMA cache_size = -2000000;     -- ~2GB RAM
  PRAGMA mmap_size  = 8589934592;   -- 8GB mmap
`);

console.log('🔥 PRAGMAs de indexação ativados');

try {
  // ===============================
  // LIMPEZA TOTAL
  // ===============================
  db.exec(`
    DROP TRIGGER IF EXISTS credilink_basic_ai;
    DROP TRIGGER IF EXISTS credilink_basic_ad;
    DROP TRIGGER IF EXISTS credilink_basic_au;
    DROP TABLE   IF EXISTS credilink_basic_fts;
  `);

  console.log('🧹 Triggers e FTS antigas removidas');

  // ===============================
  // CRIA FTS5 (ESTÁVEL)
  // ===============================
  db.exec(`
    CREATE VIRTUAL TABLE credilink_basic_fts
    USING fts5(
      NOME,
      NOME_MAE,
      tokenize = 'unicode61 remove_diacritics 2',
      content='credilink_basic',
      content_rowid='rowid'
    );
  `);

  console.log('✔ FTS5 criada (NOME + NOME_MAE)');

  // ===============================
  // CONTAGEM
  // ===============================
  const total = db
    .prepare(`SELECT COUNT(*) AS total FROM credilink_basic`)
    .get().total;

  console.log(`📊 Total de registros: ${total.toLocaleString()}`);

  // ===============================
  // INDEXAÇÃO EM LOTES
  // ===============================
  const insertStmt = db.prepare(`
    INSERT INTO credilink_basic_fts(rowid, NOME, NOME_MAE)
    SELECT rowid, NOME, NOME_MAE
    FROM credilink_basic
    LIMIT ? OFFSET ?;
  `);

  let offset = 0;
  const start = Date.now();

  console.log('📦 Indexação iniciada...');

  while (true) {
    const info = insertStmt.run(BATCH, offset);
    if (info.changes === 0) break;

    offset += BATCH;

    const elapsedMin = ((Date.now() - start) / 60000).toFixed(1);
    const pct = ((offset / total) * 100).toFixed(2);

    console.log(
      `⚙️ ${Math.min(offset, total).toLocaleString()} / ${total.toLocaleString()} ` +
      `(${pct}%) — ${elapsedMin} min`
    );
  }

  console.log('✔ Indexação finalizada');

  // ===============================
  // TRIGGERS — SINCRONIA
  // ===============================
  db.exec(`
    CREATE TRIGGER credilink_basic_ai
    AFTER INSERT ON credilink_basic
    BEGIN
      INSERT INTO credilink_basic_fts(rowid, NOME, NOME_MAE)
      VALUES (new.rowid, new.NOME, new.NOME_MAE);
    END;

    CREATE TRIGGER credilink_basic_ad
    AFTER DELETE ON credilink_basic
    BEGIN
      INSERT INTO credilink_basic_fts(credilink_basic_fts, rowid)
      VALUES ('delete', old.rowid);
    END;

    CREATE TRIGGER credilink_basic_au
    AFTER UPDATE ON credilink_basic
    BEGIN
      INSERT INTO credilink_basic_fts(credilink_basic_fts, rowid)
      VALUES ('delete', old.rowid);

      INSERT INTO credilink_basic_fts(rowid, NOME, NOME_MAE)
      VALUES (new.rowid, new.NOME, new.NOME_MAE);
    END;
  `);

  console.log('🔗 Triggers criadas');

  // ===============================
  // VOLTA WAL (PRODUÇÃO)
  // ===============================
  db.exec(`PRAGMA journal_mode = WAL;`);
  console.log('🛡️ WAL reativado');

  console.log('🚀 FTS5 FINALIZADO. BUSCA AGORA É INSANA.');

} catch (err) {
  console.error('❌ Erro:', err.message);
} finally {
  db.close();
  console.log('🔌 Banco fechado');
}

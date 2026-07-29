import { type SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ventas (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      producto      TEXT NOT NULL,
      precio        REAL NOT NULL,
      cliente       TEXT DEFAULT '',
      tipo          TEXT DEFAULT 'contado',
      pagado        INTEGER DEFAULT 1,
      fecha         TEXT NOT NULL,
      sincronizado  INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS gastos (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      concepto      TEXT NOT NULL,
      monto         REAL NOT NULL,
      fecha         TEXT NOT NULL,
      sincronizado  INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  await db.runAsync(
    "INSERT OR IGNORE INTO app_config (clave, valor) VALUES ('tutorial_visto', 'no')"
  );
  await db.runAsync(
    "INSERT OR IGNORE INTO app_config (clave, valor) VALUES ('user_id', '')"
  );
}

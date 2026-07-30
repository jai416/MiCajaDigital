import { type SQLiteDatabase } from 'expo-sqlite';

export async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ventas (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      producto        TEXT NOT NULL,
      precio          REAL NOT NULL,
      costo           REAL DEFAULT 0,
      cliente         TEXT DEFAULT '',
      tipo            TEXT DEFAULT 'contado',
      pagado          INTEGER DEFAULT 1,
      fecha           TEXT NOT NULL,
      sincronizado    INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now','localtime')),
      updated_at      TEXT DEFAULT (datetime('now','localtime')),
      catalogo_id     TEXT,
      metodo_pago     TEXT DEFAULT 'efectivo',
      moneda          TEXT DEFAULT 'CUP',
      tipo_pedido     TEXT DEFAULT 'contado',
      anticipo        REAL DEFAULT 0,
      saldo_pendiente REAL DEFAULT 0,
      fecha_entrega   TEXT,
      estado_pedido   TEXT DEFAULT 'pendiente',
      nota            TEXT DEFAULT ''
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS gastos (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      concepto      TEXT NOT NULL,
      monto         REAL NOT NULL,
      fecha         TEXT NOT NULL,
      foto          TEXT DEFAULT '',
      sincronizado  INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now','localtime')),
      updated_at    TEXT DEFAULT (datetime('now','localtime'))
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
  await db.runAsync(
    "INSERT OR IGNORE INTO app_config (clave, valor) VALUES ('last_sync_at', '2000-01-01T00:00:00.000Z')"
  );

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS catalogo (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      nombre        TEXT NOT NULL,
      precio        REAL NOT NULL,
      stock         INTEGER DEFAULT 0,
      descripcion   TEXT DEFAULT '',
      codigo_barras TEXT DEFAULT '',
      categoria     TEXT DEFAULT '',
      foto          TEXT DEFAULT '',
      sincronizado  INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now','localtime')),
      updated_at    TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migraciones
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN updated_at TEXT DEFAULT (datetime('now','localtime'))"); } catch {}
  try { await db.runAsync("ALTER TABLE gastos ADD COLUMN updated_at TEXT DEFAULT (datetime('now','localtime'))"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN catalogo_id TEXT REFERENCES catalogo(id)"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN metodo_pago TEXT DEFAULT 'efectivo'"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN tipo_pedido TEXT DEFAULT 'contado'"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN anticipo REAL DEFAULT 0"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN saldo_pendiente REAL DEFAULT 0"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN fecha_entrega TEXT"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN estado_pedido TEXT DEFAULT 'pendiente'"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN nota TEXT DEFAULT ''"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN costo REAL DEFAULT 0"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN moneda TEXT DEFAULT 'CUP'"); } catch {}
  try { await db.runAsync("ALTER TABLE catalogo ADD COLUMN codigo_barras TEXT DEFAULT ''"); } catch {}
  try { await db.runAsync("ALTER TABLE catalogo ADD COLUMN descripcion TEXT DEFAULT ''"); } catch {}
  try { await db.runAsync("ALTER TABLE catalogo ADD COLUMN categoria TEXT DEFAULT ''"); } catch {}
  try { await db.runAsync("ALTER TABLE catalogo ADD COLUMN foto TEXT DEFAULT ''"); } catch {}
  try { await db.runAsync("ALTER TABLE gastos ADD COLUMN foto TEXT DEFAULT ''"); } catch {}
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN deleted_at TEXT DEFAULT NULL"); } catch {}

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS compras (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      producto        TEXT NOT NULL,
      costo_unitario  REAL NOT NULL,
      cantidad        INTEGER NOT NULL DEFAULT 1,
      costo_total     REAL NOT NULL,
      proveedor       TEXT DEFAULT '',
      fecha           TEXT NOT NULL,
      sincronizado    INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now','localtime')),
      updated_at      TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}

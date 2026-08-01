import { type SQLiteDatabase } from 'expo-sqlite';
import { logError } from '@/src/services/logger';

export async function initDatabase(db: SQLiteDatabase) {
  try {
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
      created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
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
      created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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
      created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // Migraciones
  try { await db.runAsync("ALTER TABLE ventas ADD COLUMN updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"); } catch {}
  try { await db.runAsync("ALTER TABLE gastos ADD COLUMN updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))"); } catch {}
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
  try { await db.runAsync("ALTER TABLE catalogo ADD COLUMN deleted_at TEXT DEFAULT NULL"); } catch {}
  try { await db.runAsync("ALTER TABLE compras ADD COLUMN deleted_at TEXT DEFAULT NULL"); } catch {}

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
      created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      deleted_at      TEXT DEFAULT NULL
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      ventas INTEGER DEFAULT 0,
      gastos INTEGER DEFAULT 0,
      catalogo INTEGER DEFAULT 0,
      compras INTEGER DEFAULT 0,
      error TEXT
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      nombre TEXT NOT NULL,
      valor TEXT DEFAULT '',
      timestamp TEXT NOT NULL
    );
  `);

  // FTS5 para búsqueda full-text del catálogo
  try { await db.runAsync('CREATE VIRTUAL TABLE IF NOT EXISTS catalogo_fts USING fts5(nombre, descripcion, content=catalogo, content_rowid=rowid)'); } catch {}
  try { await db.runAsync(`CREATE TRIGGER IF NOT EXISTS catalogo_ai AFTER INSERT ON catalogo BEGIN INSERT INTO catalogo_fts(rowid, nombre, descripcion) VALUES (new.rowid, new.nombre, new.descripcion); END;`); } catch {}
  try { await db.runAsync(`CREATE TRIGGER IF NOT EXISTS catalogo_ad AFTER DELETE ON catalogo BEGIN INSERT INTO catalogo_fts(catalogo_fts, rowid, nombre, descripcion) VALUES('delete', old.rowid, old.nombre, old.descripcion); END;`); } catch {}
  try { await db.runAsync(`CREATE TRIGGER IF NOT EXISTS catalogo_au AFTER UPDATE ON catalogo BEGIN INSERT INTO catalogo_fts(catalogo_fts, rowid, nombre, descripcion) VALUES('delete', old.rowid, old.nombre, old.descripcion); INSERT INTO catalogo_fts(rowid, nombre, descripcion) VALUES (new.rowid, new.nombre, new.descripcion); END;`); } catch {}
  try { await db.runAsync('INSERT INTO catalogo_fts(catalogo_fts) VALUES("rebuild")'); } catch {}

  // Índices para acelerar las consultas frecuentes y evitar escaneos completos
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_ventas_user_fecha ON ventas (user_id, fecha)'); } catch {}
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_ventas_user_pagado ON ventas (user_id, pagado)'); } catch {}
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_ventas_user_pedido ON ventas (user_id, tipo_pedido, estado_pedido)'); } catch {}
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_gastos_user_fecha ON gastos (user_id, fecha)'); } catch {}
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_catalogo_user_nombre ON catalogo (user_id, nombre)'); } catch {}
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_compras_user_fecha ON compras (user_id, fecha)'); } catch {}
  try { await db.execAsync('CREATE INDEX IF NOT EXISTS idx_sync_user_ts ON sync_log (user_id, timestamp)'); } catch {}

  // Purga de registros de sincronización y analítica para no crecer sin límite
  try {
    await db.execAsync(`
      DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY timestamp DESC LIMIT 50);
      DELETE FROM analytics_events WHERE timestamp < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-60 days');
    `);
  } catch {}
  } catch (e) {
    logError('initDatabase', e);
  }
}

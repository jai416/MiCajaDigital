-- ============================================================
-- MI CAJA DIGITAL — Esquema Completo de Base de Datos (Supabase)
-- ============================================================
-- Ejecutar TODO esto en: Supabase Dashboard → SQL Editor
-- ============================================================
-- 
-- ANTES:
-- 1. Authentication → Settings → desmarcar "Confirm email"
-- 2. Settings → API → copiar service_role key para el admin
-- 3. Storage → Create bucket → nombre: "fotos" → público
--
-- ============================================================

-- 1. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLA: negocios (cada usuario/negocio registrado)
-- ============================================================
CREATE TABLE IF NOT EXISTS negocios (
  id               UUID PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  nombre_negocio   TEXT NOT NULL,
  telefono         TEXT DEFAULT '',
  activo           BOOLEAN DEFAULT false,
  plan             TEXT DEFAULT 'gratis' CHECK (plan IN ('gratis', 'basico', 'pro')),
  fecha_registro   TIMESTAMPTZ DEFAULT NOW(),
  fecha_expiracion TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 days')
);

-- 3. TABLA: ventas
-- ============================================================
CREATE TABLE IF NOT EXISTS ventas (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto        TEXT NOT NULL,
  precio          REAL NOT NULL CHECK (precio > 0),
  costo           REAL DEFAULT 0,
  cliente         TEXT DEFAULT '',
  tipo            TEXT DEFAULT 'contado' CHECK (tipo IN ('contado', 'fiado', 'pedido')),
  pagado          INTEGER DEFAULT 1 CHECK (pagado IN (0, 1)),
  fecha           TEXT NOT NULL,
  created_at      TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  catalogo_id     TEXT,
  metodo_pago     TEXT DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  moneda          TEXT DEFAULT 'CUP' CHECK (moneda IN ('CUP', 'USD', 'MLC')),
  tipo_pedido     TEXT DEFAULT 'contado' CHECK (tipo_pedido IN ('contado', 'fiado', 'pedido')),
  anticipo        REAL DEFAULT 0,
  saldo_pendiente REAL DEFAULT 0,
  fecha_entrega   TEXT,
  estado_pedido   TEXT DEFAULT 'pendiente' CHECK (estado_pedido IN ('pendiente', 'entregado', 'cancelado')),
  nota            TEXT DEFAULT '',
  deleted_at      TIMESTAMPTZ DEFAULT NULL
);

-- 4. TABLA: gastos
-- ============================================================
CREATE TABLE IF NOT EXISTS gastos (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  concepto      TEXT NOT NULL,
  monto         REAL NOT NULL CHECK (monto > 0),
  fecha         TEXT NOT NULL,
  foto          TEXT DEFAULT '',
  created_at    TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: catalogo (productos con stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS catalogo (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  precio        REAL NOT NULL CHECK (precio > 0),
  stock         INTEGER DEFAULT 0,
  descripcion   TEXT DEFAULT '',
  codigo_barras TEXT DEFAULT '',
  categoria     TEXT DEFAULT '',
  foto          TEXT DEFAULT '',
  created_at    TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_user_id ON catalogo(user_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_updated_at ON catalogo(updated_at);

ALTER TABLE catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT propio catalogo"
  ON catalogo FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "INSERT propio catalogo"
  ON catalogo FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "UPDATE propio catalogo"
  ON catalogo FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "DELETE propio catalogo"
  ON catalogo FOR DELETE USING (user_id = auth.uid());

-- 6. TABLA: compras (reposición de inventario)
-- ============================================================
CREATE TABLE IF NOT EXISTS compras (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto        TEXT NOT NULL,
  costo_unitario  REAL NOT NULL CHECK (costo_unitario > 0),
  cantidad        INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  costo_total     REAL NOT NULL CHECK (costo_total > 0),
  proveedor       TEXT DEFAULT '',
  fecha           TEXT NOT NULL,
  created_at      TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS')),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_user_id ON compras(user_id);
CREATE INDEX IF NOT EXISTS idx_compras_updated_at ON compras(updated_at);

ALTER TABLE compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SELECT propias compras" ON compras FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "INSERT propias compras" ON compras FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "UPDATE propias compras" ON compras FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "DELETE propias compras" ON compras FOR DELETE USING (user_id = auth.uid());

-- 7. MIGRACIONES (seguras)
-- ============================================================
-- Solo ejecutan si la columna NO existe. No dan error si ya existe.
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN catalogo_id TEXT;                    EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN metodo_pago TEXT DEFAULT 'efectivo'; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN tipo_pedido TEXT DEFAULT 'contado';  EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN anticipo REAL DEFAULT 0;            EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN saldo_pendiente REAL DEFAULT 0;     EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN fecha_entrega TEXT;                 EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN estado_pedido TEXT DEFAULT 'pendiente'; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN nota TEXT DEFAULT '';                EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN costo REAL DEFAULT 0;              EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN moneda TEXT DEFAULT 'CUP';        EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE gastos ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE catalogo ADD COLUMN codigo_barras TEXT DEFAULT '';    EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE catalogo ADD COLUMN descripcion TEXT DEFAULT '';      EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE catalogo ADD COLUMN categoria TEXT DEFAULT '';       EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE catalogo ADD COLUMN foto TEXT DEFAULT '';           EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE gastos ADD COLUMN foto TEXT DEFAULT '';             EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE ventas ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;

-- 8. INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ventas_user_id ON ventas(user_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha   ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_pagado  ON ventas(pagado);
CREATE INDEX IF NOT EXISTS idx_gastos_user_id ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha   ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_negocios_email ON negocios(email);
CREATE INDEX IF NOT EXISTS idx_negocios_activo ON negocios(activo);
CREATE INDEX IF NOT EXISTS idx_ventas_updated_at ON ventas(updated_at);
CREATE INDEX IF NOT EXISTS idx_gastos_updated_at ON gastos(updated_at);



-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos   ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve/modifica sus propios datos
--
-- negocios
CREATE POLICY "SELECT propio negocio"
  ON negocios FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "INSERT propio negocio"
  ON negocios FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "UPDATE propio negocio"
  ON negocios FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "DELETE propio negocio"
  ON negocios FOR DELETE
  USING (id = auth.uid());

-- ventas
CREATE POLICY "SELECT propias ventas"
  ON ventas FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "INSERT propias ventas"
  ON ventas FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "UPDATE propias ventas"
  ON ventas FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "DELETE propias ventas"
  ON ventas FOR DELETE
  USING (user_id = auth.uid());

-- gastos
CREATE POLICY "SELECT propios gastos"
  ON gastos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "INSERT propios gastos"
  ON gastos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "UPDATE propios gastos"
  ON gastos FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "DELETE propios gastos"
  ON gastos FOR DELETE
  USING (user_id = auth.uid());

-- 9. FUNCION: resumen de cuadre del dia
-- ============================================================
CREATE OR REPLACE FUNCTION obtener_cuadre_dia(p_user_id UUID, p_fecha TEXT)
RETURNS TABLE (
  total_ventas    REAL,
  total_gastos    REAL,
  ganancia        REAL,
  deudores        BIGINT,
  total_cobrado   REAL,
  total_pendiente REAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(precio) FROM ventas WHERE user_id = p_user_id AND fecha = p_fecha AND pagado = 1), 0),
    COALESCE((SELECT SUM(monto)   FROM gastos  WHERE user_id = p_user_id AND fecha = p_fecha), 0),
    COALESCE((SELECT SUM(precio)  FROM ventas  WHERE user_id = p_user_id AND fecha = p_fecha AND pagado = 1), 0)
    - COALESCE((SELECT SUM(monto) FROM gastos  WHERE user_id = p_user_id AND fecha = p_fecha), 0),
    (SELECT COUNT(*)::BIGINT FROM ventas WHERE user_id = p_user_id AND pagado = 0),
    COALESCE((SELECT SUM(precio) FROM ventas WHERE user_id = p_user_id AND pagado = 1), 0),
    COALESCE((SELECT SUM(precio) FROM ventas WHERE user_id = p_user_id AND pagado = 0), 0);
END;
$$;

-- 10. CONSULTAS DE EJEMPLO (comentadas)
-- ============================================================
-- SELECT * FROM obtener_cuadre_dia('user-uuid', to_char(now(), 'YYYY-MM-DD'));
--
-- SELECT producto, COUNT(*) as veces, SUM(precio) as total
-- FROM ventas WHERE user_id = 'user-uuid'
-- GROUP BY producto ORDER BY veces DESC LIMIT 10;
--
-- SELECT *, (CURRENT_DATE - fecha::date) as dias_retraso
-- FROM ventas WHERE user_id = 'user-uuid' AND pagado = 0
-- ORDER BY fecha ASC;

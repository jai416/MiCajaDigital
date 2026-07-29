-- ============================================================
-- MI CAJA DIGITAL — Esquema Completo de Base de Datos (Supabase)
-- ============================================================
-- Ejecutar TODO esto en: Supabase Dashboard → SQL Editor
-- ============================================================
-- 
-- ANTES:
-- 1. Authentication → Settings → desmarcar "Confirm email"
-- 2. Settings → API → copiar service_role key para el admin
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
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto      TEXT NOT NULL,
  precio        REAL NOT NULL CHECK (precio > 0),
  cliente       TEXT DEFAULT '',
  tipo          TEXT DEFAULT 'contado' CHECK (tipo IN ('contado', 'fiado')),
  pagado        INTEGER DEFAULT 1 CHECK (pagado IN (0, 1)),
  fecha         TEXT NOT NULL,
  created_at    TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
);

-- 4. TABLA: gastos
-- ============================================================
CREATE TABLE IF NOT EXISTS gastos (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  concepto      TEXT NOT NULL,
  monto         REAL NOT NULL CHECK (monto > 0),
  fecha         TEXT NOT NULL,
  created_at    TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))
);

-- 5. INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ventas_user_id ON ventas(user_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha   ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_pagado  ON ventas(pagado);
CREATE INDEX IF NOT EXISTS idx_gastos_user_id ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha   ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_negocios_email ON negocios(email);
CREATE INDEX IF NOT EXISTS idx_negocios_activo ON negocios(activo);

-- 6. ROW LEVEL SECURITY (RLS)
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

-- 7. FUNCION: resumen de cuadre del dia
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

-- 8. CONSULTAS DE EJEMPLO (comentadas)
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

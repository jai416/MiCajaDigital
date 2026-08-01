-- ============================================================
-- MI CAJA DIGITAL — Migración de la auditoría de seguridad
-- Aplicar en: Supabase Dashboard → SQL Editor (pegar y ejecutar)
-- Es idempotente: puede ejecutarse más de una vez sin errores.
-- ============================================================

-- PASOS MANUALES (dashboard, no son SQL):
-- 1. Authentication → Providers → Email → "Confirm email" ACTIVADO
--    (recomendación S7). Hasta que la app confirme el correo, el registro
--    permite cuentas con correos ajenos.
-- 2. Storage → si el bucket "fotos" NO existe: New bucket → nombre "fotos",
--    público. (El script también intenta crearlo si falta.)
-- 3. Configuración del admin: Settings → API → service_role key (server-side).

-- 1. COLUMNA deleted_at (soft-delete en la nube) — S3
-- ============================================================
DO $$ BEGIN ALTER TABLE ventas   ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE catalogo ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
DO $$ BEGIN ALTER TABLE compras  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;

-- 2. POLICIES de negocios — S3 (cerrar el paywall)
-- ============================================================
-- El usuario SOLO puede leer su fila e insertarla con activo=false.
-- Se ELIMINAN las policies de UPDATE y DELETE: nadie puede activarse
-- la suscripción ni extenderse la prueba modificando fechas.
-- El panel admin usa service_role (bypassa RLS).
DROP POLICY IF EXISTS "INSERT propio negocio" ON negocios;
CREATE POLICY "INSERT propio negocio"
  ON negocios FOR INSERT
  WITH CHECK (id = auth.uid() AND activo = false);

DROP POLICY IF EXISTS "UPDATE propio negocio" ON negocios;
DROP POLICY IF EXISTS "DELETE propio negocio" ON negocios;

-- 3. FUNCIÓN obtener_cuadre_dia — S2 (IDOR)
-- ============================================================
-- Antes: SECURITY DEFINER con p_user_id (cualquier usuario podía leer el
-- cuadre de otros). Ahora: SECURITY INVOKER + auth.uid() interno.
-- Se DROP la versión antigua porque PostgreSQL no permite cambiar los
-- argumentos con CREATE OR REPLACE.
DROP FUNCTION IF EXISTS obtener_cuadre_dia(UUID, TEXT);

CREATE OR REPLACE FUNCTION obtener_cuadre_dia(p_fecha TEXT)
RETURNS TABLE (
  total_ventas    REAL,
  total_gastos    REAL,
  ganancia        REAL,
  deudores        BIGINT,
  total_cobrado   REAL,
  total_pendiente REAL
) LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(precio) FROM ventas WHERE user_id = auth.uid() AND fecha = p_fecha AND pagado = 1), 0),
    COALESCE((SELECT SUM(monto)   FROM gastos  WHERE user_id = auth.uid() AND fecha = p_fecha), 0),
    COALESCE((SELECT SUM(precio)  FROM ventas  WHERE user_id = auth.uid() AND fecha = p_fecha AND pagado = 1), 0)
    - COALESCE((SELECT SUM(monto) FROM gastos  WHERE user_id = auth.uid() AND fecha = p_fecha), 0),
    (SELECT COUNT(*)::BIGINT FROM ventas WHERE user_id = auth.uid() AND pagado = 0),
    COALESCE((SELECT SUM(precio) FROM ventas WHERE user_id = auth.uid() AND pagado = 1), 0),
    COALESCE((SELECT SUM(precio) FROM ventas WHERE user_id = auth.uid() AND pagado = 0), 0);
END;
$$;

GRANT EXECUTE ON FUNCTION obtener_cuadre_dia(TEXT) TO authenticated, anon;

-- 4. STORAGE: bucket y policies — S10
-- ============================================================
-- Crea el bucket "fotos" si no existe (público, de solo lectura pública).
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Solo usuarios autenticados pueden gestionar archivos dentro de SU carpeta.
DROP POLICY IF EXISTS "Usuarios gestionan sus fotos" ON storage.objects;
CREATE POLICY "Usuarios gestionan sus fotos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- VERIFICACIÓN (opcional, comentada):
-- SELECT * FROM obtener_cuadre_dia(to_char(now(), 'YYYY-MM-DD'));
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'negocios'::regclass;

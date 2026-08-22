import { supabaseAdmin } from './supabase';

/// Registro de acciones del panel en la tabla `admin_audit` (ver
/// docs/supabase-admin_audit.sql). Fire-and-forget: un fallo de auditoría se
/// loguea pero NUNCA rompe la operación principal.
export async function registrarAccion(
  accion: string,
  entidad: string,
  entidadId?: string | null,
  detalle?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('admin_audit').insert({
      accion,
      entidad,
      entidad_id: entidadId ?? null,
      detalle: detalle ?? {},
    });
    if (error) {
      console.error('[audit] No se pudo registrar la acción:', error.message);
    }
  } catch (e) {
    console.error('[audit] Error inesperado:', e);
  }
}

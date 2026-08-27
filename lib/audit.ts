import { supabaseAdmin } from './supabase';

/// Registro de acciones del panel en la tabla `admin_audit` (ver
/// docs/supabase-schema.sql). Fire-and-forget: un fallo de auditoría se
/// loguea pero NUNCA rompe la operación principal.
export async function registrarAccion(
  accion: string,
  entidad: string,
  entidadId?: string | null,
  detalle?: Record<string, unknown>,
  ip?: string,
  userAgent?: string
): Promise<void> {
  try {
    const enrichedDetalle = { ...detalle };
    if (ip) enrichedDetalle._ip = ip;
    if (userAgent) enrichedDetalle._user_agent = userAgent;
    const { error } = await supabaseAdmin.from('admin_audit').insert({
      accion,
      entidad,
      entidad_id: entidadId ?? null,
      detalle: enrichedDetalle,
      ip_address: ip ?? null,
      user_agent: userAgent ?? null,
    });
    if (error) {
      console.error('[audit] No se pudo registrar la acción:', error.message);
    }
  } catch (e) {
    console.error('[audit] Error inesperado:', e);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { registrarAccion } from '@/lib/audit';
import { notificarTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

// Límite de filas por tabla para evitar OOM en el servidor.
// Si una tabla supera este límite, se trunca y se indica en el JSON.
const LIMITE_FILAS = 50000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tablas que se exportan. Cada entrada define:
//   tabla: nombre en Supabase
//   filtroNegocio: columna que filtra por negocio (null = exportar todo)
//   label: nombre legible para logs
const TABLAS = [
  { tabla: 'negocios', filtroNegocio: null, label: 'Negocios' },
  { tabla: 'ventas', filtroNegocio: 'negocio_id', label: 'Ventas' },
  { tabla: 'gastos', filtroNegocio: 'negocio_id', label: 'Gastos' },
  { tabla: 'catalogo', filtroNegocio: 'negocio_id', label: 'Catálogo' },
  { tabla: 'compras', filtroNegocio: 'negocio_id', label: 'Compras' },
  { tabla: 'pago_fiado', filtroNegocio: null, label: 'Pagos fiado' },
  { tabla: 'codigos_pago', filtroNegocio: null, label: 'Códigos de pago' },
  { tabla: 'mensajes', filtroNegocio: null, label: 'Mensajes' },
  { tabla: 'soporte_tickets', filtroNegocio: null, label: 'Soporte' },
  { tabla: 'conflictos_log', filtroNegocio: null, label: 'Conflictos' },
  { tabla: 'suscripcion_eventos', filtroNegocio: null, label: 'Eventos suscripción' },
  { tabla: 'app_logs', filtroNegocio: null, label: 'Logs' },
  { tabla: 'admin_audit', filtroNegocio: null, label: 'Auditoría admin' },
] as const;

async function exportarTabla(
  tabla: string,
  filtroNegocio: string | null,
  negocioId: string | null
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  let query = supabaseAdmin.from(tabla).select('*');

  // Si se pide backup de un negocio específico, filtrar por la columna de negocio
  if (negocioId && filtroNegocio) {
    query = query.eq(filtroNegocio, negocioId);
  }

  // Para tablas sin filtro de negocio, si se especifica un negocioId
  // intentamos filtrar por user_id (que es el auth.uid del dueño)
  if (negocioId && !filtroNegocio) {
    // Algunas tablas usan user_id en vez de negocio_id.
    if (tabla === 'pago_fiado' || tabla === 'conflictos_log' || tabla === 'app_logs') {
      query = query.eq('user_id', negocioId);
    }
    // suscripcion_eventos usa negocio_id; admin_audit no se exporta por negocio
    // porque su entidad puede no ser un negocio y no tiene FK uniforme.
    if (tabla === 'suscripcion_eventos') {
      query = query.eq('negocio_id', negocioId);
    }
    // soporte_tickets usa user_id
    if (tabla === 'soporte_tickets') {
      query = query.eq('user_id', negocioId);
    }
    // mensajes usa user_id
    if (tabla === 'mensajes') {
      query = query.eq('user_id', negocioId);
    }
  }

  query = query.limit(LIMITE_FILAS + 1); // +1 para detectar truncamiento

  const { data, error } = await query;

  if (error) {
    console.error(`[backup] Error exportando ${tabla}:`, error.message);
    return { rows: [], truncated: false };
  }

  const rows = (data ?? []).slice(0, LIMITE_FILAS);
  return { rows, truncated: (data?.length ?? 0) > LIMITE_FILAS };
}

export async function POST(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Parsear body opcional: { negocio_id?: string }
    let negocioId: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && body.negocio_id) {
        if (typeof body.negocio_id !== 'string' || !UUID_RE.test(body.negocio_id)) {
          return NextResponse.json(
            { error: 'negocio_id inválido' },
            { status: 400 }
          );
        }
        negocioId = body.negocio_id;
      }
    } catch {
      // Sin body = backup completo de todas las tablas
    }

    const exportedAt = new Date().toISOString();
    const backup: Record<string, unknown> = {
      exported_at: exportedAt,
      version: '1.0',
      scope: negocioId ? `negocio:${negocioId}` : 'completo',
    };

    const advertencias: string[] = [];

    // Exportar todas las tablas en paralelo (máx 5 concurrentes para no
    // saturar la conexión a Supabase)
    const CONCURRENCY = 5;
    for (let i = 0; i < TABLAS.length; i += CONCURRENCY) {
      const lote = TABLAS.slice(i, i + CONCURRENCY);
      const resultados = await Promise.all(
        lote.map((t) => exportarTabla(t.tabla, t.filtroNegocio, negocioId))
      );
      for (let j = 0; j < lote.length; j++) {
        const { tabla, label } = lote[j];
        const { rows, truncated } = resultados[j];
        backup[tabla] = rows;
        if (truncated) {
          advertencias.push(
            `${label}: truncado a ${LIMITE_FILAS} filas (datos incompletos)`
          );
        }
      }
    }

    if (advertencias.length > 0) {
      backup._advertencias = advertencias;
    }

    // Registrar en auditoría (fire-and-forget)
    const ip =
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ua = request.headers.get('user-agent') || undefined;
    registrarAccion(
      'backup_exportado',
      'backup',
      null,
      { scope: negocioId ? 'negocio' : 'completo', tablas: TABLAS.length },
      ip,
      ua
    );

    // Notificar al admin por Telegram
    const json = JSON.stringify(backup, null, 2);
    const fecha = exportedAt.slice(0, 10);
    const nombre = negocioId
      ? `micajadigital_backup_${negocioId.slice(0, 8)}_${fecha}.json`
      : `micajadigital_backup_${fecha}.json`;
    const kb = Math.round(json.length / 1024);
    notificarTelegram(
      `💾 <b>Backup manual OK</b>\nArchivo: ${nombre}\nTablas: ${TABLAS.length}\nTamaño: ${kb} KB`
    );

    // Devolver el JSON como archivo descargable
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (e) {
    console.error('[backup] Error inesperado:', e);
    return NextResponse.json(
      { error: 'Error interno al generar backup' },
      { status: 500 }
    );
  }
}

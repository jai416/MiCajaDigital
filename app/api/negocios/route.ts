import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { registrarAccion } from '@/lib/audit';
import precios from '@config/precios.json';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
  const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 50) || 50));
  const desde = (pagina - 1) * porPagina;
  const activo = sp.get('activo');
  const busqueda = sp.get('q')?.trim();

  let query = supabaseAdmin
    .from('negocios')
    .select('id, nombre_negocio, email, activo, plan, fecha_expiracion, deleted_at', { count: 'exact' })
    .order('nombre_negocio', { ascending: true })
    .range(desde, desde + porPagina - 1);

  if (activo === 'true') query = query.eq('activo', true);
  else if (activo === 'false') query = query.eq('activo', false);
  if (busqueda) {
    const sanitized = busqueda.replace(/[%_]/g, '').slice(0, 100);
    query = query.or(`email.ilike.%${sanitized}%,nombre_negocio.ilike.%${sanitized}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.ceil((count ?? 0) / porPagina),
  });
}

// Fuente de verdad de los planes: config/precios.json (raíz del repo).
const PLANES_VALIDOS = Object.keys(precios.planes);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// Parseo tolerante del body: JSON malformado → null (400) en vez de 500.
async function leerJson(
  request: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' && !Array.isArray(b)
      ? (b as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function errorId(): NextResponse {
  return NextResponse.json({ error: 'ID requerido (UUID)' }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await leerJson(request);
    if (!body) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const { id } = body;

    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      return errorId();
    }

    // Allowlist: solo campos administrativos. NUNCA aceptar columnas del body
    // a ciegas (mass assignment): un PATCH malicioso podría reescribir email,
    // user_id, updated_at, etc. Cada campo valida además su TIPO para no
    // meter basura en la DB desde el panel.
    const permitidos = [
      'activo',
      'plan',
      'fecha_expiracion',
      'nombre_negocio',
      'telefono',
      'deleted_at',
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const campo of permitidos) {
      const v = body[campo];
      if (v === undefined) continue;
      switch (campo) {
        case 'activo':
          if (typeof v !== 'boolean') {
            return NextResponse.json(
              { error: 'activo debe ser booleano' },
              { status: 400 }
            );
          }
          break;
        case 'plan':
          if (typeof v !== 'string' || !PLANES_VALIDOS.includes(v)) {
            return NextResponse.json({ error: 'Plan no válido' }, { status: 400 });
          }
          break;
        case 'fecha_expiracion':
        case 'deleted_at':
          // null = restaurar de papelera / quitar fecha; si viene texto debe
          // ser fecha parseable.
          if (
            v !== null &&
            (typeof v !== 'string' || Number.isNaN(Date.parse(v)))
          ) {
            return NextResponse.json(
              { error: `${campo} debe ser una fecha ISO o null` },
              { status: 400 }
            );
          }
          break;
        default:
          // nombre_negocio, telefono
          if (typeof v !== 'string' || v.length > 200) {
            return NextResponse.json(
              { error: `${campo} debe ser texto (≤200)` },
              { status: 400 }
            );
          }
      }
      updates[campo] = v;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin campos válidos para actualizar' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('negocios').update(updates).eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await registrarAccion('negocio_actualizado', 'negocio', String(id), {
      campos: Object.keys(updates),
      updates,
    }, request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), request.headers.get('user-agent') || undefined);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await getSession())) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await leerJson(request);
    if (!body) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const { id, permanente } = body;

    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      return errorId();
    }

    // Por defecto es soft-delete (papelera): marca deleted_at en vez de borrar
    // la fila. El borrado físico destruiría los datos del negocio por la FK
    // CASCADE de ventas/gastos/catálogo. La restauración vuelve a poner
    // deleted_at = null.
    if (permanente === true) {
      const { error } = await supabaseAdmin
        .from('negocios')
        .delete()
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await registrarAccion('negocio_eliminado_permanente', 'negocio', String(id), {},
        request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), request.headers.get('user-agent') || undefined);
      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from('negocios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await registrarAccion('negocio_a_papelera', 'negocio', String(id), {},
      request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), request.headers.get('user-agent') || undefined);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

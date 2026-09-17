import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { registrarAccion } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const TABLAS_CONFLICTO = ['ventas', 'gastos', 'catalogo', 'compras', 'pago_fiado'] as const;

async function resolverUsuarios(userIdsNoNull: string[]): Promise<Map<string, { email: string | null; nombre: string | null }>> {
  const mapa = new Map<string, { email: string | null; nombre: string | null }>();
  if (userIdsNoNull.length === 0) return mapa;
  try {
    const { data } = await supabaseAdmin
      .from('negocios')
      .select('user_id, email, nombre_negocio')
      .in('user_id', userIdsNoNull);
    for (const n of data ?? []) {
      mapa.set(n.user_id, { email: n.email ?? null, nombre: n.nombre_negocio ?? null });
    }
  } catch (e) {
    console.error('API warning (usuarios):', e);
  }
  return mapa;
}

async function resolverFilas(
  agrupado: Map<string, string[]>
): Promise<Map<string, Record<string, unknown>>> {
  const mapa = new Map<string, Record<string, unknown>>();
  for (const [tabla, ids] of agrupado) {
    if (!ids.length) continue;
    try {
      const { data } = await supabaseAdmin
        .from(tabla)
        .select('*')
        .in('id', ids);
      for (const fila of data ?? []) {
        mapa.set(`${tabla}:${fila.id}`, fila as Record<string, unknown>);
      }
    } catch (e) {
      console.error(`API warning (fila ${tabla}):`, e);
    }
  }
  return mapa;
}

export async function GET(request: NextRequest) {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 30) || 30));
    const desde = (pagina - 1) * porPagina;
    const pendientes = sp.get('pendientes') === 'true';
    const tabla = sp.get('tabla') ?? '';
    const tablas = (TABLAS_CONFLICTO as readonly string[]).includes(tabla) ? [tabla] : null;

    let query = supabaseAdmin
      .from('conflictos_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + porPagina - 1);

    if (pendientes) {
      query = query.eq('resuelto', false);
    }
    if (tablas) {
      query = query.in('tabla', tablas);
    }

    const { data, error, count } = await query;
    if (error) { console.error('API error:', error); return NextResponse.json({ error: 'Error interno' }, { status: 500 }); }

    const conflictos = (data ?? []) as Array<Record<string, unknown>>;

    const userIds = [...new Set(conflictos.map((c) => c.user_id).filter((u): u is string => !!u))];
    const usuarios = await resolverUsuarios(userIds);

    const agrupado = new Map<string, string[]>();
    for (const c of conflictos) {
      const t = String(c.tabla ?? '');
      const id = String(c.row_id ?? '');
      if (!TABLAS_CONFLICTO.includes(t as (typeof TABLAS_CONFLICTO)[number]) || !id) continue;
      if (!agrupado.has(t)) agrupado.set(t, []);
      agrupado.get(t)!.push(id);
    }
    const filas = await resolverFilas(agrupado);

    const enriquecidos = conflictos.map((c) => {
      const userId = c.user_id as string | null;
      const t = String(c.tabla ?? '');
      const id = String(c.row_id ?? '');
      const usuario = userId ? (usuarios.get(userId) ?? null) : null;
      const fila = filas.get(`${t}:${id}`) ?? null;
      return {
        ...c,
        email: usuario?.email ?? null,
        nombre_negocio: usuario?.nombre ?? null,
        fila_actual: fila,
      };
    });

    return NextResponse.json({
      data: enriquecidos,
      total: count ?? 0,
      pagina,
      totalPaginas: Math.ceil((count ?? 0) / porPagina),
    });
  } catch (e) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const { id, resuelto, accion, fila } = body;
    const conflictoId = Number(id);
    if (!id || !Number.isInteger(conflictoId) || conflictoId <= 0) {
      return NextResponse.json({ error: 'Falta id válido (entero)' }, { status: 400 });
    }
    if (resuelto !== undefined && typeof resuelto !== 'boolean') {
      return NextResponse.json({ error: 'resuelto debe ser boolean' }, { status: 400 });
    }
    if (accion !== undefined && typeof accion !== 'string') {
      return NextResponse.json({ error: 'accion debe ser texto' }, { status: 400 });
    }
    const ACCIONES_VALIDAS = ['resuelto', 'ignorado', 'en_progreso', 'mantener_remoto', 'mantener_local', 'reparado'];
    if (accion && !ACCIONES_VALIDAS.includes(accion)) {
      return NextResponse.json({ error: `accion debe ser: ${ACCIONES_VALIDAS.join(', ')}` }, { status: 400 });
    }
    if (fila !== undefined && typeof fila !== 'object') {
      return NextResponse.json({ error: 'fila debe ser un objeto' }, { status: 400 });
    }

    // Allowlist de campos reparables por tabla (nunca id/user_id/fechas de sistema)
    const CAMPOS_EDITABLES: Record<string, Set<string>> = {
      ventas: new Set(['producto', 'precio', 'costo', 'cliente', 'pagado', 'metodo_pago', 'moneda',
        'tipo_pedido', 'anticipo', 'saldo_pendiente', 'estado_pedido', 'nota', 'telefono', 'vendedor',
        'descuento', 'devuelto', 'catalogo_id', 'negocio_id', 'fecha']),
      gastos: new Set(['concepto', 'monto', 'fecha', 'categoria', 'negocio_id']),
      catalogo: new Set(['nombre', 'precio', 'costo', 'stock', 'descripcion', 'codigo_barras', 'categoria', 'foto', 'negocio_id']),
      compras: new Set(['producto', 'costo_unitario', 'cantidad', 'costo_total', 'proveedor', 'fecha', 'negocio_id']),
      pago_fiado: new Set(['venta_id', 'monto', 'fecha', 'negocio_id']),
    };

    const reparar =
      fila && Object.keys(fila).length > 0 ? (fila as Record<string, unknown>) : null;

    if (reparar) {
      const { data: conflicto, error: errConflicto } = await supabaseAdmin
        .from('conflictos_log')
        .select('tabla, row_id')
        .eq('id', conflictoId)
        .single();
      if (errConflicto || !conflicto) {
        return NextResponse.json({ error: 'Conflicto no encontrado' }, { status: 404 });
      }
      const tabla = conflicto.tabla as string;
      const permitidos = CAMPOS_EDITABLES[tabla];
      if (!permitidos) {
        return NextResponse.json({ error: `Tabla no reparable: ${tabla}` }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(reparar)) {
        if (permitidos.has(k)) updates[k] = v;
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Ningún campo es editable para esta tabla' }, { status: 400 });
      }
      const { error: errUpdate } = await supabaseAdmin
        .from(tabla)
        .update(updates)
        .eq('id', conflicto.row_id);
      if (errUpdate) {
        console.error('API error (reparar):', errUpdate);
        return NextResponse.json({ error: `No se pudo reparar la fila: ${errUpdate.message}` }, { status: 500 });
      }
    }

    const update: Record<string, unknown> = {};
    if (resuelto !== undefined) update.resuelto = resuelto;
    update.accion = accion ?? (reparar ? 'reparado' : update.accion ?? undefined);

    const { error } = await supabaseAdmin
      .from('conflictos_log')
      .update(update)
      .eq('id', conflictoId);

    if (error) { console.error('API error:', error); return NextResponse.json({ error: 'Error interno' }, { status: 500 }); }

    await registrarAccion('conflicto_resuelto', 'conflictos_log', String(conflictoId), {
      resuelto,
      accion: update.accion,
      reparoCampos: reparar ? Object.keys(reparar) : undefined,
    }, request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), request.headers.get('user-agent') || undefined);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('API error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

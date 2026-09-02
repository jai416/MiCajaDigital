import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const pagina = Math.max(1, Number(sp.get('pagina') ?? 1) || 1);
    const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 30) || 30));
    const desde = (pagina - 1) * porPagina;
    const pendientes = sp.get('pendientes') === 'true';

    let query = supabaseAdmin
      .from('conflictos_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + porPagina - 1);

    if (pendientes) {
      query = query.eq('resuelto', false);
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      pagina,
      totalPaginas: Math.ceil((count ?? 0) / porPagina),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
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

    const { id, resuelto, accion } = body;
    if (!id || typeof id !== 'number' || id < 1 || id > 2147483647) {
      return NextResponse.json({ error: 'Falta id válido' }, { status: 400 });
    }
    if (resuelto !== undefined && typeof resuelto !== 'boolean') {
      return NextResponse.json({ error: 'resuelto debe ser boolean' }, { status: 400 });
    }
    if (accion !== undefined && typeof accion !== 'string') {
      return NextResponse.json({ error: 'accion debe ser texto' }, { status: 400 });
    }
    const ACCIONES_VALIDAS = ['resuelto', 'ignorado', 'en_progreso'];
    if (accion && !ACCIONES_VALIDAS.includes(accion)) {
      return NextResponse.json({ error: `accion debe ser: ${ACCIONES_VALIDAS.join(', ')}` }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (resuelto !== undefined) update.resuelto = resuelto;
    if (accion) update.accion = accion;

    const { error } = await supabaseAdmin
      .from('conflictos_log')
      .update(update)
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}

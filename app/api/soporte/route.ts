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
    const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 50) || 50));
    const desde = (pagina - 1) * porPagina;
    const estado = sp.get('estado');

    let query = supabaseAdmin
      .from('soporte_tickets')
      .select('*, negocios:user_id(nombre_negocio, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(desde, desde + porPagina - 1);

    if (estado && estado !== 'todos') {
      query = query.eq('estado', estado);
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

    const { id, estado, respuesta_admin } = body;
    if (!id || typeof id !== 'number' || id < 1 || id > 2147483647) {
      return NextResponse.json({ error: 'Falta id válido' }, { status: 400 });
    }

    const estadosValidos = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];
    if (estado && !estadosValidos.includes(estado as string)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
    }

    if (respuesta_admin !== undefined) {
      if (typeof respuesta_admin !== 'string') {
        return NextResponse.json({ error: 'respuesta_admin debe ser texto' }, { status: 400 });
      }
      if (respuesta_admin.length > 5000) {
        return NextResponse.json({ error: 'La respuesta no puede exceder 5000 caracteres' }, { status: 400 });
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (estado) update.estado = estado;
    if (respuesta_admin !== undefined) update.respuesta_admin = respuesta_admin;

    const { error } = await supabaseAdmin
      .from('soporte_tickets')
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

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const pagina = Math.max(1, Number(sp.get('pagina') ?? 1));
  const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 50)));
  const desde = (pagina - 1) * porPagina;
  const soloPendientes = sp.get('pendientes') === 'true';

  let query = supabaseAdmin
    .from('conflictos_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (soloPendientes) {
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
}

export async function PATCH(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { id, resuelto, accion } = body;
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (resuelto !== undefined) update.resuelto = resuelto;
  if (accion) update.accion = accion;

  const { error } = await supabaseAdmin
    .from('conflictos_log')
    .update(update)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

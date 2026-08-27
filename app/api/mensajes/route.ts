import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: List messages (all users, paginated)
export async function GET(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const pagina = Math.max(1, Number(sp.get('pagina') ?? 1));
  const porPagina = Math.min(100, Math.max(1, Number(sp.get('porPagina') ?? 50)));
  const desde = (pagina - 1) * porPagina;
  const userId = sp.get('user_id');

  let query = supabaseAdmin
    .from('mensajes')
    .select('*, negocios:user_id(nombre_negocio, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (userId) {
    query = query.eq('user_id', userId);
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

// POST: Send a message to a user
export async function POST(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { user_id, titulo, mensaje } = body;

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'Falta user_id' }, { status: 400 });
  }
  if (!titulo || typeof titulo !== 'string' || titulo.trim().length < 3) {
    return NextResponse.json({ error: 'El título debe tener al menos 3 caracteres' }, { status: 400 });
  }
  if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length < 5) {
    return NextResponse.json({ error: 'El mensaje debe tener al menos 5 caracteres' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('mensajes').insert({
    user_id,
    titulo: titulo.trim(),
    mensaje: mensaje.trim(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: Delete a message
export async function DELETE(request: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const id = Number(sp.get('id'));
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const { error } = await supabaseAdmin.from('mensajes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

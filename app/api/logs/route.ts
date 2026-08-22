import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const dias = Number(request.nextUrl.searchParams.get('dias') ?? 30);
    const corte = new Date(Date.now() - dias * 86400000).toISOString();
    const { error, count } = await supabaseAdmin
      .from('app_logs')
      .delete({ count: 'exact' })
      .lt('created_at', corte);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, borrados: count ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
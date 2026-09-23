import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { notificarTelegram, escaparTelegram } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron de notificaciones Telegram — programar cada 15 min.
 * GET protegido con Authorization: Bearer ${CRON_SECRET}.
 *
 * Chequeos:
 * 1. Pruebas por vencer mañana
 * 2. Tickets de soporte nuevos sin notificar
 * 3. Health check del panel
 * 4. Códigos por vencer (3 días)
 */
export async function GET(request: NextRequest) {
  // Autenticación por header (cron secreto)
  const auth = request.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const resultados: string[] = [];

  // 1. Pruebas por vencer mañana
  try {
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const mañanaInicio = mañana.toISOString().slice(0, 10);
    const mañanaFin = new Date(mañana.getTime() + 86400000).toISOString().slice(0, 10);

    const { data: pruebas } = await supabaseAdmin
      .from('negocios')
      .select('email')
      .eq('activo', true)
      .eq('plan', 'pro')
      .is('deleted_at', null)
      .gte('fecha_expiracion', mañanaInicio)
      .lt('fecha_expiracion', mañanaFin);

    if (pruebas && pruebas.length > 0) {
      const emails = pruebas.map((n) => n.email).filter(Boolean).join(', ');
      if (emails) {
        notificarTelegram(
          `⏰ <b>${pruebas.length} pruebas terminan mañana</b>\n${escaparTelegram(emails)}`
        );
        resultados.push(`pruebas_vencer: ${pruebas.length}`);
      }
    }
  } catch (e) {
    console.error('[cron] Error chequeando pruebas:', e);
  }

  // 2. Tickets de soporte nuevos (últimos 15 min)
  try {
    const hace15min = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: tickets } = await supabaseAdmin
      .from('soporte_tickets')
      .select('id, user_id, categoria, mensaje, created_at')
      .eq('estado', 'abierto')
      .gte('created_at', hace15min);

    if (tickets && tickets.length > 0) {
      for (const t of tickets) {
        // Buscar email del negocio
        const { data: negocio } = await supabaseAdmin
          .from('negocios')
          .select('email')
          .eq('user_id', t.user_id)
          .single();

        const email = negocio?.email ? escaparTelegram(negocio.email) : 'desconocido';
        const cat = escaparTelegram(t.categoria ?? '—');
        const msg = escaparTelegram((t.mensaje ?? '').slice(0, 100));
        notificarTelegram(
          `🎫 <b>Ticket de soporte</b>\nEmail: ${email}\nCategoría: ${cat}\nMensaje: ${msg}`
        );
      }
      resultados.push(`tickets: ${tickets.length}`);
    }
  } catch (e) {
    console.error('[cron] Error chequeando tickets:', e);
  }

  // 3. Health check del panel
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL;
    if (siteUrl) {
      const res = await fetch(`${siteUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      if (res.status !== 200) {
        notificarTelegram(`⚠️ <b>Panel degradado</b>\nStatus: ${res.status}`);
        resultados.push(`health: degraded (${res.status})`);
      }
    }
  } catch (e) {
    // Si no hay URL configurada o fetch falla, notificar una vez
    if (e instanceof Error && e.name !== 'AbortError') {
      notificarTelegram(`⚠️ <b>Panel caído</b>\nNo responde health check`);
      resultados.push('health: down');
    }
  }

  // 4. Códigos por vencer (3 días)
  try {
    const en3dias = new Date(Date.now() + 3 * 86400000).toISOString();

    const { count } = await supabaseAdmin
      .from('codigos_pago')
      .select('id', { count: 'exact', head: true })
      .eq('usado', false)
      .is('deleted_at', null)
      .lte('fecha_expiracion', en3dias)
      .gte('fecha_expiracion', new Date().toISOString().slice(0, 10));

    if (count && count > 0) {
      notificarTelegram(
        `📅 <b>${count} códigos por vencer</b>\nRecuérdale a las clientas canjear.`
      );
      resultados.push(`codigos_vencer: ${count}`);
    }
  } catch (e) {
    console.error('[cron] Error chequeando códigos:', e);
  }

  return NextResponse.json({ ok: true, resultados });
}

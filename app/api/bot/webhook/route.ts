import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { enviarTelegram, escaparTelegram } from '@/lib/telegram';
import { getAppVersion, getVersionCode } from '@/lib/version';

export const dynamic = 'force-dynamic';

// El webhook solo responde comandos al propio admin (chat id configurado).
// Cualquier otro chat es ignorado en silencio — nunca filtrar datos.
const CHAT_ADMIN = process.env.TELEGRAM_CHAT_ID;
const BOT_WEBHOOK_SECRET = process.env.CRON_SECRET;

const AYUDA = `🤖 <b>Mi Caja Digital — Bot de gestion</b>

<u>Consultas</u>
• /resumen — estado global (activos, ventas, codigos, tickets)
• /ventas_hoy — ventas del dia por moneda + total
• /nuevas — clientas registradas en los ultimos 7 dias
• /vencen — suscripciones por vencer (3 dias)
• /inactivas — clientas que no abren la app (7 dias sin uso)
• /codigos — codigos por vencer
• /tickets — tickets de soporte abiertos
• /version — version publicada de la app
• /salud — estado del panel y Supabase
• /ayuda — esta ayuda
• /ping — pong (check de conexion)`;

interface Update {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
}

type Respuesta = string;

function texto(msg: Update['message']): string {
  return (msg?.text ?? '').trim().toLowerCase();
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDias(dias: number): string {
  return new Date(Date.now() - dias * 86400000).toISOString();
}

async function comandoResumen(): Promise<Respuesta> {
  try {
    const { data } = await supabaseAdmin.rpc('stats_dashboard_resumen');
    if (!data || typeof data !== 'object') return '📊 Resumen: ❌ sin datos';
    const d = data as Record<string, number>;
    return [
      '📊 <b>Resumen general</b>',
      `Negocios: ${d.total_negocios ?? '—'} (activos ${d.activos ?? '—'}, en prueba ${d.en_prueba ?? '—'})`,
      `Ventas: ${d.total_ventas_hoy ?? 0} hoy · ${d.total_ventas_7d ?? 0} ult. 7d`,
      `Gastos: ${d.total_gastos_hoy ?? 0} hoy · ${d.total_gastos_7d ?? 0} ult. 7d`,
      `Codigos pendientes: ${d.codigos_pendientes ?? 0}`,
      `Tickets abiertos: ${d.tickets_abiertos ?? 0}`,
      `Conflictos sin resolver: ${d.conflictos_pendientes ?? 0}`,
      `Errores app (7d): ${d.logs_errores_7d ?? 0}`,
    ]
      .filter((l) => l.length > 0)
      .join('\n');
  } catch {
    return '📊 Resumen: ❌ no pude consultar stats';
  }
}

async function comandoVentasHoy(): Promise<Respuesta> {
  try {
    const inicio = hoyISO();
    const { data, error } = await supabaseAdmin
      .from('ventas')
      .select('moneda, precio, devuelto')
      .gte('fecha', inicio)
      .is('deleted_at', null)
      .eq('devuelto', 0)
      .limit(5000);
    if (error) return '💰 Ventas: ❌ error de consulta';
    const porMoneda = new Map<string, { n: number; total: number }>();
    for (const v of data ?? []) {
      const m = v.moneda ?? 'CUP';
      const cur = porMoneda.get(m) ?? { n: 0, total: 0 };
      cur.n += 1;
      cur.total += (v.precio as number) ?? 0;
      porMoneda.set(m, cur);
    }
    const lineas = [`💰 <b>Ventas hoy</b> (${hoyISO()})`, `Total: ${data?.length ?? 0} ventas`];
    for (const [m, v] of porMoneda) {
      lineas.push(`${m}: ${v.n} ventas · ${v.total.toLocaleString('es-CU', { maximumFractionDigits: 2 })}`);
    }
    return lineas.join('\n');
  } catch {
    return '💰 Ventas: ❌ sin datos';
  }
}

async function comandoNuevas(): Promise<Respuesta> {
  try {
    const { data, error } = await supabaseAdmin
      .from('negocios')
      .select('email, plan, activo, fecha_registro')
      .gte('fecha_registro', haceDias(7))
      .is('deleted_at', null)
      .order('fecha_registro', { ascending: false })
      .limit(15);
    if (error) return '🆕 Nuevas: ❌ error';
    if (!data || data.length === 0) return '🆕 No hay clientas nuevas en los ultimos 7 dias.';
    const lineas = data.map(
      (n) => `• ${escaparTelegram(n.email)} · ${n.activo ? 'activa' : 'prueba'} (${n.plan})`
    );
    return `🆕 <b>Clientas nuevas (7 dias)</b>: ${data.length}\n` + lineas.join('\n');
  } catch {
    return '🆕 Nuevas: ❌ sin datos';
  }
}

async function comandoVencen(): Promise<Respuesta> {
  try {
    const { data, error } = await supabaseAdmin
      .from('negocios')
      .select('email, plan, fecha_expiracion')
      .eq('activo', true)
      .is('deleted_at', null)
      .not('fecha_expiracion', 'is', null)
      .gte('fecha_expiracion', new Date().toISOString())
      .lte('fecha_expiracion', haceDias(-3))
      .order('fecha_expiracion', { ascending: true })
      .limit(15);
    if (error) return '⏰ Vencen: ❌ error';
    if (!data || data.length === 0) return '⏰ No hay suscripciones por vencer en 3 dias.';
    const lineas = data.map((n) => {
      const fecha = (n.fecha_expiracion as string | null)?.slice(0, 10);
      return `• ${escaparTelegram(n.email)} · ${n.plan} · vence ${fecha ?? '—'}`;
    });
    return `⏰ <b>Por vencer (3 dias)</b>: ${data.length}\n` + lineas.join('\n');
  } catch {
    return '⏰ Vencen: ❌ sin datos';
  }
}

async function comandoInactivas(): Promise<Respuesta> {
  try {
    const corte = haceDias(7);
    const { data, error } = await supabaseAdmin
      .from('negocios')
      .select('email, plan, activo, fecha_expiracion, ultimo_uso_at')
      .is('deleted_at', null)
      .not('fecha_expiracion', 'is', null)
      .gte('fecha_expiracion', new Date().toISOString()) // solo vigentes
      .or(`ultimo_uso_at.lt.${corte},ultimo_uso_at.is.null`)
      .order('ultimo_uso_at', { ascending: true })
      .limit(15);
    if (error) return '😴 Inactivas: ❌ error';
    if (!data || data.length === 0) return '😴 No hay clientas inactivas (o sin datos).';
    const lineas = data.map((n) => {
      const ultimo = n.ultimo_uso_at
        ? `uso ${(n.ultimo_uso_at as string).slice(0, 10)}`
        : 'sin actividad';
      return `• ${escaparTelegram(n.email)} · ${n.plan} · ${ultimo}`;
    });
    return `😴 <b>Clientas sin uso 7d</b>: ${data.length}\n` + lineas.join('\n');
  } catch {
    return '😴 Inactivas: ❌ sin datos';
  }
}

async function comandoCodigos(): Promise<Respuesta> {
  const en3dias = haceDias(-3);
  try {
    const { count } = await supabaseAdmin
      .from('codigos_pago')
      .select('id', { count: 'exact', head: true })
      .eq('usado', false)
      .is('deleted_at', null)
      .lte('fecha_expiracion', en3dias)
      .gte('fecha_expiracion', new Date().toISOString().slice(0, 10));
    return `📅 <b>Codigos por vencer (3 dias)</b>: ${count ?? 0}`;
  } catch {
    return '📅 Codigos: ❌ sin datos';
  }
}

async function comandoTickets(): Promise<Respuesta> {
  try {
    const { data, error } = await supabaseAdmin
      .from('soporte_tickets')
      .select('id, categoria, created_at')
      .eq('estado', 'abierto')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error || !data || data.length === 0) {
      return '🎫 No hay tickets abiertos.';
    }
    const lineas = data.map((t) => `• ${escaparTelegram(t.categoria ?? '—')}`);
    return `🎫 <b>Tickets abiertos</b> (${data.length})\n` + lineas.join('\n');
  } catch {
    return '🎫 Tickets: ❌ sin datos';
  }
}

export async function POST(request: NextRequest) {
  // Seguridad: el webhook debe llevar el secret_token configurado en setWebhook.
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (BOT_WEBHOOK_SECRET && secretHeader !== BOT_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const chatId = update?.message?.chat?.id;
  const cmd = texto(update?.message);

  // Solo el admin recibe respuesta; el resto se ignora en silencio.
  if (chatId === undefined || !CHAT_ADMIN || String(chatId) !== CHAT_ADMIN) {
    return NextResponse.json({ ok: true });
  }
  if (!cmd) return NextResponse.json({ ok: true });

  let respuesta: Respuesta;
  switch (cmd) {
    case '/ping':
      respuesta = 'pong 🏓';
      break;
    case '/salud':
      respuesta = await comandoSalud();
      break;
    case '/version':
      respuesta = `📦 <b>Version publicada</b>: v${getAppVersion()}+${getVersionCode()}`;
      break;
    case '/resumen':
      respuesta = await comandoResumen();
      break;
    case '/ventas_hoy':
      respuesta = await comandoVentasHoy();
      break;
    case '/nuevas':
      respuesta = await comandoNuevas();
      break;
    case '/vencen':
      respuesta = await comandoVencen();
      break;
    case '/inactivas':
      respuesta = await comandoInactivas();
      break;
    case '/codigos':
      respuesta = await comandoCodigos();
      break;
    case '/tickets':
      respuesta = await comandoTickets();
      break;
    default:
      respuesta = AYUDA;
  }

  await enviarTelegram(chatId, respuesta);
  return NextResponse.json({ ok: true });
}

async function comandoSalud(): Promise<Respuesta> {
  const lineas: string[] = ['🩺 <b>Health</b>'];
  try {
    const { error } = await supabaseAdmin
      .from('negocios')
      .select('id')
      .limit(1);
    lineas.push(error ? 'Supabase: ❌ error' : 'Supabase: ✅ OK');
  } catch {
    lineas.push('Supabase: ❌ fallo de red');
  }
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_BASE_URL;
  lineas.push(`Panel: ${sitio ? escaparTelegram(sitio) : 'no configurado'}`);
  return lineas.join('\n');
}
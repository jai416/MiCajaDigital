import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const LIMITE_INTENTOS = 5;
const VENTANA_MIN = 15;

// Fallback en memoria cuando Supabase no está configurado / no responde
// (p. ej. DEV sin SUPABASE_SERVICE_ROLE_KEY). Evita que el panel se bloquee.
const intentosMem = new Map<string, { count: number; inicio: number }>();

async function puedeIntentar(ip: string): Promise<boolean> {
  const r = await supabaseAdmin.rpc('admin_puede_intentar', {
    p_ip: ip,
    p_limite: LIMITE_INTENTOS,
    p_ventana_min: VENTANA_MIN,
  });
  if (r.error) {
    // Fallback en memoria: pierde al reiniciar, pero permite operar offline/local
    // y en entornos donde la tabla de rate-limit aún no existe.
    const ahora = Date.now();
    const previo = intentosMem.get(ip);
    if (!previo || ahora - previo.inicio > VENTANA_MIN * 60000) {
      intentosMem.set(ip, { count: 1, inicio: ahora });
      return true;
    }
    if (previo.count >= LIMITE_INTENTOS) return false;
    previo.count++;
    return true;
  }
  if (r.data !== true) return false;
  intentosMem.delete(ip);
  return true;
}

async function registrarIntento(ip: string, exitoso: boolean) {
  try {
    await supabaseAdmin.rpc('admin_registrar_intento', { p_ip: ip, p_exitoso: exitoso });
  } catch {
    // No bloquear el flujo si el log del intento falla.
  }
  // Limpia el fallback para no mezclar contadores
  intentosMem.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';

    const puede = await puedeIntentar(ip);
    if (!puede) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${VENTANA_MIN} minutos.` },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      await registrarIntento(ip, false);
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    if (verifyCredentials(email, password)) {
      await registrarIntento(ip, true);
      await createSession();
      return NextResponse.json({ success: true });
    }

    await registrarIntento(ip, false);
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

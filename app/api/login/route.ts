import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { registrarAccion } from '@/lib/audit';

const LIMITE_INTENTOS = 5;
const VENTANA_MIN = 15;

// Fallback en memoria SOLO para DEV (p. ej. sin SUPABASE_SERVICE_ROLE_KEY).
// En producción es inútil: cada función serverless tiene memoria propia, así
// que ahí el fallo del RPC se trata fail-closed (ver puedeIntentar).
const intentosMem = new Map<string, { count: number; inicio: number }>();

/// IP real del cliente. `x-forwarded-for` solo es fiable detrás de un proxy
/// conocido (Vercel lo normaliza y expone además `x-real-ip`). Se valida el
/// formato para no guardar basura en el rate-limit.
function obtenerIp(request: NextRequest): string {
  const candidata =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (candidata && /^[0-9a-fA-F:.]{3,45}$/.test(candidata)) {
    return candidata;
  }
  return 'desconocida';
}

async function puedeIntentar(ip: string): Promise<boolean> {
  const r = await supabaseAdmin.rpc('admin_puede_intentar', {
    p_ip: ip,
    p_limite: LIMITE_INTENTOS,
    p_ventana_min: VENTANA_MIN,
  });
  if (r.error) {
    // PRODUCCIÓN: fail-closed. Si el rate-limit no responde, no se permite
    // intentar login (mejor un login caído unos segundos que fuerza bruta
    // sin límite). El fallback en memoria queda solo para desarrollo local.
    if (process.env.NODE_ENV === 'production') return false;

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
    const ip = obtenerIp(request);

    const puede = await puedeIntentar(ip);
    if (!puede) {
      // Muestreo: en un ataque cada request generaría una fila en admin_audit;
      // registrar 1 de cada 5 basta para forense y no inunda la tabla.
      if (Math.random() < 0.2) {
        await registrarAccion('login_bloqueado_rate_limit', 'sesion', null, { ip },
          ip, request.headers.get('user-agent') || undefined);
      }
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${VENTANA_MIN} minutos.` },
        { status: 429 }
      );
    }

    let credenciales: unknown;
    try {
      credenciales = await request.json();
    } catch {
      await registrarIntento(ip, false);
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const email = (credenciales as Record<string, unknown> | null)?.email;
    const password = (credenciales as Record<string, unknown> | null)?.password;

    if (typeof email !== 'string' || typeof password !== 'string') {
      await registrarIntento(ip, false);
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    if (verifyCredentials(email, password)) {
      await registrarIntento(ip, true);
      await createSession();
      await registrarAccion('login_exitoso', 'sesion', null, { ip },
        ip, request.headers.get('user-agent') || undefined);
      return NextResponse.json({ success: true });
    }

    await registrarIntento(ip, false);
    await registrarAccion('login_fallido', 'sesion', null, { ip, email },
      ip, request.headers.get('user-agent') || undefined);
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

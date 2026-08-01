import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth';

const LIMITE_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const intentos = new Map<string, { count: number; inicio: number }>();

function puedeIntentar(ip: string): boolean {
  const ahora = Date.now();
  const previo = intentos.get(ip);
  if (!previo || ahora - previo.inicio > VENTANA_MS) {
    intentos.set(ip, { count: 1, inicio: ahora });
    return true;
  }
  if (previo.count >= LIMITE_INTENTOS) return false;
  previo.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocido';
    if (!puedeIntentar(ip)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera 15 minutos.' },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    if (verifyCredentials(email, password)) {
      intentos.delete(ip);
      await createSession();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    if (verifyCredentials(email, password)) {
      await createSession();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

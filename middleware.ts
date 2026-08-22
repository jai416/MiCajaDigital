import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verificarValorSesion } from '@/lib/session';

const RUTAS_API_PUBLICAS = ['/api/login', '/api/health', '/api/logout'];

export async function middleware(request: NextRequest) {
  const valor = request.cookies.get(SESSION_COOKIE)?.value;
  const valida = await verificarValorSesion(valor);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (RUTAS_API_PUBLICAS.includes(pathname)) {
      return NextResponse.next();
    }
    if (!valida) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === '/login') {
    if (valida) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/dashboard')) {
    if (!valida) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/api/:path*'],
};

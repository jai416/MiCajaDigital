import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verificarValorSesion } from '@/lib/session';

/**
 * Middleware global (Edge runtime — lib/session.ts es compatible a propósito):
 *
 * 1. Guard de sesión para TODAS las páginas /dashboard/* (incluidas las client
 *    components que solo consumen APIs: sin cookie válida no se sirve ni el
 *    shell). Redirige a /login.
 * 2. Validación de Origin en mutaciones (/api/* no-GET): defensa anti-CSRF en
 *    profundidad junto a sameSite=lax — un POST cross-site con cookies no pasa.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  let autenticado = false;
  try {
    autenticado = await verificarValorSesion(token);
  } catch {
    // Secreto ausente/inválido → tratar como no autenticado (fail-closed).
    autenticado = false;
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!autenticado) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    // Sin Origin (curl/servidor-a-servidor) se permite: la cookie httpOnly +
    // sameSite=lax ya impide que un navegador víctima la envíe cross-site.
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: 'Origen no permitido' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Origen inválido' }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};

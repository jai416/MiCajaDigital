import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { timingSafeEqual, scryptSync } from 'crypto';
import { SESSION_COOKIE, SESSION_TTL_MS, crearValorSesion, verificarValorSesion } from './session';

// ──────────────────────────────────────────────────────────────────────────
// IMPORTANTE: NADA de leer env vars ni lanzar errores a nivel de módulo.
// Durante `next build`, Next.js importa los route handlers para analizarlos,
// y con NODE_ENV=production + vars no presentes en build time, cualquier
// throw o acceso `!` explotaba con "Failed to collect page data for /api/...".
//
// Ahora todo se lee dentro de las funciones que lo usan (verifyCredentials).
// El fail-fast de producción se conserva, pero solo se dispara cuando alguien
// intenta loguearse — no cuando Render compila.
// ──────────────────────────────────────────────────────────────────────────

function valoresIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Hash señuelo (de una contraseña aleatoria que no existe): se verifica
// SIEMPRE aunque el email ya haya fallado para igualar el tiempo de CPU y no
// delatar por timing si el email del admin es el correcto.
const HASH_SENUELO =
  'scrypt:16384:8:1:0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function verificarHash(password: string, hash: string): boolean {
  // Formato scrypt:N:r:p:salt_hex:hash_hex (sin '$', ver nota arriba).
  const partes = hash.split(':');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = partes;
  try {
    const derivado = scryptSync(password, Buffer.from(saltHex, 'hex'), 64, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return valoresIguales(derivado.toString('hex'), hashHex);
  } catch {
    return false;
  }
}

export function verifyCredentials(email: string, password: string): boolean {
  // Lazy: leer env aquí, no a nivel de módulo.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL ausente. Configúralo en .env.local o en el hosting.');
  }

  // Fail-fast de producción: SOLO al intentar loguear, no al importar.
  if (process.env.NODE_ENV === 'production' && !adminPasswordHash) {
    throw new Error(
      'ADMIN_PASSWORD_HASH ausente en producción. Genera el hash con ' +
        '`node scripts/hash_password.mjs <clave>` y elimina ADMIN_PASSWORD.'
    );
  }

  const emailOk = valoresIguales(email, adminEmail);
  let passOk: boolean;
  if (adminPasswordHash) {
    // scrypt corre siempre (~100 ms): da igual qué campo falló.
    passOk = verificarHash(password, adminPasswordHash);
  } else {
    // Sin hash real, quema el mismo tiempo de CPU con el señuelo antes de la
    // comparación plana para que el tiempo total no filtre información.
    verificarHash(password, HASH_SENUELO);
    passOk = !!adminPassword && valoresIguales(password, adminPassword);
  }
  return emailOk && passOk;
}

export async function createSession() {
  const cookieStore = cookies();
  // El token incluye su fecha de emisión firmada (ver lib/session.ts): caduca
  // a los SESSION_TTL_MS aunque alguien copie la cookie.
  const valor = await crearValorSesion();
  cookieStore.set(SESSION_COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/',
  });
}

export async function destroySession() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<boolean> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verificarValorSesion(token);
}

/// Guard para server components: PRIMERA línea de toda página /dashboard que
/// consulte datos. Sin sesión → redirect a /login (el middleware también
/// protege, esto es defensa en profundidad por si el matcher se desconfigura).
export async function requireSession(): Promise<void> {
  if (!(await getSession())) redirect('/login');
}

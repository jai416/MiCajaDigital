import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual, scryptSync } from 'crypto';
import { SESSION_COOKIE, SESSION_TOKEN_LENGTH, verificarValorSesion } from './session';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
// Hash generado con scripts/hash_password.mjs (formato
// scrypt:N:r:p:salt_hex:hash_hex, sin '$' porque @next/env lo expandiría).
// Si está definido, se prefiere sobre ADMIN_PASSWORD (fallback por compatibilidad).
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

function valoresIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/// Verifica la contraseña contra el hash scrypt (`ADMIN_PASSWORD_HASH`) si está
/// configurado; si no, contra el `ADMIN_PASSWORD` plano. Nunca guardes en texto
/// plano: genera el hash con `node scripts/hash_password.mjs <clave>`.
export function verifyPassword(password: string): boolean {
  if (ADMIN_PASSWORD_HASH) {
    const partes = ADMIN_PASSWORD_HASH.split(':');
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
  return valoresIguales(password, ADMIN_PASSWORD);
}

export function verifyCredentials(email: string, password: string): boolean {
  return valoresIguales(email, ADMIN_EMAIL) && verifyPassword(password);
}

export async function createSession() {
  const cookieStore = cookies();
  const token = randomBytes(SESSION_TOKEN_LENGTH / 2).toString('hex');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(process.env.ADMIN_SESSION_SECRET || ADMIN_PASSWORD || ''),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(token));
  const firma = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  cookieStore.set(SESSION_COOKIE, `${token}.${firma}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
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

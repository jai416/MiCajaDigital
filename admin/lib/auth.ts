import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'crypto';
import { SESSION_COOKIE, SESSION_TOKEN_LENGTH } from './session';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

function valoresIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyCredentials(email: string, password: string): boolean {
  return valoresIguales(email, ADMIN_EMAIL) && valoresIguales(password, ADMIN_PASSWORD);
}

export async function createSession() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE, randomBytes(32).toString('hex'), {
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
  return typeof token === 'string' && token.length === SESSION_TOKEN_LENGTH;
}

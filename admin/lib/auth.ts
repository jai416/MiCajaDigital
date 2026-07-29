import { cookies } from 'next/headers';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

export function verifyCredentials(email: string, password: string): boolean {
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export async function createSession() {
  const cookieStore = cookies();
  cookieStore.set('admin_session', 'autenticado', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });
}

export async function destroySession() {
  const cookieStore = cookies();
  cookieStore.delete('admin_session');
}

export async function getSession(): Promise<boolean> {
  const cookieStore = cookies();
  return cookieStore.has('admin_session');
}

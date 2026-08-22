export const SESSION_COOKIE = 'admin_session';
export const SESSION_TOKEN_LENGTH = 64;

function secretoSesion(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function valoresIguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function firmarToken(token: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretoSesion()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(token));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verificarValorSesion(valor: string | undefined): Promise<boolean> {
  if (!valor) return false;
  const [token, sig] = valor.split('.');
  if (!token || token.length !== SESSION_TOKEN_LENGTH || !sig) return false;
  const esperado = await firmarToken(token);
  return valoresIguales(sig, esperado);
}

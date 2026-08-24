// Cookie con prefijo __Host- en producción: el navegador rechaza cualquier
// cookie __Host- que no sea Secure, sin Domain y con path=/ (mitiga subdominios
// maliciosos escribiendo nuestra sesión). En desarrollo (http://localhost) se
// usa el nombre simple: los navegadores exigen canal seguro para __Host-.
// NOTA: renombrar la cookie fuerza un re-login de todas las sesiones activas.
export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production'
    ? '__Host-admin_session'
    : 'admin_session';

// Duración de la sesión: debe coincidir con el maxAge de la cookie en auth.ts.
// El timestamp va DENTRO del token firmado, así que aunque roben la cookie,
// deja de funcionar al cumplir este plazo (el maxAge solo borra la cookie del
// navegador).
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Versión del esquema de sesión incluida en la firma. Rotar
// ADMIN_SESSION_VERSION en .env.local invalida TODAS las sesiones existentes
// (útil tras un compromiso o cambio de contraseña).
function versionSesion(): string {
  return process.env.ADMIN_SESSION_VERSION || 'v1';
}

function secretoSesion(): string {
  const secreto = process.env.ADMIN_SESSION_SECRET;
  // Fail-fast: sin secreto dedicado NO se firma nada — ni con clave vacía ni
  // derivada de ADMIN_PASSWORD (una firma con clave predecible/vacía produce
  // sesiones falsificables). El error estalla en el primer uso y /api/health
  // lo reporta como check "sesion".
  if (!secreto || secreto.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET ausente o demasiado corto (<32 caracteres). ' +
        'Genera uno con: openssl rand -hex 64 y pégalo en admin/.env.local'
    );
  }
  return secreto;
}

// Comparación en tiempo constante sin Buffer (compatible con Edge runtime).
function valoresIguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmac(cadena: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretoSesion()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${versionSesion()}.${cadena}`)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/// Genera el valor completo de la cookie: `<aleatorio>.<emitido_en_ms>.<firma>`.
/// Usa Web Crypto (getRandomValues), así que funciona igual en Node y Edge.
export async function crearValorSesion(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const aleatorio = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const emitido = Date.now().toString();
  const firma = await hmac(`${aleatorio}.${emitido}`);
  return `${aleatorio}.${emitido}.${firma}`;
}

export async function verificarValorSesion(
  valor: string | undefined
): Promise<boolean> {
  if (!valor) return false;
  const partes = valor.split('.');
  if (partes.length !== 3) return false;
  const [aleatorio, emitidoStr, firma] = partes;
  if (!/^[0-9a-f]{64}$/.test(aleatorio)) return false;
  const emitido = Number(emitidoStr);
  if (!Number.isInteger(emitido) || emitido <= 0) return false;
  const edad = Date.now() - emitido;
  // Rechaza tokens viejos Y tokens "del futuro" (>2 min de desfase).
  if (edad > SESSION_TTL_MS || edad < -120000) return false;
  const esperado = await hmac(`${aleatorio}.${emitidoStr}`);
  return valoresIguales(firma, esperado);
}

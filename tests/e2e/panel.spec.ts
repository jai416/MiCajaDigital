import { test, expect } from '@playwright/test';

/// Sin sesión, cualquier ruta de dashboard redirige a /login.
test('dashboard redirige a login sin sesión', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

/// Las APIs protegidas devuelven 401 sin sesión (doble capa + middleware).
test('API negocios exige sesión', async ({ request }) => {
  const res = await request.patch('/api/negocios', {
    data: { id: 'x', activo: true },
  });
  expect(res.status()).toBe(401);
});

test('API codigos exige sesión', async ({ request }) => {
  const res = await request.get('/api/codigos');
  expect(res.status()).toBe(401);
});

test('API logs DELETE exige sesión', async ({ request }) => {
  const res = await request.delete('/api/logs?dias=30');
  expect(res.status()).toBe(401);
});

/// /api/health es público pero NO debe filtrar detalles sin sesión.
test('health público no expone detalles', async ({ request }) => {
  const res = await request.get('/api/health');
  expect([200, 500]).toContain(res.status());
  const body = await res.json();
  expect(body.checks).toBeUndefined();
  expect(body.status).toBeDefined();
});

/// Login con credenciales inválidas: la API responde 401 con el mensaje y el
/// usuario sigue en /login (nunca entra).
///
/// Se afirma sobre la RESPUESTA, no sobre el texto renderizado: en CI el
/// panel corre contra un Supabase inalcanzable (127.0.0.1:9) y cada llamada
/// del login (rate-limit, registro de intento, auditoría) reintenta antes de
/// rendirse — el 401 correcto tarda ~14 s. Esperar a que el texto
/// apareciera en pantalla convertía un retardo del stub en un falso negativo.
/// El cuerpo va en el mensaje de aserción: si algún día falla, dice qué
/// devolvió la API de verdad.
test('login fallido devuelve 401 y deja al usuario en /login', async ({ page }) => {
  test.setTimeout(120_000);

  // Si React no ha hidratado, el clic hace el submit NATIVO del formulario
  // (GET a /login) y nunca sale un POST /api/login: el test se queda esperando
  // una respuesta que jamás ocurre. `networkidle` + este aviso de consola
  // hacen que un fallo futuro diga la causa en vez de un timeout mudo.
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`console: ${m.text()}`);
  });

  await page.goto('/login', { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();

  await page.fill('#login-email', 'intruso@ejemplo.com');
  await page.fill('#login-password', 'contraseña-errónea-123');

  const respuestaLogin = page.waitForResponse(
    (r) => r.url().includes('/api/login') && r.request().method() === 'POST',
    { timeout: 60_000 }
  ).catch((e) => {
    throw new Error(
      `No salió ningún POST /api/login tras pulsar Entrar. ` +
        `URL actual: ${page.url()} | errores de consola: ` +
        `${errores.length ? errores.join(' // ') : '(ninguno)'} | ${e.message}`
    );
  });

  await page.getByRole('button', { name: 'Entrar' }).click();

  const res = await respuestaLogin;
  const cuerpo = await res.text();
  expect(
    cuerpo,
    `POST /api/login devolvió ${res.status()}: ${cuerpo.slice(0, 300)}`
  ).toContain('Credenciales incorrectas');
  expect(res.status()).toBe(401);

  await expect(page).toHaveURL(/\/login$/);
});

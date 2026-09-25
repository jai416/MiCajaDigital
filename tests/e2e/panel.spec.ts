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
  await page.goto('/login');
  await page.fill('#login-email', 'intruso@ejemplo.com');
  await page.fill('#login-password', 'contraseña-errónea-123');

  const respuestaLogin = page.waitForResponse(
    (r) => r.url().includes('/api/login') && r.request().method() === 'POST',
    { timeout: 90_000 }
  );
  await page.getByRole('button', { name: 'Entrar' }).click();

  const res = await respuestaLogin;
  const cuerpo = await res.text();
  expect(
    cuerpo,
    `POST /api/login devolvió ${res.status()}: ${cuerpo.slice(0, 300)}`
  ).toContain('Credenciales incorrectas');
  expect(res.status()).toBe(401);

  // Y el usuario sigue en /login (navegar a un dashboard = sesión creada).
  await expect(page).toHaveURL(/\/login$/);
});

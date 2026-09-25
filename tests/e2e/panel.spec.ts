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

/// Login con credenciales inválidas: error visible, nunca entra.
///
/// Timeout amplio a propósito: en CI el panel corre contra un Supabase
/// inalcanzable (127.0.0.1:9), y cada llamada del login (rate-limit,
/// registro de intento y auditoría) reintenta antes de rendirse. Medido en
/// el runner: el 401 correcto llega en ~14 s. Con los 15 s por defecto el test
/// fallaba por poco, no por un fallo del panel. En producción (Supabase real)
/// la respuesta es inmediata.
test('login fallido muestra error y sigue en /login', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/login');
  await page.fill('#login-email', 'intruso@ejemplo.com');
  await page.fill('#login-password', 'contraseña-errónea-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('text=Credenciales incorrectas')).toBeVisible({
    timeout: 45_000,
  });
  await expect(page).toHaveURL(/\/login$/);
});

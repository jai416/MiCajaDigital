import { defineConfig, devices } from '@playwright/test';

/**
 * Tests e2e del panel admin. Solo cubren comportamientos que NO requieren
 * credenciales reales (redirects de sesión, 401 de APIs, login fallido),
 * así la suite corre en CI sin secretos.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    // OJO: la sonda de "listo" NO puede ser /api/health. Esa ruta devuelve
    // 500 a propósito cuando algo está degradado (monitorización) y Playwright
    // solo acepta 2xx/3xx → el webServer se quedaba esperando 120 s y el job
    // e2e moría con "Timed out waiting 120000ms from config.webServer".
    // /login es una página estática pública: siempre 200 si el server listens.
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    // Next dev compila /middleware y la primera ruta al vuelo: con frío
    // alrededor de 20-30 s.
    timeout: 180000,
  },
});

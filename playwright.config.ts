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
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

const fs = require('fs');
const path = require('path');

/**
 * Versión para la caché del service worker.
 *
 * OJO: usaba `package.json` (1.0.0, congelado desde hace meses) → la caché
 * `mcd-admin-v1-1.0.0` NUNCA se invalidaba al desplegar, y el panel podía
 * quedarse sirviendo JS/CSS de un deploy anterior. Ahora se lee la MISMA
 * fuente de verdad que lib/version.ts (`docs/version.json`), con la env
 * `APP_VERSION` como plan B para despliegues donde ese archivo no existe
 * (Render clona solo este repo) y `package.json` como último recurso.
 */
function versionParaCache() {
  try {
    const ruta = path.join(__dirname, '..', 'docs', 'version.json');
    const v = JSON.parse(fs.readFileSync(ruta, 'utf-8')).version;
    if (v) return String(v);
  } catch {
    // docs/version.json no accesible (CI, Render): plan B.
  }
  return process.env.APP_VERSION || require('./package.json').version || '0.0.0';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // El service worker la usa como versión de caché: cada build/release con
    // una versión nueva invalida automáticamente la caché vieja del navegador.
    NEXT_PUBLIC_APP_VERSION: versionParaCache(),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // En DESARROLLO React Refresh necesita 'unsafe-eval' para evaluar
              // el bundle con HMR. Sin esto, el CSP bloquea la hidratación
              // (pageerror: "Evaluating a string as JavaScript violates ...")
              // y la página se queda sin JS: los formularios hacen submit
              // NATIVO y ninguna llamada fetch sale nunca. Solo se permite en
              // dev; en producción la CSP sigue igual de estricta.
              `script-src 'self' 'unsafe-inline'${
                process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''
              }`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

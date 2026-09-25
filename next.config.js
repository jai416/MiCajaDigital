/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // El service worker la usa como versión de caché: cada build/release con
    // una versión nueva invalida automáticamente la caché vieja del navegador.
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version || '0.0.0',
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

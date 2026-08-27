# Panel Admin — Mi Caja Digital

Next.js 14 + Supabase. Documentación de mantenimiento, seguridad y upgrades.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # rellenar valores (ver .env.example)
npm run dev
```

> **Precios**: `config/precios.json` (dentro de `admin/`) es una copia
> vendorizada de la raíz del proyecto Flutter. El alias tsconfig
> `"@config/*": ["./config/*"]` resuelve dentro del repo para que el CI
> (clone limpio) compile. Si cambias precios, actualiza AMBAS copias.

Comandos útiles:

```bash
npx tsc --noEmit        # typecheck
npm run lint            # eslint
npm run build           # build de producción
npm run test:e2e        # Playwright (requiere npx playwright install chromium)
```

## Seguridad aplicada (auditoría 2026-08-22)

- **Sesiones firmadas con expiración y versión** (`lib/session.ts`): la cookie
  es `aleatorio.emitido_ms.hmac`. El HMAC incluye `ADMIN_SESSION_VERSION`, así
  que rotar esa variable (o el secreto) invalida TODAS las sesiones al instante.
  Los tokens caducan a las 24 h aunque se copie la cookie.
- **Rate-limit fail-closed en producción**: si el RPC `admin_puede_intentar`
  falla en producción, el login se rechaza (el fallback en memoria solo aplica
  en desarrollo; en serverless cada instancia tiene memoria propia).
- **Códigos de pago criptográficos**: 8 caracteres generados con
  `crypto.randomInt` (nunca `Math.random`). Unicidad garantizada por la
  constraint `UNIQUE(codigo)` + reintento ante conflicto (23505).
- **Auditoría**: toda acción del panel queda en la tabla `admin_audit`
   (aplicar `supabase/migrations/20260822000000_admin_audit.sql` o pegar
   `docs/supabase-schema.sql` en el SQL Editor).
- **Cabeceras de seguridad**: X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy y HSTS (`next.config.js`).
- **`/api/health` estratificado**: sin sesión responde solo `{status}`; los
  detalles y la creación del bucket exigen login. Verifica buckets `fotos`
  (privado) y `config` (público).
- **Borrado permanente** exige escribir `ELIMINAR` en un modal (no confirm()
  nativo) y queda auditado.
- **Purga de logs acotada**: `/api/logs?dias=` se recorta a [1..730].

## Mantenimiento

### Actualizar Next.js a 15.x (plan)

1. Revisar el changelog: <https://nextjs.org/docs/app/building-your-application/upgrading/version-15>
2. `npm install next@15 react@19 react-dom@19 @types/react @types/react-dom`
3. Cambios esperados en este repo:
   - `cookies()`/`headers()` son asíncronos: añadir `await` en
     `lib/auth.ts` (createSession/destroySession/getSession).
   - `searchParams` de páginas pasa a Promise: `await searchParams` en
     `dashboard/page.tsx` y `negocios/page.tsx`.
   - Middleware sigue funcionando igual (runtime Edge).
4. Ejecutar `npx tsc --noEmit && npm run build && npm run test:e2e`.
5. Subir de versión y desplegar en horario tranquilo; si algo falla,
   rollback a la versión anterior del deploy en Vercel.

> Contexto: estamos en 14.2.x que ya incluye el fix del bypass de middleware
> CVE-2025-29927. La migración a 15.x es planificada, no urgente.

### Variables de entorno

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente público |
| `SUPABASE_SERVICE_ROLE_KEY` | APIs server-side (obligatoria en producción) |
| `ADMIN_EMAIL` | Login del panel |
| `ADMIN_PASSWORD_HASH` | Hash scrypt (preferente). Generar: `node scripts/hash_password.mjs <clave>` |
| `ADMIN_PASSWORD` | Solo fallback dev. En producción dispara warning fuerte |
| `ADMIN_SESSION_SECRET` | Secreto HMAC de sesión (`openssl rand -hex 64`) |
| `ADMIN_SESSION_VERSION` | Rótalo para invalidar todas las sesiones |

### Rotación de emergencia

Si se compromete una sesión o contraseña:

1. Genera hash nuevo (`node scripts/hash_password.mjs`) → actualiza
   `ADMIN_PASSWORD_HASH`.
2. Cambia `ADMIN_SESSION_SECRET` **o** sube `ADMIN_SESSION_VERSION` (p. ej. v1→v2).
3. Redespliega: todas las cookies quedan inválidas.

## Tests e2e

Los specs (`tests/e2e/panel.spec.ts`) solo prueban comportamientos sin
credenciales reales: redirects de sesión, 401 de APIs, health público sin
detalles y login fallido. Así corren en CI sin secretos.

```bash
npx playwright install chromium   # una vez
npm run test:e2e
```

## Páginas del dashboard

- `/dashboard` — Métricas y resumen (server component).
- `/dashboard/negocios` — Gestión de cuentas (activar, renovar, papelera).
- `/dashboard/codigos` — Generación y gestión de códigos de pago. Botón
  "💰 Confirmar y enviar" con diálogo de confirmación antes de generar.
- `/dashboard/logs` — Logs de la app con eliminación individual/masiva.
- `/dashboard/health` — Health check (buckets, conexión, sesión).
- `/dashboard/soporte` — Tickets de soporte (requiere migración §A).
- `/dashboard/conflictos` — Log de conflictos de sync (requiere migración §B).
- `/dashboard/mensajes` — Envío de mensajes directos a usuarios (requiere
  `docs/SQL_PEGAR.sql` §5).

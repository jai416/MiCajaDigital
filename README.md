# Panel Admin — Mi Caja Digital

[![Backup Supabase](https://github.com/jai416/MiCajaDigital/actions/workflows/backup.yml/badge.svg)](https://github.com/jai416/MiCajaDigital/actions/workflows/backup.yml)

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
- **Contraseña de producción**: `ADMIN_PASSWORD_HASH` es obligatorio; `ADMIN_PASSWORD`
  solo puede usarse en desarrollo. El health check marca el panel como degradado si
  falta el hash en producción.
- **OTA alineada con Flutter**: `/api/version` publica `version`, `versionCode`,
  `url` y `mensaje`, con fallback `1.3.4+2022` (de `process.env.APP_VERSION` /
  `APP_VERSION_CODE`), el mismo contrato que consume la app.

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
- `/dashboard/conflictos` — Resolución de conflictos de sync: contexto (usuario,
  fila actual en la nube), reparación por campo y acciones explícitas (requiere
  migración §B).
- `/dashboard/mensajes` — Envío de mensajes directos a usuarios (requiere
  `docs/SQL_APLICAR_TODOS.sql` §4).
- `/dashboard/actividad` — Actividad reciente de sync por negocio.
- `/dashboard/versiones` — Versión instalada de la app por usuaria (la app la
  reporta al arrancar vía RPC `reportar_version_app`; requiere
  `docs/SQL_VERSION_APP.sql`).

### Auditoría 12 sep 2026

- Se revocó en Supabase el grant público heredado de `stats_dashboard_v2`.
- Se corrigieron los IDs `BIGINT` de mensajes y el filtro de
  `suscripcion_eventos` en el backup por negocio.
- Las mutaciones de códigos y backups validan UUID antes de consultar Supabase.
- `npx tsc --noEmit` y `npm run build` pasan. Para Playwright: `npm install` (ya
  en devDependencies) y `npx playwright install chromium` (una vez).

### API backup/export

`POST /api/backup` — exporta todas las tablas de la BD como JSON descargable.

- **Auth**: requiere sesión admin (`getSession()`).
- **Body opcional**: `{ "negocio_id": "uuid" }` para exportar solo un negocio.
- **Response**: `application/json` descargable como `micajadigital_backup_YYYY-MM-DD.json`.
- **Límite**: 50,000 filas por tabla (seguridad contra OOM).
- **Tablas**: negocios, ventas, gastos, catalogo, compras, pago_fiado, codigos_pago, mensajes, soporte_tickets, conflictos_log, suscripcion_eventos, app_logs, admin_audit.
- **UI**: `BackupButton.tsx` en `/dashboard/negocios` (header "Exportar respaldo completo" + por-row).

### Backup automático diario (GitHub Actions)

`pg_dump` diario contra Supabase → repo privado `MiCajaDigital-BACKUPS`
(rotación 30 días). Workflow: `.github/workflows/backup.yml` (en este repo).

- **Cron**: 3:00 AM UTC + `workflow_dispatch` (manual).
- **Secrets**: `SUPABASE_DB_URL`, `BACKUP_REPO_TOKEN` (ver `docs/BACKUP_SETUP.md`).
- **Restauración**: `gunzip -c archivo.sql.gz | psql "$STAGING_DB_URL"`.
- **Prueba de restauración**: `scripts/test_backup_restore.sh` (verifica las 7 tablas principales).
- Guía completa de setup: **`docs/BACKUP_SETUP.md`** (raíz del proyecto Flutter).

## Notificaciones Telegram

El panel envía notificaciones al admin vía Telegram cuando ocurren eventos clave
(pagos confirmados, backups, tickets de soporte, health check fallando).

### Variables de entorno necesarias

```bash
# URL base del Worker proxy (Cuba bloquea api.telegram.org)
TELEGRAM_PROXY_URL=https://tu-worker.workers.dev
# Token del bot (@BotFather)
TELEGRAM_BOT_TOKEN=8858641490:AAH222...
# Chat ID privado del admin
TELEGRAM_CHAT_ID=6988595915
# Secreto para proteger el cron (generar con: openssl rand -hex 32)
CRON_SECRET=c0bff979...
```

### Puntos de notificación

| Evento | Endpoint | Cuándo |
|--------|----------|--------|
| Pago confirmado | `PATCH /api/codigos` | `estado_pago = 'confirmado'` |
| Backup manual | `POST /api/backup` | Al generar el JSON |

### Cron de notificaciones

`GET /api/cron/notificaciones` — protegido con `Authorization: Bearer ${CRON_SECRET}`.

Chequeos (cada 15 min):
1. Pruebas por vencer mañana
2. Tickets de soporte nuevos (últimos 15 min)
3. Health check del panel
4. Códigos por vencer (3 días)

**Programar el cron:**
- **Render**: si el plan lo permite, crear un Cron Job apuntando a
  `GET https://tu-panel.onrender.com/api/cron/notificaciones` con header
  `Authorization: Bearer <CRON_SECRET>`, cada 15 minutos.
- **GitHub Actions** (alternativa): añadir un workflow que haga `curl` cada 15 min.

### Verificación del Worker antes de desplegar

En el proyecto del Worker Cloudflare (no en `admin/`):

```bash
rm -rf node_modules package-lock.json
npm install
# Debe terminar sin errores ERESOLVE
npx wrangler deploy --dry-run
# Debe pasar sin error → haz el deploy real
npx wrangler deploy
```

**Nota:** El Worker son ~30 líneas. No necesita ESLint (añádelo solo cuando crezca
a ~200 líneas para reducir superficie de fallo).

### Fail-safe

- Si falta cualquier env var, las notificaciones se ignoran silenciosamente.
- Si el Worker proxy o Telegram fallan, el panel sigue funcionando igual.
- Los errores se loguean con `console.error` (sin propagar al caller).

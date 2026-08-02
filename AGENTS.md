# AGENTS.md — Mi Caja Digital

## Stack

- **Framework:** Expo SDK 57+ con TypeScript, expo-router (file-based routing)
- **DB local:** expo-sqlite (sync API: `openDatabaseSync`, `useSQLiteContext`)
- **Cloud:** Supabase (anon key en mobile, service_role key SOLO en admin/)
- **Auth:** Supabase Auth (email/password) para mobile; env-var credentials para admin panel
- **Estilos:** StyleSheet (no NativeWind)
- **Tema:** Automático light/dark vía `useColorScheme`, verde (ventas) / rojo (gastos)

## Convenciones de Código

- IDs: UUID v4 generados con `generarUUID()` (nunca autoincrement)
- Fechas en SQLite: `TEXT` en formato ISO 8601 o `YYYY-MM-DD`
- Timestamps: ISO 8601 string (`new Date().toISOString()`)
- `sincronizado INTEGER DEFAULT 0` en SQLite para registry no sincronizados
- `updated_at TEXT` en SQLite para sync bidireccional
- `metodo_pago TEXT DEFAULT 'efectivo'` en ventas con CHECK ('efectivo','tarjeta','transferencia')
- `catalogo_id TEXT` en ventas (FK opcional a catalogo)
- Sin comentarios en código de producción

## Patrones

### Hooks
Cada hook usa `useSQLiteContext()` y `useAuth()` para obtener `db` y `user`.
Ejemplo:
```
useVentas()    → addVenta, pagarVenta, deleteVenta, getVentasDelDia, getDeudores, getCuadre, getPedidos, getVentasEnRango, actualizarEstadoPedido, actualizarCliente, updateVenta
useGastos()    → addGasto, getGastosDelDia, getGastosTodos, getGastosEnRango
useCatalogo()  → getAll, buscar, buscarPorCodigo, getCategorias, buscarPorCategoria, addProducto, updateProducto, deleteProducto, getByNombre, deductStock
useCompras()   → getAll, addCompra, deleteCompra
useNotificaciones() → toggle, toggleDeudores, registerPushToken, rescheduleDaily, rescheduleDeudor
useBiometrica() → available, enabled, toggle
useSync()      → syncing, lastSync, sincronizar
useExport()    → exportTable, exportTodo, exportToPDF, exporting
useAccentColor()/AccentContext → theme, primary, accent, setAccentColor
```

TODAS las consultas SQL dentro de hooks deben estar en `try/catch/finally` con
`console.error` y retorno de valores por defecto seguros (arrays vacíos u objetos vacíos).
IMPORTANTE: dentro de un `try`, devolver con `return await db.getAllAsync(...)` (NO `return db.getAllAsync(...)`),
de lo contrario el `catch` nunca captura el rechazo del promise y se vuelve un unhandled rejection.

Números: usar `parseNumero()` de `src/utils/numero.ts` (normaliza coma decimal de locales hispanos)
en vez de `parseFloat()` directo en inputs del usuario.

### Sync
Bidireccional con estrategia "last-write-wins" basada en `updated_at`:
1. **PUSH:** Registros con `sincronizado = 0` → upsert a Supabase → marcar `sincronizado = 1`
2. **PULL:** Registros en Supabase con `updated_at > last_sync_at` → insertar o actualizar local si remote es más nuevo

Detalles:
- Borrado suave: `deleted_at` se propaga local→cloud (delete en cloud) y cloud→local (marca `deleted_at` local)
- Fotos: si la subida a storage falla, el registro NO se marca como sincronizado para reintentar
- El log se guarda en `sync_log` (también en errores)
- Ejecutado cada 5 minutos + al cambiar AppState a 'active', solo si hay conexión (NetInfo),
  diferido con `InteractionManager.runAfterInteractions` para no bloquear la UI.
  Se inicializa en `app/_layout.tsx` via componente `<SyncInit />` — corre globalmente, no por pantalla.

### Tests
Jest + jest-expo + @testing-library/react-native. Correr con `npm test` o `npm run test:watch`.
Los tests viven en `__tests__/`. Mocks manuales para `expo-sqlite`, `expo-secure-store`,
`@supabase/supabase-js`, `expo-file-system` (y `/legacy`), `expo-image-manipulator`.
`npm run typecheck` (tsc) excluye `admin/` y `__tests__/`.

### Errores y UX
- **Nunca mostrar `e.message` crudo al usuario** (puede ser 404, SQLITE, etc.). Usar
  `mensajeErrorAmigable(e)` de `src/utils/mensajes.ts` y SIEMPRE `logError(contexto, e)` antes.
- `src/services/erroresGlobales.ts` → `instalarManejadorErroresGlobales()` se llama al inicio de
  `app/_layout.tsx`: captura errores fatales (`ErrorUtils.setGlobalHandler`) y rechazos de promesas
  no manejados (`unhandledrejection`) y los loguea al archivo. Es la red de seguridad contra
  cierres de la app en Android release (Hermes mata el proceso ante un unhandled rejection).
- `src/components/ErrorBoundary.tsx` (clase, `ErrorBoundaryApp`): envuelve el Stack en `_layout.tsx`,
  loguea con `componentDidCatch` y muestra pantalla amigable con botón Reintentar.
- Todas las pantallas que cargan datos muestran `ActivityIndicator` + texto (cuadre, reportes,
  catálogo, clientes, pedidos, producto).
- `Haptics.impactAsync` SIEMPRE con `.catch(() => undefined)` (dispositivos sin vibración).

### Lint y calidad
- ESLint 9 (flat config) en `eslint.config.js` basado en `eslint-config-expo/flat`.
  Reglas propias: `@typescript-eslint/no-unused-vars: error`, `react-hooks/exhaustive-deps: error`,
  `no-console: warn`, `no-empty-function: error`.
  Desactivadas por falsos positivos: `react-hooks/refs`, `react-hooks/set-state-in-effect`,
  `react-hooks/preserve-manual-memoization` (patrón canónico RN `useRef(new Animated.Value(0)).current`).
- Correr: `npm run lint` (eslint src/ app/) y `npm run check` (tsc + eslint + jest).
- El workflow `.github/workflows/build.yml` ejecuta `typecheck`, `lint` y `test` antes de compilar el APK.

### Logging
- `src/services/logger.ts`: escribe logs a `documentDirectory/logs/app.log` (acotado a 200k chars).
- `logError(contexto, error, detalle?)` / `logInfo(contexto, mensaje)`.
- `enviarLogsWhatsApp()`: envía por WhatsApp (si es corto) o comparte el archivo (expo-sharing).
- Botón en Ajustes → «Enviar registros de errores». El sync ya registra errores vía `logError`.
- Todos los `catch` de UI que muestran Alert llaman `logError` antes de `mensajeErrorAmigable`.
- `expo-sharing` está incluido en `transformIgnorePatterns` de jest.config.js.
- **IMPORTANTE:** `expo-file-system` en SDK 57 exporta el API nuevo; los métodos legacy
  (`readAsStringAsync`, `writeAsStringAsync`, `makeDirectoryAsync`, `EncodingType`, `documentDirectory`)
  están en `expo-file-system/legacy`. El módulo raíz los re-exporta pero **LANZAN en runtime**
  (`throw errorOnLegacyMethodUse`). Importar SIEMPRE de `expo-file-system/legacy`
  (logger, backup, useExport y sync.ts lo hacen correctamente).

### Pantallas (app/ exports default)
```
app/_layout.tsx        → Root: SQLiteProvider + AuthProvider + GestureHandlerRootView
app/(tabs)/_layout.tsx → Tab navigator (8 tabs)
app/(tabs)/index.tsx   → Ventas (formulario + selector Contado/Fiado/Pedido + catálogo con búsqueda)
app/(tabs)/cuadre.tsx  → Cuadre del día (cards + gráfico + desglose métodos pago + pedidos stats)
app/(tabs)/clientes.tsx → Deudores con swipe para pagar/eliminar
app/(tabs)/gastos.tsx  → Registrar gastos
app/(tabs)/catalogo.tsx → Gestionar productos con stock
app/(tabs)/pedidos.tsx → Pedidos con filtro pendiente/entregado/cancelado
app/(tabs)/reportes.tsx → Reportes semanales/mensuales con top productos
app/(tabs)/ajustes.tsx → Settings (biométrica, notificaciones, backup, export CSV)
app/auth/login.tsx     → Login
app/auth/register.tsx  → Register
app/tutorial/          → 3 onboarding screens
```

## Database SQLite (src/database/schema.ts)

```sql
ventas:
  id TEXT PK, user_id TEXT, producto TEXT, precio REAL, cliente TEXT DEFAULT '',
  tipo TEXT DEFAULT 'contado', pagado INTEGER DEFAULT 1, fecha TEXT,
  sincronizado INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT,
  catalogo_id TEXT, metodo_pago TEXT DEFAULT 'efectivo',
  moneda TEXT DEFAULT 'CUP', tipo_pedido TEXT DEFAULT 'contado', anticipo REAL DEFAULT 0,
  saldo_pendiente REAL DEFAULT 0, fecha_entrega TEXT,
  estado_pedido TEXT DEFAULT 'pendiente',
  nota TEXT DEFAULT ''

gastos:
  id TEXT PK, user_id TEXT, concepto TEXT, monto REAL, fecha TEXT,
  foto TEXT DEFAULT '', sincronizado INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT

catalogo:
  id TEXT PK, user_id TEXT, nombre TEXT, precio REAL, stock INTEGER DEFAULT 0,
  descripcion TEXT DEFAULT '', codigo_barras TEXT DEFAULT '',
  categoria TEXT DEFAULT '', foto TEXT DEFAULT '',
  sincronizado INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT

compras:
  id TEXT PK, user_id TEXT, producto TEXT, costo_unitario REAL, cantidad INTEGER,
  costo_total REAL, proveedor TEXT DEFAULT '', fecha TEXT,
  sincronizado INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT

app_config:
  clave TEXT PK, valor TEXT
  -- claves: tutorial_visto, user_id, last_sync_at, biometrica, notif_recordatorio,
  --         notif_recordatorio_hora, notif_recordatorio_minuto, notif_deudores,
  --         notif_deudor_hora, notif_deudor_minuto, accent_color, auto_backup, push_token

sync_log:
  id TEXT PK, user_id TEXT, timestamp TEXT, ventas INTEGER, gastos INTEGER,
  catalogo INTEGER, compras INTEGER, error TEXT

analytics_events:
  id TEXT PK, user_id TEXT, nombre TEXT, valor TEXT, timestamp TEXT
```

## Database Supabase (docs/supabase-schema.sql)

SIN `sincronizado` (es local-only — Supabase usa `updated_at` para sync). Columnas extra:
- `negocios`: id UUID PK, email, nombre_negocio, telefono, activo, plan, fechas
- `ventas`: [mismas que SQLite sin sincronizado] + CHECK constraints, TIMESTAMPTZ updated_at, FK REFERENCES
- `gastos`: [mismas que SQLite sin sincronizado] + CHECK, TIMESTAMPTZ updated_at
- `catalogo`: [mismas que SQLite sin sincronizado] + CHECK, TIMESTAMPTZ updated_at
- RLS policies en cada tabla (SELECT/INSERT/UPDATE/DELETE por `user_id = auth.uid()`)
- Migraciones seguras con `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column THEN NULL; END; $$;`

## Suscripción (plan + expiración)

- **Tabla** `negocios`: `activo BOOLEAN DEFAULT false`, `plan TEXT DEFAULT 'gratis'`,
  `fecha_registro TIMESTAMPTZ DEFAULT NOW()`, `fecha_expiracion TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 days')`.
  El registro crea la fila con `activo: false` → **prueba gratis de 15 días** desde `fecha_registro`.
- **Estados** (calculados en `AuthContext` → `estadoSuscripcion`):
  - `activo`: `activo = true` y `fecha_expiracion` en el futuro → acceso completo
  - `prueba`: `activo = false` y ≤15 días desde `fecha_registro` → banner «Te quedan X días de prueba»
  - `expirado`: `activo = true` con expiración pasada, o `activo = false` con >15 días → modal bloqueante
  - `error`: fallo de red al verificar → NO bloquear (fail-open)
- **Verificación**: al abrir la app (`AuthContext` hace `SELECT activo, fecha_registro, fecha_expiracion
  FROM negocios WHERE id = user.id`), al iniciar sesión y al volver a primer plano (AppState 'active').
- **UI**: `src/components/SuscripcionGate.tsx` (montado en `app/_layout.tsx` tras OfflineBanner).
  Modal bloqueante: WhatsApp `https://wa.me/5351819744`, Telegram `https://t.me/+5351819744`, **$15 USD/mes**,
  botón «Ya renové» → `recheckSuscripcion()`.
- **Panel admin** (`admin/app/dashboard/negocios/NegociosTable.tsx`): toggle Activar/Desactivar,
  Editar (plan + fecha expiración) y **Renovar** (prompt días → `activo: true` + `fecha_expiracion = hoy + N días`).
  PATCH vía `admin/app/api/negocios/route.ts` (service_role key, server-side).
  Ya tiene búsqueda por email/nombre y filtros (todos/activos/inactivos/en prueba).
- **Health check**: `GET /api/health` (admin) verifica env vars + conexión Supabase y devuelve
  `{ status, timestamp, checks }`. Página visible en `admin/app/dashboard/health/page.tsx` (menú «Estado»).
- **PWA admin**: el panel es instalable en el móvil. `admin/public/manifest.webmanifest`,
  `admin/public/sw.js` (cache-first para GET, excluye `/api/`), iconos en `admin/public/icons/`
  (generados desde `assets/images/icon.png`), registro vía `admin/components/RegisterSW.tsx`.
  Metadata en `admin/app/layout.tsx` (manifest, appleWebApp, themeColor).

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/services/supabase.ts` | Cliente Supabase con anon key + timeout 15s (AbortController) |
| `src/services/sync.ts` | Motor de sync bidireccional |
| `src/hooks/useSync.ts` | Hook que dispara sync cada 5 min + AppState (InteractionManager) |
| `src/services/analytics.ts` | Registro de eventos en tabla `analytics_events` |
| `src/services/backup.ts` | Backup automático CSV cada 12h (expo-background-task) |
| `src/services/logger.ts` | Logs locales (app.log) + envío por WhatsApp |
| `src/services/erroresGlobales.ts` | Manejador global de errores fatales + `unhandledrejection` (previene cierres de app) |
| `src/components/ErrorBoundary.tsx` | ErrorBoundary de clase con log + pantalla amigable + Reintentar |
| `src/utils/mensajes.ts` | `mensajeErrorAmigable()` traduce errores técnicos a texto claro para el usuario |
| `src/context/AuthContext.tsx` | AuthProvider con login/register/logout + `estadoSuscripcion` (activo/prueba/expirado) |
| `src/components/SuscripcionGate.tsx` | Modal bloqueante de expiración + banner de días de prueba |
| `src/context/AccentContext.tsx` | Colores de acento personalizables (persistidos en app_config) |
| `src/components/SwipeableRow.tsx` | Componente swipeable (ReanimatedSwipeable) |
| `src/theme/colors.ts` | Paleta light/dark |
| `src/theme/accents.ts` | Paletas de acento (ACCENT_COLORS) |
| `src/utils/numero.ts` | `parseNumero()` normaliza comas decimales |
| `src/utils/user.ts` | `getUserId()` resuelve id desde auth → app_config → secure-store |
| `admin/lib/supabase.ts` | Cliente Supabase con service_role key (server-side only) |

## Observaciones de Rendimiento

- Índices SQLite en `schema.ts`: `idx_ventas_user_fecha`, `idx_ventas_user_pagado`,
  `idx_ventas_user_pedido`, `idx_gastos_user_fecha`, `idx_catalogo_user_nombre`,
  `idx_compras_user_fecha`, `idx_sync_user_ts`
- Límites: `LISTA_LIMITE = 200`, `DEUDORES_LIMITE = 100`, `BUSCAR_LIMIT = 20` en `src/constants.ts`
- `getVentasDelDia`, `getDeudores`, `getGastosDelDia`, `getGastosTodos`, `getVentasEnRango`,
  `getGastosEnRango` usan `LIMIT` para evitar escaneos completos
- **FlatList**: todas las listas usan `initialNumToRender`, `maxToRenderPerBatch` y
  `windowSize={5}` (reducido a 5 para teléfonos de bajos recursos); clientes/pedidos además
  `getItemLayout`. Los items de lista son componentes `React.memo`
  (DeudorCard, PedidoCard, CatalogoCard, CatalogoRow).
  **NO usar `removeClippedSubviews` en listas con `SwipeableRow`** (pedidos, clientes) porque
  conflictúa con react-native-gesture-handler/Reanimated en Android (vistas que desaparecen o crash).
  Solo `catalogo.tsx` lo mantiene.
- **AccentContext**: `theme` y el value del context están memoizados (`useMemo`/`useCallback`)
  para que `React.memo` en items de lista funcione (antes `theme` se recreaba en cada render)
- **Cargas de pantalla**: `useFocusEffect` envuelve la carga en `InteractionManager.runAfterInteractions`
  (cuadre, reportes, catalogo, clientes, pedidos) para no bloquear la UI
- **Sync**: `useSync` ya difiere con `InteractionManager` (intervalo 5 min + AppState 'active')
- **Imágenes**: fotos de catálogo se comprimen a 200px de ancho al subir a Supabase
  (`uploadPhotoToStorage(..., 200)` en `sync.ts`); recibos de gastos a 1024px.
  `expo-image` se usa en todas las pantallas con `cachePolicy="memory-disk"`
- **Monitoreo**: `src/utils/perf.ts` mide tiempos de carga con `react-native-performance`
  (`perfStart`/`perfEnd`, log en dev vía console.warn)
- **APK release**: `app.json` → `jsEngine: hermes`, `enableProguardInReleaseBuilds: true`,
  `enableShrinkResourcesInReleaseBuilds: true`. Workflow compila `assembleRelease`.
  Se eliminaron deps sin uso: `expo-symbols`, `expo-web-browser`
- **Memorización de pantalla**: en reportes los totales/top productos usan `useMemo`
- **Bajos recursos**: listas con `windowSize={5}` y batches de 5; splash/logo ligero;
  `enableProguardInReleaseBuilds: false` y `enableShrinkResourcesInReleaseBuilds: false`
  (evita problemas de ofuscación que rompen el APK en equipos de gama baja); Hermes ya activo.

## Tareas Comunes

### Agregar columna a ventas
1. Migration en `src/database/schema.ts`:
   ```ts
   try { await db.runAsync("ALTER TABLE ventas ADD COLUMN nueva_col TEXT DEFAULT ''"); } catch {}
   ```
2. Migration en `docs/supabase-schema.sql`:
   ```sql
   DO $$ BEGIN ALTER TABLE ventas ADD COLUMN nueva_col TEXT DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END; $$;
   ```
3. Agregar a `Venta` interface en `src/types/index.ts`
4. Agregar a push/pull en `src/services/sync.ts`

### Agregar nueva tabla
1. Schema SQLite en `src/database/schema.ts`
2. Schema Supabase en `docs/supabase-schema.sql` (con RLS policies)
3. Type en `src/types/index.ts`
4. Hook CRUD en `src/hooks/`
5. Push/pull en `src/services/sync.ts`
6. Pantalla en `app/(tabs)/`

### Agregar nueva dependencia
```bash
npx expo install nombre-paquete
# Si el registry falla: NODE_TLS_REJECT_UNAUTHORIZED=0 npx expo install nombre-paquete
```

## Observaciones

- npm registry tiene certificados CA rotos en la máquina de desarrollo → usar `NODE_TLS_REJECT_UNAUTHORIZED=0`
- El logo usa diseño «círculo verde #059669 + moneda/billete blanco» (assets en `assets/images/`), nombre de la app + slogan «Tu negocio al día» en la splash. Guía para clientas: `docs/GUIA_USUARIO.md`
- `react-native-gesture-handler` v3.1.0: `Swipeable` se importa como `import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'`
- El sync es **unidireccional local→cloud** para datos nuevos, **bidireccional** para actualizaciones (last-write-wins por timestamp)
- Service_role key NUNCA debe estar en el bundle mobile — solo en admin/ (server-side)

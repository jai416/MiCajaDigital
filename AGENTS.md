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
useVentas()    → addVenta, pagarVenta, deleteVenta, getVentasDelDia, getDeudores, getCuadre
useGastos()    → addGasto, getGastosDelDia, getGastosTodos
useCatalogo()  → getAll, buscar, buscarPorCodigo, getCategorias, buscarPorCategoria, addProducto, updateProducto, deleteProducto, getByNombre, deductStock
useCompras()   → getAll, addCompra, deleteCompra
```

### Sync
Bidireccional con estrategia "last-write-wins" basada en `updated_at`:
1. **PUSH:** Registros con `sincronizado = 0` → upsert a Supabase → marcar `sincronizado = 1`
2. **PULL:** Registros en Supabase con `updated_at > last_sync_at` → insertar o actualizar local si remote es más nuevo

Ejecutado cada 5 minutos + al cambiar AppState a 'active', solo si hay conexión (NetInfo). Se inicializa en `app/_layout.tsx` via componente `<SyncInit />` — corre globalmente, no por pantalla.

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
  -- claves: tutorial_visto, user_id, last_sync_at, biometrica, notif_recordatorio
```

## Database Supabase (docs/supabase-schema.sql)

SIN `sincronizado` (es local-only — Supabase usa `updated_at` para sync). Columnas extra:
- `negocios`: id UUID PK, email, nombre_negocio, telefono, activo, plan, fechas
- `ventas`: [mismas que SQLite sin sincronizado] + CHECK constraints, TIMESTAMPTZ updated_at, FK REFERENCES
- `gastos`: [mismas que SQLite sin sincronizado] + CHECK, TIMESTAMPTZ updated_at
- `catalogo`: [mismas que SQLite sin sincronizado] + CHECK, TIMESTAMPTZ updated_at
- RLS policies en cada tabla (SELECT/INSERT/UPDATE/DELETE por `user_id = auth.uid()`)
- Migraciones seguras con `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column THEN NULL; END; $$;`

## Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `src/services/supabase.ts` | Cliente Supabase con anon key (SOLO anon key aquí) |
| `src/services/sync.ts` | Motor de sync bidireccional |
| `src/hooks/useSync.ts` | Hook que dispara sync cada 5 min + AppState |
| `src/context/AuthContext.tsx` | AuthProvider con login/register/logout + persistencia en app_config |
| `src/components/SwipeableRow.tsx` | Componente swipeable (ReanimatedSwipeable) |
| `src/theme/colors.ts` | Paleta light/dark |
| `admin/lib/supabase.ts` | Cliente Supabase con service_role key (server-side only) |

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
- `react-native-gesture-handler` v3.1.0: `Swipeable` se importa como `import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'`
- El sync es **unidireccional local→cloud** para datos nuevos, **bidireccional** para actualizaciones (last-write-wins por timestamp)
- Service_role key NUNCA debe estar en el bundle mobile — solo en admin/ (server-side)

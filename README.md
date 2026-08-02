# Mi Caja Digital

App móvil para **control de ventas, gastos, inventario y deudores** para pequeños negocios en Cuba. Funciona **offline-first** con sincronización a Supabase cuando hay conexión.

## Funcionalidades

| Función | Descripción |
|---------|-------------|
| 💲 Ventas | Registrar ventas al contado, fiado o pedido, con calculadora integrada y selector de productos del catálogo |
| 🧾 Recibo | Comprobante automático con opción de compartir por WhatsApp |
| 📦 Catálogo | Productos con precio, stock, foto, descripción y categorías — filtro por categoría |
| 📋 Pedidos | Gestión de pedidos con anticipo, saldo pendiente, fecha de entrega, estado y selección múltiple |
| 📊 Cuadre diario | Resumen automático: ventas, gastos, ganancia, métodos de pago, pedidos pendientes/entregados |
| 👥 Deudores | Lista con días de retraso, pagar, editar nombre y recordar por WhatsApp |
| 📉 Gastos | Registrar gastos con foto del recibo (cámara o galería) |
| 📦 Compras | Historial de compras para reposición de inventario |
| 📈 Reportes | Semanal, mensual y anual con top productos más vendidos |
| 💳 Métodos de pago | Efectivo, tarjeta o transferencia — con sugerencias inteligentes |
| 🔢 Calculadora | Calculadora integrada al ingresar precio en ventas |
| 🔒 Huella / Face ID | Desbloqueo rápido con biometría |
| 🔔 Recordatorio diario | Notificación a las 8 PM para hacer el cuadre |
| 🔔 Recordatorio de cobros | Notificación a las 10 AM con deudores pendientes |
| ☁️ Sincronización automática | Cada 5 min + al abrir la app, bidireccional con Supabase |
| 📤 Backup manual | Botón "Respaldar ahora" en Ajustes |
| 📤 Exportar CSV | Exportar ventas, gastos o catálogo a CSV para Excel/Sheets |
| 🛡️ Estabilidad | Manejador global de errores + ErrorBoundary con Reintentar; mensajes de error claros (sin códigos técnicos) |
| ⚡ Optimizado | Rendimiento ajustado para teléfonos de gama baja (listas ligeras, carga diferida) |
| 🎁 Prueba de 15 días | Nuevo negocio en prueba gratis; al vencer, aviso para renovar por WhatsApp/Telegram ($15 USD/mes) |

## Requisitos

- Node.js 18+
- Expo CLI
- Cuenta en [Supabase](https://supabase.com)
- Android (APK vía EAS Build) o Expo Go para desarrollo

## Instalación

```bash
cd MiCajaDigital
NODE_TLS_REJECT_UNAUTHORIZED=0 npm install
```

## Configuración de Supabase

1. Crear proyecto en Supabase
2. Ir a SQL Editor y ejecutar `docs/supabase-schema.sql`
3. Authentication → Settings → desmarcar "Confirm email"
4. Copiar anon key y URL a `src/services/supabase.ts`
5. Service role key al panel admin (`admin/.env.local`)

## Ejecutar

```bash
npx expo start
# Escanea QR con Expo Go en tu teléfono
```

## Generar APK

```bash
npx eas build -p android --profile preview
```

## Panel Admin (Next.js)

El panel admin es un proyecto Next.js independiente en `admin/` (con su propio `package.json`
y `.env.local`). Puede desplegarse aparte del proyecto principal.

```bash
cd admin
NODE_TLS_REJECT_UNAUTHORIZED=0 npm install
npm run dev
```

El panel admin permite **gestionar suscripciones**: activar/desactivar un negocio,
editar plan y fecha de expiración, o **Renovar** (activo + expiración = hoy + N días)
en `admin/app/dashboard/negocios/`. Incluye búsqueda por email/nombre y filtros.

### Desplegarlo aparte (para usarlo desde internet/móvil)

- **Vercel** (recomendado): importa el repo y pon `Root Directory = admin`. Las variables
  de entorno van en Vercel (Supabase URL, anon key, service_role key, ADMIN_EMAIL/ADMIN_PASSWORD).
- **Railway / Render / Fly.io**: `cd admin && npm run build && npm start`.
- Es una **PWA**: al abrirlo en Chrome (Android) o Safari (iOS), el navegador ofrece
  «Instalar aplicación» para tenerlo como app en el móvil.
- **Health check**: `GET /api/health` o la página `Estado` (menú 🩺) del dashboard
  verifica env vars + conexión a Supabase.

## Estabilidad y errores

- **Causa principal de cierres resuelta**: en Android release (Hermes), cualquier rechazo de
  promesa no manejado mataba la app. Ahora `src/services/erroresGlobales.ts` captura errores
  fatales y `unhandledrejection` y los guarda en el log local.
- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`) envuelve la app: ante un fallo muestra
  una pantalla amigable («Ups, algo falló») con botón **Reintentar**, sin cerrar la app.
- **Mensajes claros**: ningún error técnico (404, SQL, etc.) llega al usuario. Todos pasan por
  `mensajeErrorAmigable()` y se registran en `app.log` antes de mostrarse.
- **Loading states**: toda pantalla que carga datos muestra un indicador + texto descriptivo.
- **Optimización bajo rendimiento**: listas con `windowSize={5}` y batches reducidos,
  `removeClippedSubviews` eliminado en listas swipeable (conflicto conocido con gesture-handler),
  haptics protegidos con `.catch()`.

## Tecnologías

- **Framework:** Expo SDK 57 + React Native 0.86
- **Navegación:** expo-router (file-based routing)
- **Base de datos:** expo-sqlite (local) + Supabase PostgreSQL (cloud)
- **Autenticación:** Supabase Auth (email/password)
- **Sync:** Bidireccional con timestamps (updated_at) — 4 tablas sync
- **Estilos:** StyleSheet con tema claro/oscuro automático
- **Biometría:** expo-local-authentication
- **Notificaciones:** expo-notifications
- **CSV:** expo-file-system + expo-sharing
- **APK:** EAS Build

## Estructura del Proyecto

```
app/               → Pantallas (expo-router)
src/
├── components/    → Componentes reutilizables (incl. ErrorBoundary, BarcodeScanner)
├── context/       → AuthContext, AccentContext
├── database/      → Schema SQLite
├── hooks/         → useVentas, useGastos, useCatalogo, etc.
├── services/      → Supabase client, sync engine, logger, erroresGlobales, backup
├── theme/         → Colores claro/oscuro
├── types/         → Interfaces TypeScript
└── utils/         → UUID, numero, mensajes, helpers
docs/              → Documentación y scripts SQL
```
# MiCajaDigital

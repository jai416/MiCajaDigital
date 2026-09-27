/**
 * Constantes de negocio del panel.
 *
 * Antes estos números vivían sueltos en `app/dashboard/page.tsx`
 * (`15 * MS_DIA`, `3 * MS_DIA`, `7 * MS_DIA`…) y también en la app Flutter
 * (`DIAS_PRUEBA = 15`). Que el panel y la app sharing el mismo número en dos
 * sitios distintos es exactamente la forma de que diverge sin que nadie lo note:
 * la app puede cambiar DIAS_PRUEBA y el panel seguir diciendo 15.
 *
 * Regla: si un número define una regla del negocio (días de prueba, de
 * preaviso, de retención), va aquí Y en la app. Si solo es un parámetro de UI
 * (por qué no 25 en un rango), déjalo local.
 */

/** Milisegundos en un día. */
export const MS_DIA = 86_400_000;

/** Días de prueba gratis (debe coincidir con `DIAS_PRUEBA` en la app). */
export const DIAS_PRUEBA = 15;

/** Días de margen para marcar una suscripción como "por vencer". */
export const DIAS_POR_VENCER = 3;

/** Días de la ventana de retención / pruebanow (renovaciones, inactivas). */
export const DIAS_RETENCION = 7;

/** Días de inactividad para considerar una clienta "inactiva". */
export const DIAS_INACTIVA = 30;

/** Meses en 6 meses (para el eje de ingresos por mes). */
export const DIAS_SEIS_MESES = 183;

// Formato de fechas del panel: SIEMPRE es-CU y UTC (las columnas de la DB
// son ISO sin zona; mezclar locales mostraba dd/mm vs mm/dd entre secciones).
const LOCALE = 'es-CU';

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: 'UTC',
      });
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });
}

/**
 * Número con separadores de miles es-CU y 2 decimales (ronda 27, S4).
 *
 * Antes cada tarjeta del dashboard hacía su propio
 * `toLocaleString('es-CU', {...})` con opções distintas: unas veces con
 * decimales y otras sin ellos, así que dos cifras parecidas se veían
 * diferentes. Aquí una sola función para todo el panel.
 */
export function numero(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/** Igual que `numero` pero sin decimales (conteos,ARPU redondeado, etc.). */
export function entero(n: number | null | undefined): string {
  return numero(n, 0);
}

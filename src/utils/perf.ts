import performance from 'react-native-performance';

export function perfStart(nombre: string): void {
  try { performance.mark(nombre); } catch {}
}

export function perfEnd(nombre: string): void {
  try {
    performance.measure(nombre + '_ms', nombre);
    if (__DEV__) {
      const entries = performance.getEntriesByName(nombre + '_ms', 'measure');
      const ultimo = entries[entries.length - 1];
      if (ultimo) {
        console.warn(`[perf] ${nombre}: ${ultimo.duration.toFixed(0)}ms`);
      }
    }
  } catch {}
}

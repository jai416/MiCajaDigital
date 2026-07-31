import {
  SYNC_INTERVAL_MS,
  SYNC_MIN_INTERVAL_MS,
  MS_PER_DAY,
  QUINCE_DIAS_MS,
  LISTA_LIMITE,
  DEUDORES_LIMITE,
  BUSCAR_LIMIT,
} from '../src/constants';

describe('constantes', () => {
  it('SYNC_INTERVAL_MS es 5 minutos', () => {
    expect(SYNC_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('SYNC_MIN_INTERVAL_MS es menor que el intervalo de sync', () => {
    expect(SYNC_MIN_INTERVAL_MS).toBeLessThan(SYNC_INTERVAL_MS);
  });

  it('QUINCE_DIAS_MS es 15 días', () => {
    expect(QUINCE_DIAS_MS).toBe(15 * MS_PER_DAY);
  });

  it('los límites de consulta son positivos y acotados', () => {
    expect(LISTA_LIMITE).toBeGreaterThan(0);
    expect(DEUDORES_LIMITE).toBeGreaterThan(0);
    expect(BUSCAR_LIMIT).toBeGreaterThan(0);
    expect(LISTA_LIMITE).toBeLessThanOrEqual(500);
  });
});

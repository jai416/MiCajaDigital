import {
  calcularEstadoSuscripcion,
  DIAS_PRUEBA,
  MS_DIA,
  type NegocioSuscripcion,
} from '../src/utils/suscripcion';

describe('calcularEstadoSuscripcion', () => {
  const ahora = Date.parse('2026-01-16T00:00:00Z');

  it('negocio activo con expiración futura → activo', () => {
    const negocio: NegocioSuscripcion = {
      activo: true,
      fecha_registro: '2026-01-01T00:00:00Z',
      fecha_expiracion: '2026-02-15T00:00:00Z',
    };
    expect(calcularEstadoSuscripcion(negocio, ahora).estado).toBe('activo');
  });

  it('negocio activo con expiración pasada → expirado', () => {
    const negocio: NegocioSuscripcion = {
      activo: true,
      fecha_registro: '2025-01-01T00:00:00Z',
      fecha_expiracion: '2026-01-10T00:00:00Z',
    };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('expirado');
    expect(r.diasRestantes).toBe(0);
  });

  it('negocio en prueba (no activo, recién registrado) → prueba con días restantes = 15', () => {
    const negocio: NegocioSuscripcion = {
      activo: false,
      fecha_registro: ahora,
    };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('prueba');
    expect(r.diasRestantes).toBe(DIAS_PRUEBA);
  });

  it('negocio en prueba a mitad del periodo → días restantes decrecen', () => {
    const registro = ahora - 5 * MS_DIA;
    const negocio: NegocioSuscripcion = { activo: false, fecha_registro: new Date(registro).toISOString() };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('prueba');
    expect(r.diasRestantes).toBe(10);
  });

  it('negocio no activo con más de 15 días desde registro → expirado', () => {
    const registro = ahora - 16 * MS_DIA;
    const negocio: NegocioSuscripcion = { activo: false, fecha_registro: new Date(registro).toISOString() };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('expirado');
    expect(r.diasRestantes).toBe(0);
  });

  it('negocio activo sin fecha de expiración → expirado (fail-safe: no regala acceso)', () => {
    const negocio: NegocioSuscripcion = { activo: true, fecha_registro: '2025-01-01T00:00:00Z' };
    expect(calcularEstadoSuscripcion(negocio, ahora).estado).toBe('expirado');
  });

  it('negocio nulo → error (fail-open, no bloquea al usuario)', () => {
    const r = calcularEstadoSuscripcion(null as unknown as NegocioSuscripcion, ahora);
    expect(r.estado).toBe('error');
  });
});

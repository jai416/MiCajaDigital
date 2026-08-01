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
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('activo');
    expect(r.diasRestantes).toBe(30);
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

  it('negocio activo que expira hoy → activo con 0 días restantes', () => {
    const negocio: NegocioSuscripcion = {
      activo: true,
      fecha_registro: '2025-12-01T00:00:00Z',
      fecha_expiracion: new Date(ahora + 3600 * 1000).toISOString(),
    };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('activo');
    expect(r.diasRestantes).toBe(1);
  });

  it('negocio en prueba exactamente en el día 15 → prueba con 0 días restantes', () => {
    const registro = ahora - DIAS_PRUEBA * MS_DIA;
    const negocio: NegocioSuscripcion = { activo: false, fecha_registro: new Date(registro).toISOString() };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('prueba');
    expect(r.diasRestantes).toBe(0);
  });

  it('negocio en prueba con registro en el futuro → no negativo (fail-safe)', () => {
    const registro = ahora + 5 * MS_DIA;
    const negocio: NegocioSuscripcion = { activo: false, fecha_registro: new Date(registro).toISOString() };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('prueba');
    expect(r.diasRestantes).toBe(DIAS_PRUEBA);
  });

  it('negocio activo sin fecha de registro → usa ahora como referencia', () => {
    const negocio: NegocioSuscripcion = {
      activo: true,
      fecha_expiracion: new Date(ahora + 3 * MS_DIA).toISOString(),
    };
    const r = calcularEstadoSuscripcion(negocio, ahora);
    expect(r.estado).toBe('activo');
    expect(r.diasRestantes).toBe(3);
  });
});

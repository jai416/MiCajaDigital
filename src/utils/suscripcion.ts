export type EstadoSuscripcion = 'activo' | 'prueba' | 'expirado' | 'error';

export const DIAS_PRUEBA = 15;

export const MS_DIA = 86400000;

export interface NegocioSuscripcion {
  activo: boolean;
  fecha_registro?: string | null;
  fecha_expiracion?: string | null;
}

export interface EstadoCalculado {
  estado: EstadoSuscripcion;
  diasRestantes: number;
}

export function calcularEstadoSuscripcion(negocio: NegocioSuscripcion, ahora = Date.now()): EstadoCalculado {
  if (!negocio) {
    return { estado: 'error', diasRestantes: DIAS_PRUEBA };
  }

  const fechaRegistro = negocio.fecha_registro ? new Date(negocio.fecha_registro).getTime() : ahora;
  const fechaExpiracion = negocio.fecha_expiracion ? new Date(negocio.fecha_expiracion).getTime() : 0;

  if (negocio.activo) {
    return fechaExpiracion > ahora
      ? { estado: 'activo', diasRestantes: Math.max(0, Math.ceil((fechaExpiracion - ahora) / MS_DIA)) }
      : { estado: 'expirado', diasRestantes: 0 };
  }

  const diasDesdeRegistro = Math.max(0, Math.floor((ahora - fechaRegistro) / MS_DIA));
  if (diasDesdeRegistro <= DIAS_PRUEBA) {
    return { estado: 'prueba', diasRestantes: Math.max(0, DIAS_PRUEBA - diasDesdeRegistro) };
  }

  return { estado: 'expirado', diasRestantes: 0 };
}

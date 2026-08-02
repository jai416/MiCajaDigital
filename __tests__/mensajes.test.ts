import { mensajeErrorAmigable } from '../src/utils/mensajes';

describe('mensajeErrorAmigable', () => {
  it('traduce errores de red', () => {
    expect(mensajeErrorAmigable(new Error('Network request failed'))).toBe(
      'No hay conexión a internet. Revisa tu señal e inténtalo de nuevo.'
    );
    expect(mensajeErrorAmigable(new Error('TypeError: fetch timed out'))).toBe(
      'No hay conexión a internet. Revisa tu señal e inténtalo de nuevo.'
    );
  });

  it('traduce errores 404 / not found', () => {
    expect(mensajeErrorAmigable(new Error('Request failed with status code 404'))).toBe(
      'No se encontró lo que buscas. Inténtalo de nuevo más tarde.'
    );
  });

  it('traduce credenciales inválidas', () => {
    expect(mensajeErrorAmigable(new Error('Invalid login credentials'))).toBe(
      'Correo o contraseña incorrectos. Verifica tus datos.'
    );
  });

  it('traduce correo ya registrado', () => {
    expect(mensajeErrorAmigable(new Error('User already registered'))).toBe(
      'Este correo ya está registrado. Inicia sesión.'
    );
  });

  it('traduce errores SQL', () => {
    expect(mensajeErrorAmigable(new Error('SQLITE_ERROR: no such table'))).toBe(
      'Ocurrió un problema al guardar tus datos. Inténtalo de nuevo.'
    );
  });

  it('usa mensaje genérico para otros errores', () => {
    expect(mensajeErrorAmigable(new Error('cualquier cosa'))).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.'
    );
  });

  it('usa mensaje genérico para valores no-Error', () => {
    expect(mensajeErrorAmigable('boom')).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
    expect(mensajeErrorAmigable(undefined)).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });
});

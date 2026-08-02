export function mensajeErrorAmigable(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('internet') || msg.includes('abort')) {
      return 'No hay conexión a internet. Revisa tu señal e inténtalo de nuevo.';
    }
    if (msg.includes('404') || msg.includes('not found')) {
      return 'No se encontró lo que buscas. Inténtalo de nuevo más tarde.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'Correo o contraseña incorrectos. Verifica tus datos.';
    }
    if (msg.includes('already registered')) {
      return 'Este correo ya está registrado. Inicia sesión.';
    }
    if (msg.includes('sqlite') || msg.includes('sql')) {
      return 'Ocurrió un problema al guardar tus datos. Inténtalo de nuevo.';
    }
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

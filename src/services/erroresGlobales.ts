import { logError } from '@/src/services/logger';

type ErrorUtilsShape = { setGlobalHandler?: (handler: (error: unknown, isFatal: boolean) => void) => void };
type GlobalLike = typeof globalThis & {
  ErrorUtils?: ErrorUtilsShape;
  addEventListener?: (event: 'unhandledrejection', listener: (event: unknown) => void) => void;
};

export function instalarManejadorErroresGlobales(): void {
  const g = globalThis as GlobalLike;
  if (g.ErrorUtils?.setGlobalHandler) {
    g.ErrorUtils.setGlobalHandler((error: unknown, isFatal: boolean) => {
      logError('global', error, isFatal ? 'FATAL' : undefined);
    });
  }
  if (typeof g.addEventListener === 'function') {
    g.addEventListener('unhandledrejection', (event: unknown) => {
      const reason = (event as { reason?: unknown })?.reason ?? event;
      logError('promesa_no_manejada', reason);
    });
  }
}

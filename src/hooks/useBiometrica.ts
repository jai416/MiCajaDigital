import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export function useBiometrica() {
  const db = useSQLiteContext();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const compat = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!active) return;
        setAvailable(compat && enrolled);

        const row = await db.getFirstAsync<{ valor: string }>(
          "SELECT valor FROM app_config WHERE clave = 'biometrica'"
        );
        if (!active) return;
        setEnabled(row?.valor === 'si');
      } catch (e) {
        console.error('Error al leer biometría:', e);
      }
    })();
    return () => { active = false; };
  }, [db]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!available || !enabled) return true;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear Mi Caja Digital',
      disableDeviceFallback: false,
    });
    return result.success;
  }, [available, enabled]);

  const toggle = useCallback(async (on: boolean) => {
    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('biometrica', ?)",
      [on ? 'si' : 'no']
    );
    setEnabled(on);
  }, [db]);

  return { available, enabled, authenticate, toggle };
}

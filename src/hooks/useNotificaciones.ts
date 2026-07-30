import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { setSecureValue, SECURE_KEYS } from '@/src/utils/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function useNotificaciones() {
  const db = useSQLiteContext();
  const [enabled, setEnabled] = useState(false);
  const [deudorEnabled, setDeudorEnabled] = useState(false);
  const [permitted, setPermitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermitted(status === 'granted');

      const row = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'notif_recordatorio'"
      );
      setEnabled(row?.valor === 'si');

      const dRow = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'notif_deudores'"
      );
      setDeudorEnabled(dRow?.valor === 'si');
    })();
  }, [db]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermitted(status === 'granted');
    return status === 'granted';
  }, []);

  const scheduleDaily = useCallback(async (hora: number = 20, minuto: number = 0) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Mi Caja Digital',
        body: '¿Ya hiciste tu cuadre de hoy? Revisa tus ventas y deudores pendientes.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hora,
        minute: minuto,
      },
    });
  }, []);

  const registerPushToken = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const token = await Notifications.getExpoPushTokenAsync();
      await db.runAsync(
        "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('push_token', ?)",
        [token.data]
      );
      await setSecureValue(SECURE_KEYS.PUSH_TOKEN, token.data);
    } catch { /* silencioso */ }
  }, [db]);

  const scheduleDeudorCheck = useCallback(async () => {
    try { await Notifications.cancelScheduledNotificationAsync('deudor-reminder'); } catch { /* ignore */ }

    const userId = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'user_id'"
    );
    if (!userId?.valor) return;

    const deudores = await db.getAllAsync<{ cliente: string; precio: number; fecha: string }>(
      `SELECT cliente, precio, fecha FROM ventas WHERE user_id = ? AND pagado = 0 AND cliente != '' AND deleted_at IS NULL ORDER BY fecha ASC LIMIT 3`,
      [userId.valor]
    );
    if (deudores.length === 0) return;

    const total = deudores.reduce((s, d) => s + d.precio, 0);
    const nombres = deudores.map(d => d.cliente).join(', ');

    await Notifications.scheduleNotificationAsync({
      identifier: 'deudor-reminder',
      content: {
        title: '🔔 Cobros pendientes',
        body: `${deudores.length} deudor(es): ${nombres}. Total: $${total.toFixed(2)}`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 0,
      },
    });
  }, [db]);

  const toggle = useCallback(async (on: boolean) => {
    if (on && !permitted) {
      const ok = await requestPermissions();
      if (!ok) {
        await db.runAsync(
          "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_recordatorio', 'no')"
        );
        setEnabled(false);
        return;
      }
    }

    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_recordatorio', ?)",
      [on ? 'si' : 'no']
    );
    setEnabled(on);

    if (on) {
      await scheduleDaily();
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  }, [db, permitted, requestPermissions, scheduleDaily]);

  const toggleDeudores = useCallback(async (on: boolean) => {
    if (on && !permitted) {
      const ok = await requestPermissions();
      if (!ok) {
        await db.runAsync(
          "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_deudores', 'no')"
        );
        setDeudorEnabled(false);
        return;
      }
    }

    await db.runAsync(
      "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_deudores', ?)",
      [on ? 'si' : 'no']
    );
    setDeudorEnabled(on);

    if (on) {
      await scheduleDeudorCheck();
    } else {
      try { await Notifications.cancelScheduledNotificationAsync('deudor-reminder'); } catch {}
    }
  }, [db, permitted, requestPermissions, scheduleDeudorCheck]);

  return { enabled, deudorEnabled, permitted, toggle, toggleDeudores, registerPushToken };
}

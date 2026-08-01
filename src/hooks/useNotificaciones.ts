import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { setSecureValue, SECURE_KEYS } from '@/src/utils/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
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
    let active = true;
    (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (!active) return;
        setPermitted(status === 'granted');

        const row = await db.getFirstAsync<{ valor: string }>(
          "SELECT valor FROM app_config WHERE clave = 'notif_recordatorio'"
        );
        if (!active) return;
        setEnabled(row?.valor === 'si');

        const dRow = await db.getFirstAsync<{ valor: string }>(
          "SELECT valor FROM app_config WHERE clave = 'notif_deudores'"
        );
        if (!active) return;
        setDeudorEnabled(dRow?.valor === 'si');
      } catch (e) {
        console.error('Error al leer notificaciones:', e);
      }
    })();
    return () => { active = false; };
  }, [db]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermitted(status === 'granted');
    return status === 'granted';
  }, []);

  const scheduleDaily = useCallback(async () => {
    try {
      try { await Notifications.cancelScheduledNotificationAsync('daily-reminder'); } catch {}

      const horaRow = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'notif_recordatorio_hora'"
      );
      const minRow = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'notif_recordatorio_minuto'"
      );
      const hora = parseInt(horaRow?.valor ?? '20');
      const minuto = parseInt(minRow?.valor ?? '0');

      await Notifications.scheduleNotificationAsync({
        identifier: 'daily-reminder',
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
    } catch (e) {
      console.error('Error al programar recordatorio diario:', e);
    }
  }, [db]);

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
    try {
      try { await Notifications.cancelScheduledNotificationAsync('deudor-reminder'); } catch { /* ignore */ }

      const userId = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'user_id'"
      );
      if (!userId?.valor) return;

      const deudores = await db.getAllAsync<{ cliente: string; saldo_pendiente: number; fecha: string }>(
        `SELECT cliente, saldo_pendiente, fecha FROM ventas WHERE user_id = ? AND pagado = 0 AND tipo_pedido != 'pedido' AND cliente != '' AND deleted_at IS NULL ORDER BY fecha ASC LIMIT 3`,
        [userId.valor]
      );
      if (deudores.length === 0) return;

      const total = deudores.reduce((s, d) => s + d.saldo_pendiente, 0);
      const nombres = deudores.map(d => d.cliente).join(', ');

      const horaRow = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'notif_deudor_hora'"
      );
      const minRow = await db.getFirstAsync<{ valor: string }>(
        "SELECT valor FROM app_config WHERE clave = 'notif_deudor_minuto'"
      );
      const hora = parseInt(horaRow?.valor ?? '10');
      const minuto = parseInt(minRow?.valor ?? '0');

      await Notifications.scheduleNotificationAsync({
        identifier: 'deudor-reminder',
        content: {
          title: '🔔 Cobros pendientes',
          body: `${deudores.length} deudor(es): ${nombres}. Total: $${total.toFixed(2)}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hora,
          minute: minuto,
        },
      });
    } catch (e) {
      console.error('Error al programar recordatorio de deudores:', e);
    }
  }, [db]);

  const toggle = useCallback(async (on: boolean) => {
    if (on && !permitted) {
      const ok = await requestPermissions();
      if (!ok) {
        try {
          await db.runAsync(
            "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_recordatorio', 'no')"
          );
        } catch (e) {
          console.error('Error al guardar preferencia:', e);
        }
        setEnabled(false);
        return;
      }
    }

    try {
      await db.runAsync(
        "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_recordatorio', ?)",
        [on ? 'si' : 'no']
      );
      setEnabled(on);
    } catch (e) {
      console.error('Error al guardar preferencia:', e);
      return;
    }

    if (on) {
      await scheduleDaily();
    } else {
      try { await Notifications.cancelScheduledNotificationAsync('daily-reminder'); } catch {}
      if (deudorEnabled) {
        await scheduleDeudorCheck();
      }
    }
  }, [db, permitted, requestPermissions, scheduleDaily, deudorEnabled, scheduleDeudorCheck]);

  const toggleDeudores = useCallback(async (on: boolean) => {
    if (on && !permitted) {
      const ok = await requestPermissions();
      if (!ok) {
        try {
          await db.runAsync(
            "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_deudores', 'no')"
          );
        } catch (e) {
          console.error('Error al guardar preferencia:', e);
        }
        setDeudorEnabled(false);
        return;
      }
    }

    try {
      await db.runAsync(
        "INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('notif_deudores', ?)",
        [on ? 'si' : 'no']
      );
      setDeudorEnabled(on);
    } catch (e) {
      console.error('Error al guardar preferencia:', e);
      return;
    }

    if (on) {
      await scheduleDeudorCheck();
    } else {
      try { await Notifications.cancelScheduledNotificationAsync('deudor-reminder'); } catch {}
    }
  }, [db, permitted, requestPermissions, scheduleDeudorCheck]);

  const rescheduleDaily = useCallback(async () => {
    if (enabled) {
      await scheduleDaily();
    }
  }, [enabled, scheduleDaily]);

  const rescheduleDeudor = useCallback(async () => {
    if (deudorEnabled) {
      await scheduleDeudorCheck();
    }
  }, [deudorEnabled, scheduleDeudorCheck]);

  return { enabled, deudorEnabled, permitted, toggle, toggleDeudores, registerPushToken, rescheduleDaily, rescheduleDeudor };
}

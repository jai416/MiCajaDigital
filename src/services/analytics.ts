import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { generarUUID } from '@/src/utils/uuid';

export type AnalyticsEvent = {
  nombre: string;
  valor?: string;
};

export function registrarEvento(db: ReturnType<typeof useSQLiteContext>, userId: string, evento: AnalyticsEvent): void {
  const { nombre, valor } = evento;
  try {
    db.runAsync(
      `INSERT OR REPLACE INTO analytics_events (id, user_id, nombre, valor, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [generarUUID(), userId, nombre, valor ?? '', new Date().toISOString()]
    ).catch(() => undefined);
  } catch {}
}

export function useAnalytics() {
  const db = useSQLiteContext();
  const track = useCallback(
    (userId: string | undefined, evento: AnalyticsEvent) => {
      if (!userId) return;
      registrarEvento(db, userId, evento);
    },
    [db]
  );
  return { track };
}

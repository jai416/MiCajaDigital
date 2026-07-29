import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { syncToSupabase } from '@/src/services/sync';
import { useAuth } from '@/src/context/AuthContext';

export function useSync() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doSync = useCallback(async () => {
    if (!user) return;

    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    setSyncing(true);
    try {
      const result = await syncToSupabase(db);
      if (result.ventas > 0 || result.gastos > 0) {
        console.log(`Sync: ${result.ventas} ventas, ${result.gastos} gastos`);
      }
      setLastSync(new Date());
    } catch {
      // Error silencioso - no molestar al usuario
    } finally {
      setSyncing(false);
    }
  }, [db, user]);

  useEffect(() => {
    if (!user) return;

    doSync();

    intervalRef.current = setInterval(doSync, 45000);

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') doSync();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [user, doSync]);

  return { syncing, lastSync, sincronizar: doSync };
}

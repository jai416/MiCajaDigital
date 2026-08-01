import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState, InteractionManager, type AppStateStatus } from 'react-native';
import { syncToSupabase } from '@/src/services/sync';
import { useAuth } from '@/src/context/AuthContext';
import { SYNC_INTERVAL_MS, SYNC_MIN_INTERVAL_MS } from '@/src/constants';

export function useSync() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef(0);
  const syncingRef = useRef(false);

  const doSync = useCallback(async (): Promise<boolean> => {
    if (!user || syncingRef.current) return false;

    if (Date.now() - lastSyncTimeRef.current < SYNC_MIN_INTERVAL_MS) return false;

    const state = await NetInfo.fetch();
    if (!state.isConnected) return false;

    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncToSupabase(db);
      lastSyncTimeRef.current = Date.now();
      setLastSync(new Date());
      return true;
    } catch {
      return false;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [db, user]);

  useEffect(() => {
    if (!user) return;

    InteractionManager.runAfterInteractions(() => {
      doSync();
    });

    const intervalo = setInterval(() => {
      InteractionManager.runAfterInteractions(() => {
        doSync();
      });
    }, SYNC_INTERVAL_MS);

    intervalRef.current = intervalo;

    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        InteractionManager.runAfterInteractions(() => {
          doSync();
        });
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [user, doSync]);

  return { syncing, lastSync, sincronizar: doSync };
}

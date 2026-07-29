import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type Gasto } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { Alert } from 'react-native';

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useGastos() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const getUserId = useCallback(async (): Promise<string> => {
    if (user?.id) return user.id;
    const row = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'user_id'"
    );
    return row?.valor ?? '';
  }, [db, user]);

  const addGasto = useCallback(
    async (concepto: string, monto: number) => {
      setLoading(true);
      try {
        const userId = await getUserId();
        if (!userId) {
          Alert.alert('Sin sesión', 'Debes iniciar sesión para guardar gastos.');
          return;
        }
        const id = generarUUID();
        const fecha = hoy();
        await db.runAsync(
          'INSERT INTO gastos (id, user_id, concepto, monto, fecha) VALUES (?, ?, ?, ?, ?)',
          [id, userId, concepto, monto, fecha]
        );
      } finally {
        setLoading(false);
      }
    },
    [db, getUserId]
  );

  const getGastosDelDia = useCallback(async (): Promise<Gasto[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const rows = await db.getAllAsync<Gasto>(
      'SELECT * FROM gastos WHERE fecha = ? AND user_id = ? ORDER BY created_at DESC',
      [hoy(), userId]
    );
    return rows;
  }, [db, getUserId]);

  const getGastosTodos = useCallback(async (): Promise<Gasto[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const rows = await db.getAllAsync<Gasto>(
      'SELECT * FROM gastos WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }, [db, getUserId]);

  return { addGasto, getGastosDelDia, getGastosTodos, loading };
}

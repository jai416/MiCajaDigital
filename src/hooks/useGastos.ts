import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type Gasto } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { Alert } from 'react-native';

import { getUserId } from '@/src/utils/user';
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
    async (concepto: string, monto: number, foto: string = '') => {
      setLoading(true);
      try {
        const userId = await getUserId(db, user);
        if (!userId) {
          throw new Error('Debes iniciar sesión para guardar gastos.');
        }
        const id = generarUUID();
        const fecha = hoy();
        const ahora = new Date().toISOString();
        await db.runAsync(
          'INSERT INTO gastos (id, user_id, concepto, monto, fecha, foto, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, userId, concepto, monto, fecha, foto, ahora]
        );
      } finally {
        setLoading(false);
      }
    },
    [db, user]
  );

  const getGastosDelDia = useCallback(async (): Promise<Gasto[]> => {
    const userId = await getUserId(db, user);
    if (!userId) return [];
    const rows = await db.getAllAsync<Gasto>(
      'SELECT * FROM gastos WHERE fecha = ? AND user_id = ? ORDER BY created_at DESC',
      [hoy(), userId]
    );
    return rows;
  }, [db, user]);

  const getGastosTodos = useCallback(async (): Promise<Gasto[]> => {
    const userId = await getUserId(db, user);
    if (!userId) return [];
    const rows = await db.getAllAsync<Gasto>(
      'SELECT * FROM gastos WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }, [db, user]);

  const getGastosEnRango = useCallback(async (inicio: string, fin: string): Promise<Gasto[]> => {
    const userId = await getUserId(db, user);
    if (!userId) return [];
    return db.getAllAsync<Gasto>(
      'SELECT * FROM gastos WHERE fecha >= ? AND fecha <= ? AND user_id = ? ORDER BY fecha ASC, created_at ASC',
      [inicio, fin, userId]
    );
  }, [db, user]);

  return { addGasto, getGastosDelDia, getGastosTodos, getGastosEnRango, loading };
}

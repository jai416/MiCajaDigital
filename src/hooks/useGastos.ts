import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type Gasto } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { Alert } from 'react-native';
import { registrarEvento } from '@/src/services/analytics';
import { LISTA_LIMITE } from '@/src/constants';

import { getUserId } from '@/src/utils/user';
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useGastos() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

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
        registrarEvento(db, userId, { nombre: 'gasto_creado', valor: concepto });
      } finally {
        setLoading(false);
      }
    },
    [db, user]
  );

  const getGastosDelDia = useCallback(async (): Promise<Gasto[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      const rows = await db.getAllAsync<Gasto>(
        `SELECT * FROM gastos WHERE fecha = ? AND user_id = ? ORDER BY created_at DESC LIMIT ${LISTA_LIMITE}`,
        [hoy(), userId]
      );
      return rows;
    } catch (e) {
      console.error('Error al obtener gastos del día:', e);
      return [];
    }
  }, [db, user]);

  const getGastosTodos = useCallback(async (): Promise<Gasto[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      const rows = await db.getAllAsync<Gasto>(
        `SELECT * FROM gastos WHERE user_id = ? ORDER BY created_at DESC LIMIT ${LISTA_LIMITE}`,
        [userId]
      );
      return rows;
    } catch (e) {
      console.error('Error al obtener gastos:', e);
      return [];
    }
  }, [db, user]);

  const getGastosEnRango = useCallback(async (inicio: string, fin: string): Promise<Gasto[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      return await db.getAllAsync<Gasto>(
        `SELECT * FROM gastos WHERE fecha >= ? AND fecha <= ? AND user_id = ? ORDER BY fecha ASC, created_at ASC LIMIT ${LISTA_LIMITE}`,
        [inicio, fin, userId]
      );
    } catch (e) {
      console.error('Error al obtener gastos en rango:', e);
      return [];
    }
  }, [db, user]);

  return { addGasto, getGastosDelDia, getGastosTodos, getGastosEnRango, loading };
}

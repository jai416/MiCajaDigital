import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { type Compra } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';

import { getUserId } from '@/src/utils/user';
export function useCompras() {
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

  const getAll = useCallback(async (): Promise<Compra[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      return await db.getAllAsync<Compra>(
        'SELECT * FROM compras WHERE user_id = ? ORDER BY fecha DESC, created_at DESC',
        [userId]
      );
    } catch { return []; }
  }, [db, user]);

  const addCompra = useCallback(
    async (producto: string, costoUnitario: number, cantidad: number, proveedor: string = '') => {
      const userId = await getUserId(db, user);
      if (!userId) return;
      setLoading(true);
      try {
        const id = generarUUID();
        const ahora = new Date().toISOString();
        const fecha = new Date().toISOString().slice(0, 10);
        const costoTotal = costoUnitario * cantidad;
        await db.runAsync(
          'INSERT INTO compras (id, user_id, producto, costo_unitario, cantidad, costo_total, proveedor, fecha, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, userId, producto, costoUnitario, cantidad, costoTotal, proveedor, fecha, ahora]
        );
      } catch {
        Alert.alert('Error', 'No se pudo registrar la compra.');
      } finally {
        setLoading(false);
      }
    },
    [db, user]
  );

  const deleteCompra = useCallback(async (id: string) => {
    try {
      await db.runAsync('DELETE FROM compras WHERE id = ?', [id]);
    } catch { /* error silencioso */ }
  }, [db]);

  return { getAll, addCompra, deleteCompra, loading };
}

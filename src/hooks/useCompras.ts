import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { type Compra } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { registrarEvento } from '@/src/services/analytics';
import { LISTA_LIMITE } from '@/src/constants';

import { getUserId } from '@/src/utils/user';
export function useCompras() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const getAll = useCallback(async (limit: number = 0, offset: number = 0): Promise<Compra[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      const sql = `SELECT * FROM compras WHERE user_id = ? AND deleted_at IS NULL ORDER BY fecha DESC, created_at DESC` +
        (limit > 0 ? ' LIMIT ? OFFSET ?' : limit === 0 ? ` LIMIT ${LISTA_LIMITE}` : '');
      const params = limit > 0 ? [userId, limit, offset] : [userId];
      return await db.getAllAsync<Compra>(sql, params);
    } catch (e) {
      console.error('Error al obtener compras:', e);
      return [];
    }
  }, [db, user]);

  const addCompra = useCallback(
    async (producto: string, costoUnitario: number, cantidad: number, proveedor: string = '') => {
      setLoading(true);
      try {
        const userId = await getUserId(db, user);
        if (!userId) return;
        const id = generarUUID();
        const ahora = new Date().toISOString();
        const fecha = new Date().toISOString().slice(0, 10);
        const costoTotal = costoUnitario * cantidad;
        await db.runAsync(
          'INSERT INTO compras (id, user_id, producto, costo_unitario, cantidad, costo_total, proveedor, fecha, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, userId, producto, costoUnitario, cantidad, costoTotal, proveedor, fecha, ahora]
        );
        registrarEvento(db, userId, { nombre: 'compra_registrada', valor: producto });
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
      const ahora = new Date().toISOString();
      await db.runAsync('UPDATE compras SET deleted_at = ?, updated_at = ?, sincronizado = 0 WHERE id = ?', [ahora, ahora, id]);
    } catch (e) { console.error('Error al eliminar compra:', e); }
  }, [db]);

  return { getAll, addCompra, deleteCompra, loading };
}

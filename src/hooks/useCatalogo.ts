import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type CatalogoItem } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { STOCK_WARN_THRESHOLD, BUSCAR_LIMIT } from '@/src/constants';
import { Alert } from 'react-native';

import { getUserId } from '@/src/utils/user';
export function useCatalogo() {
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

  const getAll = useCallback(async (): Promise<CatalogoItem[]> => {
    const userId = await getUserId(db, user);
    if (!userId) return [];
    return db.getAllAsync<CatalogoItem>(
      'SELECT * FROM catalogo WHERE user_id = ? ORDER BY nombre ASC',
      [userId]
    );
  }, [db, user]);

  const buscar = useCallback(
    async (query: string): Promise<CatalogoItem[]> => {
      const userId = await getUserId(db, user);
      if (!userId || !query.trim()) return [];
      return db.getAllAsync<CatalogoItem>(
        `SELECT * FROM catalogo WHERE user_id = ? AND (nombre LIKE ? OR descripcion LIKE ?) ORDER BY nombre ASC LIMIT ${BUSCAR_LIMIT}`,
        [userId, `%${query}%`, `%${query}%`]
      );
    },
    [db, user]
  );

  const getCategorias = useCallback(async (): Promise<string[]> => {
    const userId = await getUserId(db, user);
    if (!userId) return [];
    const rows = await db.getAllAsync<{ categoria: string }>(
      "SELECT DISTINCT categoria FROM catalogo WHERE user_id = ? AND categoria != '' ORDER BY categoria ASC",
      [userId]
    );
    return rows.map(r => r.categoria);
  }, [db, user]);

  const buscarPorCategoria = useCallback(
    async (categoria: string): Promise<CatalogoItem[]> => {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      return db.getAllAsync<CatalogoItem>(
        'SELECT * FROM catalogo WHERE user_id = ? AND categoria = ? ORDER BY nombre ASC',
        [userId, categoria]
      );
    },
    [db, user]
  );

  const buscarPorCodigo = useCallback(
    async (codigo: string): Promise<CatalogoItem | null> => {
      const userId = await getUserId(db, user);
      if (!userId || !codigo.trim()) return null;
      return db.getFirstAsync<CatalogoItem>(
        'SELECT * FROM catalogo WHERE codigo_barras = ? AND user_id = ?',
        [codigo.trim(), userId]
      );
    },
    [db, user]
  );

  const addProducto = useCallback(
    async (nombre: string, precio: number, stock: number, descripcion: string = '', categoria: string = '', foto: string = '', codigo_barras: string = '') => {
      const userId = await getUserId(db, user);
      if (!userId) {
        Alert.alert('Sin sesión', 'Debes iniciar sesión.');
        return;
      }
      setLoading(true);
      try {
        const id = generarUUID();
        const ahora = new Date().toISOString();
        await db.runAsync(
          'INSERT INTO catalogo (id, user_id, nombre, precio, stock, descripcion, codigo_barras, categoria, foto, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, userId, nombre, precio, stock, descripcion, codigo_barras, categoria, foto, ahora]
        );
      } finally {
        setLoading(false);
      }
    },
    [db, user]
  );

  const updateProducto = useCallback(
    async (id: string, nombre: string, precio: number, stock: number, descripcion: string = '', categoria: string = '', foto: string = '', codigo_barras: string = '') => {
      const ahora = new Date().toISOString();
      await db.runAsync(
        'UPDATE catalogo SET nombre = ?, precio = ?, stock = ?, descripcion = ?, codigo_barras = ?, categoria = ?, foto = ?, updated_at = ?, sincronizado = 0 WHERE id = ?',
        [nombre, precio, stock, descripcion, codigo_barras, categoria, foto, ahora, id]
      );
    },
    [db]
  );

  const deleteProducto = useCallback(
    async (id: string) => {
      await db.runAsync('DELETE FROM catalogo WHERE id = ?', [id]);
    },
    [db]
  );

  const getByNombre = useCallback(
    async (nombre: string): Promise<CatalogoItem | null> => {
      const userId = await getUserId(db, user);
      if (!userId) return null;
      return db.getFirstAsync<CatalogoItem>(
        'SELECT * FROM catalogo WHERE nombre = ? AND user_id = ?',
        [nombre, userId]
      );
    },
    [db, user]
  );

  const deductStock = useCallback(
    async (catalogoId: string, cantidad: number = 1) => {
      const item = await db.getFirstAsync<CatalogoItem>(
        'SELECT * FROM catalogo WHERE id = ?', [catalogoId]
      );
      if (!item) return;
      const nuevoStock = Math.max(0, item.stock - cantidad);
      const ahora = new Date().toISOString();
      await db.runAsync(
        'UPDATE catalogo SET stock = ?, updated_at = ? WHERE id = ?',
        [nuevoStock, ahora, catalogoId]
      );
      if (nuevoStock < STOCK_WARN_THRESHOLD && nuevoStock > 0) {
        Alert.alert('Stock bajo', `"${item.nombre}" solo tiene ${nuevoStock} unidades.`);
      } else if (nuevoStock === 0) {
        Alert.alert('Sin stock', `"${item.nombre}" está agotado.`);
      }
    },
    [db]
  );

  return { getAll, buscar, buscarPorCodigo, getCategorias, buscarPorCategoria, addProducto, updateProducto, deleteProducto, getByNombre, deductStock, loading };
}

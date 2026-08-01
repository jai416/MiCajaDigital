import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type CatalogoItem } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { STOCK_WARN_THRESHOLD, BUSCAR_LIMIT } from '@/src/constants';
import { Alert } from 'react-native';
import { registrarEvento } from '@/src/services/analytics';

import { getUserId } from '@/src/utils/user';

function toFtsQuery(text: string): string {
  return text.trim().split(/\s+/).map(w => `"${w}"*`).join(' ');
}

export function useCatalogo() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const getAll = useCallback(
    async (limit: number = 0, offset: number = 0): Promise<CatalogoItem[]> => {
      try {
        const userId = await getUserId(db, user);
        if (!userId) return [];
        const sql = 'SELECT * FROM catalogo WHERE user_id = ? AND deleted_at IS NULL ORDER BY nombre ASC' +
          (limit > 0 ? ' LIMIT ? OFFSET ?' : '');
        const params = limit > 0 ? [userId, limit, offset] : [userId];
        return await db.getAllAsync<CatalogoItem>(sql, params);
      } catch (e) {
        console.error('Error al obtener catálogo:', e);
        return [];
      }
    }, [db, user]
  );

  const buscar = useCallback(
    async (query: string): Promise<CatalogoItem[]> => {
      try {
        const userId = await getUserId(db, user);
        if (!userId || !query.trim()) return [];
        const ftsQuery = toFtsQuery(query);
        try {
          return await db.getAllAsync<CatalogoItem>(
            `SELECT catalogo.* FROM catalogo JOIN catalogo_fts ON catalogo.rowid = catalogo_fts.rowid WHERE catalogo_fts MATCH ? AND catalogo.user_id = ? AND catalogo.deleted_at IS NULL ORDER BY catalogo.nombre ASC LIMIT ${BUSCAR_LIMIT}`,
            [ftsQuery, userId]
          );
        } catch {
          const pattern = `%${query}%`;
          return await db.getAllAsync<CatalogoItem>(
            'SELECT * FROM catalogo WHERE user_id = ? AND deleted_at IS NULL AND (nombre LIKE ? OR descripcion LIKE ?) ORDER BY nombre ASC LIMIT ?',
            [userId, pattern, pattern, BUSCAR_LIMIT]
          );
        }
      } catch (e) {
        console.error('Error al buscar en catálogo:', e);
        return [];
      }
    },
    [db, user]
  );

  const getCategorias = useCallback(async (): Promise<string[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      const rows = await db.getAllAsync<{ categoria: string }>(
        "SELECT DISTINCT categoria FROM catalogo WHERE user_id = ? AND categoria != '' AND deleted_at IS NULL ORDER BY categoria ASC",
        [userId]
      );
      return rows.map(r => r.categoria);
    } catch (e) {
      console.error('Error al obtener categorías:', e);
      return [];
    }
  }, [db, user]);

  const buscarPorCategoria = useCallback(
    async (categoria: string): Promise<CatalogoItem[]> => {
      try {
        const userId = await getUserId(db, user);
        if (!userId) return [];
        return await db.getAllAsync<CatalogoItem>(
          'SELECT * FROM catalogo WHERE user_id = ? AND categoria = ? AND deleted_at IS NULL ORDER BY nombre ASC',
          [userId, categoria]
        );
      } catch (e) {
        console.error('Error al buscar por categoría:', e);
        return [];
      }
    },
    [db, user]
  );

  const buscarPorCodigo = useCallback(
    async (codigo: string): Promise<CatalogoItem | null> => {
      try {
        const userId = await getUserId(db, user);
        if (!userId || !codigo.trim()) return null;
        return await db.getFirstAsync<CatalogoItem>(
          'SELECT * FROM catalogo WHERE codigo_barras = ? AND user_id = ? AND deleted_at IS NULL',
          [codigo.trim(), userId]
        );
      } catch (e) {
        console.error('Error al buscar por código:', e);
        return null;
      }
    },
    [db, user]
  );

  const addProducto = useCallback(
    async (nombre: string, precio: number, stock: number, descripcion: string = '', categoria: string = '', foto: string = '', codigo_barras: string = '') => {
      setLoading(true);
      try {
        const userId = await getUserId(db, user);
        if (!userId) {
          Alert.alert('Sin sesión', 'Debes iniciar sesión.');
          return;
        }
        const id = generarUUID();
        const ahora = new Date().toISOString();
        await db.runAsync(
          'INSERT INTO catalogo (id, user_id, nombre, precio, stock, descripcion, codigo_barras, categoria, foto, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, userId, nombre, precio, stock, descripcion, codigo_barras, categoria, foto, ahora]
        );
        registrarEvento(db, userId, { nombre: 'producto_creado', valor: nombre });
      } finally {
        setLoading(false);
      }
    },
    [db, user]
  );

  const updateProducto = useCallback(
    async (id: string, nombre: string, precio: number, stock: number, descripcion: string = '', categoria: string = '', foto: string = '', codigo_barras: string = '') => {
      try {
        const ahora = new Date().toISOString();
        await db.runAsync(
          'UPDATE catalogo SET nombre = ?, precio = ?, stock = ?, descripcion = ?, codigo_barras = ?, categoria = ?, foto = ?, updated_at = ?, sincronizado = 0 WHERE id = ?',
          [nombre, precio, stock, descripcion, codigo_barras, categoria, foto, ahora, id]
        );
      } catch (e) {
        console.error('Error al actualizar producto:', e);
        throw e;
      }
    },
    [db]
  );

  const deleteProducto = useCallback(
    async (id: string) => {
      try {
        const ahora = new Date().toISOString();
        await db.runAsync(
          'UPDATE catalogo SET deleted_at = ?, updated_at = ?, sincronizado = 0 WHERE id = ?',
          [ahora, ahora, id]
        );
      } catch (e) {
        console.error('Error al eliminar producto:', e);
        throw e;
      }
    },
    [db]
  );

  const getByNombre = useCallback(
    async (nombre: string): Promise<CatalogoItem | null> => {
      try {
        const userId = await getUserId(db, user);
        if (!userId) return null;
        return await db.getFirstAsync<CatalogoItem>(
          'SELECT * FROM catalogo WHERE nombre = ? AND user_id = ? AND deleted_at IS NULL',
          [nombre, userId]
        );
      } catch (e) {
        console.error('Error al buscar por nombre:', e);
        return null;
      }
    },
    [db, user]
  );

  const deductStock = useCallback(
    async (catalogoId: string, cantidad: number = 1) => {
      try {
        const item = await db.getFirstAsync<CatalogoItem>(
          'SELECT * FROM catalogo WHERE id = ?', [catalogoId]
        );
        if (!item) return;
        const nuevoStock = Math.max(0, item.stock - cantidad);
        const ahora = new Date().toISOString();
        await db.runAsync(
          'UPDATE catalogo SET stock = ?, updated_at = ?, sincronizado = 0 WHERE id = ?',
          [nuevoStock, ahora, catalogoId]
        );
        if (nuevoStock < STOCK_WARN_THRESHOLD && nuevoStock > 0) {
          Alert.alert('Stock bajo', `"${item.nombre}" solo tiene ${nuevoStock} unidades.`);
        } else if (nuevoStock === 0) {
          Alert.alert('Sin stock', `"${item.nombre}" está agotado.`);
        }
      } catch (e) {
        console.error('Error al descontar stock:', e);
      }
    },
    [db]
  );

  return { getAll, buscar, buscarPorCodigo, getCategorias, buscarPorCategoria, addProducto, updateProducto, deleteProducto, getByNombre, deductStock, loading };
}

import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type Venta, type CuadreResumen } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { useAuth } from '@/src/context/AuthContext';
import { Alert } from 'react-native';

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(fecha: string): number {
  const entonces = new Date(fecha + 'T00:00:00');
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);
  return Math.floor((ahora.getTime() - entonces.getTime()) / 86400000);
}

export function useVentas() {
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

  const addVenta = useCallback(
    async (producto: string, precio: number, cliente: string, tipo: 'contado' | 'fiado') => {
      setLoading(true);
      try {
        const userId = await getUserId();
        if (!userId) {
          Alert.alert('Sin sesión', 'Debes iniciar sesión para guardar ventas.');
          return;
        }
        const id = generarUUID();
        const fecha = hoy();
        const pagado = tipo === 'contado' ? 1 : 0;
        await db.runAsync(
          'INSERT INTO ventas (id, user_id, producto, precio, cliente, tipo, pagado, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, userId, producto, precio, cliente, tipo, pagado, fecha]
        );
      } finally {
        setLoading(false);
      }
    },
    [db, getUserId]
  );

  const pagarVenta = useCallback(
    async (id: string) => {
      await db.runAsync('UPDATE ventas SET pagado = 1 WHERE id = ?', [id]);
    },
    [db]
  );

  const getVentasDelDia = useCallback(async (): Promise<Venta[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const rows = await db.getAllAsync<Venta>(
      'SELECT * FROM ventas WHERE fecha = ? AND user_id = ? ORDER BY created_at DESC',
      [hoy(), userId]
    );
    return rows;
  }, [db, getUserId]);

  const getDeudores = useCallback(async (): Promise<(Venta & { dias_retraso: number })[]> => {
    const userId = await getUserId();
    if (!userId) return [];
    const rows = await db.getAllAsync<Venta>(
      'SELECT * FROM ventas WHERE pagado = 0 AND user_id = ? ORDER BY fecha ASC, created_at ASC',
      [userId]
    );
    return rows.map((r) => ({ ...r, dias_retraso: daysSince(r.fecha) }));
  }, [db, getUserId]);

  const getCuadre = useCallback(async (): Promise<CuadreResumen> => {
    const userId = await getUserId();
    if (!userId) {
      return { totalVentas: 0, totalGastos: 0, ganancia: 0, deudores: 0, totalCobrado: 0, totalPendiente: 0 };
    }
    const fecha = hoy();

    const ventasDia = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE fecha = ? AND pagado = 1 AND user_id = ?',
      [fecha, userId]
    );
    const gastosDia = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(monto), 0) as total FROM gastos WHERE fecha = ? AND user_id = ?',
      [fecha, userId]
    );
    const deudores = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM ventas WHERE pagado = 0 AND user_id = ?',
      [userId]
    );
    const cobrado = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE pagado = 1 AND user_id = ?',
      [userId]
    );
    const pendiente = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE pagado = 0 AND user_id = ?',
      [userId]
    );

    return {
      totalVentas: ventasDia?.total ?? 0,
      totalGastos: gastosDia?.total ?? 0,
      ganancia: (ventasDia?.total ?? 0) - (gastosDia?.total ?? 0),
      deudores: deudores?.count ?? 0,
      totalCobrado: cobrado?.total ?? 0,
      totalPendiente: pendiente?.total ?? 0,
    };
  }, [db, getUserId]);

  return { addVenta, pagarVenta, getVentasDelDia, getDeudores, getCuadre, loading };
}

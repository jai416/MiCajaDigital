import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { type Venta, type CuadreResumen } from '@/src/types';
import { generarUUID } from '@/src/utils/uuid';
import { getUserId } from '@/src/utils/user';
import { useAuth } from '@/src/context/AuthContext';
import { STOCK_WARN_THRESHOLD, MS_PER_DAY, LISTA_LIMITE, DEUDORES_LIMITE } from '@/src/constants';
import { Alert } from 'react-native';
import { registrarEvento } from '@/src/services/analytics';

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(fecha: string): number {
  const entonces = new Date(fecha + 'T00:00:00');
  const ahora = new Date();
  ahora.setHours(0, 0, 0, 0);
  return Math.floor((ahora.getTime() - entonces.getTime()) / MS_PER_DAY);
}

export interface AddVentaInput {
  producto: string;
  precio: number;
  costo?: number;
  cliente?: string;
  moneda?: 'CUP' | 'USD' | 'MLC';
  tipo_pedido?: 'contado' | 'fiado' | 'pedido';
  catalogo_id?: string;
  metodo_pago?: 'efectivo' | 'tarjeta' | 'transferencia';
  anticipo?: number;
  fecha_entrega?: string;
  nota?: string;
}

export function useVentas() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const addVenta = useCallback(
    async (input: AddVentaInput) => {
      setLoading(true);
      try {
        const userId = await getUserId(db, user);
        if (!userId) {
          throw new Error('Debes iniciar sesión para guardar ventas.');
        }

        const id = generarUUID();
        const fecha = hoy();
        const tipoPedido = input.tipo_pedido ?? 'contado';
        const anticipo = tipoPedido === 'pedido' ? (input.anticipo ?? 0) : (tipoPedido === 'contado' ? input.precio : 0);
        const saldoPendiente = tipoPedido === 'pedido' ? Math.max(0, input.precio - anticipo) : tipoPedido === 'fiado' ? input.precio : 0;
        const pagado = tipoPedido === 'contado' ? 1 : 0;
        const estadoPedido = tipoPedido === 'pedido' ? 'pendiente' : 'entregado';
        const ahora = new Date().toISOString();

        await db.runAsync(
          `INSERT INTO ventas
           (id, user_id, producto, precio, costo, cliente, tipo, moneda, tipo_pedido, pagado, fecha,
            anticipo, saldo_pendiente, fecha_entrega, estado_pedido, nota,
            updated_at, catalogo_id, metodo_pago)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, userId, input.producto, input.precio, input.costo ?? 0, input.cliente ?? '',
            tipoPedido, input.moneda ?? 'CUP', tipoPedido, pagado, fecha,
            anticipo, saldoPendiente, input.fecha_entrega ?? null, estadoPedido,
            input.nota ?? '',
            ahora, input.catalogo_id ?? null, input.metodo_pago ?? 'efectivo',
          ]
        );

        if (input.catalogo_id) {
          await db.runAsync(
            "UPDATE catalogo SET stock = MAX(0, stock - 1), updated_at = ?, sincronizado = 0 WHERE id = ? AND stock > 0",
            [ahora, input.catalogo_id]
          );
          const restante = await db.getFirstAsync<{ stock: number }>(
            'SELECT stock FROM catalogo WHERE id = ?', [input.catalogo_id]
          );
          if (restante && restante.stock === 0) {
            Alert.alert('Stock agotado', `"${input.producto}" se agotó.`);
          } else if (restante && restante.stock < STOCK_WARN_THRESHOLD) {
            Alert.alert('Stock bajo', `"${input.producto}" solo tiene ${restante.stock} unidades.`);
          }
        }
        registrarEvento(db, userId, { nombre: 'venta_creada', valor: input.producto });
      } catch (e) {
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [db, user]
  );

  const pagarVenta = useCallback(
    async (id: string) => {
      try {
        const ahora = new Date().toISOString();
        await db.runAsync(
          "UPDATE ventas SET pagado = 1, updated_at = ?, sincronizado = 0 WHERE id = ?",
          [ahora, id]
        );
      } catch (e) {
        console.error('Error al pagar venta:', e);
        throw e;
      }
    },
    [db]
  );

  const deleteVenta = useCallback(
    async (id: string) => {
      try {
        await db.runAsync('UPDATE ventas SET deleted_at = ?, sincronizado = 0 WHERE id = ?', [new Date().toISOString(), id]);
      } catch (e) {
        console.error('Error al eliminar venta:', e);
        throw e;
      }
    },
    [db]
  );

  const updateVenta = useCallback(
    async (id: string, data: Partial<AddVentaInput>) => {
      try {
        const ahora = new Date().toISOString();
        const sets: string[] = [];
        const vals: (string | number | null)[] = [];
        if (data.producto !== undefined) { sets.push('producto = ?'); vals.push(data.producto); }
        if (data.precio !== undefined) { sets.push('precio = ?'); vals.push(data.precio); }
        if (data.costo !== undefined) { sets.push('costo = ?'); vals.push(data.costo); }
        if (data.cliente !== undefined) { sets.push('cliente = ?'); vals.push(data.cliente); }
        if (data.moneda !== undefined) { sets.push('moneda = ?'); vals.push(data.moneda); }
        if (data.tipo_pedido !== undefined) { sets.push('tipo_pedido = ?'); vals.push(data.tipo_pedido); }
        if (data.metodo_pago !== undefined) { sets.push('metodo_pago = ?'); vals.push(data.metodo_pago); }
        if (data.nota !== undefined) { sets.push('nota = ?'); vals.push(data.nota); }
        sets.push('updated_at = ?'); vals.push(ahora);
        sets.push('sincronizado = 0');
        vals.push(id);
        await db.runAsync(
          `UPDATE ventas SET ${sets.join(', ')} WHERE id = ?`,
          vals
        );
      } catch (e) {
        console.error('Error al actualizar venta:', e);
        throw e;
      }
    },
    [db]
  );

  const actualizarEstadoPedido = useCallback(
    async (id: string, nuevoEstado: 'pendiente' | 'entregado' | 'cancelado') => {
      try {
        const ahora = new Date().toISOString();
        if (nuevoEstado === 'entregado') {
          await db.runAsync(
            "UPDATE ventas SET estado_pedido = ?, pagado = 1, saldo_pendiente = 0, updated_at = ?, sincronizado = 0 WHERE id = ?",
            [nuevoEstado, ahora, id]
          );
        } else {
          await db.runAsync(
            "UPDATE ventas SET estado_pedido = ?, updated_at = ?, sincronizado = 0 WHERE id = ?",
            [nuevoEstado, ahora, id]
          );
        }
      } catch (e) {
        console.error('Error al actualizar pedido:', e);
        throw e;
      }
    },
    [db]
  );

  const getVentasDelDia = useCallback(async (): Promise<Venta[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      return await db.getAllAsync<Venta>(
        `SELECT * FROM ventas WHERE fecha = ? AND user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ${LISTA_LIMITE}`,
        [hoy(), userId]
      );
    } catch (e) {
      console.error('Error al obtener ventas del día:', e);
      return [];
    }
  }, [db, user]);

  const getDeudores = useCallback(async (): Promise<(Venta & { dias_retraso: number })[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      const rows = await db.getAllAsync<Venta>(
        `SELECT * FROM ventas WHERE pagado = 0 AND user_id = ? AND deleted_at IS NULL ORDER BY fecha ASC LIMIT ${DEUDORES_LIMITE}`,
        [userId]
      );
      return rows.map((r) => ({ ...r, dias_retraso: daysSince(r.fecha) }));
    } catch (e) {
      console.error('Error al obtener deudores:', e);
      return [];
    }
  }, [db, user]);

  const getVentasEnRango = useCallback(async (inicio: string, fin: string): Promise<Venta[]> => {
    try {
      const userId = await getUserId(db, user);
      if (!userId) return [];
      return await db.getAllAsync<Venta>(
        `SELECT * FROM ventas WHERE fecha >= ? AND fecha <= ? AND user_id = ? AND deleted_at IS NULL ORDER BY fecha ASC, created_at ASC LIMIT ${LISTA_LIMITE}`,
        [inicio, fin, userId]
      );
    } catch (e) {
      console.error('Error al obtener ventas en rango:', e);
      return [];
    }
  }, [db, user]);

  const getPedidos = useCallback(
    async (estado?: string, limit: number = 0, offset: number = 0): Promise<Venta[]> => {
      try {
        const userId = await getUserId(db, user);
        if (!userId) return [];
        const lim = limit > 0 ? ' LIMIT ? OFFSET ?' : '';
        if (estado) {
          return await db.getAllAsync<Venta>(
            `SELECT * FROM ventas WHERE tipo_pedido = 'pedido' AND estado_pedido = ? AND user_id = ? AND deleted_at IS NULL ORDER BY fecha DESC, created_at DESC${lim}`,
            limit > 0 ? [estado, userId, limit, offset] : [estado, userId]
          );
        }
        return await db.getAllAsync<Venta>(
          `SELECT * FROM ventas WHERE tipo_pedido = 'pedido' AND user_id = ? AND deleted_at IS NULL ORDER BY fecha DESC, created_at DESC${lim}`,
          limit > 0 ? [userId, limit, offset] : [userId]
        );
      } catch (e) {
        console.error('Error al obtener pedidos:', e);
        return [];
      }
    },
    [db, user]
  );

  const getCuadre = useCallback(async (): Promise<CuadreResumen> => {
    const vacio: CuadreResumen = { totalVentas: 0, totalGastos: 0, ganancia: 0, deudores: 0, totalCobrado: 0, totalPendiente: 0, metodosPago: { efectivo: 0, tarjeta: 0, transferencia: 0, sugerencia: '' }, pedidosPendientes: 0, pedidosEntregadosHoy: 0 };
    try {
      const userId = await getUserId(db, user);
      if (!userId) {
        return vacio;
      }
      const fecha = hoy();

      const ventasDia = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE fecha = ? AND pagado = 1 AND user_id = ? AND tipo_pedido != 'pedido' AND deleted_at IS NULL",
        [fecha, userId]
      );
      const gastosDia = await db.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(monto), 0) as total FROM gastos WHERE fecha = ? AND user_id = ?',
        [fecha, userId]
      );
      const deudores = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM ventas WHERE pagado = 0 AND user_id = ? AND deleted_at IS NULL',
        [userId]
      );
      const cobrado = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE pagado = 1 AND user_id = ? AND tipo_pedido != 'pedido' AND deleted_at IS NULL",
        [userId]
      );
      const pendiente = await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE pagado = 0 AND user_id = ? AND tipo_pedido != 'pedido' AND deleted_at IS NULL",
        [userId]
      );

      const pedidosPendientes = (await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(saldo_pendiente), 0) as total FROM ventas WHERE tipo_pedido = 'pedido' AND estado_pedido = 'pendiente' AND user_id = ? AND deleted_at IS NULL",
        [userId]
      ))?.total ?? 0;

      const pedidosEntregadosHoy = (await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE tipo_pedido = 'pedido' AND estado_pedido = 'entregado' AND fecha = ? AND user_id = ? AND deleted_at IS NULL",
        [fecha, userId]
      ))?.total ?? 0;

      const efectivo = (await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE fecha = ? AND metodo_pago = 'efectivo' AND user_id = ? AND tipo_pedido != 'pedido' AND deleted_at IS NULL", [fecha, userId]
      ))?.total ?? 0;
      const tarjeta = (await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE fecha = ? AND metodo_pago = 'tarjeta' AND user_id = ? AND tipo_pedido != 'pedido' AND deleted_at IS NULL", [fecha, userId]
      ))?.total ?? 0;
      const transferencia = (await db.getFirstAsync<{ total: number }>(
        "SELECT COALESCE(SUM(precio), 0) as total FROM ventas WHERE fecha = ? AND metodo_pago = 'transferencia' AND user_id = ? AND tipo_pedido != 'pedido' AND deleted_at IS NULL", [fecha, userId]
      ))?.total ?? 0;

      const totalMetodos = efectivo + tarjeta + transferencia;
      let sugerencia = '';
      if (totalMetodos > 0) {
        const pctEfectivo = (efectivo / totalMetodos) * 100;
        if (pctEfectivo > 60) {
          sugerencia = '💡 La mayoría paga en efectivo. Ofrece descuento por transferencia para reducir efectivo en caja.';
        } else if ((transferencia / totalMetodos) * 100 > 50) {
          sugerencia = '💡 Tus clientes prefieren transferencia. ¡Menos efectivo = más seguro!';
        } else if ((tarjeta / totalMetodos) * 100 > 50) {
          sugerencia = '💡 Las tarjetas son lo más usado. Asegúrate de tener el POS siempre listo.';
        } else {
          sugerencia = '💡 Tus métodos de pago están balanceados. Buenos hábitos de cobro.';
        }
      }

      return {
        totalVentas: ventasDia?.total ?? 0,
        totalGastos: gastosDia?.total ?? 0,
        ganancia: (ventasDia?.total ?? 0) - (gastosDia?.total ?? 0),
        deudores: deudores?.count ?? 0,
        totalCobrado: cobrado?.total ?? 0,
        totalPendiente: pendiente?.total ?? 0,
        metodosPago: { efectivo, tarjeta, transferencia, sugerencia },
        pedidosPendientes,
        pedidosEntregadosHoy,
      };
    } catch (e) {
      console.error('Error al obtener cuadre:', e);
      return vacio;
    }
  }, [db, user]);

  const actualizarCliente = useCallback(async (id: string, nuevoCliente: string) => {
    try {
      const ahora = new Date().toISOString();
      await db.runAsync(
        'UPDATE ventas SET cliente = ?, updated_at = ?, sincronizado = 0 WHERE id = ?',
        [nuevoCliente, ahora, id]
      );
    } catch (e) {
      console.error('Error al actualizar cliente:', e);
      throw e;
    }
  }, [db]);

  return { addVenta, pagarVenta, deleteVenta, updateVenta, actualizarEstadoPedido, actualizarCliente, getVentasDelDia, getVentasEnRango, getDeudores, getPedidos, getCuadre, loading };
}

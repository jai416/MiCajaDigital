import { renderHook, act } from '@testing-library/react-native';
import { useVentas } from '../src/hooks/useVentas';

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockDb,
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

jest.mock('../src/utils/user', () => ({
  getUserId: jest.fn(async () => 'u1'),
}));

jest.mock('../src/services/analytics', () => ({
  registrarEvento: jest.fn(),
}));

let mockDb: any;

function makeDb() {
  return {
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    execAsync: jest.fn().mockResolvedValue(undefined),
    _queries: [] as string[],
  };
}

describe('useVentas', () => {
  beforeEach(() => {
    mockDb = makeDb();
  });

  it('addVenta inserta con los valores calculados', async () => {
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.addVenta({ producto: 'Pan', precio: 100 });
    });

    const insert = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO ventas'));
    expect(insert).toBeDefined();
    const params = insert[1];
    expect(params[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(params[2]).toBe('Pan');
    expect(params[3]).toBe(100);
    expect(params[4]).toBe(0);
    expect(params[9]).toBe(1);
    expect(params[11]).toBe(100);
    expect(params[12]).toBe(0);
  });

  it('addVenta calcula anticipo y saldo pendiente para pedidos', async () => {
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.addVenta({ producto: 'Pedido X', precio: 1000, tipo_pedido: 'pedido', anticipo: 300 });
    });

    const insert = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO ventas'));
    const params = insert[1];
    expect(params[9]).toBe(0);
    expect(params[11]).toBe(300);
    expect(params[12]).toBe(700);
    expect(params[14]).toBe('pendiente');
  });

  it('addVenta lanza error si no hay userId', async () => {
    const { getUserId } = require('../src/utils/user');
    getUserId.mockResolvedValueOnce('');
    const { result } = renderHook(() => useVentas());
    await expect(
      act(async () => { await result.current.addVenta({ producto: 'X', precio: 1 }); })
    ).rejects.toThrow('Debes iniciar sesión para guardar ventas.');
  });

  it('getVentasDelDia retorna [] en error', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('db fail'));
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      const res = await result.current.getVentasDelDia();
      expect(res).toEqual([]);
    });
  });

  it('getDeudores calcula dias_retraso', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 'v1', fecha: '2026-07-20', pagado: 0, precio: 10 },
    ]);
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      const rows = await result.current.getDeudores();
      expect(rows.length).toBe(1);
      expect(typeof rows[0].dias_retraso).toBe('number');
      expect(rows[0].dias_retraso).toBeGreaterThanOrEqual(0);
    });
  });

  it('getCuadre retorna objeto vacío en error', async () => {
    mockDb.getFirstAsync.mockRejectedValue(new Error('db fail'));
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      const c = await result.current.getCuadre();
      expect(c.totalVentas).toBe(0);
      expect(c.metodosPago.efectivo).toBe(0);
    });
  });

  it('getCuadre suma ventas, gastos y calcula ganancia', async () => {
    mockDb.getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('SUM(precio)') && sql.includes('pagado = 1') && sql.includes("tipo_pedido != 'pedido'") && sql.includes('fecha = ?')) {
        return { total: 500 };
      }
      if (sql.includes('SUM(monto)')) return { total: 100 };
      if (sql.includes('COUNT(*)')) return { count: 3 };
      if (sql.includes('SUM(precio)') && sql.includes('pagado = 1')) return { total: 1200 };
      if (sql.includes('SUM(precio)') && sql.includes('pagado = 0')) return { total: 200 };
      if (sql.includes('SUM(saldo_pendiente)')) return { total: 300 };
      if (sql.includes("SUM(precio)") && sql.includes('estado_pedido = \'entregado\'')) return { total: 400 };
      if (sql.includes("metodo_pago = 'efectivo'")) return { total: 300 };
      if (sql.includes("metodo_pago = 'tarjeta'")) return { total: 100 };
      if (sql.includes("metodo_pago = 'transferencia'")) return { total: 100 };
      return null;
    });

    const { result } = renderHook(() => useVentas());
    await act(async () => {
      const c = await result.current.getCuadre();
      expect(c.totalVentas).toBe(500);
      expect(c.totalGastos).toBe(100);
      expect(c.ganancia).toBe(400);
      expect(c.deudores).toBe(3);
      expect(c.totalCobrado).toBe(1200);
      expect(c.totalPendiente).toBe(200);
      expect(c.pedidosPendientes).toBe(300);
      expect(c.pedidosEntregadosHoy).toBe(400);
      expect(c.metodosPago.efectivo).toBe(300);
      expect(c.metodosPago.tarjeta).toBe(100);
      expect(c.metodosPago.transferencia).toBe(100);
      expect(c.metodosPago.sugerencia.length).toBeGreaterThan(0);
    });
  });

  it('actualizarEstadoPedido marca pagado y saldo en cero al entregar', async () => {
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.actualizarEstadoPedido('v1', 'entregado');
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes("estado_pedido = ?"));
    expect(upd[0]).toContain('pagado = 1');
    expect(upd[0]).toContain('saldo_pendiente = 0');
  });

  it('deleteVenta hace borrado suave (deleted_at + sincronizado=0)', async () => {
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.deleteVenta('v1');
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('SET deleted_at'));
    expect(upd).toBeDefined();
    expect(upd[0]).toContain('sincronizado = 0');
    expect(upd[1][0]).toBeTruthy();
  });

  it('pagarVenta salda la deuda (pagado=1, saldo=0, sincronizado=0)', async () => {
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.pagarVenta('v1');
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('SET pagado = 1'));
    expect(upd).toBeDefined();
    expect(upd[0]).toContain('saldo_pendiente = 0');
    expect(upd[0]).toContain('sincronizado = 0');
  });

  it('actualizarCliente actualiza nombre y marca sync pendiente', async () => {
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.actualizarCliente('v1', 'María');
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('cliente = ?'));
    expect(upd).toBeDefined();
    expect(upd[1][0]).toBe('María');
    expect(upd[0]).toContain('sincronizado = 0');
  });

  it('getPedidos filtra por estado con LIMIT/OFFSET', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 'p1' }]);
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      const res = await result.current.getPedidos('pendiente', 30, 0);
      expect(res).toHaveLength(1);
    });
    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain("estado_pedido = ?");
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual(['pendiente', 'u1', 30, 0]);
  });

  it('updateVenta recalcula anticipo/saldo para pedidos y marca sync', async () => {
    mockDb.getFirstAsync.mockResolvedValue({
      id: 'v1', precio: 1000, tipo_pedido: 'pedido', anticipo: 300,
      pagado: 0, saldo_pendiente: 700,
    });
    const { result } = renderHook(() => useVentas());
    await act(async () => {
      await result.current.updateVenta('v1', { anticipo: 400 });
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('UPDATE ventas SET'));
    expect(upd).toBeDefined();
    expect(upd[0]).toContain('anticipo = ?');
    expect(upd[1]).toContain(400);
    expect(upd[1]).toContain(600);
  });

  it('updateVenta lanza error si la venta no existe', async () => {
    mockDb.getFirstAsync.mockResolvedValue(null);
    const { result } = renderHook(() => useVentas());
    await expect(
      act(async () => { await result.current.updateVenta('nope', { precio: 1 }); })
    ).rejects.toThrow('Venta no encontrada');
  });
});

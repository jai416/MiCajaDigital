import { syncToSupabase } from '../src/services/sync';

const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockGetUser = jest.fn();
const mockSelect = jest.fn();

jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === 'ventas' || table === 'gastos' || table === 'catalogo' || table === 'compras') {
        return {
          upsert: (payload: any, opts: any) => mockUpsert(table, payload, opts),
          delete: () => ({ eq: (col: string, val: any) => mockDelete(table, col, val) }),
          select: (cols: string) => ({
            eq: (col: string, val: any) => ({
              gt: (col2: string, val2: any) => mockSelect(table, cols, col, val, col2, val2),
            }),
          }),
        };
      }
      return {};
    },
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('Zm9v'),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(async (uri: string) => ({ uri })),
  SaveFormat: { JPEG: 'jpeg' },
}));

function makeDb() {
  const queries: string[] = [];
  const db = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      queries.push(sql);
      return { changes: 1 };
    }),
    execAsync: jest.fn(),
    _queries: queries,
  };
  return db;
}

describe('syncToSupabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockUpsert.mockResolvedValue({ error: null, data: null });
    mockDelete.mockResolvedValue({ error: null, data: null });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  it('retorna ceros si no hay sesión', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const db = makeDb();
    const res = await syncToSupabase(db);
    expect(res).toEqual({ ventas: 0, gastos: 0, catalogo: 0, compras: 0 });
  });

  it('hace PUSH de una venta sin sincronizar', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM ventas')) {
        return [{
          id: 'v1', user_id: 'u1', producto: 'Pan', precio: 50, costo: 20,
          cliente: '', tipo: 'contado', tipo_pedido: 'contado', pagado: 1,
          fecha: '2026-07-31', created_at: '2026-07-31T00:00:00.000Z',
          catalogo_id: null, metodo_pago: 'efectivo', moneda: 'CUP',
          anticipo: 0, saldo_pendiente: 0, fecha_entrega: null,
          estado_pedido: 'entregado', nota: '', deleted_at: null,
        }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);

    const res = await syncToSupabase(db);
    expect(res.ventas).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith('ventas', expect.objectContaining({ id: 'v1', producto: 'Pan' }), { onConflict: 'id' });
    const marks = db._queries.filter(q => q.includes('UPDATE ventas SET sincronizado = 1'));
    expect(marks.length).toBe(1);
  });

  it('borra en cloud una venta con deleted_at local', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM ventas')) {
        return [{ id: 'v1', user_id: 'u1', deleted_at: '2026-07-30T00:00:00.000Z' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);

    const res = await syncToSupabase(db);
    expect(res.ventas).toBe(1);
    expect(mockDelete).toHaveBeenCalledWith('ventas', 'id', 'v1');
  });

  it('aplica un borrado remoto de venta al local', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM ventas')) return { updated_at: '2026-07-01T00:00:00.000Z' };
      if (sql.includes('last_sync_at')) return { valor: '2026-07-01T00:00:00.000Z' };
      return null;
    });
    mockSelect.mockImplementation(async () => ({
      data: [{
        id: 'v1', user_id: 'u1', producto: 'Pan', precio: 50, costo: 20,
        cliente: '', tipo: 'contado', tipo_pedido: 'contado', pagado: 1,
        fecha: '2026-07-01', created_at: '2026-07-01T00:00:00.000Z',
        catalogo_id: null, metodo_pago: 'efectivo', moneda: 'CUP',
        anticipo: 0, saldo_pendiente: 0, fecha_entrega: null,
        estado_pedido: 'entregado', nota: '', deleted_at: '2026-07-29T00:00:00.000Z',
        updated_at: '2026-07-29T00:00:00.000Z',
      }],
      error: null,
    }));

    const res = await syncToSupabase(db);
    expect(res.ventas).toBe(1);
    const del = db._queries.find(q => q.includes('SET deleted_at'));
    expect(del).toBeDefined();
  });

  it('no reintenta gasto cuya foto local no se pudo subir', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM gastos')) {
        return [{ id: 'g1', user_id: 'u1', concepto: 'Luz', monto: 100, fecha: '2026-07-31', foto: 'file:///local/foto.jpg', created_at: '2026-07-31T00:00:00.000Z' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ error: null, data: null });

    const res = await syncToSupabase(db);
    expect(res.gastos).toBe(0);
    const syncMarks = db._queries.filter(q => q.includes('UPDATE gastos SET sincronizado = 1'));
    expect(syncMarks.length).toBe(0);
  });
});

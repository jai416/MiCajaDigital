import { syncToSupabase } from '../src/services/sync';

const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockGetUser = jest.fn();
const mockSelect = jest.fn();
const mockStorageUpload = jest.fn();

jest.mock('../src/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    storage: {
      from: () => ({
        upload: (path: string, body: any, opts: any) => mockStorageUpload(path, body, opts),
        getPublicUrl: (path: string) => ({ data: { publicUrl: 'https://cdn/foo.jpg' } }),
      }),
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

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('Zm9v'),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
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
    mockStorageUpload.mockResolvedValue({ data: { path: 'gastos/u1/1.jpg' }, error: null });
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

  it('aplica un borrado remoto de venta al local si remote es más nuevo', async () => {
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

  it('NO aplica un borrado remoto si el local es más nuevo (last-write-wins)', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM ventas')) return { updated_at: '2026-07-30T00:00:00.000Z' };
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
    expect(res.ventas).toBe(0);
    const del = db._queries.find(q => q.includes('SET deleted_at'));
    expect(del).toBeUndefined();
  });

  it('NO aplica un borrado remoto de catálogo si el local es más nuevo', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM catalogo')) return { updated_at: '2026-07-30T00:00:00.000Z' };
      if (sql.includes('last_sync_at')) return { valor: '2026-07-01T00:00:00.000Z' };
      return null;
    });
    mockSelect.mockImplementation(async () => ({
      data: [{
        id: 'c1', user_id: 'u1', nombre: 'Pan', precio: 50, stock: 5,
        descripcion: '', codigo_barras: '', categoria: '', foto: '',
        deleted_at: '2026-07-29T00:00:00.000Z', updated_at: '2026-07-29T00:00:00.000Z',
      }],
      error: null,
    }));

    const res = await syncToSupabase(db);
    expect(res.catalogo).toBe(0);
    const del = db._queries.find(q => q.includes('SET deleted_at'));
    expect(del).toBeUndefined();
  });

  it('aplica un borrado remoto de compras si remote es más nuevo', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM compras')) return { updated_at: '2026-07-01T00:00:00.000Z' };
      if (sql.includes('last_sync_at')) return { valor: '2026-07-01T00:00:00.000Z' };
      return null;
    });
    mockSelect.mockImplementation(async () => ({
      data: [{
        id: 'co1', user_id: 'u1', producto: 'Arroz', costo_unitario: 100,
        cantidad: 2, costo_total: 200, proveedor: '', fecha: '2026-07-01',
        deleted_at: '2026-07-29T00:00:00.000Z', updated_at: '2026-07-29T00:00:00.000Z',
      }],
      error: null,
    }));

    const res = await syncToSupabase(db);
    expect(res.compras).toBe(1);
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
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'sin conexión' } });

    const res = await syncToSupabase(db);
    expect(res.gastos).toBe(0);
    const syncMarks = db._queries.filter(q => q.includes('UPDATE gastos SET sincronizado = 1'));
    expect(syncMarks.length).toBe(0);
  });

  it('sube la foto y sincroniza un producto de catálogo con foto local', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM catalogo')) {
        return [{ id: 'c1', user_id: 'u1', nombre: 'Pan', precio: 50, stock: 5, descripcion: '', codigo_barras: '', categoria: '', foto: 'file:///local/pan.jpg', created_at: '2026-07-31T00:00:00.000Z' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ error: null, data: null });
    mockStorageUpload.mockResolvedValue({ data: { path: 'catalogo/u1/pan.jpg' }, error: null });

    const res = await syncToSupabase(db);
    expect(res.catalogo).toBe(1);
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringContaining('catalogo/u1/'),
      expect.any(Uint8Array),
      expect.objectContaining({ upsert: true })
    );
    expect(mockUpsert).toHaveBeenCalledWith('catalogo', expect.objectContaining({ foto: 'https://cdn/foo.jpg' }), { onConflict: 'id' });
    const marks = db._queries.filter(q => q.includes('UPDATE catalogo SET foto ='));
    expect(marks.length).toBe(1);
  });

  it('no sincroniza producto de catálogo si la foto no se pudo subir', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM catalogo')) {
        return [{ id: 'c1', user_id: 'u1', nombre: 'Pan', precio: 50, stock: 5, descripcion: '', codigo_barras: '', categoria: '', foto: 'file:///local/pan.jpg', created_at: '2026-07-31T00:00:00.000Z' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ error: null, data: null });
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'sin conexión' } });

    const res = await syncToSupabase(db);
    expect(res.catalogo).toBe(0);
    const syncMarks = db._queries.filter(q => q.includes('UPDATE catalogo SET sincronizado = 1'));
    expect(syncMarks.length).toBe(0);
  });

  it('hace PUSH de una compra sin sincronizar', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM compras')) {
        return [{ id: 'co1', user_id: 'u1', producto: 'Arroz', costo_unitario: 100, cantidad: 2, costo_total: 200, proveedor: 'P', fecha: '2026-07-31', created_at: '2026-07-31T00:00:00.000Z' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);

    const res = await syncToSupabase(db);
    expect(res.compras).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith('compras', expect.objectContaining({ id: 'co1', costo_total: 200 }), { onConflict: 'id' });
    const marks = db._queries.filter(q => q.includes('UPDATE compras SET sincronizado = 1'));
    expect(marks.length).toBe(1);
  });

  it('aplica un update remoto de venta si remote es más nuevo (last-write-wins)', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM ventas')) return { updated_at: '2026-07-01T00:00:00.000Z' };
      if (sql.includes('last_sync_at')) return { valor: '2026-07-01T00:00:00.000Z' };
      return null;
    });
    mockSelect.mockImplementation(async () => ({
      data: [{
        id: 'v1', user_id: 'u1', producto: 'Pan (actualizado)', precio: 60, costo: 20,
        cliente: '', tipo: 'contado', tipo_pedido: 'contado', pagado: 1,
        fecha: '2026-07-01', created_at: '2026-07-01T00:00:00.000Z',
        catalogo_id: null, metodo_pago: 'efectivo', moneda: 'CUP',
        anticipo: 0, saldo_pendiente: 0, fecha_entrega: null,
        estado_pedido: 'entregado', nota: '', deleted_at: null,
        updated_at: '2026-07-30T00:00:00.000Z',
      }],
      error: null,
    }));

    const res = await syncToSupabase(db);
    expect(res.ventas).toBe(1);
    const updCall = db.runAsync.mock.calls.find((c: any[]) => c[0].includes('UPDATE ventas SET producto'));
    expect(updCall).toBeDefined();
    expect(updCall[1]).toContain('Pan (actualizado)');
    expect(updCall[0]).toContain('sincronizado=1');
  });

  it('hace PULL de un gasto nuevo remoto y lo inserta local', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockImplementation(async (sql: string, params: any[]) => {
      if (sql.includes('FROM gastos')) return null;
      if (sql.includes('last_sync_at')) return { valor: '2026-07-01T00:00:00.000Z' };
      return null;
    });
    mockSelect.mockImplementation(async () => ({
      data: [{
        id: 'g1', user_id: 'u1', concepto: 'Luz', monto: 100, fecha: '2026-07-29',
        foto: '', created_at: '2026-07-29T00:00:00.000Z', updated_at: '2026-07-29T00:00:00.000Z',
      }],
      error: null,
    }));

    const res = await syncToSupabase(db);
    expect(res.gastos).toBe(1);
    const insertCall = db.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT OR REPLACE INTO gastos'));
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toContain('Luz');
  });

  it('registra error en sync_log cuando el PULL falla', async () => {
    const db = makeDb();
    db.getAllAsync.mockResolvedValue([]);
    db.getFirstAsync.mockResolvedValue(null);
    mockSelect.mockResolvedValue({ data: null, error: { message: 'fallo de red' } });

    const res = await syncToSupabase(db);
    expect(res).toEqual({ ventas: 0, gastos: 0, catalogo: 0, compras: 0 });
    const log = db._queries.find(q => q.includes('INSERT INTO sync_log'));
    expect(log).toBeDefined();
    const idx = db._queries.indexOf(log);
    expect(db._queries[idx + 1]).toBeUndefined();
  });

  it('sube la foto y sincroniza un gasto con foto local', async () => {
    const db = makeDb();
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM gastos')) {
        return [{ id: 'g1', user_id: 'u1', concepto: 'Luz', monto: 100, fecha: '2026-07-31', foto: 'file:///local/foto.jpg', created_at: '2026-07-31T00:00:00.000Z' }];
      }
      return [];
    });
    db.getFirstAsync.mockResolvedValue(null);
    mockUpsert.mockResolvedValue({ error: null, data: null });
    mockStorageUpload.mockResolvedValue({ data: { path: 'gastos/u1/1.jpg' }, error: null });

    const res = await syncToSupabase(db);
    expect(res.gastos).toBe(1);
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringContaining('gastos/u1/'),
      expect.any(Uint8Array),
      expect.objectContaining({ upsert: true })
    );
    expect(mockUpsert).toHaveBeenCalledWith('gastos', expect.objectContaining({ foto: 'https://cdn/foo.jpg' }), { onConflict: 'id' });
    const marks = db._queries.filter(q => q.includes('UPDATE gastos SET foto ='));
    expect(marks.length).toBe(1);
  });
});

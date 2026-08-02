import { renderHook, act } from '@testing-library/react-native';
import { useCompras } from '../src/hooks/useCompras';

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

describe('useCompras', () => {
  beforeEach(() => {
    mockDb = makeDb();
  });

  it('getAll devuelve [] en error de red', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('db down'));
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      const res = await result.current.getAll();
      expect(res).toEqual([]);
    });
  });

  it('getAll aplica LIMIT por defecto cuando no se pasa limit (anti-scan completo)', async () => {
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.getAll();
    });
    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT');
  });

  it('getAll aplica LIMIT/OFFSET explícitos', async () => {
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.getAll(20, 40);
    });
    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual(['u1', 20, 40]);
  });

  it('addCompra calcula costo_total = costo_unitario * cantidad', async () => {
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.addCompra('Arroz', 120, 3, 'Proveedor A');
    });
    const insert = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO compras'));
    const params = insert[1];
    expect(params[3]).toBe(120);
    expect(params[4]).toBe(3);
    expect(params[5]).toBe(360);
    expect(params[6]).toBe('Proveedor A');
  });

  it('addCompra registra la fecha local (YYYY-MM-DD), no la UTC', async () => {
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.addCompra('Harina', 50, 2);
    });
    const insert = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO compras'));
    const params = insert[1];
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const utc = new Date().toISOString().slice(0, 10);
    expect(params[7]).toBe(local);
    if (local !== utc) {
      expect(params[7]).not.toBe(utc);
    }
  });

  it('addCompra no revienta si no hay userId (borde: sin sesión, retorna sin insertar)', async () => {
    const { getUserId } = require('../src/utils/user');
    getUserId.mockResolvedValueOnce('');
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.addCompra('X', 10, 1);
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('deleteCompra captura errores sin lanzar', async () => {
    mockDb.runAsync.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.deleteCompra('c1');
    });
    expect(mockDb.runAsync).toHaveBeenCalled();
  });

  it('deleteCompra hace borrado suave y marca sincronizado=0', async () => {
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      await result.current.deleteCompra('c1');
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('SET deleted_at'));
    expect(upd).toBeDefined();
    expect(upd[0]).toContain('sincronizado = 0');
    expect(upd[1][0]).toBeTruthy();
  });

  it('getAll excluye borradas (deleted_at IS NULL)', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 'co1' }]);
    const { result } = renderHook(() => useCompras());
    await act(async () => {
      const res = await result.current.getAll();
      expect(res).toHaveLength(1);
    });
    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('deleted_at IS NULL');
  });
});

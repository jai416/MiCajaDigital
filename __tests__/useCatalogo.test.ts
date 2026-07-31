import { renderHook, act } from '@testing-library/react-native';
import { useCatalogo } from '../src/hooks/useCatalogo';

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

describe('useCatalogo', () => {
  beforeEach(() => {
    mockDb = makeDb();
  });

  it('getAll retorna [] en error (el catch captura el rechazo)', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('db fail'));
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      const res = await result.current.getAll();
      expect(res).toEqual([]);
    });
  });

  it('getAll aplica LIMIT/OFFSET cuando se pasa limit', async () => {
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      await result.current.getAll(20, 40);
    });
    const call = mockDb.getAllAsync.mock.calls[0];
    expect(call[0]).toContain('LIMIT ? OFFSET ?');
    expect(call[1]).toEqual(['u1', 20, 40]);
  });

  it('getAll no aplica LIMIT sin parámetro', async () => {
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      await result.current.getAll();
    });
    const call = mockDb.getAllAsync.mock.calls[0];
    expect(call[0]).not.toContain('LIMIT');
    expect(call[1]).toEqual(['u1']);
  });

  it('buscar usa FTS y falla a LIKE si la consulta FTS falla', async () => {
    mockDb.getAllAsync
      .mockRejectedValueOnce(new Error('fts error'))
      .mockResolvedValueOnce([{ id: 'c1', nombre: 'Pan' }]);
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      const res = await result.current.buscar('pan');
      expect(res).toHaveLength(1);
    });
    expect(mockDb.getAllAsync.mock.calls).toHaveLength(2);
    expect(mockDb.getAllAsync.mock.calls[1][0]).toContain('LIKE ?');
  });

  it('buscarPorCodigo retorna null en error', async () => {
    mockDb.getFirstAsync.mockRejectedValue(new Error('db fail'));
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      const res = await result.current.buscarPorCodigo('123');
      expect(res).toBeNull();
    });
  });

  it('addProducto inserta y marca usuario', async () => {
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      await result.current.addProducto('Arroz', 100, 5, 'desc', 'Granos', '', '8901');
    });
    const insert = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO catalogo'));
    expect(insert).toBeDefined();
    const params = insert[1];
    expect(params[2]).toBe('Arroz');
    expect(params[3]).toBe(100);
    expect(params[4]).toBe(5);
    expect(params[7]).toBe('Granos');
    expect(params[6]).toBe('8901');
  });

  it('deductStock descuenta y marca sincronizado=0', async () => {
    mockDb.getFirstAsync.mockResolvedValue({ id: 'c1', stock: 10, nombre: 'Pan' });
    const { result } = renderHook(() => useCatalogo());
    await act(async () => {
      await result.current.deductStock('c1', 3);
    });
    const upd = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('UPDATE catalogo SET stock'));
    expect(upd).toBeDefined();
    expect(upd[1][0]).toBe(7);
    expect(upd[0]).toContain('sincronizado = 0');
  });
});

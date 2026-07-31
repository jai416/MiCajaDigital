import { renderHook, act } from '@testing-library/react-native';
import { useGastos } from '../src/hooks/useGastos';

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

describe('useGastos', () => {
  beforeEach(() => {
    mockDb = makeDb();
  });

  it('addGasto inserta con userId', async () => {
    const { result } = renderHook(() => useGastos());
    await act(async () => {
      await result.current.addGasto('Electricidad', 150, '');
    });
    const insert = mockDb.runAsync.mock.calls.find((c: any[]) => c[0].includes('INSERT INTO gastos'));
    expect(insert).toBeDefined();
    expect(insert[1][2]).toBe('Electricidad');
    expect(insert[1][3]).toBe(150);
  });

  it('addGasto lanza error si no hay usuario (borde: sin sesión)', async () => {
    const { getUserId } = require('../src/utils/user');
    getUserId.mockResolvedValueOnce('');
    const { result } = renderHook(() => useGastos());
    await expect(
      act(async () => { await result.current.addGasto('X', 10); })
    ).rejects.toThrow('Debes iniciar sesión para guardar gastos.');
  });

  it('getGastosDelDia retorna [] en error de red', async () => {
    mockDb.getAllAsync.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useGastos());
    await act(async () => {
      const res = await result.current.getGastosDelDia();
      expect(res).toEqual([]);
    });
  });

  it('getGastosTodos retorna [] si no hay userId (sin datos)', async () => {
    const { getUserId } = require('../src/utils/user');
    getUserId.mockResolvedValueOnce('');
    const { result } = renderHook(() => useGastos());
    await act(async () => {
      const res = await result.current.getGastosTodos();
      expect(res).toEqual([]);
    });
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it('getGastosEnRango aplica LIMIT y devuelve filas', async () => {
    mockDb.getAllAsync.mockResolvedValue([{ id: 'g1', concepto: 'Luz', monto: 50, fecha: '2026-07-01' }]);
    const { result } = renderHook(() => useGastos());
    await act(async () => {
      const res = await result.current.getGastosEnRango('2026-07-01', '2026-07-31');
      expect(res).toHaveLength(1);
      expect(res[0].concepto).toBe('Luz');
    });
    const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
    expect(sql).toContain('LIMIT');
  });
});

import { getUserId } from '../src/utils/user';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

function mockDb(rows: { valor: string } | null) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue(rows),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getAllAsync: jest.fn().mockResolvedValue([]),
    execAsync: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe('getUserId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna el id del usuario autenticado si existe', async () => {
    const user = { id: 'auth-123' } as any;
    const db = mockDb(null);
    expect(await getUserId(db, user)).toBe('auth-123');
    expect(db.getFirstAsync).not.toHaveBeenCalled();
  });

  it('busca en app_config si no hay usuario autenticado', async () => {
    const db = mockDb({ valor: 'db-456' });
    expect(await getUserId(db, null)).toBe('db-456');
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      "SELECT valor FROM app_config WHERE clave = 'user_id'"
    );
  });

  it('cae en secure-store si no hay nada en la db', async () => {
    const db = mockDb(null);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('secure-789');
    expect(await getUserId(db, null)).toBe('secure-789');
  });

  it('retorna string vacío si no hay ninguna fuente', async () => {
    const db = mockDb(null);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await getUserId(db, null)).toBe('');
  });

  it('maneja error de secure-store retornando vacío', async () => {
    const db = mockDb(null);
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('boom'));
    expect(await getUserId(db, null)).toBe('');
  });
});

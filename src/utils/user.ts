import type { SQLiteDatabase } from 'expo-sqlite';
import type { User } from '@supabase/supabase-js';
import { getSecureValue, SECURE_KEYS } from './storage';

export async function getUserId(db: SQLiteDatabase, user: User | null): Promise<string> {
  try {
    if (user?.id) return user.id;
    const fromDb = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM app_config WHERE clave = 'user_id'"
    );
    if (fromDb?.valor) return fromDb.valor;
    const fromSecure = await getSecureValue(SECURE_KEYS.USER_ID);
    return fromSecure ?? '';
  } catch (e) {
    console.error('Error al obtener user_id:', e);
    return '';
  }
}

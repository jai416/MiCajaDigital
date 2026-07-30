import * as SecureStore from 'expo-secure-store';

const KEYS = {
  USER_ID: 'user_id',
  PUSH_TOKEN: 'push_token',
} as const;

export async function setSecureValue(key: string, value: string): Promise<void> {
  try { await SecureStore.setItemAsync(key, value); } catch { /* fallback */ }
}

export async function getSecureValue(key: string): Promise<string | null> {
  try { return await SecureStore.getItemAsync(key); } catch { return null; }
}

export async function removeSecureValue(key: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(key); } catch { /* ignore */ }
}

export { KEYS as SECURE_KEYS };

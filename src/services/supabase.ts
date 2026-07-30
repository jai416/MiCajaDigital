import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qmuvnfduhidadbhtmxvh.supabase.co';
const supabaseAnonKey = 'sb_publishable_wNOrRZlA_OyUBSQLW3PZ8w_5w7IpjGo';

function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  return (url: RequestInfo | URL, options?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      ...options,
      signal: options?.signal ? options.signal : controller.signal,
    }).finally(() => clearTimeout(timer));
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: createFetchWithTimeout(15000),
  },
});

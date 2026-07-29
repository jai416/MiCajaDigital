import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qmuvnfduhidadbhtmxvh.supabase.co';
const supabaseAnonKey = 'sb_publishable_wNOrRZlA_OyUBSQLW3PZ8w_5w7IpjGo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Cliente público (usado donde no se necesita RLS bypass)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (usa service_role key para BYPASEAR RLS)
// ⚠️ REQUISITO: copiar la service_role key desde Supabase Dashboard → Settings → API.
// Si falta en producción, el panel NO arranca: es mejor fallar fuerte que operar
// silenciosamente con permisos anónimos (RLS devolvería 0 filas y el admin
// creería que no hay negocios).
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.NODE_ENV === 'production' && !supabaseServiceKey) {
  throw new Error(
    'Falta SUPABASE_SERVICE_ROLE_KEY en producción. Copia la service_role key en .env.local.'
  );
}

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

/// Asegura que el bucket de fotos exista (server-side). El esquema SQL no crea
/// buckets; este helper lo crea si falta para que la app nunca falle al subir
/// imágenes. Idempotente.
export async function ensureFotosBucketExists(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      return { ok: false, error: listError.message };
    }
    const existe = (buckets ?? []).some((b) => b.name === 'fotos');
    if (existe) return { ok: true };
    const { error: createError } = await supabaseAdmin.storage.createBucket('fotos', {
      public: false,
    });
    if (createError) {
      return { ok: false, error: createError.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    };
  }
}

/// Asegura que el bucket público "config" exista (para version.json de OTA check).
export async function ensureConfigBucketExists(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      return { ok: false, error: listError.message };
    }
    const existe = (buckets ?? []).some((b) => b.name === 'config');
    if (existe) return { ok: true };
    const { error: createError } = await supabaseAdmin.storage.createBucket('config', {
      public: true,
    });
    if (createError) {
      return { ok: false, error: createError.message };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    };
  }
}

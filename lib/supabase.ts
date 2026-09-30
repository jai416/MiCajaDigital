import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────────────────────────────────
// Lazy init: los clientes se crean la PRIMERA VEZ que se usan, no al importar
// el módulo. Obligatorio para que `next build` no falle en la fase
// "Collecting page data" cuando las env vars no están en build time
// (caso típico de Render / CI sin env dummies).
//
// Antes el módulo hacía createClient() + un throw en producción a nivel de
// módulo → el build explotaba con "supabaseUrl is required" aunque el runtime
// tuviera las vars. Ahora nada se ejecuta hasta el primer acceso real.
// ──────────────────────────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Configúralas en .env.local o en el dashboard del hosting.'
    );
  }
  _supabase = createClient(url, key);
  return _supabase;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. ' +
        'La service_role key es OBLIGATORIA para el panel admin: sin ella ' +
        'no se puede saltar RLS y las operaciones devolverían 0 filas.'
    );
  }
  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}

// ──────────────────────────────────────────────────────────────────────────
// Proxies: mantienen la API `supabaseAdmin.from(...)` sin cambiar ni una línea
// del resto del código. El primer acceso a cualquier propiedad dispara la
// creación del cliente real.
// ──────────────────────────────────────────────────────────────────────────

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Buckets (idempotentes). Se mantienen las firmas originales; ahora usan
// getSupabaseAdmin() explícitamente.
// ──────────────────────────────────────────────────────────────────────────

/// Bucket público `apk` con los binarios de actualización OTA.
///
/// Se verifica desde /api/health porque el 30-09 la OTA falló en producción
/// durante días: la `url` de `version.json` apuntaba a la página de una tienda
/// de apps en vez de al APK, y el health check miraba `fotos` y `config` pero
/// **no** el bucket donde vive el binario. Si el APK no está o no es público,
/// las clientas ven el diálogo de actualizar y no se les instala nada.
export async function ensureApkBucketExists(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const admin = getSupabaseAdmin();
    const { data: buckets, error: listError } = await admin.storage.listBuckets();
    if (listError) return { ok: false, error: listError.message };
    const bucket = (buckets ?? []).find((b) => b.name === 'apk');
    if (!bucket) {
      const { error: createError } = await admin.storage.createBucket('apk', {
        public: true,
      });
      if (createError) return { ok: false, error: createError.message };
      return { ok: true };
    }
    // Existe pero privado: el APK dejaría de descargarse sin login.
    if (bucket.public !== true) {
      const { error: updError } = await admin.storage.updateBucket('apk', {
        public: true,
      });
      if (updError) {
        return { ok: false, error: `Bucket apk no es público: ${updError.message}` };
      }
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    };
  }
}

/// Asegura que el bucket privado "fotos" exista (URLs firmadas desde la app).
export async function ensureFotosBucketExists(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const admin = getSupabaseAdmin();
    const { data: buckets, error: listError } = await admin.storage.listBuckets();
    if (listError) return { ok: false, error: listError.message };
    const existe = (buckets ?? []).some((b) => b.name === 'fotos');
    if (existe) return { ok: true };
    const { error: createError } = await admin.storage.createBucket('fotos', {
      public: false,
    });
    if (createError) return { ok: false, error: createError.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    };
  }
}

/// Asegura que el bucket público "config" exista (para version.json de OTA).
export async function ensureConfigBucketExists(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const admin = getSupabaseAdmin();
    const { data: buckets, error: listError } = await admin.storage.listBuckets();
    if (listError) return { ok: false, error: listError.message };
    const existe = (buckets ?? []).some((b) => b.name === 'config');
    if (existe) return { ok: true };
    const { error: createError } = await admin.storage.createBucket('config', {
      public: true,
    });
    if (createError) return { ok: false, error: createError.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error desconocido',
    };
  }
}

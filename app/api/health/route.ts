import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const autenticado = await getSession();
  const checks: Record<string, { ok: boolean; detalle?: string }> = {};

  // HASH o contraseña: se exige una de las dos (el hash es lo recomendado).
  const envOk = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.ADMIN_EMAIL &&
      (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD)
  );
  checks.env = {
    ok: envOk,
    detalle: !envOk
      ? 'Faltan variables de entorno en admin/.env.local'
      : 'Todas las variables de entorno presentes',
  };

  // El secreto de firma de sesión es obligatorio (≥32 caracteres): sin él,
  // lib/session.ts lanza al primer uso en vez de firmar con una clave débil.
  const secretoSesionOk =
    !!process.env.ADMIN_SESSION_SECRET &&
    process.env.ADMIN_SESSION_SECRET.length >= 32;
  checks.sesion = {
    ok: secretoSesionOk,
    detalle: secretoSesionOk
      ? 'Secreto de sesión configurado'
      : 'ADMIN_SESSION_SECRET falta o es corto (<32). Genera uno con: openssl rand -hex 64',
  };

  try {
    const { data, error } = await supabaseAdmin
      .from('negocios')
      .select('id')
      .limit(1);

    checks.supabase = {
      ok: !error,
      detalle: error ? error.message : 'Conexión a Supabase OK (tabla negocios accesible)',
    };
  } catch (e) {
    checks.supabase = {
      ok: false,
      detalle: e instanceof Error ? e.message : 'Error de red al conectar con Supabase',
    };
  }

  // Bucket de fotos y detalles SOLO para sesiones autenticadas. Sin login,
  // /api/health responde con el mínimo (sin filtrar infraestructura) y sin
  // efectos secundarios (no intenta crear buckets nadie no autorizado).
  if (autenticado) {
    try {
      const { ensureFotosBucketExists, ensureConfigBucketExists } = await import('@/lib/supabase');
      const bucket = await ensureFotosBucketExists();
      checks.storage = bucket.ok
        ? { ok: true, detalle: 'Bucket fotos listo' }
        : { ok: false, detalle: bucket.error ?? 'Bucket fotos no disponible' };

      const configBucket = await ensureConfigBucketExists();
      checks.storageConfig = configBucket.ok
        ? { ok: true, detalle: 'Bucket config (OTA) listo' }
        : { ok: false, detalle: configBucket.error ?? 'Bucket config no disponible' };
    } catch (e) {
      checks.storage = {
        ok: false,
        detalle: e instanceof Error ? e.message : 'Error al verificar storage',
      };
    }

    // Verificar que version.json esté actualizado en el bucket config.
    try {
      const { data: vFile, error: vErr } = await supabaseAdmin.storage
        .from('config')
        .download('version.json');
      if (vErr) {
        checks.versionJson = { ok: false, detalle: `No se pudo leer config/version.json: ${vErr.message}` };
      } else {
        const texto = await vFile.text();
        const remoto = JSON.parse(texto);
        const ESPERADA = require('../../package.json').version || '1.3.0';
        const codigoOk = remoto.version === ESPERADA;
        checks.versionJson = {
          ok: codigoOk,
          detalle: codigoOk
            ? `version.json remoto: v${remoto.version}+${remoto.versionCode} (esperado v${ESPERADA})`
            : `⚠️ version.json remoto es v${remoto.version}, esperado v${ESPERADA}. Sube docs/version.json al bucket config.`,
        };
      }
    } catch (e) {
      checks.versionJson = {
        ok: false,
        detalle: e instanceof Error ? e.message : 'Error al verificar version.json',
      };
    }

    const healthy = Object.values(checks).every((c) => c.ok);
    return NextResponse.json(
      {
        status: healthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        checks,
      },
      { status: healthy ? 200 : 500 }
    );
  }

  // Respuesta pública mínima: solo el estado agregado, sin detalles.
  const publicoOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      status: publicoOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    },
    { status: publicoOk ? 200 : 500 }
  );
}

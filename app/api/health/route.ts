import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; detalle?: string }> = {};

  const envOk = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD
  );
  checks.env = {
    ok: envOk,
    detalle: !envOk
      ? 'Faltan variables de entorno en admin/.env.local'
      : 'Todas las variables de entorno presentes',
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

  // Bucket de fotos: se crea automáticamente si falta (idempotente).
  try {
    const { ensureFotosBucketExists } = await import('@/lib/supabase');
    const bucket = await ensureFotosBucketExists();
    checks.storage = bucket.ok
      ? { ok: true, detalle: 'Bucket fotos listo' }
      : { ok: false, detalle: bucket.error ?? 'Bucket fotos no disponible' };
  } catch (e) {
    checks.storage = {
      ok: false,
      detalle: e instanceof Error ? e.message : 'Error al verificar storage',
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

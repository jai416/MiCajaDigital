import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const checks: Record<string, { ok: boolean; detalle?: string }> = {};

  checks.env = {
    ok: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.ADMIN_EMAIL &&
        process.env.ADMIN_PASSWORD
    ),
    detalle: !checks.env
      ? 'Faltan variables de entorno en admin/.env.local'
      : 'Todas las variables de entorno presentes',
  };

  const { data, error } = await supabaseAdmin
    .from('negocios')
    .select('id')
    .limit(1);

  checks.supabase = {
    ok: !error,
    detalle: error ? error.message : 'Conexión a Supabase OK (tabla negocios accesible)',
  };

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

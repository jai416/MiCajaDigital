import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const autenticado = await getSession();
  const checks: Record<string, { ok: boolean; detalle?: string }> = {};

  // Debe coincidir con lo que acepta lib/auth.ts: hash scrypt O contraseña en
  // plano. Antes exigía el hash en producción y, al migrar a texto plano, el
  // health check-reportaba "faltan variables" con todas ellas puestas.
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

  // El webhook del bot es fail-CLOSED sin CRON_SECRET (misma política que el
  // cron). Sin él, el bot queda inoperativo aunque el panel sea "verde":
  // conviene que se note en el health en vez de descubrirlo enviando /ping.
  const telegramOk = Boolean(
    process.env.TELEGRAM_PROXY_URL && process.env.TELEGRAM_BOT_TOKEN
  );
  const webhookOk = Boolean(process.env.CRON_SECRET && process.env.TELEGRAM_CHAT_ID);
  checks.telegram = {
    ok: telegramOk && webhookOk,
    detalle:
      !telegramOk || !webhookOk
        ? 'Bot Telegram incompleto: requiere TELEGRAM_PROXY_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID y CRON_SECRET'
        : 'Bot Telegram configurado (notificaciones + comandos)',
  };

  try {
    const { data, error } = await supabaseAdmin
      .from('negocios')
      .select('id')
      .limit(1);

    checks.supabase = {
      ok: !error,
      detalle: error ? 'Error de conexión Supabase (detalle no expuesto)' : 'Conexión a Supabase OK (tabla negocios accesible)',
    };
  } catch (e) {
    // Detalle real solo a logs del servidor; la respuesta no expone el
    // mensaje crudo (mismo patrón sanitizado que el resto de /api/*).
    console.error('health/supabase:', e);
    checks.supabase = {
      ok: false,
      detalle: 'Error de red al conectar con Supabase (detalle en logs del servidor)',
    };
  }

  // Bucket de fotos y detalles SOLO para sesiones autenticadas. Sin login,
  // /api/health responde con el mínimo (sin filtrar infraestructura) y sin
  // efectos secundarios (no intenta crear buckets nadie no autorizado).
  if (autenticado) {
    try {
      const { ensureFotosBucketExists, ensureConfigBucketExists, ensureApkBucketExists } =
        await import('@/lib/supabase');
      const bucket = await ensureFotosBucketExists();
      checks.storage = bucket.ok
        ? { ok: true, detalle: 'Bucket fotos listo' }
        : { ok: false, detalle: bucket.error ?? 'Bucket fotos no disponible' };

      const configBucket = await ensureConfigBucketExists();
      checks.storageConfig = configBucket.ok
        ? { ok: true, detalle: 'Bucket config (OTA) listo' }
        : { ok: false, detalle: configBucket.error ?? 'Bucket config no disponible' };

      // El bucket `apk` es donde vive el binario de actualización. No se
      // comprobaba y por eso la OTA pudo romperse en producción sin que nada
      // lo delatara (la url apuntaba a una página web y no a un APK).
      const apkBucket = await ensureApkBucketExists();
      checks.storageApk = apkBucket.ok
        ? { ok: true, detalle: 'Bucket apk (binarios OTA) listo y público' }
        : { ok: false, detalle: apkBucket.error ?? 'Bucket apk no disponible' };
    } catch (e) {
      console.error('health/storage:', e);
      checks.storage = {
        ok: false,
        detalle: 'Error al verificar storage (detalle no expuesto)',
      };
    }

    // Verificar que version.json esté actualizado en el bucket config.
    try {
      const { data: vFile, error: vErr } = await supabaseAdmin.storage
        .from('config')
        .download('version.json');
      if (vErr) {
        checks.versionJson = { ok: false, detalle: 'No se pudo leer config/version.json (detalle no expuesto)' };
      } else {
        const texto = await vFile.text();
        let remoto: { version?: unknown; versionCode?: unknown; url?: unknown } | null = null;
        try {
          remoto = JSON.parse(texto);
        } catch {
          checks.versionJson = {
            ok: false,
            detalle: 'config/version.json NO es JSON válido (¿el bucket devuelve HTML?)',
          };
        }

        // Lo que importa para la OTA es que la url apunte al APK, no que
        // coincida con la copia local: `docs/version.json` no está en el
        // repositorio del panel (solo se commitea `admin/`), así que en
        // Render `getAppVersion()` cae a un valor fijo y la comparación
        // siempre discrepaba: era un fallo permanente del health check.
        const datos = remoto ?? {};
        const url = typeof datos.url === 'string' ? datos.url : '';
        const version = typeof datos.version === 'string' ? datos.version : '';
        const code = Number(datos.versionCode);

        const problemas: string[] = [];
        if (!version) problemas.push('falta "version"');
        if (!Number.isFinite(code) || code <= 0) problemas.push('falta "versionCode"');
        if (!url) problemas.push('falta "url"');
        else {
          if (!url.endsWith('.apk')) problemas.push('la url NO apunta a un .apk');
          if (/\.html?($|\?)/i.test(url)) problemas.push('la url parece una página web');
          if (/apkpure|apkcomb|apkmonk|apkmirror/i.test(url)) {
            problemas.push('la url apunta a una página de tienda de apps');
          }
        }

        checks.versionJson = problemas.length
          ? {
              ok: false,
              detalle: `config/version.json inválido (${problemas.join('; ')})`,
            }
          : {
              ok: true,
              detalle: `version.json remoto: v${version}+${code} -> ${url.split('/').pop()}`,
            };
      }
    } catch (e) {
      console.error('health/version.json:', e);
      checks.versionJson = {
        ok: false,
        detalle: 'Error al verificar version.json (detalle no expuesto)',
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

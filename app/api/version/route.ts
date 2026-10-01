import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { getAppVersion, getVersion, getVersionCode } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const version = getAppVersion();
    const versionCode = getVersionCode();

    // Se devuelve el contenido de config/version.json tal cual (versión, url,
    // mensaje y "cambios"), con el env var como overrides. Antes el mensaje se
    // fabricaba aquí y la url tenía un 1.3.4 escrito a mano.
    const publicada = getVersion();
    const versionData = {
      version,
      versionCode,
      url: process.env.APK_DOWNLOAD_URL || publicada.url,
      mensaje: publicada.mensaje || `Mi Caja Digital ${version}`,
      cambios: publicada.cambios ?? [],
    };

    const { error } = await supabaseAdmin
      .storage
      .from('config')
      .upload('version.json', JSON.stringify(versionData, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) return NextResponse.json({ error: 'Error al subir version.json' }, { status: 500 });

    return NextResponse.json({ ok: true, version, versionCode });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

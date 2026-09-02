import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const s = await getSession();
    if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const version = require('../../../../package.json').version || '0.0.0';
    const versionCode = parseInt(process.env.APP_VERSION_CODE || '2018', 10);

    const versionData = {
      version,
      versionCode,
      message: `Mi Caja Digital ${version}`,
      downloadUrl: process.env.APK_DOWNLOAD_URL || '',
      minVersion: 1,
    };

    const { error } = await supabaseAdmin
      .storage
      .from('config')
      .upload('version.json', JSON.stringify(versionData, null, 2), {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, version, versionCode });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 }
    );
  }
}

import { readFileSync } from 'fs';
import { join } from 'path';

// Fuente de verdad: docs/version.json (raíz del repo Flutter).
// Se lee en runtime (server-side) para que NUNCA haya drift entre el panel y la app.
// Si el archivo no existe, cae a process.env con fallback seguro.
interface VersionData {
  version: string;
  versionCode: number;
  url: string;
  mensaje: string;
}

let _cache: VersionData | null = null;

export function getVersion(): VersionData {
  if (_cache) return _cache;
  try {
    const ruta = join(process.cwd(), '..', 'docs', 'version.json');
    const raw = readFileSync(ruta, 'utf-8');
    _cache = JSON.parse(raw);
    return _cache!;
  } catch {
    // Fallback si docs/version.json no es accesible (Vercel, CI, etc.)
    _cache = {
      version: process.env.APP_VERSION || '1.3.4',
      versionCode: Number(process.env.APP_VERSION_CODE || '2022'),
      url: process.env.APK_DOWNLOAD_URL || 'https://apkpure.com/p/com.tunegocio.micajadigital.app',
      mensaje: `Mi Caja Digital ${process.env.APP_VERSION || '1.3.4'}`,
    };
    return _cache!;
  }
}

export function getAppVersion(): string {
  return getVersion().version;
}

export function getVersionCode(): number {
  return getVersion().versionCode;
}

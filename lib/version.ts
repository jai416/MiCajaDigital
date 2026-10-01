import { readFileSync } from 'fs';
import { join } from 'path';

// Fuente de verdad: docs/version.json (raíz del repo Flutter), que es lo que
// consume la app en el teléfono. El panel mantiene una copia idéntica en
// `admin/config/version.json` porque su repo (lo único que se commitea) es
// `admin/`: sin esa copia, en Render no había nada que leer y se caía a un
// valor fijo que se quedaba viejo en silencio (el 30-09 anunciaba 1.3.4 con
// la app ya en 1.3.5).
//
// Regla de publicación: NO editar estos números a mano. Se cambian en
// docs/version.json y `./scripts/sync_version.sh` los propaga a todas partes.
export interface VersionData {
  version: string;
  versionCode: number;
  url: string;
  mensaje: string;
  cambios?: string[];
}

let _cache: VersionData | null = null;

/// Rutas candidatas, en orden: la copia del panel y la del repo raíz (útil en
/// desarrollo, cuando se ejecuta desde el repo completo).
const _rutas = (): string[] => [
  join(process.cwd(), 'config', 'version.json'),
  join(process.cwd(), '..', 'docs', 'version.json'),
];

export function getVersion(): VersionData {
  if (_cache) return _cache;
  for (const ruta of _rutas()) {
    try {
      const raw = readFileSync(ruta, 'utf-8');
      const d = JSON.parse(raw) as VersionData;
      if (d?.version && d?.url) {
        _cache = d;
        return _cache;
      }
    } catch {
      // siguiente candidata
    }
  }
  // Último recurso: variables de entorno. Sin ellas, se devuelve un valor
  // marcado como desconocido en vez de inventar una versión (un número
  // equivocado en el panel es peor que ninguno: fue lo que.delayó la OTA).
  _cache = {
    version: process.env.APP_VERSION || 'desconocida',
    versionCode: Number(process.env.APP_VERSION_CODE || '0'),
    url: process.env.APK_DOWNLOAD_URL || '',
    mensaje: 'No se pudo leer config/version.json en el servidor.',
  };
  return _cache;
}

export function getAppVersion(): string {
  return getVersion().version;
}

export function getVersionCode(): number {
  return getVersion().versionCode;
}

/// Ruta del fichero del que se leyó la versión (para diagnosticar).
export function versionSource(): string {
  for (const ruta of _rutas()) {
    try {
      readFileSync(ruta, 'utf-8');
      return ruta;
    } catch {
      // siguiente
    }
  }
  return 'variables de entorno (sin config/version.json)';
}

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

const LOG_DIR = FileSystem.documentDirectory + 'logs/';
const LOG_FILE = LOG_DIR + 'app.log';
const MAX_LOG_CHARS = 200000;

export async function logError(contexto: string, error: unknown, detalle?: string): Promise<void> {
  const msg = `[${new Date().toISOString()}] [ERROR] [${contexto}] ${error instanceof Error ? error.message : String(error)}${detalle ? ` | ${detalle}` : ''}`;
  await escribir(msg);
}

export async function logInfo(contexto: string, mensaje: string): Promise<void> {
  const msg = `[${new Date().toISOString()}] [INFO] [${contexto}] ${mensaje}`;
  await escribir(msg);
}

async function escribir(linea: string): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true }).catch(() => undefined);
    const prev = await FileSystem.readAsStringAsync(LOG_FILE).catch(() => '');
    const nuevo = prev + linea + '\n';
    const recortado = nuevo.length > MAX_LOG_CHARS ? nuevo.slice(nuevo.length - MAX_LOG_CHARS) : nuevo;
    await FileSystem.writeAsStringAsync(LOG_FILE, recortado);
  } catch {}
}

export async function leerLogs(): Promise<string> {
  return FileSystem.readAsStringAsync(LOG_FILE).catch(() => '');
}

export async function borrarLogs(): Promise<void> {
  await FileSystem.deleteAsync(LOG_FILE, { idempotent: true }).catch(() => undefined);
}

export async function enviarLogsWhatsApp(): Promise<void> {
  const contenido = await leerLogs();
  if (!contenido.trim()) return;
  try {
    if (contenido.length < 1500 && (await Linking.canOpenURL('https://wa.me'))) {
      await Linking.openURL('https://wa.me/?text=' + encodeURIComponent(contenido));
      return;
    }
  } catch {}
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(LOG_FILE, { mimeType: 'text/plain', dialogTitle: 'Enviar logs de errores' });
  }
}

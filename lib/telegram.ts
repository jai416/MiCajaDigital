/**
 * Notificaciones vía Telegram — envía mensajes al admin a través de un
 * Cloudflare Worker proxy (Cuba bloquea api.telegram.org directamente).
 *
 * Fail-safe: si falta cualquier env var o el fetch falla, nunca propaga la
 * excepción. La notificación es best-effort — el panel NUNCA se rompe por esto.
 */

const TELEGRAM_PROXY_URL = process.env.TELEGRAM_PROXY_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/** Botón de teclado inline de Telegram. */
export interface BotonTelegram {
  text: string;
  /** callback_data: el bot vuelve a recibirlo como callback_query. */
  callback_data?: string;
  url?: string;
}

export type TecladoTelegram = { inline_keyboard: BotonTelegram[][] };

/**
 * Escapa caracteres especiales de HTML para Telegram.
 * Telegram solo soporta <b>, <i>, <code>, <a> — cualquier otro carácter
 * peligroso debe escaparse para evitar inyección de formato.
 */
export function escaparTelegram(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Envía un mensaje de Telegram al admin del panel.
 * Si falta cualquier env var o el fetch falla, retorna en silencio.
 *
 * @param mensaje - Texto plano (o con HTML limitado de Telegram: b, i, code, a)
 * @param opciones - parseMode: 'HTML' (default) o 'MarkdownV2'
 */
export async function notificarTelegram(
  mensaje: string,
  opciones?: { parseMode?: 'HTML' | 'MarkdownV2' }
): Promise<void> {
  if (!TELEGRAM_CHAT_ID) return;
  await enviarTelegram(TELEGRAM_CHAT_ID, mensaje, opciones);
}

/**
 * Envía un mensaje a un chat arbitrario (usado por el webhook de comandos
 * para responder directamente al chat que escribió).
 *
 * Devuelve `{ok, motivo}` en vez de tragarse el error, para que el webhook
 * pueda diagnosticar en la respuesta JSON por qué el usuario no ve nada
 * (env var faltante, timeout, HTTP de Telegram, etc.).
 */
export async function enviarTelegram(
  chatId: string | number,
  mensaje: string,
  opciones?: { parseMode?: 'HTML' | 'MarkdownV2'; teclado?: TecladoTelegram }
): Promise<{ ok: boolean; motivo?: string }> {
  if (!TELEGRAM_PROXY_URL || !TELEGRAM_BOT_TOKEN) {
    const faltan = [
      !TELEGRAM_PROXY_URL && 'TELEGRAM_PROXY_URL',
      !TELEGRAM_BOT_TOKEN && 'TELEGRAM_BOT_TOKEN',
    ]
      .filter(Boolean)
      .join(', ');
    return { ok: false, motivo: `faltan env vars: ${faltan}` };
  }

  const parseMode = opciones?.parseMode ?? 'HTML';
  const url = `${TELEGRAM_PROXY_URL}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: parseMode,
        // Botones: sin teclado, Telegram ignora el campo.
        ...(opciones?.teclado ? { reply_markup: opciones.teclado } : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const detalle = await res.text();
      console.error(`[telegram] HTTP ${res.status}: ${detalle}`);
      return { ok: false, motivo: `HTTP ${res.status} (proxy ${TELEGRAM_PROXY_URL.replace('https://', '')})` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[telegram] Error enviando mensaje:', e);
    const nombre = e instanceof Error ? e.name : 'error';
    return { ok: false, motivo: `fetch falló (${nombre})` };
  }
}

/**
 * Responde a un `callback_query` (pulsación de botón) para que Telegram quite
 * el spinner del botón al instante. Silencioso: es cosmético.
 */
export async function responderCallback(
  callbackId: string,
  texto?: string
): Promise<void> {
  if (!TELEGRAM_PROXY_URL || !TELEGRAM_BOT_TOKEN || !callbackId) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`${TELEGRAM_PROXY_URL}/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        texto ? { callback_query_id: callbackId, text: texto } : { callback_query_id: callbackId }
      ),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // Cosmético: si falla, el botón sigue funcionando.
  }
}

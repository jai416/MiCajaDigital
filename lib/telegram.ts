/**
 * Notificaciones vía Telegram — envía mensajes al admin a través de un
 * Cloudflare Worker proxy (Cuba bloquea api.telegram.org directamente).
 *
 * Fail-safe: si falta任何 env var o el fetch falla, nunca propaga la excepción.
 * La notificación es best-effort — el panel NUNCA se rompe por esto.
 */

const TELEGRAM_PROXY_URL = process.env.TELEGRAM_PROXY_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
  if (!TELEGRAM_PROXY_URL || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return;
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
        chat_id: TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: parseMode,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[telegram] HTTP ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    console.error('[telegram] Error enviando notificación:', e);
  }
}

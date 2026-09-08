/**
 * Global typings for the official Telegram Login Widget script
 * (https://telegram.org/js/telegram-widget.js).
 *
 * The script exposes `window.Telegram.Login` as a PLAIN OBJECT
 * (init / open / auth / widgetsOrigin) — NOT a constructor.
 * The auth callback receives the flat widget user object
 * (id, first_name, last_name, username, photo_url, auth_date, hash),
 * which the app serializes into the `initData` query string the
 * backend verifies (HMAC over "WebAppData").
 *
 * In-app (Telegram's own WebApp) the SDK instead provides
 * `window.Telegram.WebApp.initData` — a ready-made query string.
 */
interface TelegramWidgetAuthResult {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
  [key: string]: unknown
}

interface TelegramLoginApi {
  init: (options: { bot_id: number; lang?: string }, onauth: (data: TelegramWidgetAuthResult) => void) => void
  open: (onauth?: (data: TelegramWidgetAuthResult) => void) => void
  widgetsOrigin?: string
}

declare global {
  interface Window {
    Telegram?: {
      Login?: TelegramLoginApi
      WebApp?: {
        ready: () => void
        initData: string
        initDataUnsafe?: Record<string, unknown>
        user?: Record<string, unknown>
      }
    }
  }
}

export {}

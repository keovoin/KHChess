/**
 * Global typings for the official Telegram Login library
 * (https://telegram.org/js/telegram-login.js) — the OIDC-based successor
 * to the deprecated telegram-widget.js.
 *
 * The script exposes `window.Telegram.Login` as a PLAIN OBJECT
 * (init / open / auth / close) — NOT a constructor.
 *
 * Web flow: `Login.init({ client_id }, cb)` + `Login.open()` opens a popup
 * at oauth.telegram.org; the result arrives via postMessage as
 *   { id_token, user }  (id_token = OIDC JWT, RS256, must be verified
 *                        server-side against Telegram's JWKS)
 *   { error }           (e.g. 'popup_closed')
 *
 * In-app (Telegram's own WebApp) the SDK instead provides
 * `window.Telegram.WebApp.initData` — a ready-made query string, still
 * verified by the backend with the classic HMAC scheme.
 */

interface TelegramIdTokenUser {
  iss?: string
  aud?: string
  sub?: string
  iat?: number
  exp?: number
  id?: number
  name?: string
  given_name?: string
  family_name?: string
  preferred_username?: string
  picture?: string
  [key: string]: unknown
}

interface TelegramLoginSuccess {
  id_token: string
  user: TelegramIdTokenUser
  error?: never
}

interface TelegramLoginFailure {
  id_token?: never
  user?: never
  error: string
}

type TelegramLoginResult = TelegramLoginSuccess | TelegramLoginFailure

interface TelegramLoginApi {
  init: (options: { client_id: number; scope?: string[]; nonce?: string; lang?: string }, onauth?: (data: TelegramLoginResult) => void) => void
  open: (onauth?: (data: TelegramLoginResult) => void) => void
  auth: (options: { client_id: number; scope?: string[]; nonce?: string; lang?: string }, onauth?: (data: TelegramLoginResult) => void) => void
  close: () => void
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

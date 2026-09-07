/**
 * Minimal global typings for the Telegram Login Widget script
 * (https://telegram.org/js/telegram-widget.js) and the optional
 * in-app WebApp SDK (@telegram-apps/sdk-react, loaded by Telegram itself).
 */
interface TelegramLoginWidgetParams {
  bot_username: string
  request_access?: boolean
  onauth: (data: { initData: string }) => void
  extra_receive_parameters?: string[]
  onsuccess?: () => void
  onfailure?: (error?: { description?: string }) => void
  onclose?: () => void
}

interface TelegramLoginWidget {
  render: () => void
  destroy: () => void
}

declare global {
  interface Window {
    Telegram?: {
      Login: new (params: TelegramLoginWidgetParams) => TelegramLoginWidget
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

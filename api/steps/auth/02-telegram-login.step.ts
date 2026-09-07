import { User, userSchema } from '@chessarena/types/user'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { TokenData } from '../../types-api'
import { UserState } from '../states/user-state'

/**
 * Telegram login — single verification for both entry points:
 *  1. Web (browser): the @tma.js Telegram Login Widget posts its data
 *     (id, first_name, username, photo_url, auth_date, hash).
 *  2. In-app: Telegram WebApp initData (user, auth_date, hash) is validated
 *     the same way and the user object is extracted from `user`.
 *
 * Server-side verification (Telegram's documented scheme):
 *   secret_key  = HMAC_SHA256(bot_token, "WebAppData")
 *   data_string = all fields except `hash`, sorted by key, "key=value\n"…
 *   valid       = HMAC_SHA256(secret_key, data_string) === hash
 */

const TELEGRAM_MAX_AGE_SECONDS = 86_400 // 24h

const webAppUserSchema = z.object({
  id: z.number().int(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  is_premium: z.boolean().optional(),
  language_code: z.string().optional(),
  is_allow_anonymous_messages: z.boolean().optional(),
  added_to_menu: z.boolean().optional(),
  has_main_web_app: z.boolean().optional(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'TelegramLogin',
  description: 'Exchange a verified Telegram login widget / WebApp init data payload for an app access token',
  path: '/auth/telegram-login',
  method: 'POST',
  virtualSubscribes: [],
  emits: [],
  flows: ['Auth'],
  bodySchema: z.object({
    initData: z.string().min(1),
  }),

  responseSchema: {
    200: z.object({
      accessToken: z.string(),
      user: userSchema,
    }),
    400: z.object({ error: z.string() }),
    500: z.object({ error: z.string() }),
  },
}

const parseInitData = (initData: string): Record<string, string> => {
  const params: Record<string, string> = {}
  for (const pair of initData.split('&')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    try {
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '))
    } catch {
      // keep raw value if it is not percent-encoded
      params[pair.slice(0, eq)] = pair.slice(eq + 1)
    }
  }
  return params
}

const verifyTelegramPayload = (
  payload: Record<string, string>,
  botToken: string,
): { user: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string } } | null => {
  const { hash, ...rest } = payload

  if (!hash) return null

  // WebApp initData nests the user under `user` (JSON string).
  let fields = rest
  let user: { id: number; first_name: string; last_name?: string; username?: string } | undefined
  if (rest.user) {
    // In-app WebApp initData: `user` is a JSON-encoded string, auth_date is ISO.
    try {
      const parsed = webAppUserSchema.safeParse(JSON.parse(rest.user))
      if (!parsed.success) return null
      user = parsed.data
    } catch {
      return null
    }
  } else {
    // Login Widget data: flat fields, auth_date is a unix timestamp.
    const id = Number(rest.id)
    if (!Number.isInteger(id) || id <= 0 || !rest.first_name) return null
    user = {
      id,
      first_name: rest.first_name,
      last_name: rest.last_name,
      username: rest.username,
    }
  }

  // Age check (WebApp auth_date is ISO, widget auth_date is unix seconds).
  const authDateRaw = fields.auth_date ?? ''
  const authTime = /^\d{10}$/.test(authDateRaw) ? Number(authDateRaw) * 1000 : new Date(authDateRaw).getTime()
  if (Number.isNaN(authTime) || Date.now() - authTime > TELEGRAM_MAX_AGE_SECONDS * 1000) return null

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n')

  const secretKey = crypto.createHmac('sha256', botToken).update('WebAppData').digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  const a = Buffer.from(hash)
  const b = Buffer.from(expectedHash)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  return {
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: rest.photo_url,
    },
  }
}

export const handler: Handlers['TelegramLogin'] = async (req, { logger, state }) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return { status: 500, body: { error: 'Telegram login is not configured' } }
    }

    let payload: Record<string, string>
    try {
      payload = parseInitData(req.body.initData)
    } catch {
      return { status: 400, body: { error: 'Invalid Telegram data' } }
    }

    // Shape gate: must look like Telegram data (the HMAC check below is the
    // security boundary — parseInitData yields all-string values, so strict
    // zod number schemas would always reject real payloads).
    const looksLikeTelegram =
      !!payload.hash &&
      /^[a-f0-9]{64}$/.test(payload.hash) &&
      !!payload.auth_date &&
      (!!payload.id || !!payload.user)
    if (!looksLikeTelegram) {
      return { status: 400, body: { error: 'Invalid Telegram data' } }
    }

    const verified = verifyTelegramPayload(payload, botToken)
    if (!verified) {
      logger.warn('Telegram login verification failed', { hasUser: !!payload.user })
      return { status: 400, body: { error: 'Telegram verification failed' } }
    }

    const tgUser = verified.user
    const userId = `tg-${tgUser.id}`
    const name = [tgUser.last_name, tgUser.first_name].filter(Boolean).join(' ').trim()
    const username = tgUser.username ?? ''

    const user: User = {
      id: userId,
      name: name || username || 'Telegram User',
      profilePic: tgUser.photo_url ?? '',
      email: '',
    }

    const userState = new UserState(state)
    await userState.setUser(userId, user)

    const tokenData: TokenData = { sub: userId }
    const accessToken = jwt.sign(tokenData, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRATION as never })

    logger.info('Telegram login successful', { userId, username })

    return {
      status: 200,
      body: { accessToken, user },
    }
  } catch (err: unknown) {
    const error = err as { stack?: string; message?: string }
    logger.error('Telegram login failed', { error: error.message, stack: error.stack })
    return {
      status: 500,
      body: { error: 'Telegram login failed' },
    }
  }
}

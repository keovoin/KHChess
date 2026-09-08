import { User, userSchema } from '@chessarena/types/user'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { TokenData } from '../../types-api'
import { UserState } from '../states/user-state'

/**
 * Telegram login — single verification for both entry points:
 *
 *  1. Web (browser): the official Telegram Login library (telegram-login.js,
 *     OIDC) opens a popup and returns an `id_token` (JWT, RS256) signed by
 *     https://oauth.telegram.org. Verified here against Telegram's JWKS.
 *  2. In-app: Telegram WebApp initData (user, auth_date, hash) is validated
 *     with the classic HMAC scheme and the user object extracted from `user`.
 *
 * id_token verification (Telegram's documented OIDC scheme):
 *   - fetch JWKS from https://oauth.telegram.org/.well-known/jwks.json
 *   - verify RS256 signature with the matching `kid`
 *   - iss must be https://oauth.telegram.org, aud must be our client id,
 *     exp must not be in the past
 */

const TELEGRAM_MAX_AGE_SECONDS = 86_400 // 24h
const TELEGRAM_OIDC_ISSUER = 'https://oauth.telegram.org'
const TELEGRAM_JWKS_URL = 'https://oauth.telegram.org/.well-known/jwks.json'

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
  description: 'Exchange a verified Telegram OIDC id_token / WebApp init data payload for an app access token',
  path: '/auth/telegram-login',
  method: 'POST',
  virtualSubscribes: [],
  emits: [],
  flows: ['Auth'],
  bodySchema: z
    .object({
      idToken: z.string().min(1).optional(),
      initData: z.string().min(1).optional(),
    })
    .refine((b) => Boolean(b.idToken) !== Boolean(b.initData), {
      message: 'Provide exactly one of idToken or initData',
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

/* ---------------- in-app WebApp initData (HMAC) ---------------- */

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

const verifyWebAppInitData = (
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
    // Flat fields (legacy widget shape), auth_date is a unix timestamp.
    const id = Number(rest.id)
    if (!Number.isInteger(id) || id <= 0 || !rest.first_name) return null
    user = {
      id,
      first_name: rest.first_name,
      last_name: rest.last_name,
      username: rest.username,
    }
  }

  // Age check (WebApp auth_date is ISO, flat auth_date is unix seconds).
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

/* ---------------- web OIDC id_token (JWKS + RS256) ---------------- */

type JwkEntry = { n: string; e: string }
type IdTokenClaims = {
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
}

let jwkCache: Record<string, JwkEntry> | null = null

const fetchJwks = async (force = false): Promise<Record<string, JwkEntry>> => {
  if (jwkCache && !force && Object.keys(jwkCache).length > 0) return jwkCache
  const res = await fetch(TELEGRAM_JWKS_URL, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`)
  const data = (await res.json()) as { keys: Array<{ kid?: string; alg?: string; n?: string; e?: string }> }
  const next: Record<string, JwkEntry> = {}
  for (const k of data.keys) {
    if (k.alg === 'RS256' && k.kid && k.n && k.e) next[k.kid] = { n: k.n, e: k.e }
  }
  if (Object.keys(next).length === 0) throw new Error('JWKS returned no RS256 keys')
  jwkCache = next
  return next
}

const verifyTelegramIdToken = async (idToken: string, clientId: string): Promise<IdTokenClaims | null> => {
  const parts = idToken.split('.')
  if (parts.length !== 3) return null

  let header: { kid?: string; alg?: string }
  let claims: IdTokenClaims
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (header.alg !== 'RS256' || !header.kid) return null

  // Claim checks (signature still verified below).
  if (claims.iss !== TELEGRAM_OIDC_ISSUER) return null
  if (String(claims.aud) !== String(clientId)) return null
  const now = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(claims.exp) || claims.exp! < now) return null
  if (Number.isFinite(claims.iat) && claims.iat! > now + 60) return null
  if (!claims.sub) return null

  let jwks = await fetchJwks()
  if (!jwks[header.kid]) {
    // Unknown kid — keys may have rotated; refetch once.
    jwks = await fetchJwks(true)
    if (!jwks[header.kid]) return null
  }
  const jwk = jwks[header.kid]
  const publicKey = crypto.createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e },
    format: 'jwk',
  })

  const verifier = crypto.createVerify('sha256')
  verifier.update(parts[0] + '.' + parts[1], 'utf8')
  const signature = Buffer.from(parts[2], 'base64url')
  if (!verifier.verify(publicKey, signature, 'hex')) return null

  return claims
}

/* ---------------- handler ---------------- */

export const handler: Handlers['TelegramLogin'] = async (req, { logger, state }) => {
  try {
    let tgUser: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }

    if (req.body.idToken) {
      // Web (OIDC) — verify the id_token against Telegram's JWKS.
      const clientId = process.env.TELEGRAM_CLIENT_ID
      if (!clientId) {
        return { status: 500, body: { error: 'Telegram login is not configured' } }
      }
      const claims = await verifyTelegramIdToken(req.body.idToken, clientId)
      if (!claims) {
        logger.warn('Telegram id_token verification failed')
        return { status: 400, body: { error: 'Telegram verification failed' } }
      }
      const id = Number.isInteger(claims.id) ? claims.id : Number(claims.sub)
      if (!Number.isInteger(id) || id <= 0) {
        return { status: 400, body: { error: 'Telegram verification failed' } }
      }
      tgUser = {
        id,
        first_name: claims.given_name || claims.name || 'Telegram User',
        last_name: claims.family_name,
        username: claims.preferred_username,
        photo_url: claims.picture,
      }
    } else {
      // In-app WebApp initData — classic HMAC verification.
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) {
        return { status: 500, body: { error: 'Telegram login is not configured' } }
      }
      let payload: Record<string, string>
      try {
        payload = parseInitData(req.body.initData!)
      } catch {
        return { status: 400, body: { error: 'Invalid Telegram data' } }
      }

      const looksLikeTelegram =
        !!payload.hash &&
        /^[a-f0-9]{64}$/.test(payload.hash) &&
        !!payload.auth_date &&
        (!!payload.id || !!payload.user)
      if (!looksLikeTelegram) {
        return { status: 400, body: { error: 'Invalid Telegram data' } }
      }

      const verified = verifyWebAppInitData(payload, botToken)
      if (!verified) {
        logger.warn('Telegram initData verification failed', { hasUser: !!payload.user })
        return { status: 400, body: { error: 'Telegram verification failed' } }
      }
      tgUser = verified.user
    }

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

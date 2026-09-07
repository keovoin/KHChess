import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { UserState } from '../states/user-state'
import { auth } from '../middlewares/auth.middleware'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'AdminStats',
  description: 'Aggregate stats for the /admin panel (admins only)',
  path: '/admin/stats',
  method: 'GET',
  emits: [],
  flows: ['chess'],
  middleware: [auth({ required: true })],
  bodySchema: z.object({}),
  responseSchema: {
    200: z.object({
      totalUsers: z.number(),
      totalGuests: z.number(),
      totalGames: z.number(),
      liveAiGames: z.number(),
      recentGames: z.array(
        z.object({
          id: z.string(),
          status: z.string(),
          createdAt: z.string().optional(),
        }),
      ),
    }),
    403: z.object({ error: z.string() }),
  },
}

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const handler: Handlers['AdminStats'] = async (req, { logger, state, streams }) => {
  const userState = new UserState(state)
  const userId = req.tokenInfo?.sub

  // Resolve the caller's email to enforce the allowlist server-side.
  const caller = userId ? await userState.getUser(userId) : null
  const email = (caller?.email ?? '').toLowerCase()

  if (!adminEmails.includes(email)) {
    logger.warn('Admin stats denied for non-admin', { email, userId })
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const users = (await state.getGroup('user')) ?? []
  const games = (await streams.chessGame.getGroup('game')) ?? []
  const liveGames = (await streams.chessLiveAiGames.getGroup('game')) ?? []

  const recentGames = games
    .slice()
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 20)
    .map((g) => ({
      id: g.id,
      status: g.status ?? 'unknown',
      createdAt: g.createdAt,
    }))

  return {
    status: 200,
    body: {
      totalUsers: users.length,
      totalGuests: users.filter((u) => String(u.id).startsWith('guest-')).length,
      totalGames: games.length,
      liveAiGames: liveGames.length,
      recentGames,
    },
  }
}

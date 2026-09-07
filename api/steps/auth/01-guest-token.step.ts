import { User, userSchema } from '@chessarena/types/user'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { TokenData } from '../../types-api'
import { UserState } from '../states/user-state'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GuestToken',
  description: 'Issue a short-lived access token for guest (no-account) play',
  path: '/auth/guest-token',
  method: 'POST',
  virtualSubscribes: [],
  emits: [],
  flows: ['Auth'],
  bodySchema: z.object({}),

  responseSchema: {
    200: z.object({
      accessToken: z.string(),
      user: userSchema,
    }),
    500: z.object({ error: z.string() }),
  },
}

export const handler: Handlers['GuestToken'] = async (req, { logger, state }) => {
  try {
    const guestId = `guest-${randomUUID()}`

    const tokenData: TokenData = { sub: guestId, guest: true }
    const accessToken = jwt.sign(tokenData, process.env.JWT_SECRET!, { expiresIn: '7d' })

    const user: User = { id: guestId, name: 'Guest', profilePic: '', email: '' }

    // Materialize the guest in state immediately so downstream steps
    // (create-game, move, access) that resolve the user by sub keep working.
    const userState = new UserState(state)
    await userState.setUser(guestId, user)

    logger.info('Guest token issued', { guestId })

    return {
      status: 200,
      body: { accessToken, user },
    }
  } catch (err: unknown) {
    const error = err as { stack?: string; message?: string }
    logger.error('Guest token issuance failed', { error: error.message, stack: error.stack })
    return {
      status: 500,
      body: { error: 'Failed to issue guest token' },
    }
  }
}

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { setAiConfig } from '../../services/ai/ai-config'
import { auth } from '../middlewares/auth.middleware'
import { UserState } from '../states/user-state'
import { isAllowedAdmin } from './admin-emails'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'AdminUpdateAiConfig',
  description: 'Update the AI model used for "vs AI" games (admins only)',
  path: '/admin/ai-config',
  method: 'PUT',
  emits: [],
  flows: ['chess'],
  middleware: [auth({ required: true })],
  bodySchema: z.object({
    model: z.string().min(1).max(64),
  }),
  responseSchema: {
    200: z.object({
      provider: z.string(),
      model: z.string(),
    }),
    400: z.object({ error: z.string() }),
    403: z.object({ error: z.string() }),
  },
}

export const handler: Handlers['AdminUpdateAiConfig'] = async (req, { logger, state }) => {
  const userState = new UserState(state)

  if (!(await isAllowedAdmin(userState, req.tokenInfo?.sub))) {
    logger.warn('AI config update denied for non-admin', { userId: req.tokenInfo?.sub })
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const result = setAiConfig({ model: (req.body as { model: string }).model })
  if (!result.ok) {
    logger.error('AI config update rejected', { error: result.error, userId: req.tokenInfo?.sub })
    return { status: 400, body: { error: result.error } }
  }

  logger.info('AI config updated', { provider: result.config.provider, model: result.config.model })
  return { status: 200, body: { provider: result.config.provider, model: result.config.model } }
}

import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { getAiConfig } from '../../services/ai/ai-config'
import { supportedModelsByProvider } from '../../services/ai/models'
import { auth } from '../middlewares/auth.middleware'
import { UserState } from '../states/user-state'
import { isAllowedAdmin } from './admin-emails'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'AdminGetAiConfig',
  description: 'Get the configured AI model for "vs AI" games (admins only)',
  path: '/admin/ai-config',
  method: 'GET',
  emits: [],
  flows: ['chess'],
  middleware: [auth({ required: true })],
  bodySchema: z.object({}),
  responseSchema: {
    200: z.object({
      provider: z.string(),
      model: z.string(),
      supportedModels: z.array(z.string()),
    }),
    403: z.object({ error: z.string() }),
  },
}

export const handler: Handlers['AdminGetAiConfig'] = async (req, { logger, state }) => {
  const userState = new UserState(state)

  if (!(await isAllowedAdmin(userState, req.tokenInfo?.sub))) {
    logger.warn('AI config read denied for non-admin', { userId: req.tokenInfo?.sub })
    return { status: 403, body: { error: 'Forbidden' } }
  }

  const { provider, model } = getAiConfig()
  return { status: 200, body: { provider, model, supportedModels: supportedModelsByProvider[provider] } }
}

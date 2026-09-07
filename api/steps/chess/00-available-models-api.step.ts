import { AiModelsSchema } from '@chessarena/types/ai-models'
import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { getAiConfig } from '../../services/ai/ai-config'
import { supportedModelsByProvider } from '../../services/ai/models'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'AvailableModels',
  description: 'Expose all available ai models for the supported providers (OpenAI, Google Gemini, Anthropic Claude)',
  path: '/chess/models',
  method: 'GET',
  emits: [],
  virtualEmits: [
    {
      topic: 'api:create-game',
      label: 'Used to create game',
    },
  ],
  flows: ['chess'],
  bodySchema: z.object({}),
  responseSchema: {
    200: z.object({
      models: AiModelsSchema(),
      // The model admin-configured for "vs AI" games (players no longer pick).
      activeModel: z.string(),
      activeProvider: z.string(),
    }),
    404: z.object({ message: z.string() }),
    400: z.object({ message: z.string() }),
  },
}

export const handler: Handlers['AvailableModels'] = async (_, { logger }) => {
  logger.info('Received available models request')

  return {
    status: 200,
    body: {
      models: supportedModelsByProvider,
      activeModel: getAiConfig().model,
      activeProvider: getAiConfig().provider,
    },
  }
}

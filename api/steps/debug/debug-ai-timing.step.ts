import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { openai } from '../../services/ai/openai'
import { models } from '../../services/ai/models'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'DebugAiTiming',
  description: 'Diagnostic: time a raw LLM call from inside the container',
  path: '/debug/ai-timing',
  method: 'GET',
  emits: [],
  flows: ['chess'],
  bodySchema: z.object({}),
  responseSchema: {
    200: z.object({
      ms: z.number(),
      action: z
        .object({ thought: z.string(), move: z.object({ from: z.string(), to: z.string() }) })
        .optional(),
      error: z.string().optional(),
    }),
  },
}

const SCHEMA = z.object({
  thought: z.string(),
  move: z.object({
    from: z.string(),
    to: z.string(),
  }),
})

export const handler: Handlers['DebugAiTiming'] = async (_ctx, { logger }) => {
  const prompt = [
    'You are a chess engine. Reply with ONLY valid JSON.',
    'Position (FEN): rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    'It is black to move. Choose a legal move.',
  ].join('\n')

  const t0 = Date.now()
  try {
    const action = await openai({
      prompt,
      zod: SCHEMA,
      provider: 'openai',
      logger,
      model: models.openai,
    })
    return { status: 200, body: { ms: Date.now() - t0, action } }
  } catch (err) {
    return { status: 200, body: { ms: Date.now() - t0, error: String((err as Error).message).slice(0, 300) } }
  }
}

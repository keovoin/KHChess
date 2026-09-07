import { OpenAI } from 'openai'
import zodToJsonSchema from 'zod-to-json-schema'
import { models } from './models'
import { Handler } from './types'

export const openai: Handler = async ({ zod, model, logger, prompt }) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  })

  const completion = await openai.chat.completions.create({
    model: model ?? models.openai,
    messages: [{ role: 'user', content: prompt }],
    reasoning_effort: 'low',
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'chess_move', schema: zodToJsonSchema(zod) },
    },
    // vLLM-only param (not in OpenAI types): keep Qwen3 in non-thinking mode.
    // Thinking ON adds ~12s/move (1400 reasoning tokens) vs ~1.5s without.
    ...({ chat_template_kwargs: { enable_thinking: false } } as Record<string, unknown>),
  })

  logger.info('OpenAI response received', { model })

  const content = JSON.parse(completion.choices[0].message.content ?? '{}')

  return content
}

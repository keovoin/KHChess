import { ZodObject, ZodRawShape } from 'zod'
import { openai } from './openai'
import { Handler } from './types'
import { Logger } from 'motia'
import { gemini } from './gemini'
import { claude } from './claude'
import { grok } from './grok'
import { AiModelProvider } from '@chessarena/types/ai-models'

// Stockfish is the local engine — it never goes through the LLM prompt path
// (the AI player step routes engine games to getStockfishMove directly).
const stockfish: Handler = async () => {
  throw new Error('Stockfish is a local engine and does not use the LLM prompt path')
}

const providers: Record<AiModelProvider, Handler> = {
  stockfish,
  openai,
  gemini,
  claude,
  grok,
}

type MakePromptInput<T extends ZodRawShape> = {
  prompt: string
  zod: ZodObject<T>
  provider: AiModelProvider
  logger: Logger
  model: string
}

export const makePrompt = async <T extends ZodRawShape>(input: MakePromptInput<T>) => {
  const handler = providers[input.provider]

  return handler(input)
}

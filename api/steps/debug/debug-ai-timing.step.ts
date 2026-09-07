import fs from 'fs'
import path from 'path'
import mustache from 'mustache'
import { Chess } from 'chess.js'
import { ApiRouteConfig, Handlers } from 'motia'
import { z } from 'zod'
import { openai } from '../../services/ai/openai'
import { models } from '../../services/ai/models'
import { evaluateBestMoves } from '../../services/chess/evaluate-best-moves'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'DebugAiTiming',
  description: 'Diagnostic: time the full-prompt LLM call in-container',
  path: '/debug/ai-timing',
  method: 'GET',
  emits: [],
  flows: ['chess'],
  bodySchema: z.object({}),
  responseSchema: {
    200: z.object({
      ms: z.number(),
      promptChars: z.number(),
      action: z
        .object({ thought: z.string(), move: z.object({ from: z.string(), to: z.string() }) })
        .optional(),
      error: z.string().optional(),
    }),
  },
}

const SCHEMA = z.object({
  thought: z.string(),
  move: z.object({ from: z.string(), to: z.string() }),
})

export const handler: Handlers['DebugAiTiming'] = async (_ctx, { logger }) => {
  // Replicate the real AI-player prompt: black to move after 1.e4
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const chess = new Chess(fen)
  const bestMoves = evaluateBestMoves({ fen } as never)

  const template = fs.readFileSync(path.join(__dirname, '..', 'chess', '05-ai-player.mustache'), 'utf8')
  const prompt = mustache.render(
    template,
    {
      fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      fen,
      lastMove: { from: 'e2', to: 'e4' },
      inCheck: chess.isCheck(),
      player: 'black',
      validMoves: bestMoves.map((m) => ({ move: { from: m.from, to: m.to }, score: m.score })),
    },
    {},
    { escape: (v: string) => v },
  )

  const t0 = Date.now()
  try {
    const action = await openai({ prompt, zod: SCHEMA, provider: 'openai', logger, model: models.openai })
    return { status: 200, body: { ms: Date.now() - t0, promptChars: prompt.length, action } }
  } catch (err) {
    return { status: 200, body: { ms: Date.now() - t0, promptChars: prompt.length, error: String((err as Error).message).slice(0, 300) } }
  }
}

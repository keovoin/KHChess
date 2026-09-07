import { FlowContextStateStreams, Logger } from 'motia'
import { createGameId } from './create-game-id'
import { Game } from '@chessarena/types/game'
import { AiModelProvider } from '@chessarena/types/ai-models'
import { ensureAiConfigLoaded, resolveAiModel } from '../ai/ai-config'
import { models } from '../ai/models'
import { isAiGame } from './utils'
import { User } from '@chessarena/types/user'
import { LiveAiGames } from '@chessarena/types/live-ai-games'
import { persistGame, persistLiveAiGame } from '../supabase/persistence'

export const createGame = async (
  players: Game['players'],
  streams: FlowContextStateStreams,
  logger: Logger,
  user?: User,
): Promise<Game> => {
  const gameId = await createGameId({ streams, logger })

  // After a redeploy the in-memory AI config resets to defaults — restore the
  // admin's chosen model from Supabase before we resolve models (one-time read
  // per process; no-op once loaded).
  await ensureAiConfigLoaded()

  // Fill in the resolved model for AI seats so the stored game is
  // self-consistent (AI step + leaderboard both read the concrete model).
  // Players pick only "vs AI"; the model comes from the admin AI config.
  const white = {
    ...players.white,
    model: players.white.ai ? resolveAiModel(players.white.ai, players.white.model) : players.white.model,
    userId: players.white.ai ? undefined : user?.id,
  }
  const black = {
    ...players.black,
    model: players.black.ai ? resolveAiModel(players.black.ai, players.black.model) : players.black.model,
    userId: players.black.ai,
  }

  const game = await streams.chessGame.set('game', gameId, {
    id: gameId,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'white',
    status: 'pending',
    players: { white, black },
    check: false,
  })

  // Durable copy (fire-and-forget; never blocks the create response).
  persistGame(game)

  if (isAiGame(game) && white.ai && black.ai) {
    const whiteAi: AiModelProvider = white.ai
    const blackAi: AiModelProvider = black.ai
    const live: LiveAiGames = {
      id: gameId,
      createdAt: new Date().toISOString(),
      gameId,
      players: {
        white: { provider: whiteAi, model: white.model ?? models[whiteAi] },
        black: { provider: blackAi, model: black.model ?? models[blackAi] },
      },
    }
    await streams.chessLiveAiGames.set('game', gameId, live)
    persistLiveAiGame(gameId, live)
  }

  return game
}

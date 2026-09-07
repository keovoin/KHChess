import { FlowContextStateStreams, Logger } from 'motia'
import { createGameId } from './create-game-id'
import { Game } from '@chessarena/types/game'
import { resolveAiModel } from '../ai/ai-config'
import { isAiGame } from './utils'
import { User } from '@chessarena/types/user'

export const createGame = async (
  players: Game['players'],
  streams: FlowContextStateStreams,
  logger: Logger,
  user?: User,
): Promise<Game> => {
  const gameId = await createGameId({ streams, logger })

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

  if (isAiGame(game) && white.ai && black.ai) {
    await streams.chessLiveAiGames.set('game', gameId, {
      id: gameId,
      createdAt: new Date().toISOString(),
      gameId,
      players: {
        white: { provider: white.ai, model: white.model },
        black: { provider: black.ai, model: black.model },
      },
    })
  }

  return game
}

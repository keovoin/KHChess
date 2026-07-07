import type { Game, Player } from '@chessarena/types/game'

export type Players = {
  white: Player
  black: Player
}

export type GameRole = 'white' | 'black' | 'spectator' | 'root'

export type GameWithRole = Game & {
  role: GameRole
  username: string
  passwords?: { root: string; white: string; black: string }
}

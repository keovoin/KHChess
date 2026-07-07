import { apiClient } from './auth/api-client'

type Args = {
  gameId: string
}

export type MovePayload = {
  from: string
  to: string
  promote?: 'queen' | 'rook' | 'bishop' | 'knight'
}

export const useMove = ({ gameId }: Args) => {
  const move = async (payload: MovePayload) => {
    await apiClient.post(`/chess/game/${gameId}/move`, payload)
  }

  return move
}

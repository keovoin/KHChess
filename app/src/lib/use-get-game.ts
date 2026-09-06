import { useCallback, useEffect, useState } from 'react'
import { apiClient } from './auth/api-client'
import { useAuth } from './auth/use-auth'
import type { GameWithRole } from './types'
import { useStreamEventHandler } from '@motiadev/stream-client-react'
import type { StreamSubscription } from '@motiadev/stream-client-browser'
import type { PublicUser } from '@chessarena/types/user'

type AccessRequest = {
  user: PublicUser
}

export const useGetGame = (gameId: string, event: StreamSubscription<unknown, unknown> | null) => {
  const { user } = useAuth()
  const [game, setGame] = useState<GameWithRole | undefined>()
  const [accessRequest, setAccessRequest] = useState<AccessRequest[]>([])

  const getGame = useCallback(async (gameId: string) => {
    const data = await apiClient.get<GameWithRole>(`/chess/game/${gameId}`)
    setGame(data)
    // seed pending access requests persisted on the game
    setAccessRequest((data.pendingAccessRequests ?? []).map((r) => ({ user: r.user })))
  }, [])
  const onCancel = (userId: string) => {
    setAccessRequest((prev) => prev.filter((request) => request.user.id !== userId))
  }

  const refetch = useCallback(() => {
    getGame(gameId).catch(() => void 0)
  }, [gameId, getGame])

  useEffect(refetch, [refetch])

  // keep the owner's request list in sync with the persisted game state
  useEffect(() => {
    if (!game) return
    const blackAssigned = !!game.players.black.userId || !!game.players.black.ai
    const pending = blackAssigned
      ? []
      : (game.pendingAccessRequests ?? []).map((r) => ({ user: r.user }))
    setAccessRequest((prev) =>
      JSON.stringify(prev) === JSON.stringify(pending) ? prev : pending,
    )
  }, [game])

  // capture on-access-requested event
  useStreamEventHandler(
    {
      event,
      type: 'on-access-requested',
      listener: (event) =>
        setAccessRequest((prev) =>
          prev.some((r) => r.user.id === event.user?.id) ? prev : [...prev, event],
        ),
    },
    [],
  )

  // capture on-access-accepted event
  // if the user is the owner, refetch the game to update the game role
  useStreamEventHandler(
    {
      event,
      type: 'on-access-accepted',
      listener: (event) => {
        if (event.userId === user?.id) refetch()
      },
    },
    [refetch, user?.id],
  )

  return { game, accessRequest, onCancel }
}

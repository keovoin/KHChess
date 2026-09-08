import { useState } from 'react'
import { toast } from 'sonner'
import { TopBar } from '@/components/ui/top-bar'
import { useTranslation } from '@/lib/i18n'
import type { Player } from '@chessarena/types/game'
import { useCreateGame } from '@/lib/use-create-game'
import { CreateGameOpponents, type Opponent } from './create-game-opponents'
import { CreateGamePlayerForm } from './create-game-player-form'

type Props = {
  onGameCreated: (gameId: string) => void
  onCancel: () => void
}

type Setup = {
  forColor: 'white' | 'black'
  isAiEnabled: boolean
  initial: Player
  opponent: Opponent
}

export const CreateGame: React.FC<Props> = ({ onGameCreated, onCancel }) => {
  const createGame = useCreateGame()
  const { t } = useTranslation()
  const [setup, setSetup] = useState<Setup>()
  const [isLoading, setIsLoading] = useState(false)

  const submit = async (players: { white?: Partial<Player>; black?: Partial<Player> }) => {
    setIsLoading(true)

    try {
      const game = await createGame({
        white: { ai: players.white?.ai },
        black: { ai: players.black?.ai },
      })

      onGameCreated(game.id)
    } finally {
      setIsLoading(false)
    }
  }

  const onPick = (opponent: Opponent) => {
    if (opponent.kind === 'ai') {
      // the AI plays black; the engine bot is the default (server admin default
      // is stockfish). NEVER hardcode 'openai' here — an LLM provider with a
      // missing key leaves the bot stuck on "Thinking...".
      setSetup({ forColor: 'black', isAiEnabled: true, initial: { ai: 'stockfish' }, opponent })
    } else {
      // friend: the user plays white, black seat is left open for the invite
      setSetup({ forColor: 'white', isAiEnabled: false, initial: {}, opponent })
    }
  }

  const onPlayerSubmit = (player: Player) => {
    if (setup?.opponent.kind === 'ai') {
      if (!player.ai) {
        toast(t('create.aiRequired'), {
          description: t('create.aiRequiredDesc'),
          position: 'bottom-center',
        })
        return
      }
      void submit({ black: { ai: player.ai } })
      return
    }

    void submit({})
  }

  const onBack = () => {
    if (isLoading) return
    if (setup) {
      setSetup(undefined)
    } else {
      onCancel()
    }
  }

  return (
    <div className="flex flex-col flex-1 gap-14 items-center justify-between w-full">
      <TopBar onBack={onBack} />
      {setup ? (
        <CreateGamePlayerForm
          player={setup.initial}
          color={setup.forColor}
          onSubmit={onPlayerSubmit}
          isAiEnabled={setup.isAiEnabled}
          isLoading={isLoading}
        />
      ) : (
        <CreateGameOpponents onPick={onPick} />
      )}
    </div>
  )
}

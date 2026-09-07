import { AiIcon } from '@/components/chess/ai-icon'
import { ChessIcon } from '@/components/chess/chess-icon'
import { Selector } from '@/components/ui/selector'
import type { Player } from '@chessarena/types/game'
import { useGetAiModels } from '@/lib/use-get-ai-models'
import { useTranslation } from '@/lib/i18n'
import { useEffect, useState } from 'react'
import { CreateGameButton } from './create-game-button'
import { Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

type Props = {
  player: Player
  color: 'white' | 'black'
  onSubmit: (player: Player, color: 'white' | 'black') => void
  isAiEnabled: boolean
  isLoading?: boolean
}

export const CreateGamePlayerForm: React.FC<Props> = ({ player, color, onSubmit, isAiEnabled, isLoading }) => {
  const { t } = useTranslation()
  const [ai, setAi] = useState<Player['ai']>(player.ai)
  const { activeModel, activeProvider } = useGetAiModels()

  useEffect(() => {
    setAi(player.ai)
  }, [player])

  return (
    <div className="flex flex-col flex-1 gap-4 items-center w-full">
      <div className="shrink-0 space-y-2">
        <ChessIcon
          color={color}
          size={80}
          style={color === 'black' ? { stroke: '#fff', strokeWidth: 0.5 } : undefined}
        />
        <h2 className="text-center text-2xl font-bold capitalize">{color}</h2>
      </div>
      <Selector isSelected={!ai} className="w-full" onClick={() => setAi(undefined)}>
        Play as {color}
      </Selector>
      {isAiEnabled && (
        <>
          <div className="flex flex-row gap-2 shrink-0 items-center justify-center w-full text-muted-foreground text-md font-semibold">
            <Separator className="shrink" />
            <span className="min-w-fit">{t('create.aiVs')}</span>
            <Separator className="shrink" />
          </div>
          <Selector
            isSelected={!!ai}
            className="flex flex-col gap-1 w-full min-h-[102px] p-3"
            onClick={() => setAi(activeProvider ?? 'openai')}
          >
            <div className="flex items-center gap-3">
              <AiIcon ai={activeProvider ?? 'openai'} color="white" />
              <span className="font-semibold">{t('create.ai')}</span>
            </div>
            {activeModel && (
              <span className="text-sm text-muted-foreground font-mono">{activeModel}</span>
            )}
          </Selector>
        </>
      )}
      <div className="flex flex-col flex-1 gap-4 w-full">
        <div className="shrink-0 w-full">
          {isLoading ? (
            <div className="flex flex-row gap-2 items-center justify-center w-full h-[64px] font-medium text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Your match is loading...
            </div>
          ) : (
            <CreateGameButton className="w-full" onClick={() => onSubmit({ ...player, ai }, color)}>
              {color === 'white' ? 'Continue' : 'Start match'}
            </CreateGameButton>
          )}
        </div>
      </div>
    </div>
  )
}

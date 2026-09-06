import { AiIcon } from '@/components/chess/ai-icon'
import { Selector } from '@/components/ui/selector'
import { useTranslation } from '@/lib/i18n'
import { Users } from 'lucide-react'

export type Opponent = { kind: 'ai' } | { kind: 'friend' }

type Props = {
  onPick: (opponent: Opponent) => void
}

export const CreateGameOpponents: React.FC<Props> = ({ onPick }) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col flex-1 gap-4 items-center justify-start w-full pt-8">
      <h2 className="text-center text-2xl font-bold">{t('create.opponent')}</h2>

      <Selector className="w-full flex-row items-center gap-4 p-4" onClick={() => onPick({ kind: 'friend' })}>
        <Users className="size-8" />
        <div className="flex flex-col items-start">
          <span className="text-lg font-semibold">{t('create.friendInvite')}</span>
          <span className="text-sm text-muted-foreground">{t('create.friendInviteDesc')}</span>
        </div>
      </Selector>

      <Selector className="w-full flex-row items-center gap-4 p-4" onClick={() => onPick({ kind: 'ai' })}>
        <AiIcon ai="openai" color="white" />
        <div className="flex flex-col items-start">
          <span className="text-lg font-semibold">{t('create.ai')}</span>
          <span className="text-sm text-muted-foreground">{t('create.aiDesc')}</span>
        </div>
      </Selector>
    </div>
  )
}

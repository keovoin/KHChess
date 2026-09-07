import { BaseButton } from '@/components/ui/base-button'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'
import { Check, Link2, Share2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  gameId: string
}

export const ChessInviteCard: React.FC<Props> = ({ gameId }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const inviteUrl = `${window.location.origin}/game/${gameId}`

  const onCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast(t('invite.copied'), {
      description: inviteUrl,
      position: 'bottom-center',
    })
    setTimeout(() => setCopied(false), 2500)
  }

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'KHChess', text: t('invite.shareText'), url: inviteUrl })
      } catch {
        // dismissed by user
      }
    } else {
      void onCopy()
    }
  }

  return (
    <Card className="bg-black/20 rounded-xl mt-4 p-0">
      <div className="p-4">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex flex-row items-center gap-2 text-2xl text-white font-bold">
            <UserPlus />
            {t('invite.title')}
          </div>
          <div className="text-md mx-auto text-center w-full text-muted-foreground">{t('invite.desc')}</div>
          <div className="flex flex-row gap-2 w-full">
            <BaseButton className="flex-1" onClick={onCopy}>
              {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copied ? t('invite.copied') : t('invite.copy')}
            </BaseButton>
            <Button variant="outline" className="p-4" onClick={onShare}>
              <Share2 className="size-4" />
              {t('invite.share')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

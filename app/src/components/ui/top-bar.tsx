import { LanguagesToggle } from '../i18n/languages-toggle'
import { ArrowLeft } from 'lucide-react'
import { KhChessBrand } from './khchess-brand'
import { cn } from '@/lib/utils'

type Props = {
  onBack?: () => void
  showLanguageToggle?: boolean
}

export const TopBar: React.FC<Props> = ({ onBack, showLanguageToggle = true }) => {
  return (
    <div className="flex flex-row items-center justify-center w-full">
      {onBack ? <ArrowLeft className="size-6 shrink-0 cursor-pointer mr-2" onClick={onBack} /> : null}
      <KhChessBrand
        className={cn(
          'grow',
          onBack && 'mr-8',
          !onBack && showLanguageToggle && 'mr-3',
        )}
      />
      {showLanguageToggle ? <LanguagesToggle className="shrink-0" /> : null}
    </div>
  )
}

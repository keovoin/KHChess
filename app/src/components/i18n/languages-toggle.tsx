import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Languages } from 'lucide-react'

// Compact EN / ខ្មែរ switcher. Persists choice and auto-detects browser on first load.
export const LanguagesToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { locale, setLocale } = useTranslation()

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full bg-white/10 border border-white/10 p-1 select-none',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <Languages className="size-3.5 text-gray-400 ml-1.5 shrink-0" aria-hidden />
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer',
          locale === 'en' ? 'bg-white text-black' : 'text-gray-300 hover:text-white',
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('kh')}
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer',
          locale === 'kh' ? 'bg-white text-black' : 'text-gray-300 hover:text-white',
        )}
      >
        ខ្មែរ
      </button>
    </div>
  )
}

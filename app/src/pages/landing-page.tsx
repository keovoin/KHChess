import { Trophy } from 'lucide-react'
import { useNavigate } from 'react-router'
import { usePageTitle } from '@/lib/use-page-title'
import { useTranslation } from '@/lib/i18n'
import { AuthContainer } from '@/components/auth/auth-container'
import { CreateGameButton } from '@/components/chess/create-game/create-game-button'
import { Leaderboard } from '@/components/leaderboard/leaderboard'
import { TopBar } from '@/components/ui/top-bar'
import { PageGrid, PageGridRightColumn } from '@/components/page-grid'
import { BaseButton } from '@/components/ui/base-button'
import { ChessArenaLogo } from '@/components/ui/chess-arena-logo'

export const LandingPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const goToAbout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    navigate('/about')
  }

  usePageTitle('Powered by Motia')

  return (
    <PageGrid>
      <div className="hidden md:flex md:flex-col p-4 overflow-y-auto">
        <Leaderboard className="max-h-[min(calc(100dvh-32px),1280px)] my-auto mx-auto" />
      </div>
      <PageGridRightColumn className="backdrop-blur-none md:backdrop-blur-lg">
        <TopBar />
        <div className="flex flex-col justify-center grow gap-2 text-center">
          <ChessArenaLogo />
          <p className="font-medium text-center text-muted-foreground">{t('landing.welcome')}</p>
          <p className="font-medium text-center text-muted-foreground">
            {t('landing.tagline')}{' '}
            <a href="/about" className="text-white underline" onClick={goToAbout}>
              {t('landing.learnMore')}
            </a>
          </p>
        </div>
        <div className="flex flex-col gap-4 items-center justify-center w-full">
          <AuthContainer />
          <CreateGameButton onClick={() => navigate('/new')}>{t('landing.createGame')}</CreateGameButton>
          <div className="flex flex-row flex-wrap gap-2 items-center justify-center w-full">
            <BaseButton className="flex-1" onClick={() => navigate('/live-matches')}>
              {t('landing.liveMatches')}
            </BaseButton>
            <BaseButton className="min-w-[64px] shrink-0 md:flex-1" onClick={() => navigate('/leaderboard')}>
              <Trophy className="shrink-0" /> <span className="hidden sm:block">{t('landing.leaderboard')}</span>
            </BaseButton>
          </div>

          <p className="font-medium text-sm text-center text-muted-foreground">
            {t('landing.openSource')}{' '}
            <a href="/about" className="text-white underline" onClick={goToAbout}>
              {t('landing.here')}
            </a>{' '}
            {t('landing.openSourceTail')}
          </p>
        </div>
      </PageGridRightColumn>
    </PageGrid>
  )
}

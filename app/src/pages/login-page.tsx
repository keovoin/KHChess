import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageGrid, PageGridRightColumn } from '@/components/page-grid'
import { BaseButton } from '@/components/ui/base-button'
import { Input } from '@/components/ui/input'
import { ChessArenaLogo } from '@/components/ui/chess-arena-logo'
import { usePageTitle } from '@/lib/use-page-title'
import { TopBar } from '@/components/ui/top-bar'
import { useTranslation } from '@/lib/i18n'
import { OtpInput } from '../components/ui/otp-input'
import { useLogin } from '../lib/auth/use-login'
import { useQueryParam } from '../lib/use-query-param'

export const LoginPage = () => {
  const { t } = useTranslation()
  const [isOtpEnabled, setIsOtpEnabled] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [redirect] = useQueryParam('redirect')

  const { handleLogin, verifyOtp, isAuthenticating, error, successMessage } = useLogin()

  const onEmailLogin = () => {
    setIsOtpEnabled(true)
    return handleLogin('email', { email })
  }

  useEffect(() => {
    localStorage.setItem('chessarena-redirect', redirect ?? '')
  }, [redirect])

  const navigate = useNavigate()
  const onBack = () => navigate('/')

  usePageTitle('Login')

  return (
    <PageGrid>
      <PageGridRightColumn>
        <TopBar onBack={onBack} />
        <div className="flex flex-col gap-4 items-center justify-center grow">
          <ChessArenaLogo />
        </div>
        {successMessage ? (
          <div className="flex flex-col justify-center h-[348px] gap-6">
            <div className="space-y-1">
              <p className="text-center text-2xl font-semibold">{successMessage.title}</p>
              <p className="text-muted-foreground text-center">{successMessage.description}</p>
            </div>
            {isOtpEnabled && (
              <div className="space-y-4">
                <OtpInput value={otp} onChange={setOtp} />
                <BaseButton className="w-full" onClick={() => verifyOtp(email, otp)} isLoading={isAuthenticating}>
                  {t('login.verify')}
                </BaseButton>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {error && <p className="text-red-500 text-center font-semibold first-letter:uppercase">{error}</p>}
            {!isAuthenticating && (
              <>
                <BaseButton className="w-full" onClick={() => handleLogin('google')}>
                  <img src="/login/google-logo.svg" alt="Google" className="size-6" />
                  {t('login.google')}
                </BaseButton>
                <BaseButton className="w-full" onClick={() => handleLogin('telegram')}>
                  <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="#229ED9" aria-hidden="true">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  {t('login.telegram')}
                </BaseButton>
                {/* <BaseButton className="w-full" onClick={() => handleLogin('twitter')}>
                  <img src="/login/x-logo.svg" alt="X" className="size-6" />
                  Continue with X
                </BaseButton> */}
                <div className="flex flex-row gap-2 items-center justify-center w-full text-muted-foreground text-md font-semibold">
                  <div className="h-[1px] flex-1 bg-white/10" />
                  {t('login.or')}
                  <div className="h-[1px] flex-1 bg-white/10" />
                </div>
              </>
            )}
            <Input
              type="email"
              placeholder={t('login.emailPlaceholder')}
              className="w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <BaseButton className="w-full" onClick={onEmailLogin} isLoading={isAuthenticating}>
              {t('login.continue')}
            </BaseButton>
            <p className="text-muted-foreground text-center">
              {t('login.footnote')}{' '}
              <a href="/privacy-policy" target="_blank" className="font-semibold underline">
                {t('login.privacy')}
              </a>
              .
            </p>
          </div>
        )}
      </PageGridRightColumn>
    </PageGrid>
  )
}

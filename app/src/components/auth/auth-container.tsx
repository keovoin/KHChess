import { useAuth } from '@/lib/auth/use-auth'
import { useTranslation } from '@/lib/i18n'
import { ChatBubbleAvatar } from '../ui/chat/chat-bubble'
import { Button } from '../ui/button'
import { Loader2, LogIn, ShieldCheck, User, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router'

export const AuthContainer = () => {
  const { user, isLoading, isAdmin, loginAsGuest, logout, authError } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Visible sign-in failure (e.g. an OAuth leg bounced back with an error).
  // Without this the user lands on the home page with nothing shown and it
  // reads as a "timeout" — the real failure is hidden.
  if (authError) {
    const detail = [authError.error, authError.error_code, authError.error_description]
      .filter(Boolean)
      .join(' · ')
    return (
      <div className="w-full rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-200">
        <div className="flex items-start gap-2">
          <XCircle className="size-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold">Sign-in problem: </span>
            <span className="break-words">{detail || 'unknown error'}</span>
          </div>
        </div>
      </div>
    )
  }

  if (user) {
    return (
      <div className="flex items-center justify-between w-full gap-2 rounded-xl backdrop-blur-lg bg-white/10 px-4 py-4 shadow-lg">
        <div className="flex items-center min-w-0 gap-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-black/50 flex items-center justify-center">
            <ChatBubbleAvatar color="white" fallback={user.name?.slice(0, 2).toUpperCase()} src={user.profilePic} />
          </div>
          <div className="min-w-0">
            <span className="block text-white font-medium text-lg truncate">
              {user.name}
              {user.name === 'Guest' && <span className="ml-2 text-xs text-gray-400">{t('auth.guestBadge')}</span>}
            </span>
            <span className="block text-gray-400 text-sm truncate">
              {user.email || t('auth.guestBadge')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <Button variant="outline" onClick={() => navigate('/admin')}>
              <ShieldCheck className="size-4" /> <span className="hidden sm:inline">{t('auth.admin')}</span>
            </Button>
          )}
          <Button variant="outline" onClick={logout}>
            {t('auth.signOut')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between w-full gap-2 rounded-xl backdrop-blur-lg bg-white/10 px-4 py-4 shadow-lg">
      <div className="flex items-center min-w-0 gap-3">
        <div className="p-3 rounded-full bg-white">
          <LogIn className="size-4 text-black" />
        </div>
        <div className="min-w-0">
          <span className="block text-white font-medium text-lg truncate">{t('auth.signIn')}</span>
          <span className="block text-gray-400 text-sm leading-tight">
            {t('auth.noAccountShort')}
            <span className="hidden sm:inline"> {t('auth.noAccountTail')}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isLoading ? (
          <Button variant="outline">
            <Loader2 className="size-4 animate-spin" />
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => navigate('/login')}>
              {t('auth.logIn')}
            </Button>
            <Button variant="default" onClick={() => loginAsGuest().then(() => navigate('/new'))}>
              <User className="size-4" /> <span className="hidden sm:inline">{t('auth.playAsGuest')}</span>
              <span className="sm:hidden">{t('auth.guest')}</span>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

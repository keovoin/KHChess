import { apiClient } from '@/lib/auth/api-client'
import { authApi } from '@/lib/auth/auth-api'
import { AuthService } from '@/lib/auth/auth-service'
import { getAuthParamsFromUrl, handleAuthError } from '@/lib/auth/auth-utils'
import type { AuthError, SupabaseError } from '@/lib/auth/types'
import type { User } from '@chessarena/types/user'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthContext } from './auth-context'

const useUserState = () => {
  const [user, _setUser] = useState<User | null>(null)

  const setUser = useCallback((user: User | null) => {
    _setUser(user)
    localStorage.setItem('motia-user', JSON.stringify(user))
  }, [])

  useEffect(() => {
    const localStorageUser = localStorage.getItem('motia-user')
    setUser(localStorageUser ? JSON.parse(localStorageUser) : null)
  }, [setUser])

  return [user, setUser] as const
}

// Emails (comma-separated) that may open the /admin panel.
const ADMIN_EMAILS = ((import.meta.env.VITE_ADMIN_EMAILS ?? '') as string)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useUserState()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [authError, setAuthError] = useState<AuthError | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const params = getAuthParamsFromUrl()
    const fetchUser = async () => {
      setAuthError(null)
      setIsLoading(true)

      try {
        const session = await AuthService.getSession()

        if (session) {
          const result = await authApi.auth(session.access_token)
          const redirect = localStorage.getItem('chessarena-redirect')
          setUser(result.user)

          if (redirect) {
            navigate(redirect)
            localStorage.removeItem('chessarena-redirect')
          }
        }
      } catch (error: unknown) {
        console.error('Auth state change error:', error)
        setAuthError(handleAuthError(error))
      } finally {
        setIsLoading(false)
      }
    }

    if (params.error) {
      setAuthError({
        error: params.error,
        error_code: params.error_code || '',
        error_description: params.error_description || '',
      })
      return
    }

    if (params.access_token || !apiClient.isAuthenticated()) {
      fetchUser()
    }
  }, [navigate, setUser])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setIsLoading(true)
    setAuthError(null)

    try {
      await AuthService.login(email, password)
    } catch (error: unknown) {
      console.error('Login error:', error)
      const supabaseError = error as SupabaseError
      setAuthError({
        error: supabaseError.message || 'Failed to log in',
        error_code: supabaseError.code || '',
        error_description: '',
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const verifyOtp = useCallback(
    async (email: string, token: string): Promise<void> => {
      setIsLoading(true)
      setAuthError(null)

      try {
        const { session } = await AuthService.verifyOtp(email, token)
        if (session?.access_token) {
          const result = await authApi.auth(session.access_token)
          setUser(result.user)
        }
      } catch (error: unknown) {
        console.error('Login error:', error)
        const supabaseError = error as SupabaseError
        setAuthError({
          error: supabaseError.message || 'Failed to log in',
          error_code: supabaseError.code || '',
          error_description: '',
        })
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [setUser],
  )

  const loginWithOtp = useCallback(async (email: string): Promise<void> => {
    setAuthError(null)
    setIsLoading(true)

    try {
      await AuthService.loginWithOtp(email)
    } catch (error: unknown) {
      console.error('Magic link error:', error)
      setAuthError(handleAuthError(error))
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loginWithOAuth = useCallback(async (provider: 'google' | 'twitter'): Promise<void> => {
    setIsLoading(true)
    setAuthError(null)

    try {
      await AuthService.loginWithOAuth(provider)
    } catch (error: unknown) {
      console.error('OAuth login error:', error)
      setAuthError(handleAuthError(error))
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Play without an account: the API mints a short-lived guest token.
  const loginAsGuest = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setAuthError(null)

    try {
      const result = await authApi.guestToken()
      apiClient.setAuthToken(result.accessToken)
      setUser(result.user)
      localStorage.setItem('chessarena-guest', '1')
    } catch (error: unknown) {
      console.error('Guest login error:', error)
      setAuthError(handleAuthError(error))
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setUser])

  // Log in with Telegram. Web: official Login library (OIDC popup → id_token,
  // verified server-side against Telegram's JWKS). In-app: WebApp initData
  // (HMAC). The library is telegram-login.js — NOT the deprecated
  // telegram-widget.js (its /auth endpoint is dead: "Bot domain invalid").
  const loginWithTelegram = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setAuthError(null)

    const finish = (payload: { idToken: string } | { initData: string }) =>
      (async () => {
        try {
          const result = await authApi.telegramLogin(payload)
          apiClient.setAuthToken(result.accessToken)
          setUser(result.user)
          const redirect = localStorage.getItem('chessarena-redirect')
          if (redirect) {
            navigate(redirect)
            localStorage.removeItem('chessarena-redirect')
          }
        } catch (error: unknown) {
          console.error('Telegram login error:', error)
          setAuthError(handleAuthError(error))
          throw error
        } finally {
          setIsLoading(false)
        }
      })()

    try {
      // Inside the Telegram app: the SDK hands us initData directly.
      const tg = window.Telegram?.WebApp
      if (tg?.initData && tg.initData.length > 0) {
        await finish({ initData: tg.initData })
        return
      }

      // On the web: official OIDC library. The script is loaded async in
      // index.html, so wait for it before touching it.
      const deadline = Date.now() + 5000
      while (!window.Telegram?.Login) {
        if (Date.now() > deadline) throw new Error('Telegram login script not loaded')
        await new Promise((r) => setTimeout(r, 100))
      }
      const api = window.Telegram.Login
      const clientId = Number(import.meta.env.VITE_TELEGRAM_BOT_ID)
      if (!clientId) throw new Error('Telegram client id not configured')
      const onAuth = (data: { id_token?: string; error?: string }) => {
        if (data.error || !data.id_token) {
          console.error('Telegram login failed:', data.error ?? 'missing id_token')
          setAuthError({
            error: data.error === 'popup_closed' ? 'Telegram login window was closed' : 'Telegram login failed',
            error_code: data.error ?? '',
            error_description: '',
          })
          setIsLoading(false)
          return
        }
        void finish({ idToken: data.id_token })
      }
      api.init({ client_id: clientId }, onAuth)
      api.open(onAuth)
    } catch (error: unknown) {
      console.error('Telegram login error:', error)
      setAuthError(handleAuthError(error))
      setIsLoading(false)
      throw error
    }
  }, [navigate, setUser])

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setAuthError(null)

    try {
      await AuthService.logout()
      localStorage.removeItem('chessarena-guest')
      setUser(null)
    } catch (error: unknown) {
      console.error('Logout error:', error)
      setAuthError(handleAuthError(error))
    } finally {
      setIsLoading(false)
    }
  }, [setUser])

  const isAuthenticated = apiClient.isAuthenticated()
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isAdmin,
      isGuest: !!localStorage.getItem('chessarena-guest'),
      isLoading,
      authError,
      login,
      loginWithOtp,
      loginWithOAuth,
      loginWithTelegram,
      loginAsGuest,
      logout,
      verifyOtp,
    }),
    [user, isAuthenticated, isAdmin, isLoading, authError, login, loginWithOtp, loginWithOAuth, loginWithTelegram, loginAsGuest, logout, verifyOtp],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

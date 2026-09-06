import type { User } from '@chessarena/types/user'

export type AuthError = {
  error: string
  error_code: string
  error_description: string
}

export interface SupabaseError {
  message: string
  code?: string
  status?: number
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isGuest: boolean
  isLoading: boolean
  authError: AuthError | null
  login: (email: string, password: string) => Promise<void>
  loginWithOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  loginWithOAuth: (provider: 'google' | 'twitter') => Promise<void>
  loginAsGuest: () => Promise<void>
  logout: () => Promise<void>
}

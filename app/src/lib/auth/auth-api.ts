import type { User } from '@chessarena/types/user'
import { apiClient } from './api-client'

type AuthResponse = {
  userId: string
  accessToken: string
  user: User
}

export const authApi = {
  auth: async (authToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(`/auth`, { authToken })

    apiClient.setAuthToken(response.accessToken)

    return response
  },

  // Mint a guest (no-account) token from the API.
  guestToken: async (): Promise<{ accessToken: string; user: User }> =>
    apiClient.post<{ accessToken: string; user: User }>('/auth/guest-token', {}),
}

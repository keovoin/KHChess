import { UserState } from '../states/user-state'

/**
 * Shared admin allowlist for /admin routes.
 *
 * Reads ADMIN_EMAILS (comma-separated, lowercase) from the environment and
 * resolves the caller's user id to their email. Mirrors the existing
 * /admin/stats behavior so admin access stays consistent.
 */
export const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

export const resolveCallerEmail = async (userState: UserState, userId?: string): Promise<string> => {
  const caller = userId ? await userState.getUser(userId) : null
  return (caller?.email ?? '').toLowerCase()
}

export const isAllowedAdmin = async (userState: UserState, userId?: string): Promise<boolean> => {
  const email = await resolveCallerEmail(userState, userId)
  return adminEmails().includes(email)
}

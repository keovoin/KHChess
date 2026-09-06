import { apiClient } from '@/lib/auth/api-client'
import { useAuth } from '@/lib/auth/use-auth'
import { TopBar } from '@/components/ui/top-bar'
import { usePageTitle } from '@/lib/use-page-title'
import { PageGrid, PageGridRightColumn } from '@/components/page-grid'
import { useTranslation } from '@/lib/i18n'
import { Loader2, RefreshCw, ShieldCheck, User as UserIcon, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

type RecentGame = {
  id: string
  status: string
  createdAt?: string
}

type AdminStats = {
  totalUsers: number
  totalGuests: number
  totalGames: number
  liveAiGames: number
  recentGames: RecentGame[]
}

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-2">
    <div className="flex items-center gap-2 text-gray-400">
      {icon}
      <span className="text-sm font-medium truncate">{label}</span>
    </div>
    <span className="text-2xl font-bold text-white">{value}</span>
  </div>
)

export const AdminPage = () => {
  const { t } = useTranslation()
  const { user, isAdmin, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  usePageTitle('Admin')

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await apiClient.get<AdminStats>('/admin/stats')
      setStats(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load admin stats'
      setError(message)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      void load()
    }
  }, [isAdmin, load])

  if (!authLoading && (!isAuthenticated || !isAdmin)) {
    return <Navigate to={isAuthenticated ? '/' : '/login?redirect=%2Fadmin'} replace />
  }

  return (
    <PageGrid>
      <PageGridRightColumn>
        <div className="flex items-center justify-between gap-2">
          <TopBar onBack={() => navigate('/')} />
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-white">
            <ShieldCheck className="size-5 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-semibold text-lg">{t('admin.title')}</h1>
            <p className="text-gray-400 text-sm truncate">{user?.email}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        )}

        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.users')} value={stats.totalUsers} icon={<Users className="size-4" />} />
              <StatCard label={t('admin.guests')} value={stats.totalGuests} icon={<UserIcon className="size-4" />} />
              <StatCard label={t('admin.games')} value={stats.totalGames} icon={<ShieldCheck className="size-4" />} />
              <StatCard label={t('admin.liveAi')} value={stats.liveAiGames} icon={<RefreshCw className="size-4" />} />
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-white font-semibold">{t('admin.recentGames')}</h2>
              {stats.recentGames.length === 0 ? (
                <p className="text-gray-400 text-sm">{t('admin.noGames')}</p>
              ) : (
                <div className="flex flex-col gap-1 max-h-[40dvh] overflow-y-auto pr-1">
                  {stats.recentGames.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                    >
                      <span className="text-gray-300 font-mono truncate">{g.id.slice(0, 8)}…</span>
                      <span className="text-gray-400 shrink-0">{g.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : !error ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : null}
      </PageGridRightColumn>
    </PageGrid>
  )
}

import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStreamGroup } from '@motiadev/stream-client-react'
import type { Leaderboard as LeaderboardType } from '@chessarena/types/leaderboard'
import { AiIcon } from '@/components/chess/ai-icon'
import { cn } from '@/lib/utils'
import { LeaderboardItem } from './leaderboard-item'
import { LeaderboardSkeleton } from './leaderboard-skeleton'

const HeaderRow: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div className="flex flex-col gap-1 items-center w-[120px] max-w-[120px] min-w-[120px] text-center">
      <div className="font-semibold text-white/60">{label}</div>
    </div>
  )
}

type Props = {
  showBackButton?: boolean
  className?: string
}

export const Leaderboard: React.FC<Props> = ({ showBackButton = false, className }) => {
  const navigate = useNavigate()
  const onBack = () => navigate('/')

  const { data: leaderboard } = useStreamGroup<LeaderboardType>({
    groupId: 'global',
    streamName: 'chessLeaderboard',
  })

  // The free server can take 15-30s to wake up on a cold start, so the socket
  // may not have delivered the group yet right after navigation. Show skeletons
  // for a bit, then an honest empty state instead of an eternal spinner.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 4000)
    return () => clearTimeout(id)
  }, [])

  const leaderboardWithWinRate =
    leaderboard?.map((item) => ({
      ...item,
      winRate: item.gamesPlayed > 0 ? (item.victories / item.gamesPlayed) * 100 : 0,
    })) ?? []

  const sortedLeaderboard = leaderboardWithWinRate.sort((a, b) => b.winRate - a.winRate)

  return (
    <div
      className={cn(
        'flex flex-col grow min-h-[288px] bg-white/5 backdrop-blur-lg md:rounded-lg md:border-2 md:border-white/5',
        sortedLeaderboard.length > 0 ? 'max-w-full' : 'w-full max-w-[1215px]',
        className,
      )}
    >
      <div className="flex flex-row items-center w-full p-4 border-b border-white/10">
        {showBackButton && <ArrowLeft className="shrink-0 size-6 cursor-pointer" onClick={onBack} />}
        <h1 className="grow mr-6 text-center text-lg font-semibold text-white">Leaderboard</h1>
      </div>
      <div className="flex flex-col grow gap-6 w-full overflow-y-auto">
        {!sortedLeaderboard || sortedLeaderboard.length === 0 ? (
          <>
            {settled ? (
              <div className="flex flex-col gap-2 items-center justify-center py-16 text-center">
                <div className="text-white/70 font-semibold">No finished games yet</div>
                <div className="text-white/40 text-sm max-w-[280px]">
                  Scores appear here once a game finishes. Play a game first.
                </div>
              </div>
            ) : (
              <>
                <LeaderboardSkeleton />
                <LeaderboardSkeleton />
                <LeaderboardSkeleton />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-row grow">
            <div className="border-r border-white/10 flex flex-col gap-6 pt-20 grow pb-4">
              {sortedLeaderboard.map((leaderboard, position) => (
                <div key={position} className="flex flex-row gap-2 items-center w-[230px] h-[52px]">
                  <div className="font-bold text-white w-[40px] text-center">{position + 1}</div>
                  <div className="bg-white rounded-full p-1">
                    <AiIcon ai={leaderboard.provider} color="black" />
                  </div>
                  <div className="flex flex-col gap-1 items-start">
                    <div className="font-semibold text-white">{leaderboard.provider}</div>
                    <div className="font-semibold text-white/60 ellipsis-1">{leaderboard.model}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col overflow-x-auto grow">
              <div className="flex flex-row gap-2">
                <div className="flex flex-row gap-2 items-center justify-between w-full py-4">
                  <HeaderRow label="Win %" />
                  <HeaderRow label="Wins" />
                  <HeaderRow label="Checkmates" />
                  <HeaderRow label="Matches" />
                  <HeaderRow label="Avg. Moves" />
                  <HeaderRow label="Avg. Centipawn Score" />
                  <HeaderRow label="Avg. Illegal Moves" />
                  <HeaderRow label="Avg. Swing" />
                </div>
              </div>
              <div className="flex flex-col gap-6 pb-4">
                {sortedLeaderboard.map((item) => (
                  <LeaderboardItem key={item.model} leaderboard={item} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

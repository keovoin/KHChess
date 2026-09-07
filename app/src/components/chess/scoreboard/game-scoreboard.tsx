import { Card } from '@/components/ui/card'
import { useTranslation } from '@/lib/i18n'
import type { Game } from '@chessarena/types/game'
import { useScrollIntoView } from '@/lib/use-scroll-into-view'
import { Info, Loader2 } from 'lucide-react'
import React from 'react'
import { Matchup } from './matchup'
import { ScoreboardRow } from './scoreboard-row'

interface ScoreboardProps {
  game: Game
}

const PlayerCard: React.FC<ScoreboardProps> = ({ game }) => {
  const scoreboard = game.scoreboard!
  const white = game.players.white
  const black = game.players.black

  return (
    <table className="w-full">
      <tbody>
        <ScoreboardRow
          white={scoreboard.white.averageSwing.toFixed(0)}
          label="Avg. Swing"
          black={scoreboard.black.averageSwing.toFixed(0)}
        />
        <ScoreboardRow
          white={scoreboard.white.highestSwing.toFixed(0)}
          label="Highest Swing"
          black={scoreboard.black.highestSwing.toFixed(0)}
        />
        <ScoreboardRow white={scoreboard.white.blunders} label="Blunders" black={scoreboard.black.blunders} />
        <ScoreboardRow
          white={white.illegalMoveAttempts ?? 0}
          label="Illegal Moves"
          black={black.illegalMoveAttempts ?? 0}
        />
        <ScoreboardRow
          white={white.captures?.length ?? 0}
          label="Captures"
          black={black.captures?.length ?? 0}
        />
        <ScoreboardRow white={white.promotions ?? 0} label="Promotions" black={black.promotions ?? 0} />
        <ScoreboardRow
          white={scoreboard.white.finalCentipawnScore.toFixed(0)}
          label="Centipawn Score"
          black={scoreboard.black.finalCentipawnScore.toFixed(0)}
        />
      </tbody>
    </table>
  )
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ game }) => {
  const scoreboard = game.scoreboard
  const ref = useScrollIntoView()
  const { t } = useTranslation()
  const hasAi = !!game.players.white.ai || !!game.players.black.ai

  return (
    <Card className="bg-black/20 rounded-xl mt-4 p-0" ref={ref}>
      {scoreboard ? (
        <>
          <div className="p-4">
            {game.endGameReason === 'Checkmate' && (
              <div className="flex flex-col">
                <div className="text-2xl text-white font-bold mx-auto text-center w-full">Checkmate!</div>
                <div className="text-md mx-auto text-center w-full text-muted-foreground">
                  <span className="capitalize">{game.winner}</span> wins the match in {scoreboard.totalMoves} moves
                </div>
              </div>
            )}
            {game.endGameReason === 'Draw' && (
              <div className="flex flex-col">
                <div className="text-2xl text-white font-bold mx-auto text-center w-full">Draw</div>
                <div className="text-md mx-auto text-center w-full text-muted-foreground">
                  The match ended in a draw after {scoreboard.totalMoves} moves
                </div>
              </div>
            )}
            {game.endGameReason === 'Too many illegal moves' && (
              <div className="flex flex-col">
                <div className="text-2xl text-white font-bold mx-auto text-center w-full">Match Over</div>
                <div className="text-md mx-auto text-center w-full text-muted-foreground">
                  <span className="capitalize">{game.winner}</span> wins &mdash; opponent made too many illegal moves
                </div>
              </div>
            )}

            <div className="flex flex-col mt-3 gap-2">
              <div className="text-lg text-white font-bold mx-auto text-center w-full">Evaluation</div>

              <Matchup white={game.players.white} black={game.players.black} />

              <PlayerCard game={game} />
            </div>
          </div>

          {game.players.black.ai && game.players.white.ai && (
            <div className="text-sm flex items-start gap-2 mx-auto w-full text-muted-foreground bg-white/10 rounded-b-xl p-4">
              <Info className="w-12" />
              <span>
                LLMs rarely complete matches. To evaluate them, we end matches at 50 moves and check scores, number of
                blunders, etc.{' '}
                <a href="/about" className="text-white font-bold" target="_blank">
                  Click here
                </a>{' '}
                to learn more.
              </span>
            </div>
          )}
        </>
      ) : hasAi ? (
        <div className="p-4">
          <div className="flex flex-col">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
            <div className="text-2xl text-white font-bold mx-auto text-center w-full my-2">Loading scoreboard...</div>
            <div className="text-md mx-auto text-center w-full text-muted-foreground">
              The scoreboard should be ready in a few seconds.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl text-white font-bold mx-auto text-center w-full">
              {game.winner ? (
                <>
                  <span className="capitalize">{game.winner}</span> {t('game.wins')}
                </>
              ) : (
                t('game.draw')
              )}
            </div>
            {game.endGameReason && (
              <div className="text-md mx-auto text-center w-full text-muted-foreground">{game.endGameReason}</div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export default Scoreboard

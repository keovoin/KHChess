import { CronConfig, Handlers } from 'motia'
import {
  hydrateGame,
  hydrateLeaderboard,
  loadPendingGames,
  resumeAiIfStalled,
  supabaseEnabled,
} from '../../services/supabase/persistence'

/**
 * Postgres rehydration + AI-resume safety net.
 *
 * Render's free tier wipes in-memory + file streams on every deploy/restart.
 * Most read paths lazily rehydrate on demand (get-game, move), but:
 *   1. The leaderboard is read by the frontend purely via the stream client
 *      (no API route), so nothing would restore it after a redeploy — this
 *      cron is the only path.
 *   2. A "vs AI" game whose turn was the AI's when a deploy hit would otherwise
 *      stall until a user re-opened it; this resumes it proactively.
 *
 * Everything here is idempotent: hydrateLeaderboard is a no-op once the stream
 * is non-empty, and a game is only resumed if it was actually just restored
 * from Postgres (i.e. it was missing from memory = we just came back from a
 * redeploy). In steady state this cron does nothing.
 */
export const config: CronConfig = {
  cron: '* * * * *', // every minute (node-cron is 5-field: min hour dom month dow)
  name: 'HydrateState',
  description: 'Restore leaderboard + resume AI games after a redeploy wipes memory',
  type: 'cron',
  emits: ['chess-game-moved'],
  flows: ['chess'],
}

export const handler: Handlers['HydrateState'] = async ({ logger, streams, emit }) => {
  if (!supabaseEnabled()) return

  // 1) Leaderboard — no lazy read path, so the cron is the only rehydration.
  const lbCount = await hydrateLeaderboard(streams)
  if (lbCount > 0) {
    logger.info('Rehydrated leaderboard from Postgres', { count: lbCount })
  }

  // 2) Pending games whose turn is the AI's — resume the ones just restored
  //    from Postgres (a redeploy wiped their in-flight AI move).
  const pending = await loadPendingGames()
  for (const game of pending) {
    if (game.status !== 'pending') continue
    const turnPlayer = game.turn === 'white' ? game.players.white : game.players.black
    if (!turnPlayer?.ai) continue // human's turn — the player resumes it by moving

    const { game: inMemory, hydrated } = await hydrateGame(game.id, streams)
    // Only resume when we just rehydrated it (it was missing = post-redeploy).
    // If it was already in memory, the normal flow owns it — don't double-move.
    if (hydrated && inMemory) {
      const resumed = await resumeAiIfStalled(game.id, streams, emit)
      if (resumed) {
        logger.info('Resumed stalled AI game after redeploy', { gameId: game.id })
      }
    }
  }
}

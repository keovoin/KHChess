import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { FlowContextStateStreams } from 'motia'
import type { Game } from '@chessarena/types/game'
import type { Leaderboard } from '@chessarena/types/leaderboard'
import type { GameMove } from '@chessarena/types/game-move'
import type { LiveAiGames } from '@chessarena/types/live-ai-games'

/**
 * Supabase durable persistence for Motia streams.
 *
 * Render's free tier has no persistent disk and every deploy/restart wipes
 * the in-memory + file-backed streams. We mirror every write to Postgres
 * (via Supabase, service_role key) so game state survives redeploys.
 *
 * Latency rule: all PERSIST functions are fire-and-forget. They must never be
 * awaited on the request/move critical path — call them, ignore the promise,
 * and `.catch()` swallows failures so a slow Supabase round-trip can never add
 * latency or crash a move. Rehydration (LOAD functions) is awaited on the read
 * path only when a game is missing from memory.
 */

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let client: SupabaseClient | null = null

export const supabaseEnabled = (): boolean => Boolean(url && serviceKey)

const sb = (): SupabaseClient | null => {
  if (!supabaseEnabled()) return null
  if (!client) {
    // url + serviceKey are both non-null here (guaranteed by supabaseEnabled)
    client = createClient(url as string, serviceKey as string, { auth: { persistSession: false } })
  }
  return client
}

// ---- fire-and-forget fire wrapper (never throws, never blocks) ----
// supabase-js query builders are *thenables*, not native Promises, so we wrap
// in Promise.resolve() to get a real .catch(). A failed durable write must
// never surface to gameplay.
const fire = (p: PromiseLike<unknown> | undefined) => {
  if (!p) return
  Promise.resolve(p).catch(() => {
    /* persistence is best-effort; a failure must never affect gameplay */
  })
}

// ---------------- PERSIST (write-through) ----------------

export const persistGame = (game: Game) => {
  const c = sb()
  if (!c) return
  fire(c.from('games').upsert({ id: game.id, state: game, status: game.status ?? 'pending' }))
}

export const deleteGame = (gameId: string) => {
  const c = sb()
  if (!c) return
  fire(c.from('games').delete().eq('id', gameId))
}

export const persistMove = (gameId: string, moveId: string, move: GameMove, moveNumber?: number) => {
  const c = sb()
  if (!c) return
  fire(c.from('game_moves').upsert({ game_id: gameId, move_id: moveId, move_number: moveNumber ?? null, data: move }))
}

export const persistMessage = (gameId: string, messageId: string, msg: unknown) => {
  const c = sb()
  if (!c) return
  fire(c.from('game_messages').upsert({ game_id: gameId, message_id: messageId, data: msg }))
}

export const persistSidechatMessage = (gameId: string, messageId: string, msg: unknown) => {
  const c = sb()
  if (!c) return
  // sidechat reuses game_messages with a sender_id tag so we can split on read
  fire(c.from('game_messages').upsert({ game_id: gameId, message_id: 'side-' + messageId, sender_id: 'sidechat', data: msg }))
}

export const persistLeaderboard = (model: string, lb: Leaderboard) => {
  const c = sb()
  if (!c) return
  fire(
    c.from('leaderboard').upsert({
      id: model,
      provider: lb.provider,
      model: lb.model,
      games_played: lb.gamesPlayed,
      victories: lb.victories,
      checkmates: lb.checkmates,
      draws: lb.draws,
      illegal_moves: lb.illegalMoves,
      sum_centipawn_scores: lb.sumCentipawnScores,
      sum_highest_swing: lb.sumHighestSwing,
      sum_turns: lb.sumTurns,
    }),
  )
}

export const persistLiveAiGame = (id: string, live: LiveAiGames) => {
  const c = sb()
  if (!c) return
  fire(c.from('games').upsert({ id: 'live:' + id, state: live, status: 'live-ai' }))
}

export const deleteLiveAiGame = (id: string) => {
  const c = sb()
  if (!c) return
  fire(c.from('games').delete().eq('id', 'live:' + id))
}

// ---- AI config (admin's chosen model survives redeploys) ----

export const persistAiConfig = (provider: string, model: string) => {
  const c = sb()
  if (!c) return
  fire(c.from('ai_config').upsert({ id: 1, provider, model }, { onConflict: 'id' }))
}

export const loadAiConfig = async (): Promise<{ provider: string; model: string } | null> => {
  const c = sb()
  if (!c) return null
  const { data, error } = await c.from('ai_config').select('provider, model').eq('id', 1).maybeSingle()
  if (error || !data) return null
  return { provider: data.provider, model: data.model }
}

// ---------------- LOAD (rehydration) ----------------

export const loadGame = async (gameId: string): Promise<Game | null> => {
  const c = sb()
  if (!c) return null
  const { data, error } = await c.from('games').select('state').eq('id', gameId).maybeSingle()
  if (error || !data) return null
  return (data.state as Game) ?? null
}

export const loadMoves = async (gameId: string): Promise<{ moveId: string; move: GameMove }[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c
    .from('game_moves')
    .select('data, move_id')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({ moveId: r.move_id, move: r.data as GameMove })).filter((r) => r.move)
}

export const loadMessages = async (gameId: string): Promise<{ messageId: string; msg: unknown }[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c
    .from('game_messages')
    .select('data, message_id, sender_id')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data
    .filter((r) => r.sender_id !== 'sidechat')
    .map((r) => ({ messageId: r.message_id.replace(/^side-/, ''), msg: r.data }))
    .filter((r) => r.msg)
}

export const loadSidechatMessages = async (gameId: string): Promise<{ messageId: string; msg: unknown }[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c
    .from('game_messages')
    .select('data, message_id, sender_id')
    .eq('game_id', gameId)
    .eq('sender_id', 'sidechat')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data
    .map((r) => ({ messageId: String(r.message_id).replace(/^side-/, ''), msg: r.data }))
    .filter((r) => r.msg)
}

export const loadLeaderboards = async (): Promise<Leaderboard[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.from('leaderboard').select('*')
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id,
    provider: r.provider,
    model: r.model,
    gamesPlayed: r.games_played ?? 0,
    victories: r.victories ?? 0,
    checkmates: r.checkmates ?? 0,
    draws: r.draws ?? 0,
    illegalMoves: r.illegal_moves ?? 0,
    sumCentipawnScores: Number(r.sum_centipawn_scores ?? 0),
    sumHighestSwing: Number(r.sum_highest_swing ?? 0),
    sumTurns: r.sum_turns ?? 0,
  }))
}

/** All non-live game ids currently stored (for the hydrate cron). */
export const loadStoredGameIds = async (): Promise<string[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.from('games').select('id').neq('status', 'live-ai')
  if (error || !data) return []
  return data.map((r) => r.id)
}

export const loadPendingGames = async (): Promise<Game[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.from('games').select('state, status').eq('status', 'pending')
  if (error || !data) return []
  return data.map((r) => r.state as Game).filter(Boolean)
}

export const loadLiveAiGames = async (): Promise<LiveAiGames[]> => {
  const c = sb()
  if (!c) return []
  const { data, error } = await c.from('games').select('state, id').eq('status', 'live-ai')
  if (error || !data) return []
  return data.map((r) => r.state as LiveAiGames).filter(Boolean)
}

// ---------------- REHYDRATE (restore in-memory streams from Postgres) ----------------
//
// After a Render deploy/restart the in-memory + file streams are empty. These
// helpers restore them from Postgres. They are only called when a game is
// missing from memory, so the in-memory check is the natural de-dupe.

/**
 * Restore a single game (plus its moves, messages and sidechat) into the
 * in-memory streams from Postgres.
 *
 * Returns `{ game, hydrated }` where `hydrated` is true only when the game was
 * actually missing from memory and loaded from Postgres. Callers use `hydrated`
 * to decide whether a "vs AI" game needs its AI turn re-triggered (a redeploy
 * wiped the in-flight AI move, so the AI must be asked to move again).
 *
 * No-op when the game is already in memory (returns it with hydrated=false).
 */
export const hydrateGame = async (
  gameId: string,
  streams: FlowContextStateStreams,
): Promise<{ game: Game | null; hydrated: boolean }> => {
  const c = sb()
  if (!c) return { game: null, hydrated: false }

  const existing = await streams.chessGame.get('game', gameId)
  if (existing) return { game: existing, hydrated: false }

  const game = await loadGame(gameId)
  if (!game) return { game: null, hydrated: false }

  await streams.chessGame.set('game', gameId, game)

  const [moves, messages, sidechat] = await Promise.all([loadMoves(gameId), loadMessages(gameId), loadSidechatMessages(gameId)])
  for (const { moveId, move } of moves) {
    await streams.chessGameMove.set(gameId, moveId, move)
  }
  // Stored payloads are exactly the objects the stream originally held, so they
  // satisfy the stream's value type at runtime — cast past the opaque `unknown`.
  for (const { messageId, msg } of messages) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await streams.chessGameMessage.set(gameId, messageId, msg as any)
  }
  for (const { messageId, msg } of sidechat) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await streams.chessSidechatMessage.set(gameId, messageId, msg as any)
  }

  return { game, hydrated: true }
}

/**
 * Shared guard so a rehydrated "vs AI" game's AI turn is re-triggered at most
 * once per process lifetime (per redeploy). Both the lazy read path and the
 * cron call this before emitting the resume; the loser of the race skips.
 * In-memory only — a redeploy wipes it, which is exactly when re-resuming is
 * legitimate again.
 */
const _resumed = new Map<string, number>()
const RESUME_TTL_MS = 5 * 60 * 1000

export const claimAiResume = (gameId: string): boolean => {
  const now = Date.now()
  const last = _resumed.get(gameId)
  if (last !== undefined && now - last < RESUME_TTL_MS) return false
  _resumed.set(gameId, now)
  return true
}

/**
 * Re-trigger a "vs AI" game whose AI turn was lost to a redeploy.
 *
 * Only acts when the game is still `pending`, it's the AI's turn, and the
 * one-shot resume guard hasn't already fired for this game this deploy.
 * Emits `chess-game-moved`, which the existing `ChessGameMoved` handler
 * converts into an `ai-move` (it reads the game, sees the turn is AI, and
 * emits `ai-move`). Safe to call on every rehydrate — it's a no-op when the
 * human is on the move or the game is already finished.
 */
export const resumeAiIfStalled = async (
  gameId: string,
  streams: FlowContextStateStreams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit: any,
): Promise<boolean> => {
  const game = await streams.chessGame.get('game', gameId)
  if (!game || game.status !== 'pending') return false
  const turnPlayer = game.turn === 'white' ? game.players.white : game.players.black
  if (!turnPlayer?.ai) return false
  if (!claimAiResume(gameId)) return false

  await emit({
    topic: 'chess-game-moved',
    data: {
      gameId,
      player: game.turn === 'white' ? 'black' : 'white',
      fenBefore: game.fen,
      move: { from: 'resume', to: 'resume' },
    },
  })
  return true
}

/** Restore the global leaderboard into the stream if it's empty in memory. */
export const hydrateLeaderboard = async (streams: FlowContextStateStreams) => {
  const c = sb()
  if (!c) return 0
  const current = (await streams.chessLeaderboard.getGroup('global')) ?? []
  if (current.length > 0) return 0

  const entries = await loadLeaderboards()
  for (const lb of entries) {
    await streams.chessLeaderboard.set('global', lb.model, lb)
  }
  return entries.length
}

/** Restore the live-AI-games stream if it's empty in memory. */
export const hydrateLiveAiGames = async (streams: FlowContextStateStreams) => {
  const c = sb()
  if (!c) return 0
  const current = (await streams.chessLiveAiGames.getGroup('game')) ?? []
  if (current.length > 0) return 0

  const entries = await loadLiveAiGames()
  for (const live of entries) {
    await streams.chessLiveAiGames.set('game', live.id, live)
  }
  return entries.length
}


import type { Logger } from 'motia'

/**
 * Temporary debug: stream phase timings to the hermes_feed Supabase table
 * (readable on the status page). Lets us see exactly where the AI reply
 * time goes without access to Render logs. Fire-and-forget, never throws.
 * Remove once bot timing is verified.
 */
const SUPABASE_URL = 'https://prcmofuxywhkegetkrgy.supabase.co'

const feedLog = (gameId: string, label: string, data: Record<string, unknown>) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return
  const text = `[timing] game=${gameId} ${label} ${JSON.stringify(data)}`
  fetch(`${SUPABASE_URL}/rest/v1/hermes_feed?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ kind: 'progress', text }),
  }).catch(() => undefined)
}

export type TimingCtx = { gameId: string; t0: number; logger: Logger }

export const markPhase = (ctx: TimingCtx, label: string, extra: Record<string, unknown> = {}) => {
  const ms = Date.now() - ctx.t0
  ctx.logger.info(`[TIMING] ${label}`, { ms, ...extra })
  feedLog(ctx.gameId, label, { ms, ...extra })
}

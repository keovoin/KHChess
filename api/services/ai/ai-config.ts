import { AiModelProvider, AiModelProviderSchema } from '@chessarena/types/ai-models'
import { models, supportedModelsByProvider } from './models'
import { loadAiConfig, persistAiConfig, supabaseEnabled } from '../supabase/persistence'

/**
 * Runtime AI configuration (admin-settable via /admin/ai-config).
 *
 * Players just pick "vs AI"; this decides which model actually plays. The
 * config is kept in memory for fast reads AND mirrored to Supabase
 * (`ai_config`) so the admin's chosen model survives Render redeploys — a
 * deploy wipes in-memory state, so on first use we load it back from Postgres.
 */
type AiConfig = {
  provider: AiModelProvider
  model: string
}

const DEFAULT_CONFIG: AiConfig = {
  provider: 'openai',
  model: models.openai, // 'Qwen3.8-27B'
}

let config: AiConfig = { ...DEFAULT_CONFIG }
let configLoadAttempted = false

/**
 * Load the admin's stored AI config from Supabase into memory, once per process.
 * After a deploy the in-memory config is back to defaults; this restores the
 * admin's choice before the next game resolves a model. Safe to call any
 * number of times — it only hits Postgres once (no-op when disabled).
 */
export const ensureAiConfigLoaded = async (): Promise<void> => {
  if (configLoadAttempted || !supabaseEnabled()) return
  configLoadAttempted = true
  try {
    const stored = await loadAiConfig()
    if (stored) {
      const validProvider = AiModelProviderSchema().options.includes(stored.provider as AiModelProvider)
      const validModel = supportedModelsByProvider[stored.provider as AiModelProvider]?.includes(stored.model)
      if (validProvider && validModel) {
        config = { provider: stored.provider as AiModelProvider, model: stored.model }
      }
    }
  } catch {
    /* best-effort: fall back to defaults if the read fails */
  }
}

export const getAiConfig = (): AiConfig => ({ ...config })

/**
 * Validate + apply a config update. Returns the new config, or an error string.
 * Model must exist in the supported list for the (openai) provider.
 * Persists to Supabase (fire-and-forget) so it survives the next redeploy.
 */
export const setAiConfig = (update: { provider?: string; model?: string }): { ok: true; config: AiConfig } | { ok: false; error: string } => {
  const provider = update.provider ?? config.provider
  if (!AiModelProviderSchema().options.includes(provider as AiModelProvider)) {
    return { ok: false, error: `Invalid provider: ${provider}` }
  }

  const model = (update.model ?? config.model).trim()
  if (!supportedModelsByProvider[provider as AiModelProvider]?.includes(model)) {
    return { ok: false, error: `Model "${model}" is not supported for ${provider}` }
  }

  config = { provider: provider as AiModelProvider, model }
  persistAiConfig(config.provider, config.model)
  return { ok: true, config: getAiConfig() }
}

/** The provider players' AI seat should use. */
export const getAiProvider = (): AiModelProvider => config.provider

/**
 * Resolve the model for a player's AI seat: an explicit model (legacy games /
 * direct API calls) wins, otherwise the admin-configured default.
 */
export const resolveAiModel = (provider: AiModelProvider | undefined, model: string | undefined): string => {
  const p = provider ?? config.provider
  return model ?? (p === config.provider ? config.model : models[p])
}

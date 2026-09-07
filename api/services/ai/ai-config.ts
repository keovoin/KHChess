import { AiModelProvider, AiModelProviderSchema } from '@chessarena/types/ai-models'
import { models, supportedModelsByProvider } from './models'

/**
 * Runtime AI configuration (admin-settable via /admin/ai-config).
 *
 * The server only has the OpenAI-compatible endpoint (Qwen3.8-27B) wired, so
 * players just pick "vs AI" and this decides which model actually plays.
 *
 * NOTE: in-memory only — Render's free tier has no persistent disk, so the
 * config resets to defaults on every deploy/restart. A real store (Supabase)
 * is on the roadmap and will persist this too.
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

export const getAiConfig = (): AiConfig => ({ ...config })

/**
 * Validate + apply a config update. Returns the new config, or an error string.
 * Model must exist in the supported list for the (openai) provider.
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

import { apiClient } from '@/lib/auth/api-client'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Check, Loader2 } from 'lucide-react'
import type { AiModelProvider } from '@chessarena/types/ai-models'

type AiConfig = {
  provider: AiModelProvider
  model: string
  supportedModels?: string[]
}

// All providers the admin can switch between. Stockfish is the default:
// local engine, near-instant, zero API cost. The LLM providers (openai /
// gemini / claude / grok) need their API key configured on the server.
const PROVIDERS: { id: AiModelProvider; label: string; hint: string }[] = [
  { id: 'stockfish', label: 'Stockfish (Bot)', hint: 'Instant • local engine • free' },
  { id: 'gemini', label: 'Gemini (Google)', hint: 'Flash model • needs GEMINI_API_KEY' },
  { id: 'openai', label: 'OpenAI / Qwen', hint: 'LLM opponent' },
  { id: 'claude', label: 'Claude (Anthropic)', hint: 'LLM opponent' },
  { id: 'grok', label: 'Grok (xAI)', hint: 'LLM opponent' },
]

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : 'Request failed'

export const AiConfigCard: React.FC = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [provider, setProvider] = useState<AiModelProvider>('stockfish')
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const data = await apiClient.get<AiConfig>('/admin/ai-config')
      if (data?.model) {
        setConfig(data)
        setProvider(data.provider)
        setSelected(data.model)
      } else {
        setError('Failed to load AI config')
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching provider re-selects its default model.
  const pickProvider = (p: AiModelProvider) => {
    setProvider(p)
    if (p === provider) return
    const fallback = config && config.provider === p ? config.model : ''
    setSelected(fallback)
  }

  const save = async () => {
    if (!config || (provider === config.provider && selected === config.model)) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await apiClient.put<AiConfig>('/admin/ai-config', { provider, model: selected })
      if (data?.model) {
        setConfig({ ...config, provider: data.provider, model: data.model, supportedModels: data.supportedModels })
        setProvider(data.provider)
        setSelected(data.model)
        setSaved(true)
      } else {
        setError('Failed to update AI config')
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-4 flex flex-col gap-3">
        <h3 className="font-semibold">{t('admin.aiConfig')}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      </Card>
    )
  }

  const dirty = config && (provider !== config.provider || selected !== config.model)

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('admin.aiConfig')}</h3>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <Check className="size-3" /> {t('admin.aiConfigSaved')}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.aiConfigDesc')}</p>

      {error ? (
        <span className="text-sm text-red-500">{error}</span>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => pickProvider(p.id)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                  provider === p.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted',
                )}
              >
                <span className="font-medium">{p.label}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.hint}
                  {config?.provider === p.id && <Check className="size-4 shrink-0 text-primary" />}
                </span>
              </button>
            ))}
          </div>

          {provider === 'stockfish' ? (
            <p className="text-xs text-muted-foreground">
              Bot plays in ~0.5s per move, no LLM, no API cost. Strength scales with the server CPU.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(config?.provider === provider ? (config.supportedModels ?? []) : []).length > 0
                ? config?.supportedModels?.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelected(m)}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-mono transition',
                        selected === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted',
                      )}
                    >
                      {m}
                      {config?.model === m && config?.provider === provider && <Check className="size-4 shrink-0" />}
                    </button>
                  ))
                : (
                  <p className="text-xs text-muted-foreground">
                    Select a provider above; its model list loads when it is the active one.
                  </p>
                )}
            </div>
          )}
        </div>
      )}

      {dirty && (
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : t('admin.aiConfigSave')}
        </Button>
      )}
    </Card>
  )
}

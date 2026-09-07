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

const errMsg = (err: unknown): string =>
  err instanceof Error ? err.message : 'Request failed'

export const AiConfigCard: React.FC = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AiConfig | null>(null)
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

  const save = async () => {
    if (!config || selected === config.model) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const data = await apiClient.put<AiConfig>('/admin/ai-config', { model: selected })
      if (data?.model) {
        setConfig((prev) => (prev ? { ...prev, model: data.model } : prev))
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

  const models = config?.supportedModels?.length ? config.supportedModels : [config?.model].filter(Boolean) as string[]

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
        <div className="flex flex-col gap-2">
          {models.map((m) => (
            <button
              key={m}
              onClick={() => setSelected(m)}
              className={cn(
                'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-mono transition',
                selected === m
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground hover:bg-muted',
              )}
            >
              {m}
              {config?.model === m && <Check className="size-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {config && selected !== config.model && (
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="size-4 animate-spin" /> : t('admin.aiConfigSave')}
        </Button>
      )}
    </Card>
  )
}

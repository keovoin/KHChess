import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from './env'
import type { AiModels, AiModelProvider } from '@chessarena/types/ai-models'

export const useGetAiModels = () => {
  const [models, setModels] = useState<AiModels>({
    stockfish: [],
    openai: [],
    gemini: [],
    claude: [],
    grok: [],
  })
  // The model admin-configured for "vs AI" games — players no longer pick.
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<AiModelProvider | null>(null)

  const getAiModels = useCallback(async (): Promise<void> => {
    const res = await fetch(`${apiUrl}/chess/models`)

    if (!res.ok) {
      return
    }

    const data = await res.json()
    if (data?.models) {
      setModels(data.models)
    }
    if (typeof data?.activeModel === 'string') {
      setActiveModel(data.activeModel)
    }
    if (typeof data?.activeProvider === 'string') {
      setActiveProvider(data.activeProvider as AiModelProvider)
    }
  }, [])

  useEffect(() => {
    getAiModels().catch(() => console.error('Failed to get AI models'))
  }, [getAiModels])

  return { models, activeModel, activeProvider }
}

import React, { useEffect, useRef, useState } from 'react'
import { Chessground as ChessgroundApi } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'

interface Props {
  config?: Config
}

export const Chessground: React.FC<Props> = ({ config = {} }) => {
  const [api, setApi] = useState<Api | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref && ref.current && !api) {
      const chessgroundApi = ChessgroundApi(ref.current, {
        animation: { enabled: true, duration: 200 },
        ...config,
      })

      setApi(chessgroundApi)
    } else if (ref && ref.current && api) {
      api.set(config)
    }
  }, [ref, api, config])

  return (
    <div
      ref={ref}
      className="relative mx-auto aspect-square overflow-x-clip w-[min(100%,550px)] xl:w-[min(100%,calc(100dvh-32px))] 2xl:w-[min(100%,calc(100dvh-64px))]"
    />
  )
}

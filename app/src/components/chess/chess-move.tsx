import type React from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  from: string
  to: string
  color: 'white' | 'black'
}

export const ChessMove: React.FC<Props> = ({ from, to, color }) => {
  return (
    <div
      className={cn(
        'flex flex-row gap-1.5 items-center font-bold text-lg uppercase',
        color === 'white' ? 'text-black' : 'text-white',
      )}
    >
      {from}
      <ArrowRight className="size-4" />
      {to}
    </div>
  )
}

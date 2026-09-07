import { cn } from '@/lib/utils'

type Props = {
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Brand wordmark shown in place of the old Motia attribution.
 */
export const KhChessBrand = ({ className, size = 'sm' }: Props) => {
  return (
    <span
      className={cn(
        'inline-flex cursor-default select-none items-center gap-1.5 text-white/80 font-semibold tracking-wide',
        size === 'sm' ? 'text-sm' : 'text-base',
        className,
      )}
    >
      <span className="text-white">KHChess</span>
    </span>
  )
}

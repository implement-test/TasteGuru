import type { HTMLAttributes } from 'react'
import { cn } from '@/client/lib/cn'

const tones = {
  mint: 'bg-mint',
  peach: 'bg-peach',
  lavender: 'bg-lavender',
  butter: 'bg-butter',
  pink: 'bg-pink',
  plain: 'bg-surface-2',
} as const

export function Badge({ tone = 'plain', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-semibold text-ink', tones[tone], className)}
      {...props}
    />
  )
}

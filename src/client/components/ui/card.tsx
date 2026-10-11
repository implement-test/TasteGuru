import type { HTMLAttributes } from 'react'
import { cn } from '@/client/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border-2 border-line bg-surface p-5 shadow-retro', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('mb-3 text-lg', className)} {...props} />
}

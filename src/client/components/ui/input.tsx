import type { InputHTMLAttributes } from 'react'
import { cn } from '@/client/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'min-h-11 w-full rounded-xl border-2 border-line bg-surface px-3 text-base text-ink placeholder:text-muted',
        className,
      )}
      {...props}
    />
  )
}

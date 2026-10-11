import { cn } from '@/client/lib/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-pixel text-xl font-bold text-ink', className)}>
      <img src="/favicon.svg" alt="" width={28} height={28} />
      TasteGuru
    </span>
  )
}

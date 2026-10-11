import type { ReactNode } from 'react'

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="bg-dots flex flex-col items-center rounded-2xl border-2 border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 text-5xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="mb-2 text-lg">{title}</h2>
      {children && <div className="max-w-sm text-muted">{children}</div>}
    </div>
  )
}

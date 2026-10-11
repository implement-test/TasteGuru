import { EmptyState } from '@/client/components/EmptyState'

export function ComingSoonPage({ title, emoji, phase }: { title: string; emoji: string; phase: string }) {
  return (
    <>
      <h1 className="mb-6 text-2xl">{title}</h1>
      <EmptyState emoji={emoji} title="준비 중이에요">
        {phase}에서 만나요.
      </EmptyState>
    </>
  )
}

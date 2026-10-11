import { EmptyState } from '@/client/components/EmptyState'
import { useMe } from '@/client/lib/api'

export function HomePage() {
  const { data: me } = useMe()
  return (
    <>
      <h1 className="mb-1 text-2xl">안녕하세요, {me?.nickname}님!</h1>
      <p className="mb-6 text-muted">우리 그룹이 먹어 본 음식이 여기에 모여요.</p>
      <EmptyState emoji="🥟" title="아직 등록된 음식이 없어요">
        음식 등록과 평가는 다음 업데이트(2단계)에서 열려요.
      </EmptyState>
    </>
  )
}

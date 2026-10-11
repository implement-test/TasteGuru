import { Link } from 'react-router'
import { EmptyState } from '@/client/components/EmptyState'

export function NotFoundPage() {
  return (
    <EmptyState emoji="🍽️" title="페이지를 찾을 수 없어요">
      <Link to="/">홈으로 가기</Link>
    </EmptyState>
  )
}

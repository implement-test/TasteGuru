import { Plus, Search } from 'lucide-react'
import { useDeferredValue } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '@/client/components/EmptyState'
import { FoodCard } from '@/client/components/food/FoodCard'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { useFoods, useMe } from '@/client/lib/api'
import { cn } from '@/client/lib/cn'
import { FOOD_KIND_LABEL, isFoodKind, type FoodKind } from '@/shared/food'

const KINDS: ('' | FoodKind)[] = ['', 'product', 'meal_kit', 'delivery']

export function HomePage() {
  const { data: me } = useMe()
  // 검색 조건은 주소에 남겨 뒤로 가기·새로고침에도 유지
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const kindParam = params.get('kind')
  const kind = isFoodKind(kindParam) ? kindParam : ''
  const sort = params.get('sort') === 'top' ? 'top' : 'recent'
  const deferredQ = useDeferredValue(q.trim())
  const { data: foods, isPending, isError } = useFoods({ q: deferredQ, kind, sort })

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const filtered = !!(q || kind)

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl">안녕하세요, {me?.nickname}님!</h1>
          <p className="text-muted">우리 그룹이 먹어 본 음식이 여기에 모여요.</p>
        </div>
        <Button asChild className="hidden md:inline-flex">
          <Link to="/foods/new">
            <Plus size={18} aria-hidden /> 음식 추가
          </Link>
        </Button>
      </div>

      <div className="mb-3 relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <Input type="search" value={q} onChange={(e) => update('q', e.target.value)} placeholder="이름·브랜드·가게로 찾기" aria-label="음식 검색" className="pl-10" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="종류" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k || 'all'}
              type="button"
              aria-pressed={kind === k}
              onClick={() => update('kind', k)}
              className={cn('min-h-9 rounded-full border-2 border-line px-3 text-sm font-medium', kind === k ? 'bg-primary shadow-retro-sm' : 'bg-surface')}
            >
              {k ? FOOD_KIND_LABEL[k] : '전체'}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="sr-only">정렬</span>
          <select
            value={sort}
            onChange={(e) => update('sort', e.target.value === 'top' ? 'top' : '')}
            className="min-h-9 rounded-lg border-2 border-line bg-surface px-2 text-ink"
          >
            <option value="recent">최근 등록순</option>
            <option value="top">평점 높은순</option>
          </select>
        </label>
      </div>

      {isError ? (
        <p className="text-danger">목록을 불러오지 못했어요.</p>
      ) : isPending ? (
        <p className="text-muted" role="status">
          불러오는 중…
        </p>
      ) : !foods.length ? (
        filtered ? (
          <EmptyState emoji="🔍" title="찾는 음식이 없어요">
            다른 검색어로 찾아보거나 새로 등록해 주세요.
          </EmptyState>
        ) : (
          <EmptyState emoji="🥟" title="아직 등록된 음식이 없어요">
            <p className="mb-4">처음 먹어 본 음식을 등록해 보세요.</p>
            <Button asChild>
              <Link to="/foods/new">음식 추가하기</Link>
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {foods.length}개
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {foods.map((f) => (
              <li key={f.id} className="flex">
                <FoodCard food={f} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

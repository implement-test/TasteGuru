import { Link } from 'react-router'
import type { FoodSummary } from '@/shared/food'
import { FoodImg } from './FoodImage'
import { KindBadge } from './KindBadge'
import { Stars } from './Stars'

export function FoodCard({ food }: { food: FoodSummary }) {
  return (
    <Link
      to={`/foods/${food.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border-2 border-line bg-surface text-ink no-underline shadow-retro transition-transform hover:-translate-y-0.5"
    >
      <FoodImg src={food.thumbnail} className="aspect-square w-full border-b-2 border-line" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center gap-1.5">
          <KindBadge kind={food.kind} />
          {food.myOverall != null && <span className="text-xs text-muted">내 점수 {food.myOverall}</span>}
        </div>
        <p className="line-clamp-2 font-semibold leading-snug">{food.name}</p>
        {(food.brand || food.storeName) && <p className="truncate text-sm text-muted">{food.brand ?? food.storeName}</p>}
        <div className="mt-auto flex items-center gap-1.5 pt-1 text-sm">
          <Stars value={food.avgOverall} size={14} />
          <span className="text-muted">{food.avgOverall != null ? `${food.avgOverall} (${food.ratingCount}명)` : '평가 없음'}</span>
        </div>
      </div>
    </Link>
  )
}

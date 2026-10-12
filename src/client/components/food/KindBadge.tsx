import { Badge } from '@/client/components/ui/badge'
import { FOOD_KIND_LABEL, type FoodKind } from '@/shared/food'

const TONE = { product: 'mint', meal_kit: 'butter', delivery: 'peach' } as const

export function KindBadge({ kind }: { kind: FoodKind }) {
  return <Badge tone={TONE[kind]}>{FOOD_KIND_LABEL[kind]}</Badge>
}

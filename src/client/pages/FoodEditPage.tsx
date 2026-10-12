import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { FoodFields, toFoodBody, type FoodFieldValues } from '@/client/components/food/FoodFields'
import { Button } from '@/client/components/ui/button'
import { Card } from '@/client/components/ui/card'
import { Segmented } from '@/client/components/ui/segmented'
import { api, HttpError, queryKeys, useFood } from '@/client/lib/api'
import { FOOD_KIND_LABEL, validateFoodInput, type FoodDetail, type FoodKind } from '@/shared/food'

const KIND_OPTIONS = (Object.keys(FOOD_KIND_LABEL) as FoodKind[]).map((value) => ({ value, label: FOOD_KIND_LABEL[value] }))

function EditForm({ food }: { food: FoodDetail }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [kind, setKind] = useState<FoodKind>(food.kind)
  const [fields, setFields] = useState<FoodFieldValues>({
    name: food.name,
    brand: food.brand ?? '',
    storeName: food.storeName ?? '',
    price: food.price != null ? String(food.price) : '',
    sourceUrl: food.sourceUrl ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const body = toFoodBody(kind, fields)
      const check = validateFoodInput(body)
      if (!check.ok) throw new Error(check.message)
      return api(`/api/foods/${food.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.food(food.id) })
      qc.invalidateQueries({ queryKey: queryKeys.foods })
      navigate(`/foods/${food.id}`)
    },
    onError: (e) => setError(e instanceof HttpError || e instanceof Error ? e.message : '저장하지 못했어요.'),
  })
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate()
  }
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card className="space-y-5">
        <Segmented legend="종류" value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <FoodFields kind={kind} values={fields} onChange={setFields} />
        {error && (
          <p role="alert" className="rounded-xl border-2 border-line bg-peach p-3 text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? '저장하는 중…' : '저장'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/foods/${food.id}`)}>
            취소
          </Button>
        </div>
        <p className="text-sm text-muted">사진은 음식 상세 화면에서 추가·삭제할 수 있어요.</p>
      </Card>
    </form>
  )
}

export function FoodEditPage() {
  const { id = '' } = useParams()
  const { data, isPending } = useFood(id)
  if (isPending) return <p role="status">불러오는 중…</p>
  if (!data || !data.food.canEdit) return <Navigate to={`/foods/${id}`} replace />
  return (
    <>
      <h1 className="mb-6 text-2xl">음식 정보 수정</h1>
      <EditForm food={data.food} />
    </>
  )
}

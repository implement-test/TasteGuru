import { Input } from '@/client/components/ui/input'
import { BRAND_MAX, NAME_MAX, type FoodKind } from '@/shared/food'

export interface FoodFieldValues {
  name: string
  brand: string
  storeName: string
  price: string
  sourceUrl: string
}

export const emptyFields: FoodFieldValues = { name: '', brand: '', storeName: '', price: '', sourceUrl: '' }

/** 화면 입력값 → API 본문 */
export function toFoodBody(kind: FoodKind, v: FoodFieldValues) {
  const price = v.price.replace(/[^\d]/g, '')
  return {
    kind,
    name: v.name,
    brand: kind === 'delivery' ? null : v.brand || null,
    storeName: kind === 'delivery' ? v.storeName || null : null,
    price: price ? Number(price) : null,
    sourceUrl: v.sourceUrl.trim() || null,
  }
}

function Field({ id, label, required, hint, children }: { id: string; label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-semibold">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function FoodFields({ kind, values, onChange }: { kind: FoodKind; values: FoodFieldValues; onChange: (v: FoodFieldValues) => void }) {
  const set = (key: keyof FoodFieldValues) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...values, [key]: e.target.value })
  return (
    <div className="space-y-4">
      <Field id="food-name" label={kind === 'delivery' ? '메뉴 이름' : '제품 이름'} required>
        <Input id="food-name" value={values.name} onChange={set('name')} maxLength={NAME_MAX} required placeholder={kind === 'delivery' ? '예: 김치찌개' : '예: 왕교자 1.05kg'} />
      </Field>
      {kind === 'delivery' ? (
        <Field id="food-store" label="가게 이름" required>
          <Input id="food-store" value={values.storeName} onChange={set('storeName')} maxLength={BRAND_MAX} required placeholder="예: 엄마손 식당" />
        </Field>
      ) : (
        <Field id="food-brand" label="브랜드">
          <Input id="food-brand" value={values.brand} onChange={set('brand')} maxLength={BRAND_MAX} placeholder="예: 비비고" />
        </Field>
      )}
      <Field id="food-price" label="가격" hint="산 가격이나 참고 가격 (선택)">
        <div className="flex items-center gap-2">
          <Input id="food-price" value={values.price} onChange={set('price')} inputMode="numeric" placeholder="예: 11480" className="max-w-48" />
          <span>원</span>
        </div>
      </Field>
      <Field id="food-url" label={kind === 'delivery' ? '가게·메뉴 링크' : '구매 링크'}>
        <Input id="food-url" type="url" value={values.sourceUrl} onChange={set('sourceUrl')} placeholder="https://" />
      </Field>
    </div>
  )
}

import { useId } from 'react'
import { cn } from '@/client/lib/cn'
import type { TasteAttribute } from '@/shared/food'

const LEVELS = [null, 0, 1, 2, 3, 4, 5] as const

/** 맛 강도 입력: '–'(안 매김) 또는 0~5 */
export function IntensityInput({ attribute, value, onChange }: { attribute: TasteAttribute; value: number | null; onChange: (v: number | null) => void }) {
  const name = useId()
  const guideId = `${name}-guide`
  return (
    <fieldset aria-describedby={attribute.guide ? guideId : undefined}>
      <legend className="flex items-baseline gap-2 font-semibold">
        <span aria-hidden>{attribute.emoji}</span>
        {attribute.name}
      </legend>
      {attribute.guide && (
        <p id={guideId} className="mb-1.5 text-xs text-muted">
          {attribute.guide}
        </p>
      )}
      <div className="flex gap-1">
        {LEVELS.map((lv) => (
          <label
            key={String(lv)}
            className={cn(
              'flex min-h-10 min-w-10 flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-line text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus',
              value === lv ? (lv === null ? 'bg-surface-2' : 'bg-primary shadow-retro-sm') : 'bg-surface',
            )}
          >
            <input type="radio" name={name} className="sr-only" checked={value === lv} onChange={() => onChange(lv)} />
            {lv === null ? <span aria-label="안 매김">–</span> : lv}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

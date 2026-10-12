import { Star } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/client/lib/cn'

/** 점수 표시 (소수점은 반올림해 별 개수로) */
export function Stars({ value, size = 16, className }: { value: number | null; size?: number; className?: string }) {
  const filled = value == null ? 0 : Math.round(value)
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={value == null ? '평가 없음' : `5점 중 ${value}점`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden className={i <= filled ? 'fill-star text-ink' : 'text-muted'} strokeWidth={2} />
      ))}
    </span>
  )
}

/** 종합 점수 입력 (별 1~5, 라디오) */
export function StarInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-1 font-semibold">
        종합 점수 <span className="text-danger">*</span>
      </legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <label
            key={i}
            className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus"
          >
            <input type="radio" name={name} className="sr-only" checked={value === i} onChange={() => onChange(i)} />
            <span className="sr-only">{i}점</span>
            <Star size={36} aria-hidden className={value != null && i <= value ? 'fill-star text-ink' : 'text-muted'} strokeWidth={1.75} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

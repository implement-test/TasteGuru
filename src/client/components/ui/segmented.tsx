import { useId } from 'react'
import { cn } from '@/client/lib/cn'

interface Option<T extends string> {
  value: T
  label: string
}

/** 라디오 버튼 기반 선택 컨트롤 (키보드 화살표로 이동 가능) */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'relative inline-flex min-h-11 cursor-pointer items-center rounded-xl border-2 border-line px-4 font-medium has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
              value === o.value ? 'bg-primary shadow-retro-sm' : 'bg-surface',
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

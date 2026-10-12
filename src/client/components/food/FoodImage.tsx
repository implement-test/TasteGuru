import { useState } from 'react'
import { cn } from '@/client/lib/cn'

/** 음식 사진. 쇼핑몰 이미지가 깨지면 기본 그림으로 바꾼다 */
export function FoodImg({ src, alt = '', className }: { src: string | null; alt?: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <div className={cn('bg-dots flex items-center justify-center bg-surface-2 text-4xl', className)} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <span aria-hidden>🍽️</span>
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn('object-cover', className)} />
}

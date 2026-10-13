// 음식·평가 관련 공용 타입과 검증 (화면·서버 공용)
export type FoodKind = 'product' | 'meal_kit' | 'delivery'
export type FoodSource = 'manual' | 'url' | 'api'

export const FOOD_KIND_LABEL: Record<FoodKind, string> = {
  product: '완제품',
  meal_kit: '밀키트',
  delivery: '배달 메뉴',
}

export const MAX_IMAGES = 5
export const NAME_MAX = 80
export const BRAND_MAX = 40
export const MEMO_MAX = 500
export const PRICE_MAX = 10_000_000
export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024
export const UPLOAD_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const

export interface TasteAttribute {
  id: string
  name: string
  emoji: string
  guide: string | null
}

export interface FoodImage {
  id: string
  src: string
  storage: 'external' | 'r2'
}

export interface FoodSummary {
  id: string
  kind: FoodKind
  name: string
  brand: string | null
  storeName: string | null
  thumbnail: string | null
  avgOverall: number | null
  ratingCount: number
  myOverall: number | null
  createdAt: number
}

export interface AttributeStat {
  attributeId: string
  avg: number | null
  count: number
}

export interface RatingView {
  userId: string
  nickname: string
  image: string | null
  overall: number
  scores: Record<string, number>
  memo: string | null
  updatedAt: number
}

export interface FoodDetail {
  id: string
  kind: FoodKind
  name: string
  brand: string | null
  storeName: string | null
  price: number | null
  sourceUrl: string | null
  source: FoodSource
  createdBy: { id: string; nickname: string } | null
  createdAt: number
  updatedAt: number
  images: FoodImage[]
  avgOverall: number | null
  ratingCount: number
  attributeStats: AttributeStat[]
  ratings: RatingView[]
  myRating: RatingView | null
  canEdit: boolean
}

export interface FoodInput {
  kind: FoodKind
  name: string
  brand?: string | null
  storeName?: string | null
  price?: number | null
  sourceUrl?: string | null
  source?: FoodSource
  /** 쇼핑몰 이미지 주소 (URL 가져오기 결과) */
  externalImages?: string[]
}

export interface RatingInput {
  overall: number
  scores: Record<string, number | null>
  memo?: string | null
}

/** URL에서 가져온 상품 정보 */
export interface ImportedProduct {
  url: string
  name: string | null
  brand: string | null
  price: number | null
  image: string | null
  siteName: string | null
}

const str = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string') return undefined
  const s = v.trim().replace(/\s+/g, ' ')
  if (!s) return null
  return s.length <= max ? s : undefined
}

export const isFoodKind = (v: unknown): v is FoodKind => v === 'product' || v === 'meal_kit' || v === 'delivery'

export function isHttpUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 2000) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export type Validated<T> = { ok: true; value: T } | { ok: false; message: string }

/** 음식 입력 검증. partial이면 수정용(넘어온 필드만 검사) */
export function validateFoodInput(raw: unknown, partial = false): Validated<Partial<FoodInput>> {
  if (!raw || typeof raw !== 'object') return { ok: false, message: '입력 형식이 올바르지 않아요.' }
  const r = raw as Record<string, unknown>
  const out: Partial<FoodInput> = {}

  if (r.kind !== undefined || !partial) {
    if (!isFoodKind(r.kind)) return { ok: false, message: '음식 종류를 골라 주세요.' }
    out.kind = r.kind
  }
  if (r.name !== undefined || !partial) {
    const name = str(r.name, NAME_MAX)
    if (!name) return { ok: false, message: `이름은 1~${NAME_MAX}자로 입력해 주세요.` }
    out.name = name
  }
  for (const [key, max] of [
    ['brand', BRAND_MAX],
    ['storeName', BRAND_MAX],
  ] as const) {
    if (r[key] === undefined) continue
    const v = str(r[key], max)
    if (v === undefined) return { ok: false, message: `${key === 'brand' ? '브랜드' : '가게 이름'}은 ${max}자까지 입력할 수 있어요.` }
    out[key] = v
  }
  if (r.price !== undefined) {
    if (r.price === null || r.price === '') out.price = null
    else if (typeof r.price === 'number' && Number.isInteger(r.price) && r.price >= 0 && r.price <= PRICE_MAX) out.price = r.price
    else return { ok: false, message: '가격은 0~1,000만 원 사이 숫자로 입력해 주세요.' }
  }
  if (r.sourceUrl !== undefined) {
    if (r.sourceUrl === null || r.sourceUrl === '') out.sourceUrl = null
    else if (isHttpUrl(r.sourceUrl)) out.sourceUrl = r.sourceUrl
    else return { ok: false, message: '구매 링크는 http(s) 주소로 입력해 주세요.' }
  }
  if (r.source !== undefined) {
    if (r.source !== 'manual' && r.source !== 'url' && r.source !== 'api') return { ok: false, message: '입력 출처가 올바르지 않아요.' }
    out.source = r.source
  }
  if (r.externalImages !== undefined) {
    if (!Array.isArray(r.externalImages) || r.externalImages.length > MAX_IMAGES || !r.externalImages.every(isHttpUrl)) {
      return { ok: false, message: `사진 주소가 올바르지 않거나 ${MAX_IMAGES}개를 넘었어요.` }
    }
    out.externalImages = r.externalImages
  }
  const kind = out.kind
  if (!partial && kind === 'delivery' && !out.storeName) return { ok: false, message: '배달 메뉴는 가게 이름을 입력해 주세요.' }
  return { ok: true, value: out }
}

export function validateRatingInput(raw: unknown, attributeIds: string[]): Validated<RatingInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, message: '입력 형식이 올바르지 않아요.' }
  const r = raw as Record<string, unknown>
  const overall = r.overall
  if (typeof overall !== 'number' || !Number.isInteger(overall) || overall < 1 || overall > 5) {
    return { ok: false, message: '종합 점수(별 1~5개)를 골라 주세요.' }
  }
  const scores: Record<string, number | null> = {}
  if (r.scores !== undefined) {
    if (!r.scores || typeof r.scores !== 'object') return { ok: false, message: '맛 점수 형식이 올바르지 않아요.' }
    for (const [id, v] of Object.entries(r.scores as Record<string, unknown>)) {
      if (!attributeIds.includes(id)) return { ok: false, message: '알 수 없는 맛 항목이 있어요.' }
      if (v === null) scores[id] = null
      else if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5) scores[id] = v
      else return { ok: false, message: '맛 점수는 0~5 사이로 골라 주세요.' }
    }
  }
  const memo = str(r.memo ?? null, MEMO_MAX)
  if (memo === undefined) return { ok: false, message: `메모는 ${MEMO_MAX}자까지 쓸 수 있어요.` }
  return { ok: true, value: { overall, scores, memo } }
}

/** API 검색 결과 후보 (초안) */
export interface ProductCandidate {
  name: string
  brand: string | null
  image: string | null
  price: number | null
  url: string | null
  provider: string
}

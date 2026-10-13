// ── API를 통한 상품 검색 입력 ──
// 상품명으로 검색해 후보를 고르면 이름·사진을 채운다. 설계: docs/TasteGuru_API입력_초안.md
import type { ProductCandidate } from '../../shared/food'
import { cleanTitle } from './url'

export interface ProductSearchProvider {
  /** 공급자 식별자 (설정·로그용) */
  id: string
  /** 화면에 보이는 이름 */
  label: string
  /** 필요한 키가 모두 설정됐는지 */
  isEnabled(env: Env): boolean
  /** 검색어로 상품 후보를 찾는다. 실패하면 SearchError */
  search(query: string, env: Env): Promise<ProductCandidate[]>
}

export class SearchError extends Error {}

const NAVER_HUB_IMAGE_URL = 'https://naverapihub.apigw.ntruss.com/search/v1/image'
const SEARCH_TIMEOUT_MS = 8000
const SEARCH_DISPLAY = 20
export const SEARCH_MAX_RESULTS = 12

/** NAVER API HUB 키. NAVER_HUB_* 이름을 우선하고, NAVER_* 이름도 받는다 */
export function naverHubKeys(env: Env): { id: string; secret: string } | null {
  const id = env.NAVER_HUB_CLIENT_ID || env.NAVER_CLIENT_ID
  const secret = env.NAVER_HUB_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  return id && secret ? { id, secret } : null
}

interface NaverImageItem {
  title?: string
  link?: string
  thumbnail?: string
  sizeheight?: string
  sizewidth?: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

/** 검색 결과 제목: <b> 강조와 HTML 엔티티를 걷어낸다 */
export function plainTitle(raw: string): string {
  return raw
    .replace(/<\/?b>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim()
}

/** http 이미지 주소는 https로 (https 화면에서 섞인 콘텐츠로 막히지 않게) */
function toHttps(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** 이미지 검색 결과 → 상품 후보. "상품명 : 쇼핑몰" 제목에서 쇼핑몰 이름을 떼어 낸다 */
export function toCandidates(items: NaverImageItem[], provider: string): ProductCandidate[] {
  const seen = new Set<string>()
  const out: ProductCandidate[] = []
  for (const it of items) {
    const image = toHttps(it.link)
    if (!image || seen.has(image)) continue
    seen.add(image)
    const title = plainTitle(it.title ?? '')
    const mall = title.match(/\s+:\s+([^:]{1,30})$/u)
    const { name, brand } = cleanTitle(mall ? title.slice(0, mall.index) : title, mall?.[1].trim() ?? null, null)
    out.push({
      name,
      brand,
      image,
      thumbnail: toHttps(it.thumbnail) ?? image,
      price: null,
      url: null,
      provider,
    })
    if (out.length >= SEARCH_MAX_RESULTS) break
  }
  return out
}

/**
 * NAVER API HUB 이미지 검색.
 * - 네이버 쇼핑 검색 API는 2026-07-31 종료 → 이미지 검색으로 "대표 사진 + 이름 초안" 후보를 찾는다
 * - 인증: X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY (네이버 클라우드 플랫폼 Application 키)
 * - 가격·브랜드는 오지 않는다
 */
export const naverApiHubProvider: ProductSearchProvider = {
  id: 'naver-api-hub',
  label: '네이버 검색',
  isEnabled: (env) => !!naverHubKeys(env),
  async search(query, env) {
    const keys = naverHubKeys(env)
    if (!keys) throw new SearchError('naver keys not configured')
    const url = `${NAVER_HUB_IMAGE_URL}?${new URLSearchParams({ query, display: String(SEARCH_DISPLAY), sort: 'sim', filter: 'large' })}`
    let res: Response
    try {
      res = await fetch(url, {
        headers: { 'X-NCP-APIGW-API-KEY-ID': keys.id, 'X-NCP-APIGW-API-KEY': keys.secret },
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      })
    } catch (e) {
      throw new SearchError(`naver request failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new SearchError(`naver ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json<{ items?: NaverImageItem[] }>().catch(() => null)
    if (!data || !Array.isArray(data.items)) throw new SearchError('naver response has no items')
    return toCandidates(data.items, this.id)
  },
}

export const PROVIDERS: ProductSearchProvider[] = [naverApiHubProvider]

export function activeProvider(env: Env): ProductSearchProvider | null {
  return PROVIDERS.find((p) => p.isEnabled(env)) ?? null
}

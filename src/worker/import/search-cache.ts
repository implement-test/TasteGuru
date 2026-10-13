// 상품 검색 결과 하루 캐시 (Cloudflare Cache API).
// 같은 검색어는 하루 동안 외부 API를 다시 부르지 않는다 (NAVER API HUB 유료화 대비).
// Cache API는 데이터센터별로 따로 저장되고, 공간이 부족하면 하루가 되기 전에 지워질 수 있다.
import type { ProductCandidate } from '../../shared/food'
import type { ProductSearchProvider } from './providers'

export const SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60
export const SEARCH_QUERY_MAX = 50

/** 캐시 키용 검색어: 앞뒤 공백·연속 공백·대소문자 차이를 없앤다 */
export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').slice(0, SEARCH_QUERY_MAX).toLowerCase()
}

function cacheKey(origin: string, providerId: string, query: string): Request {
  return new Request(`${origin}/__cache/import-search/${providerId}?q=${encodeURIComponent(query)}`)
}

/**
 * 캐시에 있으면 그대로, 없으면 검색한 뒤 저장한다. 검색 실패(SearchError)는 저장하지 않는다.
 * @param origin 캐시 키에 쓸 주소 (요청 주소의 origin)
 * @param waitUntil 응답 후에 저장을 마치게 하는 함수
 */
export async function cachedSearch(
  provider: ProductSearchProvider,
  rawQuery: string,
  env: Env,
  opts: { origin: string; waitUntil: (p: Promise<unknown>) => void; cache?: Cache },
): Promise<{ items: ProductCandidate[]; cached: boolean }> {
  const query = normalizeQuery(rawQuery)
  const cache = opts.cache ?? caches.default
  const key = cacheKey(opts.origin, provider.id, query)

  const hit = await cache.match(key).catch(() => undefined)
  if (hit) {
    const items = await hit.json<ProductCandidate[]>().catch(() => null)
    if (Array.isArray(items)) return { items, cached: true }
  }

  const items = await provider.search(query, env)
  const res = Response.json(items, { headers: { 'cache-control': `public, max-age=${SEARCH_CACHE_TTL_SECONDS}` } })
  opts.waitUntil(cache.put(key, res).catch((e) => console.error('search cache put failed', e)))
  return { items, cached: false }
}

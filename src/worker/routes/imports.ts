import { Hono } from 'hono'
import type { ProductCandidate } from '../../shared/food'
import { fail, type AppEnv } from '../app'
import { activeProvider, SearchError } from '../import/providers'
import { cachedSearch } from '../import/search-cache'
import { ImportError, importFromUrl } from '../import/url'

export const imports = new Hono<AppEnv>()

// 상품 URL 붙여넣기 → 제품명·사진·가격·브랜드
imports.post('/import/url', async (c) => {
  const body = await c.req.json<{ url?: unknown }>().catch(() => ({}) as { url?: unknown })
  try {
    return c.json(await importFromUrl(body.url))
  } catch (e) {
    if (e instanceof ImportError) return fail(c, e.code === 'invalid_url' ? 400 : 422, e.code, e.message)
    throw e
  }
})

// API 상품 검색: 공급자 키가 없으면 501, 외부 API 실패는 502. 같은 검색어는 하루 캐시
imports.get('/import/search', async (c) => {
  const provider = activeProvider(c.env)
  if (!provider) return fail(c, 501, 'search_not_configured', '상품 검색은 준비 중이에요.')
  const q = c.req.query('q')?.trim()
  if (!q) return fail(c, 400, 'invalid_query', '검색어를 입력해 주세요.')
  try {
    const { items, cached } = await cachedSearch(provider, q, c.env, {
      origin: new URL(c.req.url).origin,
      waitUntil: (p) => c.executionCtx.waitUntil(p),
    })
    const body: { provider: string; items: ProductCandidate[] } = { provider: provider.id, items }
    return c.json(body, 200, { 'x-search-cache': cached ? 'hit' : 'miss' })
  } catch (e) {
    if (!(e instanceof SearchError)) throw e
    console.error('product search failed', provider.id, e.message)
    return fail(c, 502, 'search_failed', '검색하지 못했어요. 잠시 후 다시 해 보거나 직접 입력해 주세요.')
  }
})

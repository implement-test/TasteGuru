import { Hono } from 'hono'
import { fail, type AppEnv } from '../app'
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

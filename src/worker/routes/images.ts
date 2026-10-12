import { Hono } from 'hono'
import { fail, type AppEnv } from '../app'

// 직접 올린 사진 제공 (그룹원만). 키에 무작위 ID가 있어 내용이 바뀌지 않으므로 오래 캐시한다.
export const images = new Hono<AppEnv>()

images.get('/images/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/images\//, '')
  if (!key.startsWith('foods/')) return fail(c, 404, 'image_not_found', '사진을 찾을 수 없어요.')
  const obj = await c.env.MEDIA.get(key)
  if (!obj) return fail(c, 404, 'image_not_found', '사진을 찾을 수 없어요.')
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('cache-control', 'private, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

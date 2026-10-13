import { describe, expect, it } from 'vitest'
import { activeProvider, PROVIDERS } from '../src/worker/import/providers'
import { call, memberSession } from './helpers'

describe('API 상품 검색 (공급자 없음)', () => {
  it('네이버 키가 있어도 공급자가 켜지지 않는다 (검색 API 약관상 결과 저장 불가로 제거)', () => {
    expect(PROVIDERS).toHaveLength(0)
    expect(activeProvider({ NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 'secret' } as unknown as Env)).toBeNull()
  })

  it('GET /api/import/search: 로그인하지 않으면 401, 로그인하면 501', async () => {
    expect((await call('/api/import/search?q=신라면')).status).toBe(401)
    const member = await memberSession('searcher@test.local')
    const res = await call(`/api/import/search?q=${encodeURIComponent('신라면')}`, { cookie: member })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('search_not_configured')
  })

  it('설정 화면용 config도 상품 검색을 끈다', async () => {
    expect(await (await call('/api/config')).json()).toMatchObject({ productSearch: { enabled: false, label: null } })
  })
})

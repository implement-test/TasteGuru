import { afterEach, describe, expect, it, vi } from 'vitest'
import { activeProvider, naverApiHubProvider, naverHubKeys, plainTitle, SearchError, toCandidates } from '../src/worker/import/providers'
import { call, memberSession } from './helpers'

const keyed = (extra: Partial<Env> = {}) => ({ NAVER_HUB_CLIENT_ID: 'hub-id', NAVER_HUB_CLIENT_SECRET: 'hub-secret', ...extra }) as Env

// 실제 API HUB 이미지 검색 응답(2026-10-13 "신라면")을 줄인 것
const SAMPLE = {
  lastBuildDate: 'Tue, 13 Oct 2026 10:46:48 +0900',
  total: 387728,
  start: 1,
  display: 3,
  items: [
    {
      title: '농심 <b>신라면</b> 5개입 : 스낵365',
      link: 'http://shop1.phinf.naver.net/20260619_264/a.png',
      thumbnail: 'https://search.pstatic.net/common/?type=b150&src=http%3A%2F%2Fshop1.phinf.naver.net%2Fa.png',
      sizeheight: '1000',
      sizewidth: '1000',
    },
    {
      title: '[슈퍼와] 신라면 멀티팩 5개입 : 슈퍼와',
      link: 'https://shop-phinf.pstatic.net/20260601_34/b.png',
      thumbnail: 'https://search.pstatic.net/common/?type=b150&src=b.png',
      sizeheight: '1000',
      sizewidth: '1000',
    },
    { title: '신라면 로제 4개입 x 3개', link: 'https://cdn2.halfclub.com/c.jpg', thumbnail: 'https://search.pstatic.net/sunny/?type=b150&src=c.jpg' },
    { title: '중복 사진', link: 'https://cdn2.halfclub.com/c.jpg', thumbnail: '' },
    { title: '주소 없음' },
  ],
}

afterEach(() => vi.restoreAllMocks())

describe('네이버 API HUB 키', () => {
  it('NAVER_HUB_* 를 우선하고 NAVER_* 이름도 받는다', () => {
    expect(naverHubKeys(keyed())).toEqual({ id: 'hub-id', secret: 'hub-secret' })
    expect(naverHubKeys({ NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 'secret' } as Env)).toEqual({ id: 'id', secret: 'secret' })
    expect(naverHubKeys({ NAVER_CLIENT_ID: 'id' } as Env)).toBeNull()
    expect(activeProvider({} as Env)).toBeNull()
    expect(activeProvider({ NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 'secret' } as Env)?.id).toBe('naver-api-hub')
  })
})

describe('이미지 검색 결과 변환', () => {
  it('제목의 <b>·엔티티를 걷어낸다', () => {
    expect(plainTitle('<b>비비고</b> 왕교자 &amp; 물만두 &quot;1kg&quot;')).toBe('비비고 왕교자 & 물만두 "1kg"')
  })

  it('쇼핑몰 이름을 떼고, http 사진은 https로, 중복·주소 없는 결과는 뺀다', () => {
    expect(toCandidates(SAMPLE.items, 'naver-api-hub')).toEqual([
      {
        name: '농심 신라면 5개입',
        brand: null,
        image: 'https://shop1.phinf.naver.net/20260619_264/a.png',
        thumbnail: SAMPLE.items[0].thumbnail,
        price: null,
        url: null,
        provider: 'naver-api-hub',
      },
      {
        name: '신라면 멀티팩 5개입',
        brand: null,
        image: 'https://shop-phinf.pstatic.net/20260601_34/b.png',
        thumbnail: SAMPLE.items[1].thumbnail,
        price: null,
        url: null,
        provider: 'naver-api-hub',
      },
      {
        name: '신라면 로제 4개입 x 3개',
        brand: null,
        image: 'https://cdn2.halfclub.com/c.jpg',
        thumbnail: SAMPLE.items[2].thumbnail,
        price: null,
        url: null,
        provider: 'naver-api-hub',
      },
    ])
  })

  it('[브랜드] 표시는 브랜드로 쓴다', () => {
    expect(toCandidates([{ title: '[비비고] 왕교자 1.05kg : 컬리', link: 'https://x.com/a.jpg' }], 'p')[0]).toMatchObject({ name: '왕교자 1.05kg', brand: '비비고' })
  })
})

describe('네이버 API HUB 호출', () => {
  it('API HUB 주소와 인증 헤더로 이미지 검색을 부른다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(SAMPLE))
    const items = await naverApiHubProvider.search('신라면', keyed())
    expect(items).toHaveLength(3)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://naverapihub.apigw.ntruss.com/search/v1/image')
    expect(u.searchParams.get('query')).toBe('신라면')
    expect(init.headers).toEqual({ 'X-NCP-APIGW-API-KEY-ID': 'hub-id', 'X-NCP-APIGW-API-KEY': 'hub-secret' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('인증 실패·네트워크 오류·이상한 응답은 SearchError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({ error: { errorCode: 401, message: '요청한 API는 이 Application에서 활성화되어 있지 않습니다.' } }, { status: 401 }),
    )
    await expect(naverApiHubProvider.search('신라면', keyed())).rejects.toThrow(SearchError)

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
    await expect(naverApiHubProvider.search('신라면', keyed())).rejects.toThrow(SearchError)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<html>oops</html>'))
    await expect(naverApiHubProvider.search('신라면', keyed())).rejects.toThrow(SearchError)
  })
})

describe('GET /api/import/search', () => {
  it('로그인하지 않으면 401, 키가 없으면 501', async () => {
    expect((await call('/api/import/search?q=신라면')).status).toBe(401)
    const member = await memberSession('searcher@test.local')
    const res = await call(`/api/import/search?q=${encodeURIComponent('신라면')}`, { cookie: member })
    expect(res.status).toBe(501)
    expect(((await res.json()) as { error: string }).error).toBe('search_not_configured')
  })
})

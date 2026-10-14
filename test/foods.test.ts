import { env } from 'cloudflare:workers'
import { beforeAll, describe, expect, it } from 'vitest'
import type { FoodDetail, FoodSummary, TasteAttribute } from '../src/shared/food'
import { adminSession, call, memberSession } from './helpers'

let admin: string
let member: string
let other: string

beforeAll(async () => {
  admin = await adminSession()
  member = await memberSession('member@test.local')
  other = await memberSession('other@test.local')
})

async function createFood(cookie: string, body: Record<string, unknown>) {
  const res = await call('/api/foods', { method: 'POST', cookie, json: body })
  return { res, id: res.ok ? ((await res.json()) as { id: string }).id : '' }
}

const detail = async (cookie: string, id: string) =>
  (await (await call(`/api/foods/${id}`, { cookie })).json()) as { food: FoodDetail; attributes: TasteAttribute[] }

describe('음식 등록', () => {
  it('로그인하지 않으면 401', async () => {
    expect((await call('/api/foods')).status).toBe(401)
  })

  it('기본 맛 항목 8개가 있다', async () => {
    const attrs = (await (await call('/api/attributes', { cookie: member })).json()) as TasteAttribute[]
    expect(attrs.map((a) => a.id)).toEqual(['sweet', 'salty', 'spicy', 'sour', 'bitter', 'umami', 'greasy', 'texture'])
  })

  it('입력 검증: 이름 필수, 배달 메뉴는 가게 이름 필수, 가격·링크 형식', async () => {
    expect((await createFood(member, { kind: 'product', name: ' ' })).res.status).toBe(400)
    expect((await createFood(member, { kind: 'delivery', name: '김치찌개' })).res.status).toBe(400)
    expect((await createFood(member, { kind: 'product', name: '만두', price: -1 })).res.status).toBe(400)
    expect((await createFood(member, { kind: 'product', name: '만두', sourceUrl: 'javascript:alert(1)' })).res.status).toBe(400)
    expect((await createFood(member, { kind: 'pizza', name: '만두' })).res.status).toBe(400)
    // 상품 검색(API) 입력은 v0.2.4에서 제거
    expect((await createFood(member, { kind: 'product', name: '만두', source: 'api' })).res.status).toBe(400)
    expect((await call('/api/import/search?q=만두', { cookie: member })).status).toBe(404)
  })

  it('URL에서 가져온 정보와 쇼핑몰 사진으로 등록', async () => {
    const { res, id } = await createFood(member, {
      kind: 'product',
      name: '왕교자 만두 대용량 1.05kg',
      brand: '비비고',
      price: 11480,
      sourceUrl: 'https://www.kurly.com/goods/5082274',
      source: 'url',
      externalImages: ['https://product-image.kurly.com/a.jpg'],
    })
    expect(res.status).toBe(201)
    const { food } = await detail(member, id)
    expect(food).toMatchObject({ name: '왕교자 만두 대용량 1.05kg', brand: '비비고', price: 11480, source: 'url', canEdit: true, ratingCount: 0 })
    expect(food.images).toEqual([expect.objectContaining({ storage: 'external', src: 'https://product-image.kurly.com/a.jpg' })])
    expect(food.createdBy?.nickname).toBe('member')
  })

  it('배달 메뉴는 브랜드 없이 가게 이름으로 저장', async () => {
    const { id } = await createFood(member, { kind: 'delivery', name: '김치찌개', storeName: '엄마손 식당', brand: '무시됨' })
    const { food } = await detail(member, id)
    expect(food).toMatchObject({ kind: 'delivery', storeName: '엄마손 식당', brand: null })
  })
})

describe('수정·삭제 권한', () => {
  it('등록자와 관리자만 고치고 지울 수 있다', async () => {
    const { id } = await createFood(member, { kind: 'meal_kit', name: '밀푀유나베' })
    expect((await call(`/api/foods/${id}`, { method: 'PATCH', cookie: other, json: { name: '해킹' } })).status).toBe(403)
    expect((await detail(other, id)).food.canEdit).toBe(false)
    expect((await call(`/api/foods/${id}`, { method: 'PATCH', cookie: member, json: { name: '밀푀유 나베', price: 15900 } })).status).toBe(200)
    expect((await detail(member, id)).food).toMatchObject({ name: '밀푀유 나베', price: 15900 })
    expect((await call(`/api/foods/${id}`, { method: 'PATCH', cookie: admin, json: { kind: 'delivery' } })).status).toBe(400)
    expect((await call(`/api/foods/${id}`, { method: 'DELETE', cookie: other })).status).toBe(403)
    expect((await call(`/api/foods/${id}`, { method: 'DELETE', cookie: admin })).status).toBe(204)
    expect((await call(`/api/foods/${id}`, { cookie: member })).status).toBe(404)
  })
})

describe('평가', () => {
  it('종합 점수 필수, 맛 강도 0~5, 일부 항목만 평가 가능', async () => {
    const { id } = await createFood(member, { kind: 'product', name: '고기만두' })
    const put = (cookie: string, json: unknown) => call(`/api/foods/${id}/rating`, { method: 'PUT', cookie, json })
    expect((await put(member, { scores: { salty: 3 } })).status).toBe(400)
    expect((await put(member, { overall: 6 })).status).toBe(400)
    expect((await put(member, { overall: 4, scores: { salty: 7 } })).status).toBe(400)
    expect((await put(member, { overall: 4, scores: { umami2: 1 } })).status).toBe(400)
    expect((await put(member, { overall: 4, scores: { salty: 3, spicy: 0 }, memo: '  육즙 많음 ' })).status).toBe(200)
    expect((await put(other, { overall: 2, scores: { salty: 5, sweet: 2 } })).status).toBe(200)

    const { food } = await detail(admin, id)
    expect(food.avgOverall).toBe(3)
    expect(food.ratingCount).toBe(2)
    const stat = (a: string) => food.attributeStats.find((s) => s.attributeId === a)
    // 안 매긴 사람은 평균에서 제외: 단맛은 other 혼자 2점
    expect(stat('sweet')).toEqual({ attributeId: 'sweet', avg: 2, count: 1 })
    expect(stat('salty')).toEqual({ attributeId: 'salty', avg: 4, count: 2 })
    expect(stat('spicy')).toEqual({ attributeId: 'spicy', avg: 0, count: 1 })
    expect(stat('sour')).toEqual({ attributeId: 'sour', avg: null, count: 0 })
    expect(food.myRating).toBeNull()
    // 메모는 모두에게 공개
    expect(food.ratings.find((r) => r.nickname === 'member')?.memo).toBe('육즙 많음')
  })

  it('다시 평가하면 덮어쓰고, 빠진 맛 항목은 지워진다', async () => {
    const { id } = await createFood(member, { kind: 'product', name: '김치만두' })
    await call(`/api/foods/${id}/rating`, { method: 'PUT', cookie: member, json: { overall: 3, scores: { salty: 3, spicy: 2 } } })
    await call(`/api/foods/${id}/rating`, { method: 'PUT', cookie: member, json: { overall: 5, scores: { spicy: 4, sour: null } } })
    const { food } = await detail(member, id)
    expect(food.ratingCount).toBe(1)
    expect(food.myRating).toMatchObject({ overall: 5, scores: { spicy: 4 }, memo: null })
    expect((await call(`/api/foods/${id}/rating`, { method: 'DELETE', cookie: member })).status).toBe(204)
    expect((await detail(member, id)).food).toMatchObject({ ratingCount: 0, myRating: null, avgOverall: null })
  })
})

describe('목록', () => {
  it('검색·종류 필터·평점순 정렬, 내 점수 표시', async () => {
    const a = (await createFood(member, { kind: 'product', name: '새우만두', brand: '풀무원', externalImages: ['https://example.com/a1.jpg', 'https://example.com/a2.jpg'] })).id
    const b = (await createFood(member, { kind: 'product', name: '군만두 100%' })).id
    await call(`/api/foods/${a}/rating`, { method: 'PUT', cookie: member, json: { overall: 2 } })
    await call(`/api/foods/${b}/rating`, { method: 'PUT', cookie: other, json: { overall: 5 } })

    const list = async (qs: string) => (await (await call(`/api/foods${qs}`, { cookie: member })).json()) as FoodSummary[]
    const byBrand = await list('?q=' + encodeURIComponent('풀무원'))
    expect(byBrand.map((f) => f.id)).toEqual([a])
    expect(byBrand[0]).toMatchObject({ avgOverall: 2, ratingCount: 1, myOverall: 2, thumbnail: 'https://example.com/a1.jpg' })
    expect((await list('?q=' + encodeURIComponent('100%')))[0].thumbnail).toBeNull()
    // % 같은 특수문자도 글자 그대로 검색
    expect((await list('?q=' + encodeURIComponent('100%'))).map((f) => f.id)).toEqual([b])
    const top = await list('?sort=top&kind=product')
    expect(top.indexOf(top.find((f) => f.id === b)!)).toBeLessThan(top.indexOf(top.find((f) => f.id === a)!))
    expect(top.every((f) => f.kind === 'product')).toBe(true)
    expect(top.at(-1)?.avgOverall).toBeNull() // 평가 없는 음식은 뒤로
  })

  it('비슷한 이름 안내', async () => {
    await createFood(member, { kind: 'product', name: '비비고 왕교자' })
    const similar = (await (await call('/api/foods-similar?q=' + encodeURIComponent('왕교자 만두'), { cookie: member })).json()) as { name: string }[]
    expect(similar.some((s) => s.name.includes('왕교자'))).toBe(true)
  })
})

describe('사진', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

  it('업로드·제공·대표 지정·삭제, 음식당 5장 제한', async () => {
    const { id } = await createFood(member, { kind: 'product', name: '사진 테스트', externalImages: ['https://example.com/1.jpg'] })
    const upload = (cookie: string) => call(`/api/foods/${id}/images`, { method: 'POST', cookie, headers: { 'content-type': 'image/png' }, body: png })

    const up = await upload(other)
    expect(up.status).toBe(201)
    const img = (await up.json()) as { id: string; src: string }
    expect(img.src).toMatch(new RegExp(`^/api/images/foods/${id}/.+\\.png$`))

    // 그룹원만 볼 수 있고, 내용이 그대로 돌아온다
    expect((await call(img.src)).status).toBe(401)
    const served = await call(img.src, { cookie: member })
    expect(served.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(png)

    // 대표 사진 지정 → 맨 앞
    expect((await call(`/api/foods/${id}/images/${img.id}/primary`, { method: 'POST', cookie: member })).status).toBe(200)
    expect((await detail(member, id)).food.images[0].id).toBe(img.id)

    // 형식 제한
    expect((await call(`/api/foods/${id}/images`, { method: 'POST', cookie: member, headers: { 'content-type': 'image/gif' }, body: png })).status).toBe(415)

    // 5장 제한 (외부 1 + 업로드 1 + 3장 더 = 5)
    for (let i = 0; i < 3; i++) expect((await upload(member)).status).toBe(201)
    expect((await upload(member)).status).toBe(409)
    expect((await call(`/api/foods/${id}/images`, { method: 'POST', cookie: member, json: { url: 'https://example.com/x.jpg' } })).status).toBe(409)

    // 올린 사람은 자기 사진을 지울 수 있고 R2에서도 지워진다
    const key = img.src.replace('/api/images/', '')
    expect((await call(`/api/foods/${id}/images/${img.id}`, { method: 'DELETE', cookie: other })).status).toBe(204)
    expect(await env.MEDIA.get(key)).toBeNull()
    const after = (await detail(member, id)).food.images
    expect(after.map((_, i) => i)).toEqual([0, 1, 2, 3])
    expect(after).toHaveLength(4)

    // 음식을 지우면 올린 사진도 R2에서 지워진다
    const remaining = after.filter((i) => i.storage === 'r2').map((i) => i.src.replace('/api/images/', ''))
    expect((await call(`/api/foods/${id}`, { method: 'DELETE', cookie: member })).status).toBe(204)
    for (const k of remaining) expect(await env.MEDIA.get(k)).toBeNull()
  })
})

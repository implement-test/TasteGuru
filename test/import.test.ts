import { describe, expect, it } from 'vitest'
import { blockedSiteName, cleanTitle, extractProduct, ImportError, parseImportUrl } from '../src/worker/import/url'

const html = (head: string) => new Response(`<!doctype html><html><head>${head}</head><body>본문</body></html>`, { headers: { 'content-type': 'text/html' } })

describe('URL 가져오기', () => {
  it('컬리 형식: [브랜드] 표시와 쇼핑몰 이름을 걷어내고 JSON-LD 가격을 읽는다', async () => {
    const res = html(`
      <title>[비비고] 왕교자 만두 대용량 1.05kg - 마켓컬리</title>
      <meta property="og:title" content="[비비고] 왕교자 만두 대용량 1.05kg - 마켓컬리">
      <meta property="og:site_name" content="컬리 - 마켓컬리/뷰티컬리">
      <meta property="og:image" content="https://product-image.kurly.com/a.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"컬리"}</script>
      <script type="application/ld+json">{"@type":"Product","name":"[비비고] 왕교자","brand":{"@type":"Brand","name":"비비고"},"offers":{"price":"11480"}}</script>`)
    expect(await extractProduct(res, new URL('https://www.kurly.com/goods/5082274'))).toEqual({
      url: 'https://www.kurly.com/goods/5082274',
      name: '왕교자 만두 대용량 1.05kg',
      brand: '비비고',
      price: 11480,
      image: 'https://product-image.kurly.com/a.jpg',
      siteName: '컬리 - 마켓컬리/뷰티컬리',
    })
  })

  it('11번가 형식: [11번가] 표시는 지우고 브랜드는 JSON-LD에서', async () => {
    const res = html(`
      <meta property="og:title" content="[11번가] 비비고 수제든든한섬만두(384g×2봉) 768g">
      <meta property="og:image" content="//cdn.011st.com/p/1.jpg">
      <script type="application/ld+json">[{"@type":"Product","brand":"CJ","offers":[{"price":9900}]}]</script>`)
    const p = await extractProduct(res, new URL('https://www.11st.co.kr/products/9203592919'))
    expect(p).toMatchObject({ name: '비비고 수제든든한섬만두(384g×2봉) 768g', brand: 'CJ', price: 9900, image: 'https://cdn.011st.com/p/1.jpg' })
  })

  it('메타 정보가 없으면 title을 쓰고, 가격이 없으면 null', async () => {
    const p = await extractProduct(html('<title>고기만두 - 1kg</title>'), new URL('https://shop.example.com/1'))
    expect(p).toMatchObject({ name: '고기만두 - 1kg', brand: null, price: null, image: null })
  })

  it('cleanTitle: 브랜드가 따로 있으면 [다른 표시]는 그대로 둔다', () => {
    expect(cleanTitle('[특가] 고기만두', null, '풀무원')).toEqual({ name: '[특가] 고기만두', brand: '풀무원' })
  })

  it('주소 검사: 공유 문구 속 주소 추출, 내부 주소·잘못된 형식 거부', () => {
    expect(parseImportUrl('비비고 왕교자 https://www.kurly.com/goods/1 지금 할인').toString()).toBe('https://www.kurly.com/goods/1')
    for (const bad of ['', 'ftp://x.com', 'http://localhost/a', 'http://10.0.0.1/', 'not a url', 42]) {
      expect(() => parseImportUrl(bad)).toThrow(ImportError)
    }
  })

  it('차단 사이트 판별', () => {
    expect(blockedSiteName(new URL('https://www.coupang.com/vp/products/1'))).toBe('쿠팡')
    expect(blockedSiteName(new URL('https://m.coupang.com/vm/products/1'))).toBe('쿠팡')
    expect(blockedSiteName(new URL('https://smartstore.naver.com/x/products/1'))).toBe('네이버 스마트스토어')
    expect(blockedSiteName(new URL('https://www.kurly.com/goods/1'))).toBeNull()
  })
})

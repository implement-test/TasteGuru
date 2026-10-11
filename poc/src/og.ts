// 상품 URL에서 Open Graph / JSON-LD 메타 정보를 추출한다.
// 쇼핑몰이 링크 미리보기 봇은 허용하는 경우가 있어 여러 User-Agent로 시도한다.

export const USER_AGENTS = {
  browser:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  kakaotalk: 'facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/',
  twitter: 'Twitterbot/1.0',
} as const

export type UaKey = keyof typeof USER_AGENTS

const ALLOWED_HOSTS = [
  'coupang.com',
  'kurly.com',
  'naver.com',
  'naver.me',
  'ssg.com',
  '11st.co.kr',
  'gmarket.co.kr',
  'auction.co.kr',
  'oasis.co.kr',
  'lotteon.com',
]

export function isAllowedUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h)) ? url : null
}

export interface OgResult {
  ua: UaKey
  ok: boolean
  status: number
  finalUrl: string
  elapsedMs: number
  blocked: boolean
  contentType: string | null
  server: string | null
  title?: string
  image?: string
  description?: string
  siteName?: string
  price?: string
  brand?: string
  jsonLdTypes: string[]
  error?: string
}

const BLOCK_PATTERNS = [/access denied/i, /pardon our interruption/i, /captcha/i, /비정상적인 접근/, /차단/]

export async function fetchOg(url: URL, ua: UaKey): Promise<OgResult> {
  const started = Date.now()
  const base: OgResult = {
    ua,
    ok: false,
    status: 0,
    finalUrl: url.toString(),
    elapsedMs: 0,
    blocked: false,
    contentType: null,
    server: null,
    jsonLdTypes: [],
  }
  try {
    const res = await fetch(url.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENTS[ua],
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10_000),
    })
    const meta: Record<string, string> = {}
    let titleText = ''
    let jsonLd = ''
    const jsonLdBlocks: string[] = []

    const rewritten = new HTMLRewriter()
      .on('meta', {
        element(el) {
          const key = (el.getAttribute('property') ?? el.getAttribute('name') ?? '').toLowerCase()
          const content = el.getAttribute('content')
          if (key && content && !(key in meta)) meta[key] = content
        },
      })
      .on('title', {
        text(t) {
          titleText += t.text
        },
      })
      .on('script[type="application/ld+json"]', {
        element(el) {
          if (jsonLd) jsonLdBlocks.push(jsonLd)
          jsonLd = ''
          el.onEndTag(() => {
            jsonLdBlocks.push(jsonLd)
            jsonLd = ''
          })
        },
        text(t) {
          jsonLd += t.text
        },
      })
      .transform(res)
    const body = await rewritten.text()

    const products = jsonLdBlocks.flatMap(parseJsonLd)
    const product = products.find((p) => p['@type'] === 'Product')
    const offers = product?.offers as Record<string, unknown> | Record<string, unknown>[] | undefined
    const offer = Array.isArray(offers) ? offers[0] : offers
    const brand = product?.brand as { name?: string } | string | undefined

    const result: OgResult = {
      ...base,
      status: res.status,
      finalUrl: res.url || base.finalUrl,
      contentType: res.headers.get('content-type'),
      server: res.headers.get('server'),
      elapsedMs: Date.now() - started,
      title: meta['og:title'] ?? meta['twitter:title'] ?? (product?.name as string | undefined) ?? (titleText.trim() || undefined),
      image: meta['og:image'] ?? meta['twitter:image'] ?? firstImage(product?.image),
      description: meta['og:description'] ?? meta['description'],
      siteName: meta['og:site_name'],
      price: meta['product:price:amount'] ?? (offer?.price != null ? String(offer.price) : undefined),
      brand: typeof brand === 'string' ? brand : brand?.name,
      jsonLdTypes: products.map((p) => String(p['@type'])).slice(0, 10),
    }
    result.blocked =
      res.status === 403 || res.status === 429 || BLOCK_PATTERNS.some((p) => p.test(titleText) || p.test(body.slice(0, 2000)))
    result.ok = res.ok && !result.blocked && !!(result.title || result.image)
    return result
  } catch (e) {
    return { ...base, elapsedMs: Date.now() - started, error: e instanceof Error ? e.message : String(e) }
  }
}

function parseJsonLd(raw: string): Record<string, unknown>[] {
  try {
    const data = JSON.parse(raw.trim())
    const list = Array.isArray(data) ? data : data['@graph'] ?? [data]
    return (list as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  } catch {
    return []
  }
}

function firstImage(img: unknown): string | undefined {
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return firstImage(img[0])
  if (img && typeof img === 'object' && 'url' in img) return String((img as { url: unknown }).url)
  return undefined
}

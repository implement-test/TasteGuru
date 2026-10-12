// 상품 URL에서 제품명·대표 이미지·가격·브랜드를 추출한다 (Open Graph + JSON-LD).
// PoC 결과: 컬리·11번가는 성공, 쿠팡·네이버 스마트스토어는 서버 요청을 차단한다.
import type { ImportedProduct } from '../../shared/food'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
]

/** 서버에서 가져올 수 없다고 확인된 사이트 → 요청하지 않고 바로 안내 */
const BLOCKED_HOSTS: Record<string, string> = {
  'coupang.com': '쿠팡',
  'smartstore.naver.com': '네이버 스마트스토어',
  'brand.naver.com': '네이버 브랜드스토어',
}

/** 제목 앞에 붙는 쇼핑몰 표시 ([11번가] 등) */
const SITE_TAGS = ['11번가', 'G마켓', '옥션', 'SSG', '이마트몰', '롯데ON']

export class ImportError extends Error {
  constructor(
    readonly code: 'invalid_url' | 'blocked_site' | 'fetch_failed' | 'no_product_info',
    message: string,
  ) {
    super(message)
  }
}

export function blockedSiteName(url: URL): string | null {
  const host = url.hostname.toLowerCase()
  for (const [h, name] of Object.entries(BLOCKED_HOSTS)) if (host === h || host.endsWith('.' + h)) return name
  return null
}

function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.includes(':') // IPv6
  )
}

export function parseImportUrl(raw: unknown): URL {
  if (typeof raw !== 'string') throw new ImportError('invalid_url', '상품 주소를 입력해 주세요.')
  // 공유 문구에 섞인 주소도 받아들인다 ("...상품명 https://...")
  const match = raw.match(/https?:\/\/\S+/)
  let url: URL
  try {
    url = new URL(match ? match[0] : raw.trim())
  } catch {
    throw new ImportError('invalid_url', '올바른 주소가 아니에요.')
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || isPrivateHost(url.hostname)) {
    throw new ImportError('invalid_url', '쇼핑몰 상품 주소(https://…)를 넣어 주세요.')
  }
  return url
}

interface RawMeta {
  meta: Record<string, string>
  title: string
  jsonLd: string[]
}

async function readMeta(res: Response): Promise<RawMeta> {
  const meta: Record<string, string> = {}
  let title = ''
  const jsonLd: string[] = []
  let current = ''
  await new HTMLRewriter()
    .on('meta', {
      element(el) {
        const key = (el.getAttribute('property') ?? el.getAttribute('name') ?? '').toLowerCase()
        const content = el.getAttribute('content')
        if (key && content && !(key in meta)) meta[key] = content
      },
    })
    .on('title', {
      text(t) {
        title += t.text
      },
    })
    .on('script[type="application/ld+json"]', {
      element(el) {
        current = ''
        el.onEndTag(() => {
          jsonLd.push(current)
        })
      },
      text(t) {
        current += t.text
      },
    })
    .transform(res)
    .text()
  return { meta, title: title.trim(), jsonLd }
}

type Json = Record<string, unknown>

function jsonLdNodes(raw: string): Json[] {
  try {
    const data = JSON.parse(raw.trim())
    const list = Array.isArray(data) ? data : (data['@graph'] ?? [data])
    return (list as unknown[]).filter((x): x is Json => !!x && typeof x === 'object')
  } catch {
    return []
  }
}

const isProduct = (n: Json) => n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product'))

function firstImage(img: unknown): string | null {
  if (typeof img === 'string') return img
  if (Array.isArray(img)) return firstImage(img[0])
  if (img && typeof img === 'object' && 'url' in img) return String((img as Json).url)
  return null
}

function toPrice(v: unknown): number | null {
  if (v == null) return null
  const n = Math.round(Number(String(v).replace(/[^\d.]/g, '')))
  return Number.isFinite(n) && n > 0 ? n : null
}

const SITE_WORDS = /몰|마켓|컬리|쇼핑|store|shop/i

function isSiteLabel(label: string, siteName: string | null): boolean {
  const l = label.trim()
  if (SITE_TAGS.includes(l) || SITE_WORDS.test(l)) return true
  return !!siteName && (siteName.includes(l) || l.includes(siteName.split(/[\s-]/)[0]))
}

/** 제목에서 쇼핑몰 이름·[브랜드] 표시를 걷어내고 브랜드를 찾는다 */
export function cleanTitle(rawTitle: string, siteName: string | null, brand: string | null): { name: string; brand: string | null } {
  let name = rawTitle.trim()
  // 뒤에 붙는 " - 마켓컬리", " | 쇼핑몰" 제거
  const suffix = name.match(/\s+[-|]\s+([^-|]{1,24})$/u)
  if (suffix && isSiteLabel(suffix[1], siteName)) name = name.slice(0, suffix.index)
  // 앞에 붙는 [11번가] 같은 쇼핑몰 표시는 지우고, [비비고] 같은 브랜드 표시는 브랜드로 쓴다
  let foundBrand = brand
  const tag = name.match(/^\[([^\]]{1,20})\]\s*/u)
  if (tag) {
    const t = tag[1].trim()
    if (isSiteLabel(t, siteName)) name = name.slice(tag[0].length)
    else if (!foundBrand || foundBrand === t) {
      foundBrand = t
      name = name.slice(tag[0].length)
    }
  }
  return { name: name.trim(), brand: foundBrand?.trim() || null }
}

/** HTML 응답에서 상품 정보를 뽑는다 */
export async function extractProduct(res: Response, url: URL): Promise<ImportedProduct> {
  const { meta, title, jsonLd } = await readMeta(res)
  const product = jsonLd.flatMap(jsonLdNodes).find(isProduct)
  const offers = product?.offers as Json | Json[] | undefined
  const offer = Array.isArray(offers) ? offers[0] : offers
  const brandNode = product?.brand as Json | string | undefined
  const ldBrand = typeof brandNode === 'string' ? brandNode : typeof brandNode?.name === 'string' ? brandNode.name : null
  const siteName = meta['og:site_name'] ?? null
  const rawName = (meta['og:title'] ?? (product?.name as string | undefined) ?? title) || ''
  const { name, brand } = cleanTitle(rawName, siteName, ldBrand)
  let image = meta['og:image'] ?? meta['twitter:image'] ?? firstImage(product?.image)
  if (image) image = new URL(image, url).toString()
  return {
    url: url.toString(),
    name: name || null,
    brand,
    price: toPrice(meta['product:price:amount'] ?? offer?.price),
    image,
    siteName,
  }
}

const BLOCK_TITLE = /access denied|pardon our interruption|captcha|에러페이지|로그인/i

/** 여러 User-Agent로 시도해 첫 번째로 성공한 결과를 돌려준다 */
export async function importFromUrl(raw: unknown): Promise<ImportedProduct> {
  const url = parseImportUrl(raw)
  const blocked = blockedSiteName(url)
  if (blocked) throw new ImportError('blocked_site', `${blocked} 상품은 정보를 가져올 수 없어요. 직접 입력해 주세요.`)

  let lastStatus = 0
  for (const ua of USER_AGENTS) {
    let res: Response
    try {
      res = await fetch(url.toString(), {
        redirect: 'follow',
        headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko-KR,ko;q=0.9' },
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      continue
    }
    lastStatus = res.status
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
      await res.body?.cancel()
      continue
    }
    const product = await extractProduct(res, new URL(res.url || url.toString()))
    if (product.name && !BLOCK_TITLE.test(product.name)) return { ...product, url: url.toString() }
  }
  if (lastStatus === 403 || lastStatus === 429) throw new ImportError('blocked_site', '이 쇼핑몰은 상품 정보를 가져올 수 없어요. 직접 입력해 주세요.')
  if (lastStatus === 0) throw new ImportError('fetch_failed', '쇼핑몰에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  throw new ImportError('no_product_info', '상품 정보를 찾지 못했어요. 직접 입력해 주세요.')
}

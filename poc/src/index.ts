import { Hono, type Context, type Next } from 'hono'
import { setCookie } from 'hono/cookie'
import { createAuth, INVITE_COOKIE } from './auth'
import type { Env } from './env'
import { fetchOg, isAllowedUrl, USER_AGENTS, type UaKey } from './og'
import { renderPage } from './page'
import { ImportError, importFromUrl } from '../../src/worker/import/url'

type AppEnv = { Bindings: Env & { POC_KEY?: string }; Variables: { userId: string | null } }

const app = new Hono<AppEnv>()

// 대표 주소(BETTER_AUTH_URL)가 아닌 주소로 들어오면 대표 주소로 보낸다 (로그인 쿠키·OAuth 주소를 하나로 유지).
// PoC 점검 API는 예외.
app.use('*', async (c, next) => {
  const url = new URL(c.req.url)
  if (url.host !== new URL(c.env.BETTER_AUTH_URL).host && !url.pathname.startsWith('/api/poc/')) {
    return c.redirect(new URL(url.pathname + url.search, c.env.BETTER_AUTH_URL).toString(), 301)
  }
  return next()
})

app.on(['GET', 'POST'], '/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

async function currentUser(c: Context<AppEnv>) {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
  return session?.user ?? null
}

// PoC 테스트 API는 로그인 사용자 또는 PoC 키가 있어야 호출 가능
async function requireAccess(c: Context<AppEnv>, next: Next) {
  const key = c.req.header('x-poc-key') ?? c.req.query('key')
  if (c.env.POC_KEY && key === c.env.POC_KEY) return next()
  if (await currentUser(c)) return next()
  return c.json({ error: 'unauthorized' }, 401)
}

app.get('/', (c) => c.html(renderPage()))

app.get('/api/me', async (c) => {
  const user = await currentUser(c)
  if (!user) return c.json({ user: null })
  const profile = await c.env.DB.prepare('SELECT role FROM profiles WHERE user_id = ?').bind(user.id).first<{ role: string }>()
  return c.json({ user: { id: user.id, name: user.name, email: user.email, image: user.image }, role: profile?.role ?? null })
})

// 초대 링크: 토큰을 쿠키에 저장한 뒤 첫 화면으로 보낸다. 구글 로그인 콜백에서 이 쿠키를 검사한다.
app.get('/invite/:token', async (c) => {
  const token = c.req.param('token')
  const invite = await c.env.DB.prepare('SELECT token FROM invites WHERE token = ? AND used_by IS NULL AND expires_at > ?')
    .bind(token, Date.now())
    .first()
  if (!invite) return c.redirect('/?invite=invalid')
  setCookie(c, INVITE_COOKIE, token, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 60 * 60 })
  return c.redirect('/?invite=ok')
})

app.post('/api/invites', async (c) => {
  const user = await currentUser(c)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  const profile = await c.env.DB.prepare('SELECT role FROM profiles WHERE user_id = ?').bind(user.id).first<{ role: string }>()
  if (profile?.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  const token = crypto.randomUUID().replaceAll('-', '')
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000
  await c.env.DB.prepare('INSERT INTO invites (token, created_by, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(token, user.id, Date.now(), expiresAt)
    .run()
  return c.json({ url: new URL(`/invite/${token}`, c.req.url).toString(), expiresAt })
})

app.get('/api/poc/status', async (c) => {
  const d1Started = Date.now()
  const users = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM user').first<{ n: number }>()
  return c.json({
    secrets: {
      betterAuth: !!c.env.BETTER_AUTH_SECRET,
      google: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
      naver: !!(c.env.NAVER_CLIENT_ID && c.env.NAVER_CLIENT_SECRET),
    },
    d1: { users: users?.n ?? 0, elapsedMs: Date.now() - d1Started },
    colo: (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null,
  })
})

app.use('/api/poc/naver', requireAccess)
app.get('/api/poc/naver', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q) return c.json({ error: 'q required' }, 400)
  if (!c.env.NAVER_CLIENT_ID || !c.env.NAVER_CLIENT_SECRET) return c.json({ error: 'naver secrets not configured' }, 503)
  const started = Date.now()
  const res = await fetch(`https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=5`, {
    headers: { 'X-Naver-Client-Id': c.env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': c.env.NAVER_CLIENT_SECRET },
  })
  const data = await res.json<{ total?: number; items?: Record<string, string>[]; errorMessage?: string }>()
  if (!res.ok) return c.json({ status: res.status, error: data.errorMessage ?? 'naver error' }, 502)
  return c.json({
    status: res.status,
    elapsedMs: Date.now() - started,
    total: data.total,
    items: (data.items ?? []).map((it) => ({
      title: it.title.replace(/<\/?b>/g, ''),
      image: it.image,
      lprice: it.lprice ? Number(it.lprice) : null,
      mallName: it.mallName,
      brand: it.brand || null,
      maker: it.maker || null,
      category: [it.category1, it.category2, it.category3, it.category4].filter(Boolean).join(' > '),
      productId: it.productId,
      link: it.link,
    })),
    rawFields: Object.keys(data.items?.[0] ?? {}),
  })
})

app.use('/api/poc/og', requireAccess)
app.get('/api/poc/og', async (c) => {
  const url = isAllowedUrl(c.req.query('url') ?? '')
  if (!url) return c.json({ error: 'url not allowed' }, 400)
  const uaParam = c.req.query('ua') ?? 'all'
  const uas = (uaParam === 'all' ? Object.keys(USER_AGENTS) : [uaParam]).filter((u): u is UaKey => u in USER_AGENTS)
  const results = []
  for (const ua of uas) results.push(await fetchOg(url, ua))
  return c.json({ url: url.toString(), results })
})

// 구글 로그인 시작 URL이 올바르게 만들어지는지 점검 (실제 로그인은 브라우저에서)
app.use('/api/poc/google-url', requireAccess)
app.get('/api/poc/google-url', async (c) => {
  const base = c.env.BETTER_AUTH_URL
  const res = await createAuth(c.env).handler(
    new Request(`${base}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
    }),
  )
  const data = await res.json<{ url?: string }>()
  if (!data.url) return c.json({ status: res.status, data }, 502)
  const u = new URL(data.url)
  return c.json({
    status: res.status,
    host: u.host,
    redirect_uri: u.searchParams.get('redirect_uri'),
    scope: u.searchParams.get('scope'),
    client_id_suffix: u.searchParams.get('client_id')?.slice(-27),
    url: data.url,
  })
})

// 본 앱의 URL 가져오기 로직을 실제 쇼핑몰 페이지로 점검
app.use('/api/poc/import', requireAccess)
app.get('/api/poc/import', async (c) => {
  try {
    return c.json({ ok: true, product: await importFromUrl(c.req.query('url')) })
  } catch (e) {
    if (e instanceof ImportError) return c.json({ ok: false, code: e.code, message: e.message })
    throw e
  }
})

app.use('/api/poc/r2', requireAccess)
app.get('/api/poc/r2', async (c) => {
  const key = `poc/${crypto.randomUUID()}.txt`
  const started = Date.now()
  await c.env.MEDIA.put(key, 'tasteguru poc', { httpMetadata: { contentType: 'text/plain' } })
  const obj = await c.env.MEDIA.get(key)
  const text = await obj?.text()
  await c.env.MEDIA.delete(key)
  return c.json({ ok: text === 'tasteguru poc', elapsedMs: Date.now() - started })
})

app.use('/api/poc/d1', requireAccess)
app.get('/api/poc/d1', async (c) => {
  const started = Date.now()
  await c.env.DB.prepare('INSERT INTO poc_ping (created_at) VALUES (?)').bind(Date.now()).run()
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM poc_ping').first<{ n: number }>()
  return c.json({ ok: true, pings: row?.n ?? 0, elapsedMs: Date.now() - started })
})

export default app

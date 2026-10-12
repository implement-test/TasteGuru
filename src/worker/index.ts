import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { normalizeNickname, type AppConfig, type Me, type Role } from '../shared/types'
import { fail, requireUser, type AppEnv, type SessionUser } from './app'
import { createAuth, INVITE_COOKIE } from './auth'
import { getDb, schema } from './db'
import { activeProvider } from './import/providers'
import { admin } from './routes/admin'
import { foods } from './routes/foods'
import { images } from './routes/images'
import { imports } from './routes/imports'

const app = new Hono<AppEnv>().basePath('/api')

const toMe = (u: SessionUser): Me => ({
  id: u.id,
  email: u.email,
  image: u.image ?? null,
  nickname: u.nickname || u.name,
  role: (u.role as Role) ?? 'member',
})

app.on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

app.get('/config', (c) => {
  const provider = activeProvider(c.env)
  const config: AppConfig = {
    googleEnabled: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    productSearch: { enabled: !!provider, label: provider?.label ?? null },
  }
  return c.json(config)
})

// 초대 링크 확인: 유효하면 초대 쿠키를 심는다. 구글 로그인 콜백에서 이 쿠키로 가입을 허용한다.
app.post('/invites/:token/accept', async (c) => {
  const db = getDb(c.env.DB)
  const token = c.req.param('token')
  const found = await db.query.invite.findFirst({ where: eq(schema.invite.token, token) })
  if (!found) return fail(c, 404, 'invite_not_found', '초대 링크를 찾을 수 없어요.')
  if (found.usedBy) return fail(c, 410, 'invite_used', '이미 사용된 초대 링크예요.')
  if (found.expiresAt.getTime() <= Date.now()) return fail(c, 410, 'invite_expired', '기간이 지난 초대 링크예요.')
  setCookie(c, INVITE_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    maxAge: 60 * 60,
  })
  return c.json({ ok: true, expiresAt: found.expiresAt.getTime() })
})

// 여기부터는 로그인한 그룹원만
app.use('*', requireUser)

app.get('/me', (c) => c.json(toMe(c.get('user'))))

app.patch('/me', async (c) => {
  const body = await c.req.json<{ nickname?: unknown }>().catch(() => ({}) as { nickname?: unknown })
  const nickname = normalizeNickname(body.nickname)
  if (!nickname) return fail(c, 400, 'invalid_nickname', '닉네임은 1~20자로 입력해 주세요.')
  const user = c.get('user')
  await getDb(c.env.DB).update(schema.user).set({ nickname, updatedAt: new Date() }).where(eq(schema.user.id, user.id))
  return c.json(toMe({ ...user, nickname }))
})

app.route('/admin', admin)
app.route('/', foods)
app.route('/', imports)
app.route('/', images)

app.notFound((c) => fail(c, 404, 'not_found', '요청한 API가 없어요.'))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: '서버에서 문제가 생겼어요.' }, 500)
})

export default app

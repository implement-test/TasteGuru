import { desc, eq } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { setCookie } from 'hono/cookie'
import {
  INVITE_TTL_MS,
  normalizeNickname,
  type AppConfig,
  type InviteItem,
  type InviteStatus,
  type Me,
  type MemberItem,
  type Role,
} from '../shared/types'
import { createAuth, findActiveInvite, INVITE_COOKIE } from './auth'
import { getDb, schema } from './db'

interface SessionUser {
  id: string
  email: string
  image?: string | null
  name: string
  nickname?: string | null
  role?: string | null
}

type AppEnv = { Bindings: Env; Variables: { user: SessionUser } }

const app = new Hono<AppEnv>().basePath('/api')

const fail = (c: Context, status: 400 | 401 | 403 | 404 | 410, error: string, message: string) =>
  c.json({ error, message }, status)

const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
  if (!session) return fail(c, 401, 'unauthorized', '로그인이 필요해요.')
  c.set('user', session.user as SessionUser)
  await next()
})

const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'admin') return fail(c, 403, 'forbidden', '관리자만 할 수 있어요.')
  await next()
})

const toMe = (u: SessionUser): Me => ({
  id: u.id,
  email: u.email,
  image: u.image ?? null,
  nickname: u.nickname || u.name,
  role: (u.role as Role) ?? 'member',
})

app.on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

app.get('/config', (c) => {
  const config: AppConfig = { googleEnabled: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET) }
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

app.get('/me', requireUser, (c) => c.json(toMe(c.get('user'))))

app.patch('/me', requireUser, async (c) => {
  const body = await c.req.json<{ nickname?: unknown }>().catch(() => ({}) as { nickname?: unknown })
  const nickname = normalizeNickname(body.nickname)
  if (!nickname) return fail(c, 400, 'invalid_nickname', '닉네임은 1~20자로 입력해 주세요.')
  const user = c.get('user')
  await getDb(c.env.DB).update(schema.user).set({ nickname, updatedAt: new Date() }).where(eq(schema.user.id, user.id))
  return c.json(toMe({ ...user, nickname }))
})

// ── 관리자 ──
const admin = new Hono<AppEnv>()
admin.use(requireUser, requireAdmin)

admin.get('/members', async (c) => {
  const rows = await getDb(c.env.DB).query.user.findMany({ orderBy: schema.user.createdAt })
  const members: MemberItem[] = rows.map((u) => ({
    id: u.id,
    nickname: u.nickname || u.name,
    email: u.email,
    image: u.image,
    role: u.role,
    createdAt: u.createdAt.getTime(),
  }))
  return c.json(members)
})

const inviteUrl = (c: Context<AppEnv>, token: string) => new URL(`/invite/${token}`, c.env.BETTER_AUTH_URL).toString()

admin.get('/invites', async (c) => {
  const db = getDb(c.env.DB)
  const rows = await db
    .select({ invite: schema.invite, usedByName: schema.user.nickname, usedByFallback: schema.user.name })
    .from(schema.invite)
    .leftJoin(schema.user, eq(schema.invite.usedBy, schema.user.id))
    .orderBy(desc(schema.invite.createdAt))
    .limit(50)
  const now = Date.now()
  const items: InviteItem[] = rows.map(({ invite, usedByName, usedByFallback }) => {
    const status: InviteStatus = invite.usedBy ? 'used' : invite.expiresAt.getTime() <= now ? 'expired' : 'active'
    return {
      token: invite.token,
      url: inviteUrl(c, invite.token),
      status,
      createdAt: invite.createdAt.getTime(),
      expiresAt: invite.expiresAt.getTime(),
      usedBy: invite.usedBy ? usedByName || usedByFallback || '알 수 없음' : null,
      usedAt: invite.usedAt?.getTime() ?? null,
    }
  })
  return c.json(items)
})

admin.post('/invites', async (c) => {
  const token = crypto.randomUUID().replaceAll('-', '')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS)
  await getDb(c.env.DB).insert(schema.invite).values({ token, createdBy: c.get('user').id, createdAt: now, expiresAt })
  const item: InviteItem = {
    token,
    url: inviteUrl(c, token),
    status: 'active',
    createdAt: now.getTime(),
    expiresAt: expiresAt.getTime(),
    usedBy: null,
    usedAt: null,
  }
  return c.json(item, 201)
})

admin.delete('/invites/:token', async (c) => {
  const db = getDb(c.env.DB)
  const token = c.req.param('token')
  if (!(await findActiveInvite(db, token))) return fail(c, 404, 'invite_not_found', '취소할 수 있는 초대 링크가 없어요.')
  await db.delete(schema.invite).where(eq(schema.invite.token, token))
  return c.body(null, 204)
})

app.route('/admin', admin)

app.notFound((c) => fail(c, 404, 'not_found', '요청한 API가 없어요.'))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error', message: '서버에서 문제가 생겼어요.' }, 500)
})

export default app

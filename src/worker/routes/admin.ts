import { desc, eq } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { INVITE_TTL_MS, type InviteItem, type InviteStatus, type MemberItem } from '../../shared/types'
import { fail, requireAdmin, type AppEnv } from '../app'
import { findActiveInvite } from '../auth'
import { getDb, schema } from '../db'

export const admin = new Hono<AppEnv>()
admin.use(requireAdmin)

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


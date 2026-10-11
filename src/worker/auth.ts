import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, count, eq, gt, isNull } from 'drizzle-orm'
import { NICKNAME_MAX } from '../shared/types'
import { getDb, schema, type Db } from './db'

export const INVITE_COOKIE = 'tg_invite'

export function readCookie(headers: Headers | undefined, name: string): string | undefined {
  const raw = headers?.get('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

async function userCount(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(schema.user)
  return row?.n ?? 0
}

export async function findActiveInvite(db: Db, token: string) {
  return db.query.invite.findFirst({
    where: and(eq(schema.invite.token, token), isNull(schema.invite.usedBy), gt(schema.invite.expiresAt, new Date())),
  })
}

type HookContext = { request?: Request; headers?: Headers } | null | undefined
const inviteTokenFrom = (ctx: HookContext) => readCookie(ctx?.request?.headers ?? ctx?.headers, INVITE_COOKIE)

// Workers의 env는 요청마다 전달되므로 auth 인스턴스도 요청마다 만든다.
export function createAuth(env: Env) {
  const db = getDb(env.DB)
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' } }
        : {},
    emailAndPassword: { enabled: env.ENABLE_TEST_EMAIL_AUTH === '1' },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    onAPIError: { errorURL: '/login' },
    user: {
      additionalFields: {
        role: { type: 'string', input: false, defaultValue: 'member' },
        nickname: { type: 'string', input: false, required: false },
      },
      // 가입은 초대 링크로만 허용한다. 첫 가입자(관리자)만 예외.
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.action !== 'create-user') return
        if ((await userCount(db)) === 0) {
          if (env.ADMIN_EMAIL && user.email?.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
            return { error: 'admin_only', errorDescription: '관리자 계정으로 먼저 가입해야 해요.' }
          }
          return
        }
        const token = inviteTokenFrom(ctx)
        if (!token || !(await findActiveInvite(db, token))) {
          return { error: 'invite_required', errorDescription: '초대 링크로만 가입할 수 있어요.' }
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => {
            const isFirst = (await userCount(db)) === 0
            return { data: { ...u, role: isFirst ? 'admin' : 'member', nickname: u.name.trim().slice(0, NICKNAME_MAX) || '맛친구' } }
          },
          after: async (u, ctx) => {
            const token = inviteTokenFrom(ctx)
            if (!token) return
            await db
              .update(schema.invite)
              .set({ usedBy: u.id, usedAt: new Date() })
              .where(and(eq(schema.invite.token, token), isNull(schema.invite.usedBy)))
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

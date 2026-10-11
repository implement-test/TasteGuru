import { betterAuth } from 'better-auth'
import type { Env } from './env'

export const INVITE_COOKIE = 'tg_invite'

function readCookie(headers: Headers | undefined, name: string): string | undefined {
  const raw = headers?.get('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

async function userCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM user').first<{ n: number }>()
  return row?.n ?? 0
}

async function findValidInvite(db: D1Database, token: string) {
  return db
    .prepare('SELECT token FROM invites WHERE token = ? AND used_by IS NULL AND expires_at > ?')
    .bind(token, Date.now())
    .first<{ token: string }>()
}

// Workers의 env는 요청마다 전달되므로 auth 인스턴스도 요청마다 만든다.
export function createAuth(env: Env) {
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {},
    // 로컬 테스트 전용: 구글 키 없이 초대 제한 로직을 검증하기 위한 이메일 가입
    emailAndPassword: { enabled: env.POC_EMAIL_AUTH === '1' },
    onAPIError: { errorURL: '/?auth_error=1' },
    user: {
      // 가입은 초대 링크로만 허용한다. 첫 가입자(관리자)만 예외.
      validateUserInfo: async ({ user, source }, ctx) => {
        if (source.action !== 'create-user') return
        if ((await userCount(env.DB)) === 0) {
          // 배포 직후 다른 사람이 먼저 로그인해 관리자가 되는 것을 막는다.
          if (env.ADMIN_EMAIL && user.email?.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) {
            return { error: 'admin_only', errorDescription: '관리자 계정으로 먼저 가입해야 해요.' }
          }
          return
        }
        const token = readCookie(ctx?.request?.headers ?? ctx?.headers, INVITE_COOKIE)
        if (!token || !(await findValidInvite(env.DB, token))) {
          return { error: 'invite_required', errorDescription: '초대 링크로만 가입할 수 있어요.' }
        }
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            const isFirst = (await userCount(env.DB)) === 1
            await env.DB.prepare('INSERT INTO profiles (user_id, role, created_at) VALUES (?, ?, ?)')
              .bind(user.id, isFirst ? 'admin' : 'member', Date.now())
              .run()
            const token = readCookie(ctx?.request?.headers ?? ctx?.headers, INVITE_COOKIE)
            if (!isFirst && token) {
              await env.DB.prepare('UPDATE invites SET used_by = ?, used_at = ? WHERE token = ? AND used_by IS NULL')
                .bind(user.id, Date.now(), token)
                .run()
            }
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

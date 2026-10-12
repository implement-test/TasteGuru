import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { Role } from '../shared/types'
import { createAuth } from './auth'

export interface SessionUser {
  id: string
  email: string
  image?: string | null
  name: string
  nickname?: string | null
  role?: string | null
}

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser } }

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 415 | 422 | 501 | 502
export const fail = (c: Context, status: ErrorStatus, error: string, message: string) => c.json({ error, message }, status)

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user')) return next()
  const session = await createAuth(c.env).api.getSession({ headers: c.req.raw.headers })
  if (!session) return fail(c, 401, 'unauthorized', '로그인이 필요해요.')
  c.set('user', session.user as SessionUser)
  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'admin') return fail(c, 403, 'forbidden', '관리자만 할 수 있어요.')
  await next()
})

export const isAdmin = (u: SessionUser) => (u.role as Role) === 'admin'
export const displayName = (u: { nickname?: string | null; name: string }) => u.nickname || u.name

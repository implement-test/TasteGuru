import { exports } from 'cloudflare:workers'
import type { InviteItem } from '../src/shared/types'

export const BASE = 'http://localhost'
const worker = (exports as unknown as { default: Fetcher }).default
const PASSWORD = 'passw0rd-test-123'

export async function call(path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) {
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  headers.set('origin', BASE)
  if (init.cookie) headers.set('cookie', init.cookie)
  const body = init.json !== undefined ? JSON.stringify(init.json) : init.body
  return worker.fetch(new Request(BASE + path, { ...init, headers, body }))
}

export const cookiesFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

export async function signUp(email: string, cookie?: string) {
  const res = await call('/api/auth/sign-up/email', { method: 'POST', cookie, json: { email, password: PASSWORD, name: email.split('@')[0] } })
  return { res, session: cookiesFrom(res) }
}

/** 가입(이미 있으면 로그인)해서 세션 쿠키를 돌려준다 */
export async function sessionFor(email: string, inviteCookie?: string): Promise<string> {
  const up = await signUp(email, inviteCookie)
  if (up.res.ok) return up.session
  const res = await call('/api/auth/sign-in/email', { method: 'POST', json: { email, password: PASSWORD } })
  if (!res.ok) throw new Error(`sign-in failed for ${email}: ${res.status}`)
  return cookiesFrom(res)
}

export const adminSession = () => sessionFor('admin@test.local')

/** 관리자 초대로 가입한 일반 회원 세션 */
export async function memberSession(email: string): Promise<string> {
  const admin = await adminSession()
  const invite = (await (await call('/api/admin/invites', { method: 'POST', cookie: admin })).json()) as InviteItem
  const accepted = await call(`/api/invites/${invite.token}/accept`, { method: 'POST' })
  return sessionFor(email, cookiesFrom(accepted))
}

import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import type { InviteItem, Me, MemberItem } from '../src/shared/types'

const BASE = 'http://localhost'
const worker = (exports as unknown as { default: Fetcher }).default

async function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  headers.set('origin', BASE)
  if (init.cookie) headers.set('cookie', init.cookie)
  return worker.fetch(new Request(BASE + path, { ...init, headers }))
}

const cookiesFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')

async function signUp(email: string, cookie?: string) {
  const res = await call('/api/auth/sign-up/email', {
    method: 'POST',
    cookie,
    body: JSON.stringify({ email, password: 'passw0rd-test-123', name: email.split('@')[0] }),
  })
  return { res, session: cookiesFrom(res) }
}

async function acceptInvite(token: string) {
  const res = await call(`/api/invites/${token}/accept`, { method: 'POST' })
  return { res, cookie: cookiesFrom(res) }
}

describe('초대 링크 가입 제한', () => {
  it('관리자 이메일만 첫 가입, 이후에는 초대 링크로만 가입', async () => {
    // 관리자 이메일이 아니면 첫 가입 거부
    expect((await signUp('stranger@test.local')).res.status).toBe(403)

    // 관리자 첫 가입 → admin
    const admin = await signUp('admin@test.local')
    expect(admin.res.status).toBe(200)
    const me = (await (await call('/api/me', { cookie: admin.session })).json()) as Me
    expect(me.role).toBe('admin')
    expect(me.nickname).toBe('admin')

    // 초대 없이 가입 거부
    const noInvite = await signUp('nobody@test.local')
    expect(noInvite.res.status).toBe(403)
    expect(((await noInvite.res.json()) as { code: string }).code).toBe('invite_required')

    // 관리자가 초대 생성
    const created = await call('/api/admin/invites', { method: 'POST', cookie: admin.session })
    expect(created.status).toBe(201)
    const invite = (await created.json()) as InviteItem
    expect(invite.url).toBe(`${BASE}/invite/${invite.token}`)

    // 초대 수락 → 쿠키로 가입 → member
    const accepted = await acceptInvite(invite.token)
    expect(accepted.res.status).toBe(200)
    expect(accepted.cookie).toContain('tg_invite=')
    const friend = await signUp('friend@test.local', accepted.cookie)
    expect(friend.res.status).toBe(200)
    const friendMe = (await (await call('/api/me', { cookie: friend.session })).json()) as Me
    expect(friendMe.role).toBe('member')

    // 사용된 초대는 다시 쓸 수 없음
    expect((await acceptInvite(invite.token)).res.status).toBe(410)
    expect((await signUp('again@test.local', accepted.cookie)).res.status).toBe(403)

    // 일반 회원은 관리자 API 사용 불가
    expect((await call('/api/admin/invites', { method: 'POST', cookie: friend.session })).status).toBe(403)
    expect((await call('/api/admin/members', { cookie: friend.session })).status).toBe(403)

    // 관리자 화면 데이터
    const members = (await (await call('/api/admin/members', { cookie: admin.session })).json()) as MemberItem[]
    expect(members.map((m) => m.role)).toEqual(['admin', 'member'])
    const invites = (await (await call('/api/admin/invites', { cookie: admin.session })).json()) as InviteItem[]
    expect(invites[0]).toMatchObject({ status: 'used', usedBy: 'friend' })

    // 사용된 초대는 취소 불가, 새 초대는 취소 가능
    expect((await call(`/api/admin/invites/${invite.token}`, { method: 'DELETE', cookie: admin.session })).status).toBe(404)
    const second = (await (await call('/api/admin/invites', { method: 'POST', cookie: admin.session })).json()) as InviteItem
    expect((await call(`/api/admin/invites/${second.token}`, { method: 'DELETE', cookie: admin.session })).status).toBe(204)
    expect((await acceptInvite(second.token)).res.status).toBe(404)
  })

  it('없는 초대 링크는 404', async () => {
    expect((await acceptInvite('nope')).res.status).toBe(404)
  })
})

describe('내 정보', () => {
  it('로그인하지 않으면 401', async () => {
    expect((await call('/api/me')).status).toBe(401)
  })

  it('닉네임을 바꿀 수 있고 1~20자만 허용', async () => {
    let session = (await signUp('admin@test.local')).session
    if (!session) {
      // 앞선 테스트와 저장소를 공유하는 경우 로그인으로 세션을 얻는다
      const res = await call('/api/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@test.local', password: 'passw0rd-test-123' }),
      })
      session = cookiesFrom(res)
    }
    const bad = await call('/api/me', { method: 'PATCH', cookie: session, body: JSON.stringify({ nickname: '   ' }) })
    expect(bad.status).toBe(400)
    const tooLong = await call('/api/me', { method: 'PATCH', cookie: session, body: JSON.stringify({ nickname: 'ㄱ'.repeat(21) }) })
    expect(tooLong.status).toBe(400)
    const ok = await call('/api/me', { method: 'PATCH', cookie: session, body: JSON.stringify({ nickname: '  만두   러버 ' }) })
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as Me).nickname).toBe('만두 러버')
    expect(((await (await call('/api/me', { cookie: session })).json()) as Me).nickname).toBe('만두 러버')
  })
})

describe('설정 API', () => {
  it('구글 키가 없으면 googleEnabled=false', async () => {
    expect(await (await call('/api/config')).json()).toEqual({ googleEnabled: false, productSearch: { enabled: false, label: null } })
  })
})

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Card, CardTitle } from '@/client/components/ui/card'
import { api, queryKeys } from '@/client/lib/api'
import type { InviteItem, InviteStatus, MemberItem } from '@/shared/types'

const date = (ms: number) => new Date(ms).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

const STATUS: Record<InviteStatus, { label: string; tone: 'mint' | 'lavender' | 'plain' }> = {
  active: { label: '사용 가능', tone: 'mint' },
  used: { label: '사용됨', tone: 'lavender' },
  expired: { label: '만료', tone: 'plain' },
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied ? '복사됨' : '복사'}
    </Button>
  )
}

function NewInvite({ invite }: { invite: InviteItem }) {
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  return (
    <div className="mt-4 rounded-xl border-2 border-line bg-butter p-4" role="status">
      <p className="mb-2 font-semibold">새 초대 링크를 만들었어요</p>
      <p className="mb-3 rounded-lg bg-surface p-2 font-mono text-sm break-all">{invite.url}</p>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={invite.url} />
        {canShare && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigator.share({ title: 'TasteGuru 초대', text: 'TasteGuru에 초대할게요!', url: invite.url }).catch(() => {})}
          >
            <Share2 size={16} aria-hidden /> 공유
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm">{date(invite.expiresAt)}까지 한 명만 쓸 수 있어요.</p>
    </div>
  )
}

export function AdminPage() {
  const qc = useQueryClient()
  const members = useQuery({ queryKey: queryKeys.members, queryFn: () => api<MemberItem[]>('/api/admin/members') })
  const invites = useQuery({ queryKey: queryKeys.invites, queryFn: () => api<InviteItem[]>('/api/admin/invites') })
  const create = useMutation({
    mutationFn: () => api<InviteItem>('/api/admin/invites', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invites }),
  })
  const revoke = useMutation({
    mutationFn: (token: string) => api<void>(`/api/admin/invites/${token}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invites }),
  })

  return (
    <>
      <h1 className="mb-6 text-2xl">멤버·초대 관리</h1>
      <div className="space-y-6">
        <Card>
          <CardTitle>초대 링크</CardTitle>
          <p className="mb-4 text-muted">링크 하나로 한 명이 가입할 수 있어요. 7일이 지나면 만료돼요.</p>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            초대 링크 만들기
          </Button>
          {create.data && <NewInvite invite={create.data} />}
          {create.isError && <p className="mt-2 text-danger">초대 링크를 만들지 못했어요.</p>}

          <h3 className="mt-6 mb-2 text-base">최근 초대</h3>
          {invites.isPending ? (
            <p className="text-muted">불러오는 중…</p>
          ) : !invites.data?.length ? (
            <p className="text-muted">아직 만든 초대 링크가 없어요.</p>
          ) : (
            <ul className="divide-y-2 divide-surface-2">
              {invites.data.map((inv) => (
                <li key={inv.token} className="flex flex-wrap items-center gap-2 py-3">
                  <Badge tone={STATUS[inv.status].tone}>{STATUS[inv.status].label}</Badge>
                  <span className="text-sm text-muted">
                    {date(inv.createdAt)} 생성
                    {inv.status === 'used' && inv.usedBy ? ` · ${inv.usedBy}님 가입` : ` · ${date(inv.expiresAt)} 만료`}
                  </span>
                  {inv.status === 'active' && (
                    <span className="ml-auto flex gap-2">
                      <CopyButton text={inv.url} />
                      <Button size="sm" variant="danger" disabled={revoke.isPending} onClick={() => revoke.mutate(inv.token)}>
                        취소
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>멤버 {members.data ? `(${members.data.length})` : ''}</CardTitle>
          <ul className="divide-y-2 divide-surface-2">
            {members.data?.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                {m.image ? (
                  <img src={m.image} alt="" width={40} height={40} className="rounded-full border-2 border-line" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full border-2 border-line bg-mint" aria-hidden>
                    🙂
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.nickname}</p>
                  <p className="truncate text-sm text-muted">{m.email}</p>
                </div>
                <div className="text-right">
                  <Badge tone={m.role === 'admin' ? 'pink' : 'plain'}>{m.role === 'admin' ? '관리자' : '멤버'}</Badge>
                  <p className="mt-1 text-xs text-muted">{date(m.createdAt)} 가입</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

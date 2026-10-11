import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Logo } from '@/client/components/Logo'
import { Card } from '@/client/components/ui/card'
import { api, HttpError, useConfig, useMe } from '@/client/lib/api'
import { GoogleButton } from './LoginPage'

export function InvitePage() {
  const { token = '' } = useParams()
  const { data: me } = useMe()
  const { data: config } = useConfig()
  const accept = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<{ ok: true; expiresAt: number }>(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
    retry: false,
    enabled: !me,
  })

  return (
    <div className="bg-dots flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm text-center">
        <Logo className="mb-4 justify-center text-2xl" />
        {me ? (
          <>
            <p className="mb-4">이미 가입되어 있어요.</p>
            <Link to="/">홈으로 가기</Link>
          </>
        ) : accept.isPending ? (
          <p role="status">초대 링크를 확인하고 있어요…</p>
        ) : accept.isError ? (
          <>
            <div className="mb-2 text-4xl" aria-hidden>
              🥲
            </div>
            <p role="alert" className="mb-4">
              {accept.error instanceof HttpError ? accept.error.message : '초대 링크를 확인하지 못했어요.'}
            </p>
            <p className="text-sm text-muted">관리자에게 새 초대 링크를 요청해 주세요.</p>
          </>
        ) : (
          <>
            <div className="mb-2 text-4xl" aria-hidden>
              💌
            </div>
            <p className="mb-1 font-semibold">TasteGuru에 초대받았어요!</p>
            <p className="mb-6 text-sm text-muted">구글 계정으로 로그인하면 가입이 끝나요.</p>
            <GoogleButton disabled={config && !config.googleEnabled} />
            <p className="mt-4 text-xs text-muted">
              링크 유효 기간: {new Date(accept.data.expiresAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}까지
            </p>
          </>
        )}
      </Card>
    </div>
  )
}

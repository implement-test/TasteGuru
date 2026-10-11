import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Logo } from '@/client/components/Logo'
import { Button } from '@/client/components/ui/button'
import { Card } from '@/client/components/ui/card'
import { useConfig, useMe } from '@/client/lib/api'
import { signInWithGoogle } from '@/client/lib/auth-client'

const ERROR_MESSAGES: Record<string, string> = {
  invite_required: '초대 링크로만 가입할 수 있어요. 받은 초대 링크로 다시 들어와 주세요.',
  admin_only: '관리자 계정으로 먼저 가입해야 해요.',
  access_denied: '구글 로그인이 취소됐어요.',
}

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function GoogleButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      size="lg"
      variant="secondary"
      className="w-full"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true)
        await signInWithGoogle().catch(() => setBusy(false))
      }}
    >
      <GoogleIcon />
      {busy ? '구글로 이동 중…' : '구글로 로그인'}
    </Button>
  )
}

export function LoginPage() {
  const { data: me } = useMe()
  const { data: config } = useConfig()
  const [params] = useSearchParams()
  const error = params.get('error')

  if (me) return <Navigate to="/" replace />

  return (
    <div className="bg-dots flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm text-center">
        <Logo className="mb-2 justify-center text-2xl" />
        <p className="mb-6 text-muted">우리끼리 기록하는 진짜 맛 평가</p>
        {error && (
          <p role="alert" className="mb-4 rounded-xl border-2 border-line bg-peach p-3 text-left text-sm">
            {ERROR_MESSAGES[error] ?? '로그인 중 문제가 생겼어요. 다시 시도해 주세요.'}
          </p>
        )}
        <GoogleButton disabled={config && !config.googleEnabled} />
        {config && !config.googleEnabled && <p className="mt-3 text-sm text-danger">구글 로그인 설정이 아직 끝나지 않았어요.</p>}
        <p className="mt-6 text-sm text-muted">초대받은 사람만 가입할 수 있어요.</p>
      </Card>
    </div>
  )
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, LogOut } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/client/components/ui/button'
import { Card, CardTitle } from '@/client/components/ui/card'
import { Input } from '@/client/components/ui/input'
import { Segmented } from '@/client/components/ui/segmented'
import { api, HttpError, queryKeys, useMe } from '@/client/lib/api'
import { signOut as signOutRequest } from '@/client/lib/auth-client'
import { usePrefs, type FontSize, type Theme } from '@/client/lib/prefs'
import { NICKNAME_MAX, normalizeNickname, type Me } from '@/shared/types'

function NicknameForm({ me }: { me: Me }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(me.nickname)
  const save = useMutation({
    mutationFn: (nickname: string) => api<Me>('/api/me', { method: 'PATCH', body: JSON.stringify({ nickname }) }),
    onSuccess: (data) => qc.setQueryData(queryKeys.me, data),
  })
  const valid = normalizeNickname(value) !== null
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (valid) save.mutate(value)
  }
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="nickname" className="block font-semibold">
        닉네임
      </label>
      <div className="flex gap-2">
        <Input id="nickname" value={value} maxLength={NICKNAME_MAX} onChange={(e) => setValue(e.target.value)} aria-describedby="nickname-help" />
        <Button type="submit" disabled={!valid || save.isPending || value.trim() === me.nickname}>
          저장
        </Button>
      </div>
      <p id="nickname-help" className="text-sm text-muted" aria-live="polite">
        {save.isError
          ? save.error instanceof HttpError
            ? save.error.message
            : '저장하지 못했어요.'
          : save.isSuccess
            ? '저장했어요.'
            : `그룹원에게 보이는 이름이에요. 1~${NICKNAME_MAX}자.`}
      </p>
    </form>
  )
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'sm', label: '작게' },
  { value: 'md', label: '보통' },
  { value: 'lg', label: '크게' },
  { value: 'xl', label: '아주 크게' },
]

export function SettingsPage() {
  const { data: me } = useMe()
  const prefs = usePrefs()
  const qc = useQueryClient()

  const signOut = async () => {
    await signOutRequest()
    qc.setQueryData(queryKeys.me, null)
  }

  return (
    <>
      <h1 className="mb-6 text-2xl">설정</h1>
      <div className="space-y-6">
        <Card>
          <CardTitle>프로필</CardTitle>
          {me && <NicknameForm me={me} />}
          {me && <p className="mt-3 text-sm text-muted">로그인 계정: {me.email}</p>}
        </Card>

        <Card className="space-y-5">
          <CardTitle className="mb-0">화면</CardTitle>
          <Segmented legend="테마" value={prefs.theme} options={THEMES} onChange={prefs.setTheme} />
          <Segmented legend="글자 크기" value={prefs.fontSize} options={FONT_SIZES} onChange={prefs.setFontSize} />
          <p className="rounded-xl bg-surface-2 p-3 text-muted">미리보기: 바삭한 군만두, 짠맛 3 · 매운맛 1</p>
          <p className="text-sm text-muted">화면 설정은 이 기기에만 저장돼요.</p>
        </Card>

        <Card className="p-2">
          <Link to="/changelog" className="flex min-h-12 items-center justify-between rounded-xl px-3 text-ink no-underline hover:bg-surface-2">
            <span>업데이트 내역</span>
            <span className="flex items-center gap-1 text-sm text-muted">
              v{__APP_VERSION__} <ChevronRight size={18} aria-hidden />
            </span>
          </Link>
          {me?.role === 'admin' && (
            <Link to="/admin" className="flex min-h-12 items-center justify-between rounded-xl px-3 text-ink no-underline hover:bg-surface-2">
              <span>멤버·초대 관리</span>
              <ChevronRight size={18} aria-hidden />
            </Link>
          )}
        </Card>

        <Button variant="danger" onClick={signOut}>
          <LogOut size={18} aria-hidden /> 로그아웃
        </Button>
      </div>
    </>
  )
}

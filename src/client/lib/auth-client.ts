// Better Auth 엔드포인트를 직접 호출한다 (클라이언트 라이브러리를 번들에 넣지 않기 위해).
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`auth ${path} ${res.status}`)
  return res.json() as Promise<T>
}

export async function signInWithGoogle() {
  const { url } = await post<{ url?: string }>('/sign-in/social', { provider: 'google', callbackURL: '/', errorCallbackURL: '/login' })
  if (!url) throw new Error('no redirect url')
  window.location.assign(url)
}

export async function signOut() {
  await post('/sign-out', {})
}

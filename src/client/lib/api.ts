import { useQuery } from '@tanstack/react-query'
import type { ApiError, AppConfig, Me } from '@/shared/types'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
    credentials: 'same-origin',
  })
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => null)) as (T & ApiError) | null
  if (!res.ok) {
    throw new HttpError(res.status, body?.error ?? 'unknown', body?.message ?? '요청을 처리하지 못했어요.')
  }
  return body as T
}

export const queryKeys = {
  me: ['me'] as const,
  config: ['config'] as const,
  members: ['admin', 'members'] as const,
  invites: ['admin', 'invites'] as const,
}

/** 로그인 사용자. 로그인하지 않았으면 null */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await api<Me>('/api/me')
      } catch (e) {
        if (e instanceof HttpError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
  })
}

export function useConfig() {
  return useQuery({ queryKey: queryKeys.config, queryFn: () => api<AppConfig>('/api/config'), staleTime: Infinity })
}

import { useQuery } from '@tanstack/react-query'
import type { FoodDetail, FoodKind, FoodSummary, TasteAttribute } from '@/shared/food'
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
  attributes: ['attributes'] as const,
  foods: ['foods'] as const,
  food: (id: string) => ['food', id] as const,
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

export interface FoodListParams {
  q?: string
  kind?: FoodKind | ''
  sort?: 'recent' | 'top'
}

export function useFoods(params: FoodListParams) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.kind) qs.set('kind', params.kind)
  if (params.sort) qs.set('sort', params.sort)
  return useQuery({
    queryKey: [...queryKeys.foods, params],
    queryFn: () => api<FoodSummary[]>(`/api/foods?${qs}`),
    placeholderData: (prev) => prev,
  })
}

export function useAttributes() {
  return useQuery({ queryKey: queryKeys.attributes, queryFn: () => api<TasteAttribute[]>('/api/attributes'), staleTime: 10 * 60_000 })
}

export function useFood(id: string) {
  return useQuery({
    queryKey: queryKeys.food(id),
    queryFn: () => api<{ food: FoodDetail; attributes: TasteAttribute[] }>(`/api/foods/${id}`),
  })
}

/** 사진 파일 업로드 (본문에 그대로) */
export async function uploadImage(foodId: string, blob: Blob) {
  const res = await fetch(`/api/foods/${foodId}/images`, { method: 'POST', body: blob, headers: { 'content-type': blob.type }, credentials: 'same-origin' })
  const body = (await res.json().catch(() => null)) as ApiError | null
  if (!res.ok) throw new HttpError(res.status, body?.error ?? 'unknown', body?.message ?? '사진을 올리지 못했어요.')
  return body as unknown as { id: string; src: string }
}

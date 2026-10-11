export type Role = 'admin' | 'member'

export interface Me {
  id: string
  email: string
  image: string | null
  nickname: string
  role: Role
}

export interface AppConfig {
  googleEnabled: boolean
}

export type InviteStatus = 'active' | 'used' | 'expired'

export interface InviteItem {
  token: string
  url: string
  status: InviteStatus
  createdAt: number
  expiresAt: number
  usedBy: string | null
  usedAt: number | null
}

export interface MemberItem {
  id: string
  nickname: string
  email: string
  image: string | null
  role: Role
  createdAt: number
}

export interface ApiError {
  error: string
  message?: string
}

export const NICKNAME_MAX = 20
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** 닉네임 앞뒤 공백 제거 후 1~20자인지 검사. 올바르면 정리된 값, 아니면 null */
export function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().replace(/\s+/g, ' ')
  return v.length >= 1 && v.length <= NICKNAME_MAX ? v : null
}

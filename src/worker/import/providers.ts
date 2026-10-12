// ── API를 통한 상품 검색 입력 (초안) ──
// 상품명으로 검색해 후보를 고르면 이름·사진 등을 채우는 기능의 연결부.
// 실제 연동은 API 키 발급 후 구현한다. 설계: docs/TasteGuru_API입력_초안.md
import type { ProductCandidate } from '../../shared/food'

export interface ProductSearchProvider {
  /** 공급자 식별자 (설정·로그용) */
  id: string
  /** 화면에 보이는 이름 */
  label: string
  /** 필요한 키가 모두 설정됐는지 */
  isEnabled(env: Env): boolean
  /** 검색어로 상품 후보를 찾는다 */
  search(query: string, env: Env): Promise<ProductCandidate[]>
}

/**
 * NAVER API HUB 검색 (초안).
 * - 네이버 쇼핑 검색 API는 2026-07-31 종료되어 쓸 수 없음
 * - API HUB로 옮겨진 일반 검색(이미지 검색 등)으로 "대표 사진 후보"를 찾는 용도로 검토 중
 * - 엔드포인트·인증 헤더·응답 형식은 HUB 앱 발급 후 공식 문서로 확인해 채운다
 */
export const naverApiHubProvider: ProductSearchProvider = {
  id: 'naver-api-hub',
  label: '네이버 검색',
  isEnabled: (env) => !!(env.NAVER_HUB_CLIENT_ID && env.NAVER_HUB_CLIENT_SECRET),
  async search() {
    throw new Error('naver-api-hub provider is not implemented yet')
  },
}

export const PROVIDERS: ProductSearchProvider[] = [naverApiHubProvider]

export function activeProvider(env: Env): ProductSearchProvider | null {
  return PROVIDERS.find((p) => p.isEnabled(env)) ?? null
}

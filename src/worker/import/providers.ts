// ── API를 통한 상품 검색 입력 ──
// 상품명으로 검색해 후보를 고르면 이름·사진을 채우는 기능의 연결부.
// 지금은 사용 가능한 공급자가 없어 /api/import/search는 501, 화면의 "상품 검색" 탭은 "준비 중"이다.
//
// NAVER API HUB 검색 API는 v0.2.1~v0.2.2에서 썼다가 v0.2.3에서 제거했다.
// 검색 API 개별 특약(2026-09-20 시행)이 검색결과·파생물의 저장·캐싱(2.3), 가공 노출(2.2),
// 검색결과 제공 외 목적 사용(2.1)을 금지해 "검색 → 골라서 음식 정보로 저장" 흐름과 맞지 않는다.
// 새 공급자를 붙일 때는 결과를 저장해도 되는 데이터인지 약관부터 확인한다. 기록: docs/TasteGuru_API입력_초안.md
import type { ProductCandidate } from '../../shared/food'

export interface ProductSearchProvider {
  /** 공급자 식별자 (설정·로그용) */
  id: string
  /** 화면에 보이는 이름 */
  label: string
  /** 필요한 키가 모두 설정됐는지 */
  isEnabled(env: Env): boolean
  /** 검색어로 상품 후보를 찾는다. 실패하면 SearchError */
  search(query: string, env: Env): Promise<ProductCandidate[]>
}

export class SearchError extends Error {}

export const PROVIDERS: ProductSearchProvider[] = []

export function activeProvider(env: Env): ProductSearchProvider | null {
  return PROVIDERS.find((p) => p.isEnabled(env)) ?? null
}

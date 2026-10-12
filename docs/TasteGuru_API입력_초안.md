# TasteGuru – API를 통한 상품 입력 (초안, 2026-10-12)

> 상태: **연결부만 구현, 실제 연동은 미구현.** NAVER API HUB 가입 오류로 키를 아직 받지 못함.
> 키가 준비되면 이 문서의 "구현 순서"대로 진행한다.

## 1. 목적

상품명으로 검색 → 후보 목록에서 고르기 → 이름·사진 등을 자동으로 채우기.
URL 붙여넣기가 안 되는 쇼핑몰(쿠팡, 네이버 스마트스토어 등) 상품을 쉽게 입력하기 위한 보조 경로.

## 2. 지금 구현된 것 (v0.2.0)

| 위치 | 내용 |
| --- | --- |
| `src/worker/import/providers.ts` | `ProductSearchProvider` 인터페이스(`id`, `label`, `isEnabled(env)`, `search(query, env)`)와 NAVER API HUB 공급자 자리. `search()`는 아직 "미구현" 오류 |
| `GET /api/import/search?q=` | 사용 가능한 공급자가 없으면 **501 `search_not_configured`**, 있으면 `{ provider, items: ProductCandidate[] }` |
| `GET /api/config` | `productSearch: { enabled, label }` — 키가 없으면 `enabled: false` |
| 음식 추가 화면 | "상품 검색" 탭이 **준비 중**으로 비활성. `productSearch.enabled`가 true가 되면 자동으로 켜짐 |
| `src/shared/food.ts` | `ProductCandidate` 타입 (name, brand, image, price, url, provider) |
| 환경 변수 자리 | `NAVER_HUB_CLIENT_ID`, `NAVER_HUB_CLIENT_SECRET` (설정되면 공급자 활성) |
| DB | `food.source`에 `'api'` 값이 이미 정의됨 (API로 입력한 음식 구분용) |

## 3. 후보 API

| API | 얻을 수 있는 것 | 비용·조건 | 판단 |
| --- | --- | --- | --- |
| NAVER API HUB 이미지 검색 | 상품명으로 찾은 **사진 후보** (이름·가격·브랜드는 없음) | 현재 한시적 무료, 유료화 예고. 검색 결과 표시 목적 외 사용 제한 등 약관 확인 필요 | 1순위 검토. 대표 사진 고르기 용도 |
| NAVER API HUB 블로그·웹 검색 | 상품명 관련 글 제목·링크 | 위와 같음 | 참고 정보 정도. 우선순위 낮음 |
| 식약처 바코드 제품 정보 (공공데이터) | 바코드 → **제품명·제조사** (사진 없음) | 무료, 공공데이터포털 인증키 | 바코드 스캔 입력과 함께 검토 |
| 식약처 식품영양성분 DB(K-FIND) | 제품명 → 영양성분 | 무료 | MVP 이후 "영양 정보" 기능 |
| 쿠팡 파트너스 상품 검색 | 상품명·사진·가격 | 파트너스 최종 승인(판매 실적) 필요 | 현실성 낮음 |
| ~~네이버 쇼핑 검색~~ | — | 2026-07-31 종료 | 사용 불가 |

> 위 표의 API HUB 세부 사항(엔드포인트·응답 필드·약관)은 키 발급 후 공식 문서로 다시 확인한다. 이 문서 작성 시점에는 2차 자료만 확인함.

## 4. 화면 흐름 (안)

1. 음식 추가 → "상품 검색" 탭 → 검색어 입력
2. 후보 카드 목록 (사진·이름·브랜드·가격 중 있는 것만 표시)
3. 하나를 고르면 아래 입력 폼에 채움 (`source: 'api'`), 사용자가 확인·수정 후 저장
4. 이미지 검색만 쓰는 경우: 직접 입력 폼의 "사진" 영역에 **"사진 찾기"** 버튼으로 붙이는 방식도 가능 (이름은 직접 입력)

## 5. 구현 순서 (키 발급 후)

1. NAVER API HUB에서 앱 만들기 → Client ID/Secret 발급
2. 공식 문서로 이미지 검색 엔드포인트·인증 헤더·응답 형식·호출 한도 확인
3. `naverApiHubProvider.search()` 구현: 응답 → `ProductCandidate[]` 변환, 8초 시간 제한, 오류 시 빈 목록
4. Cloudflare → tasteguru Worker에 `NAVER_HUB_CLIENT_ID`, `NAVER_HUB_CLIENT_SECRET` Secret 등록 → 탭 자동 활성화
5. `FoodNewPage`의 `mode === 'search'` 영역에 검색 폼·후보 목록 구현
6. 테스트: 외부 호출을 가짜 응답으로 바꿔 변환·오류 처리 검증, 키 없을 때 501 유지 확인
7. 사용량 대비: 같은 검색어 결과를 KV 또는 Cache API에 하루 캐시 (유료화 대비)

## 6. 열린 질문

- NAVER API HUB 가입 오류 내용 (오류 문구를 알려 주면 원인 확인을 돕겠음)
- 이미지 검색 결과를 "대표 사진"으로 저장해도 되는지 약관 확인 — 기본은 쇼핑몰 이미지처럼 **주소만 저장(핫링크)**
- 바코드 스캔을 함께 넣을지 (휴대폰 카메라 + 식약처 바코드 API)

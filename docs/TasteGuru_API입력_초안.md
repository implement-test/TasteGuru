# TasteGuru – API를 통한 상품 입력 (2026-10-12 초안, 2026-10-13 구현)

> 상태: **v0.2.1에서 NAVER API HUB 이미지 검색으로 구현.** 아래 2~5절은 초안 당시 기록, 실제 연동 내용은 "7. 구현 결과" 참고.

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

## 7. 구현 결과 (v0.2.1, 2026-10-13)

실제 키로 확인한 내용:

| 항목 | 내용 |
| --- | --- |
| 키 | 네이버 클라우드 플랫폼 → NAVER API HUB Application 키 (Client ID 10자, Secret 40자). 개발자센터(`openapi.naver.com`) 키와 다름 |
| 주소 | `GET https://naverapihub.apigw.ntruss.com/search/v1/image?query=&display=&sort=&filter=` (블로그 `/blog`, 뉴스 `/news` 등도 같은 형식) |
| 인증 헤더 | `X-NCP-APIGW-API-KEY-ID`(Client ID), `X-NCP-APIGW-API-KEY`(Client Secret) |
| API 사용 설정 | Application에서 체크한 API만 사용 가능. 안 켠 API는 401 "요청한 API는 이 Application에서 활성화되어 있지 않습니다." |
| 응답 | 개발자센터 검색 API와 같음: `items[].title`(`<b>` 강조 포함), `link`(원본 사진), `thumbnail`(150px), `sizewidth`, `sizeheight` |
| 제목 | 쇼핑몰 상품이면 대개 "상품명 : 쇼핑몰" 형식 → 쇼핑몰 이름을 떼어 이름 초안으로 사용 |

구현:

- `src/worker/import/providers.ts` `naverApiHubProvider`: 20건 요청 → 사진 주소 중복 제거 후 최대 12건, http 사진은 https로, 8초 시간 제한
- 키 이름: `NAVER_HUB_CLIENT_ID`/`NAVER_HUB_CLIENT_SECRET` 우선, `NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`도 인식
- `GET /api/import/search?q=`: 키 없음 501, 네이버 오류·시간 초과 502 `search_failed`
- 음식 추가 → "상품 검색" 탭: 검색 → 사진 후보 고르기 → 이름·대표 사진 채움 → 확인 후 저장 (`source: 'api'`)
- 테스트: `test/search.test.ts` (변환, 호출 주소·헤더, 오류 처리, 501)

하루 캐시 (v0.2.2):

- `src/worker/import/search-cache.ts`: Cloudflare Cache API(`caches.default`)에 검색어별 결과를 24시간 저장. 추가 설정·바인딩 없음
- 캐시 키: 공급자 + 정규화한 검색어(앞뒤·연속 공백 제거, 소문자, 50자)
- 실패(502)는 저장하지 않음. 응답 헤더 `x-search-cache: hit|miss`로 확인 가능
- 한계: 데이터센터별로 따로 저장되고 공간이 부족하면 일찍 지워질 수 있음 (사용량 줄이기 용도로는 충분)

남은 일: 이미지 검색 결과 사진 저장 관련 약관 확인

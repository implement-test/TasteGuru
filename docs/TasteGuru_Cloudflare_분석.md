# TasteGuru – Cloudflare 단독 개발 가능성 및 사용량 분석 (2026-10-11)

## 결론: **가능 (추천)**

Supabase 없이 **Cloudflare Workers Paid 하나로 모든 기능을 만들 수 있고**, 지금 쓰는 사용량에 TasteGuru를 더해도 **포함량 안**이라 **추가 비용은 0원으로 예상**합니다 (이미 내는 월 $5 안에서 해결).

| Supabase 기능 | Cloudflare 대체 | 판단 |
| --- | --- | --- |
| PostgreSQL DB | **D1** (SQLite 기반 서버리스 DB) | 가능. 평균 집계·다대다 관계·뷰 모두 SQL로 처리. 유료 플랜 DB당 최대 10GB |
| Google 로그인 (Auth) | **Better Auth** 라이브러리 + D1 | 가능. 설정만으로 끝나는 Supabase와 달리 **직접 연결 코드가 필요**(라이브러리가 대부분 처리) |
| RLS(행 단위 권한) | Worker API 코드에서 권한 검사 | 가능. 메모가 **전체 공개**로 정해져 권한 규칙이 단순해짐(수정·삭제 = 본인/관리자) |
| Storage(사진) | **R2** | 가능. 전송(egress) 요금 없음 |
| 호스팅 (Vercel) | **Workers + Static Assets** | 가능. 화면 파일은 정적 자산으로, API는 같은 Worker에서 처리 |
| 예약 작업 (GitHub Actions) | **Cron Triggers** | 가능. 주간 백업을 Worker 안에서 실행 |
| 자동 백업 (무료 플랜엔 없음) | **D1 Time Travel** | 유료 플랜은 **최근 30일 아무 시점(분 단위)으로 복구** 가능, 추가 비용 없음 |

### Supabase 대비 장단점

**장점**
- **비용 0원 추가**: 이미 Workers Paid 사용 중
- **일시정지 없음**: Supabase 무료 플랜의 "7일 비활성 시 정지" 문제가 사라짐
- **계정·서비스 하나로 통합**: 배포·DB·파일·예약 작업을 한 곳에서 관리, 키 관리 대상 감소
- **백업 걱정 감소**: D1 Time Travel 30일 + 주간 JSON 백업

**단점·주의**
- 로그인·초대 기능을 라이브러리로 **직접 구성**해야 함 (Supabase보다 초기 작업 조금 더 많음)
- 권한 검사를 DB가 아닌 **API 코드에서** 해야 하므로 테스트로 확인 필요
- D1은 **주 데이터베이스가 한 지역**에 있음 → 생성 시 위치를 **아시아·태평양(apac)** 으로 지정해 한국에서 빠르게
- D1은 쓰기 요금 상한·세밀한 알림이 없음 → 10인 규모에선 문제없지만, 잘못된 반복 쓰기 버그만 주의

---

## 현재 Cloudflare 사용량 (API로 조회)

- 조회 범위: **2026-10-01 ~ 10-11 (11일)**. 계정 생성일은 2026-09-26
- API 토큰 권한 부족으로 **KV, Pages, Images, 구독·청구 정보는 조회하지 못함** → 정확한 청구 주기와 청구 금액은 대시보드에서 확인 필요

### 리소스 현황

| 종류 | 이름 |
| --- | --- |
| Workers (4) | owlsflow, playlog-son, projectdeck, sf6-repository |
| D1 (3) | playlog-db, projectdeck, sf6-repository-tag-cache |
| R2 (3) | playlog-media, sf6-media, sf6-repository-opennext-cache |
| Queues / Durable Objects | 없음 |

### 사용량 vs 월 포함량

| 항목 | 11일 사용량 | 월 예상(×2.8) | Workers Paid 월 포함량 | 월 예상 비율 |
| --- | --- | --- | --- | --- |
| Workers 요청 | 38,139 | 약 10.7만 | 1,000만 | **약 1%** |
| Workers CPU 시간 | 639,310 ms | 약 180만 ms | 3,000만 ms | **약 6%** |
| D1 읽은 행 | 57,678 | 약 16만 | 250억 | ≈ 0% |
| D1 쓴 행 | 3,066 | 약 8,600 | 5,000만 | ≈ 0% |
| D1 저장 용량 | 0.57 MB | — | 5 GB | ≈ 0% |
| R2 저장 용량 | **3.98 GB** | 증가 중 | 10 GB-월 (무료) | **약 40%** ⚠️ |
| R2 Class A (쓰기류) | 약 27,500 | 약 7.7만 | 100만 (무료) | 약 8% |
| R2 Class B (읽기류) | 약 8,100 | 약 2.3만 | 1,000만 (무료) | ≈ 0% |

### Worker별 사용량 (10/1~10/11)

| Worker | 요청 | CPU 합계 | 요청당 평균 CPU | 비고 |
| --- | --- | --- | --- | --- |
| sf6-repository | 9,704 | 578,038 ms | **약 60 ms** | 전체 CPU의 **90%**. Next.js(OpenNext) 서버 렌더링이 무거움 |
| (이름 없음) | 24,137 | 15,719 ms | 0.7 ms | 스크립트 이름이 기록되지 않은 요청(삭제된 Worker나 Pages 등으로 추정, 확인 불가) |
| projectdeck | 3,207 | 9,293 ms | 2.9 ms | |
| playlog-son | 781 | 14,772 ms | 19 ms | |
| owlsflow | 310 | 21,488 ms | 69 ms | |

### ⚠️ 주의: `sf6-repository-opennext-cache` R2 버킷 증가

| 날짜 | 용량 | 객체 수 |
| --- | --- | --- |
| 10-02 | 0.75 GB | 5,518 |
| 10-05 | 3.26 GB | 22,853 |
| 10-08 | 3.46 GB | 23,647 |
| 10-11 | 3.96 GB | 24,962 |

- 최근 하루 약 **0.17 GB씩 증가** (10/7→10/11 기준). 이 속도면 **약 5주 뒤(11월 중순) 계정 R2 무료 10GB 초과**
- 초과 요금은 GB-월당 $0.015로 크지 않지만(5GB 초과 시 월 약 $0.08), 계속 쌓이는 구조
- 권장: 해당 버킷에 **수명 주기 규칙(예: 30일 지난 객체 자동 삭제)** 추가. TasteGuru와는 별개 작업이라 진행 여부는 결정해 주세요

---

## TasteGuru 예상 사용량 (10인, 넉넉하게 잡은 값)

| 항목 | 가정 | 월 예상 | 포함량 대비 |
| --- | --- | --- | --- |
| Workers 요청 | 10명 × 하루 200회 API 호출 | 6만 | 0.6% |
| CPU 시간 | 요청당 평균 5 ms (React SPA + 가벼운 API) | 30만 ms | 1% |
| D1 읽은 행 | 목록 1회 5,000행 × 10명 × 하루 30회 | 4,500만 | 0.2% |
| D1 쓴 행 | 평가·등록 | 수천 | ≈ 0% |
| D1 저장 | 음식 1,000개, 평가 1만 건 | 50 MB 미만 | 1% |
| R2 저장 | 음식 1,000개 × 사진 5장 × 300 KB (최대치) | 1.5 GB | 15% |

**기존 + TasteGuru 합계**: 요청 약 2%, CPU 약 7%, R2 약 55% (opennext 캐시 증가분 제외 시) → **포함량 안, 추가 비용 0원**

---

## 바뀐 기술 스택

| 구분 | 이전 (Supabase 안) | 변경 (Cloudflare 단독) | 이유 |
| --- | --- | --- | --- |
| 화면 | Next.js | **React + Vite (SPA)** | 지인 전용이라 검색 노출(SSR)이 필요 없음. 화면 파일은 정적 자산으로 제공되어 Worker CPU를 거의 안 씀. 현재 sf6-repository에서 보이는 **OpenNext의 높은 CPU(요청당 60 ms)·캐시 용량 증가를 피함** |
| API | Next.js API 라우트 | **Hono** (Workers용 경량 웹 프레임워크) | Workers 전용으로 만들어져 가볍고, D1·R2 바인딩 사용이 간단 |
| DB | Supabase Postgres | **D1** + Drizzle ORM | 타입 안전한 쿼리, 마이그레이션 관리 |
| 인증 | Supabase Auth | **Better Auth** (Google) + 자체 초대 링크 | D1과 함께 쓸 수 있고 Workers에서 동작 |
| 파일 | Supabase Storage | **R2** | 브라우저에서 WebP로 압축(장당 약 300 KB) 후 업로드 |
| 호스팅 | Vercel | **Workers + Static Assets** | 하나의 Worker로 화면 + API 배포 |
| 백업 | GitHub Actions | **D1 Time Travel + Cron Trigger → R2** | Cloudflare 안에서 완결 |
| UI·차트 | shadcn/ui + Tailwind, Recharts | 변경 없음 | |

---

## 출처

**주요 출처**
- Cloudflare 계정 API·GraphQL Analytics 직접 조회 결과 (2026-10-11)
- [Cloudflare – D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare – D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare – D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare – R2 Pricing](https://developers.cloudflare.com/r2/pricing)
- [Cloudflare – Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

**보조 출처**
- [costbench – Cloudflare Workers 숨은 비용](https://costbench.com/software/cloud-infrastructure/cloudflare-pages-workers/hidden-costs/)
- [flarecalc – D1 계산기](https://flarecalc.com/calculators/d1)
- [flarecalc – R2 계산기](https://flarecalc.com/calculators/r2)
- [flaviocopes – Better Auth on Cloudflare Workers](https://flaviocopes.com/better-auth-astro-cloudflare.md)

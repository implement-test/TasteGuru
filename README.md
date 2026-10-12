# TasteGuru

소규모 그룹(10명 이하)이 음식의 맛을 항목별(단맛·짠맛·매운맛 등 강도 + 종합 점수)로 기록하고 비교하는 웹 앱.

- 서비스 주소: https://tasteguru.nogamenogain.com
- 기획·설계 문서: [`docs/`](docs/) (명세 `TasteGuru.md`, 세부 구상, Cloudflare 분석, PoC 결과, API 입력 초안)
- 업데이트 내역: [`CHANGELOG.md`](CHANGELOG.md) (앱의 "업데이트 내역" 화면에 그대로 표시)

## 기술 구성

Cloudflare Workers 하나에 화면과 API를 함께 배포한다.

| 구분 | 사용 |
| --- | --- |
| 화면 | React 19 + Vite + TypeScript, React Router, TanStack Query, Tailwind CSS v4 |
| API | Hono (`/api/*`) |
| 인증 | Better Auth — 구글 로그인, 초대 링크로만 가입 |
| DB | Cloudflare D1 (`tasteguru-db`, APAC) + Drizzle ORM |
| 파일 | Cloudflare R2 (`tasteguru-media`, APAC) |
| 테스트 | Vitest + `@cloudflare/vitest-plugin` (Workers 런타임·D1에서 실행) |

## 폴더 구조

```
src/
  worker/        Hono API, Better Auth 설정, Drizzle 스키마(db/schema.ts)
    routes/      foods(음식·평가·사진), admin, imports(URL 가져오기·API 검색 자리), images(R2 사진 제공)
    import/      url.ts(상품 URL → 이름·사진·가격·브랜드), providers.ts(API 검색 공급자 초안)
  client/        React 화면 (pages, components, lib)
  shared/        화면·서버 공용 타입과 함수 (changelog 파서 등)
migrations/      D1 마이그레이션 (drizzle-kit이 생성)
test/            Workers 런타임 테스트
scripts/         디자인 토큰 대비 검사
poc/             0단계 기술 검증용 Worker (본 앱과 별개)
```

## 개발

```bash
npm ci
cp .dev.vars.example .dev.vars        # 로컬 비밀값
npm run db:migrate:local
npm run dev                           # http://localhost:5173
```

로컬에서 구글 키 없이 화면을 보려면 `.dev.vars`에 `ENABLE_TEST_EMAIL_AUTH=1`을 두고 이메일 가입 API(`POST /api/auth/sign-up/email`)로 계정을 만든다. **운영에는 절대 설정하지 않는다.**

| 명령 | 설명 |
| --- | --- |
| `npm run check` | 타입 검사 + 색 대비 검사 + 테스트 (CI와 같음) |
| `npm test` | 테스트만 |
| `npm run db:generate` | `src/worker/db/schema.ts` 변경 후 마이그레이션 생성 |
| `npm run db:migrate:remote` | 운영 D1에 마이그레이션 적용 |
| `npm run deploy` | 빌드 후 운영 배포 |
| `npm run cf-typegen` | `wrangler.jsonc` 변경 후 Env 타입 다시 생성 |

## 운영 비밀값 (Workers → tasteguru → Settings → Variables and Secrets)

| 이름 | 설명 |
| --- | --- |
| `BETTER_AUTH_SECRET` | 세션 서명 키 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 구글 OAuth (리디렉션 URI: `https://tasteguru.nogamenogain.com/api/auth/callback/google`) |
| `ADMIN_EMAIL` | 첫 관리자가 될 이메일. 다른 사람이 먼저 가입해 관리자가 되는 것을 막는다 |

## 디자인 규칙

- 색은 `src/client/styles.css`의 토큰만 쓴다. 토큰을 바꾸면 `npm run check:contrast`로 WCAG AA(글자 4.5:1, 테두리 3:1)를 확인한다
- 다크 토큰은 `data-theme='dark'` 블록과 시스템 다크 모드 블록 두 곳에 같게 둔다 (검사 스크립트가 확인)
- 크기는 `rem` 단위로 지정해 설정의 글자 크기 4단계가 모든 화면에 적용되게 한다

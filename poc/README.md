# TasteGuru PoC

개발 0단계 기술 검증용 Cloudflare Worker. 결과는 `../docs/TasteGuru_PoC_결과.md` 참고.

- 배포 주소: https://tasteguru-poc.end0fw0rld.workers.dev
- 구성: Hono(API) · Better Auth(Google 로그인, 초대 링크 가입 제한) · D1 · R2

## 명령

```bash
npm install
npx wrangler d1 migrations apply tasteguru-poc-db --local   # 로컬 DB
npm run dev                                                  # http://localhost:8787
npm run typecheck
npm run deploy
node scripts/gen-auth-sql.mjs                                # Better Auth 테이블 SQL 다시 생성
```

## 로컬 환경 변수 (`.dev.vars`, git 제외)

```
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:8787
POC_KEY=...
POC_EMAIL_AUTH=1        # 로컬 전용: 구글 없이 가입 제한 로직 테스트
ADMIN_EMAIL=...
```

## 배포본 Secret

`BETTER_AUTH_SECRET`, `POC_KEY`(설정됨), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `ADMIN_EMAIL`

## API

| 경로 | 설명 |
| --- | --- |
| `GET /` | PoC 확인 페이지 |
| `/api/auth/*` | Better Auth |
| `GET /api/me` | 로그인 사용자와 역할 |
| `GET /invite/:token` | 초대 링크 (쿠키 저장 후 첫 화면으로) |
| `POST /api/invites` | 초대 링크 생성 (관리자) |
| `GET /api/poc/status` | Secret 설정 여부, D1 상태 |
| `GET /api/poc/naver?q=` | 네이버 쇼핑 검색 (PoC 키 또는 로그인 필요) |
| `GET /api/poc/og?url=&ua=` | 상품 URL 메타 추출, `ua`: all·browser·facebook·kakaotalk·twitter |
| `GET /api/poc/d1`, `/api/poc/r2` | D1·R2 읽기/쓰기 확인 |

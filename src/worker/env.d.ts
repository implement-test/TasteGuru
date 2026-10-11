// wrangler.jsonc에 없는 Secret·대시보드 변수 (wrangler types가 만들지 않는 것)
interface SecretEnv {
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** 첫 관리자가 될 이메일. 지정하면 이 이메일만 첫 가입 가능 */
  ADMIN_EMAIL?: string
  /** 테스트 전용: 구글 없이 가입 흐름을 검증하는 이메일 가입. 운영에는 설정하지 않는다 */
  ENABLE_TEST_EMAIL_AUTH?: string
  /** 테스트 전용: D1 마이그레이션 목록 */
  TEST_MIGRATIONS?: import('@cloudflare/vitest-plugin').D1Migration[]
}

declare namespace Cloudflare {
  interface Env extends SecretEnv {}
}
interface Env extends SecretEnv {}

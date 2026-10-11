export interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  BETTER_AUTH_URL: string
  BETTER_AUTH_SECRET: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  NAVER_CLIENT_ID?: string
  NAVER_CLIENT_SECRET?: string
  POC_EMAIL_AUTH?: string
  ADMIN_EMAIL?: string
}

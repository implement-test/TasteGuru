// Better Auth가 요구하는 테이블 SQL을 SQLite 기준으로 생성한다 (D1 마이그레이션용).
import { DatabaseSync } from 'node:sqlite'
import { getMigrations } from 'better-auth/db/migration'

const db = new DatabaseSync(':memory:')
const { compileMigrations } = await getMigrations({
  database: db,
  secret: 'x'.repeat(32),
  socialProviders: { google: { clientId: 'x', clientSecret: 'x' } },
})
process.stdout.write(await compileMigrations())

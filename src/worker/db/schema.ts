import { foreignKey, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// 시간은 모두 밀리초 정수(Unix ms)로 저장한다.
const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull()
const updatedAt = () => integer('updated_at', { mode: 'timestamp_ms' }).notNull()

// ── Better Auth 테이블 (필드 이름은 Better Auth 규칙을 따름) ──
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  role: text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  nickname: text('nickname'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

// ── 앱 테이블 ──
export const invite = sqliteTable('invite', {
  token: text('token').primaryKey(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedBy: text('used_by').references(() => user.id, { onDelete: 'set null' }),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
})

// ── 음식·평가 ──
export const FOOD_KINDS = ['product', 'meal_kit', 'delivery'] as const
export const FOOD_SOURCES = ['manual', 'url', 'api'] as const

export const food = sqliteTable(
  'food',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: FOOD_KINDS }).notNull(),
    name: text('name').notNull(),
    brand: text('brand'),
    storeName: text('store_name'),
    price: integer('price'),
    sourceUrl: text('source_url'),
    source: text('source', { enum: FOOD_SOURCES }).notNull().default('manual'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('food_created_at_idx').on(t.createdAt), index('food_name_idx').on(t.name)],
)

/** 음식 사진. external = 쇼핑몰 이미지 주소, r2 = 직접 올린 사진(R2 키) */
export const foodImage = sqliteTable(
  'food_image',
  {
    id: text('id').primaryKey(),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id, { onDelete: 'cascade' }),
    storage: text('storage', { enum: ['external', 'r2'] }).notNull(),
    location: text('location').notNull(),
    position: integer('position').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('food_image_food_id_idx').on(t.foodId, t.position)],
)

export const tasteAttribute = sqliteTable('taste_attribute', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  guide: text('guide'),
  position: integer('position').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

/** 1인 1평가. 다시 평가하면 덮어쓴다 */
export const rating = sqliteTable(
  'rating',
  {
    foodId: text('food_id')
      .notNull()
      .references(() => food.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    overall: integer('overall').notNull(),
    memo: text('memo'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.foodId, t.userId] }), index('rating_user_id_idx').on(t.userId)],
)

/** 맛 항목별 강도(0~5). 매긴 항목만 행이 생긴다 */
export const ratingScore = sqliteTable(
  'rating_score',
  {
    foodId: text('food_id').notNull(),
    userId: text('user_id').notNull(),
    attributeId: text('attribute_id')
      .notNull()
      .references(() => tasteAttribute.id),
    value: integer('value').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.foodId, t.userId, t.attributeId] }),
    foreignKey({ columns: [t.foodId, t.userId], foreignColumns: [rating.foodId, rating.userId] }).onDelete('cascade'),
  ],
)

import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Hono } from 'hono'
import {
  MAX_IMAGES,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  isFoodKind,
  validateFoodInput,
  validateRatingInput,
  type AttributeStat,
  type FoodDetail,
  type FoodImage,
  type FoodSummary,
  type RatingView,
  type TasteAttribute,
} from '../../shared/food'
import { displayName, fail, isAdmin, type AppEnv, type SessionUser } from '../app'
import { getDb, schema, type Db } from '../db'

const { food, foodImage, rating, ratingScore, tasteAttribute, user } = schema

export const imageSrc = (img: { storage: 'external' | 'r2'; location: string }) =>
  img.storage === 'r2' ? `/api/images/${img.location}` : img.location

const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)

async function activeAttributes(db: Db): Promise<TasteAttribute[]> {
  return db
    .select({ id: tasteAttribute.id, name: tasteAttribute.name, emoji: tasteAttribute.emoji, guide: tasteAttribute.guide })
    .from(tasteAttribute)
    .where(eq(tasteAttribute.active, true))
    .orderBy(asc(tasteAttribute.position))
}

async function loadFood(db: Db, id: string) {
  return db.query.food.findFirst({ where: eq(food.id, id) })
}

const canEdit = (u: SessionUser, f: { createdBy: string | null }) => isAdmin(u) || f.createdBy === u.id

async function imageCount(db: Db, foodId: string) {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(foodImage).where(eq(foodImage.foodId, foodId))
  return row?.n ?? 0
}

async function nextPosition(db: Db, foodId: string) {
  const [row] = await db.select({ p: sql<number | null>`max(${foodImage.position})` }).from(foodImage).where(eq(foodImage.foodId, foodId))
  return (row?.p ?? -1) + 1
}

/** 이미지 순서를 0,1,2…로 다시 매긴다 */
async function renumber(db: Db, foodId: string, orderedIds: string[]) {
  if (!orderedIds.length) return
  const updates = orderedIds.map((id, i) => db.update(foodImage).set({ position: i }).where(and(eq(foodImage.id, id), eq(foodImage.foodId, foodId))))
  await db.batch(updates as unknown as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
}

export const foods = new Hono<AppEnv>()

foods.get('/attributes', async (c) => c.json(await activeAttributes(getDb(c.env.DB))))

// 목록: 검색어·종류·정렬
foods.get('/foods', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const q = c.req.query('q')?.trim().slice(0, 50)
  const kind = c.req.query('kind')
  const sort = c.req.query('sort') === 'top' ? 'top' : 'recent'

  // 상관 서브쿼리는 별칭으로 테이블을 명시한다 (food_image.id 등과 헷갈리지 않게)
  const avgOverall = sql<number | null>`(select avg(r.overall) from rating r where r.food_id = "food"."id")`
  const ratingCount = sql<number>`(select count(*) from rating r where r.food_id = "food"."id")`
  const myOverall = sql<number | null>`(select r.overall from rating r where r.food_id = "food"."id" and r.user_id = ${me.id})`
  const thumbStorage = sql<'external' | 'r2' | null>`(select fi.storage from food_image fi where fi.food_id = "food"."id" order by fi.position limit 1)`
  const thumbLocation = sql<string | null>`(select fi.location from food_image fi where fi.food_id = "food"."id" order by fi.position limit 1)`

  const filters = []
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, (m) => '\\' + m)}%`
    filters.push(or(sql`${food.name} like ${pattern} escape '\\'`, sql`${food.brand} like ${pattern} escape '\\'`, sql`${food.storeName} like ${pattern} escape '\\'`))
  }
  if (isFoodKind(kind)) filters.push(eq(food.kind, kind))

  const rows = await db
    .select({
      id: food.id,
      kind: food.kind,
      name: food.name,
      brand: food.brand,
      storeName: food.storeName,
      createdAt: food.createdAt,
      avgOverall,
      ratingCount,
      myOverall,
      thumbStorage,
      thumbLocation,
    })
    .from(food)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(...(sort === 'top' ? [sql`${avgOverall} is null`, desc(avgOverall), desc(ratingCount)] : []), desc(food.createdAt))
    .limit(200)

  const items: FoodSummary[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    brand: r.brand,
    storeName: r.storeName,
    thumbnail: r.thumbStorage && r.thumbLocation ? imageSrc({ storage: r.thumbStorage, location: r.thumbLocation }) : null,
    avgOverall: round1(r.avgOverall),
    ratingCount: r.ratingCount,
    myOverall: r.myOverall,
    createdAt: r.createdAt.getTime(),
  }))
  return c.json(items)
})

foods.post('/foods', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const parsed = validateFoodInput(await c.req.json().catch(() => null))
  if (!parsed.ok) return fail(c, 400, 'invalid_food', parsed.message)
  const v = parsed.value
  const id = crypto.randomUUID()
  const now = new Date()
  const images = (v.externalImages ?? []).slice(0, MAX_IMAGES)
  await db.batch([
    db.insert(food).values({
      id,
      kind: v.kind!,
      name: v.name!,
      brand: v.kind === 'delivery' ? null : (v.brand ?? null),
      storeName: v.storeName ?? null,
      price: v.price ?? null,
      sourceUrl: v.sourceUrl ?? null,
      source: v.source ?? 'manual',
      createdBy: me.id,
      createdAt: now,
      updatedAt: now,
    }),
    ...images.map((location, i) =>
      db.insert(foodImage).values({ id: crypto.randomUUID(), foodId: id, storage: 'external', location, position: i, createdBy: me.id, createdAt: now }),
    ),
  ])
  return c.json({ id }, 201)
})

foods.get('/foods/:id', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')

  const [images, attrs, ratingRows, scoreRows, creator] = await Promise.all([
    db.select().from(foodImage).where(eq(foodImage.foodId, f.id)).orderBy(asc(foodImage.position)),
    activeAttributes(db),
    db
      .select({ r: rating, nickname: user.nickname, name: user.name, image: user.image })
      .from(rating)
      .innerJoin(user, eq(rating.userId, user.id))
      .where(eq(rating.foodId, f.id))
      .orderBy(desc(rating.updatedAt)),
    db.select().from(ratingScore).where(eq(ratingScore.foodId, f.id)),
    f.createdBy ? db.query.user.findFirst({ where: eq(user.id, f.createdBy), columns: { id: true, nickname: true, name: true } }) : null,
  ])

  const scoresByUser = new Map<string, Record<string, number>>()
  for (const s of scoreRows) {
    const m = scoresByUser.get(s.userId) ?? {}
    m[s.attributeId] = s.value
    scoresByUser.set(s.userId, m)
  }
  const ratings: RatingView[] = ratingRows.map(({ r, nickname, name, image }) => ({
    userId: r.userId,
    nickname: nickname || name,
    image,
    overall: r.overall,
    scores: scoresByUser.get(r.userId) ?? {},
    memo: r.memo,
    updatedAt: r.updatedAt.getTime(),
  }))

  // 평균은 그 항목을 매긴 사람만으로 계산한다 (안 매긴 항목은 0점이 아니라 제외)
  const attributeStats: AttributeStat[] = attrs.map((a) => {
    const values = scoreRows.filter((s) => s.attributeId === a.id).map((s) => s.value)
    return { attributeId: a.id, avg: values.length ? round1(values.reduce((x, y) => x + y, 0) / values.length) : null, count: values.length }
  })
  const avgOverall = ratings.length ? round1(ratings.reduce((x, r) => x + r.overall, 0) / ratings.length) : null

  const detail: FoodDetail = {
    id: f.id,
    kind: f.kind,
    name: f.name,
    brand: f.brand,
    storeName: f.storeName,
    price: f.price,
    sourceUrl: f.sourceUrl,
    source: f.source,
    createdBy: creator ? { id: creator.id, nickname: displayName(creator) } : null,
    createdAt: f.createdAt.getTime(),
    updatedAt: f.updatedAt.getTime(),
    images: images.map<FoodImage>((i) => ({ id: i.id, src: imageSrc(i), storage: i.storage })),
    avgOverall,
    ratingCount: ratings.length,
    attributeStats,
    ratings,
    myRating: ratings.find((r) => r.userId === me.id) ?? null,
    canEdit: canEdit(me, f),
  }
  return c.json({ food: detail, attributes: attrs })
})

foods.patch('/foods/:id', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')
  if (!canEdit(me, f)) return fail(c, 403, 'forbidden', '등록한 사람이나 관리자만 고칠 수 있어요.')
  const parsed = validateFoodInput(await c.req.json().catch(() => null), true)
  if (!parsed.ok) return fail(c, 400, 'invalid_food', parsed.message)
  const { externalImages: _ignored, ...v } = parsed.value
  const kind = v.kind ?? f.kind
  const storeName = v.storeName !== undefined ? v.storeName : f.storeName
  if (kind === 'delivery' && !storeName) return fail(c, 400, 'invalid_food', '배달 메뉴는 가게 이름을 입력해 주세요.')
  await db
    .update(food)
    .set({ ...v, ...(kind === 'delivery' ? { brand: null } : {}), updatedAt: new Date() })
    .where(eq(food.id, f.id))
  return c.json({ id: f.id })
})

foods.delete('/foods/:id', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')
  if (!canEdit(me, f)) return fail(c, 403, 'forbidden', '등록한 사람이나 관리자만 지울 수 있어요.')
  const uploaded = await db
    .select({ location: foodImage.location })
    .from(foodImage)
    .where(and(eq(foodImage.foodId, f.id), eq(foodImage.storage, 'r2')))
  await db.delete(food).where(eq(food.id, f.id))
  if (uploaded.length) await c.env.MEDIA.delete(uploaded.map((u) => u.location))
  return c.body(null, 204)
})

// ── 평가 (내 평가만 쓰고 지울 수 있음) ──
foods.put('/foods/:id/rating', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')
  const attrs = await activeAttributes(db)
  const parsed = validateRatingInput(
    await c.req.json().catch(() => null),
    attrs.map((a) => a.id),
  )
  if (!parsed.ok) return fail(c, 400, 'invalid_rating', parsed.message)
  const { overall, scores, memo } = parsed.value
  const now = new Date()
  const given = Object.entries(scores).filter((e): e is [string, number] => e[1] !== null)
  await db.batch([
    db
      .insert(rating)
      .values({ foodId: f.id, userId: me.id, overall, memo: memo ?? null, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [rating.foodId, rating.userId], set: { overall, memo: memo ?? null, updatedAt: now } }),
    // 덮어쓰기: 기존 맛 점수를 지우고 이번에 매긴 것만 저장
    db.delete(ratingScore).where(and(eq(ratingScore.foodId, f.id), eq(ratingScore.userId, me.id))),
    ...given.map(([attributeId, value]) => db.insert(ratingScore).values({ foodId: f.id, userId: me.id, attributeId, value })),
  ])
  return c.json({ ok: true })
})

foods.delete('/foods/:id/rating', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  await db.batch([
    db.delete(ratingScore).where(and(eq(ratingScore.foodId, c.req.param('id')), eq(ratingScore.userId, me.id))),
    db.delete(rating).where(and(eq(rating.foodId, c.req.param('id')), eq(rating.userId, me.id))),
  ])
  return c.body(null, 204)
})

// ── 사진 (그룹원 누구나 추가, 지우기·순서 변경은 등록자·관리자·사진 올린 사람) ──
foods.post('/foods/:id/images', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')
  if ((await imageCount(db, f.id)) >= MAX_IMAGES) return fail(c, 409, 'too_many_images', `사진은 음식당 ${MAX_IMAGES}장까지예요.`)

  const type = (c.req.header('content-type') ?? '').split(';')[0].trim()
  const now = new Date()
  const id = crypto.randomUUID()

  if (type === 'application/json') {
    // 쇼핑몰 이미지 주소 추가
    const body = await c.req.json<{ url?: unknown }>().catch(() => ({}) as { url?: unknown })
    const url = typeof body.url === 'string' ? body.url : ''
    if (!/^https?:\/\//.test(url) || url.length > 2000) return fail(c, 400, 'invalid_image_url', '사진 주소가 올바르지 않아요.')
    await db.insert(foodImage).values({ id, foodId: f.id, storage: 'external', location: url, position: await nextPosition(db, f.id), createdBy: me.id, createdAt: now })
    return c.json({ id, src: url, storage: 'external' } satisfies FoodImage, 201)
  }

  if (!(UPLOAD_TYPES as readonly string[]).includes(type)) return fail(c, 415, 'unsupported_image', 'JPG·PNG·WebP 사진만 올릴 수 있어요.')
  const declared = Number(c.req.header('content-length') ?? 0)
  if (declared > UPLOAD_MAX_BYTES) return fail(c, 413, 'image_too_large', '사진이 너무 커요. 3MB 이하로 올려 주세요.')
  const body = await c.req.arrayBuffer()
  if (body.byteLength === 0) return fail(c, 400, 'empty_image', '사진 파일이 비어 있어요.')
  if (body.byteLength > UPLOAD_MAX_BYTES) return fail(c, 413, 'image_too_large', '사진이 너무 커요. 3MB 이하로 올려 주세요.')
  const ext = type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp'
  const key = `foods/${f.id}/${id}.${ext}`
  await c.env.MEDIA.put(key, body, { httpMetadata: { contentType: type } })
  await db.insert(foodImage).values({ id, foodId: f.id, storage: 'r2', location: key, position: await nextPosition(db, f.id), createdBy: me.id, createdAt: now })
  return c.json({ id, src: imageSrc({ storage: 'r2', location: key }), storage: 'r2' } satisfies FoodImage, 201)
})

foods.delete('/foods/:id/images/:imageId', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')
  const img = await db.query.foodImage.findFirst({ where: and(eq(foodImage.id, c.req.param('imageId')), eq(foodImage.foodId, f.id)) })
  if (!img) return fail(c, 404, 'image_not_found', '사진을 찾을 수 없어요.')
  if (!canEdit(me, f) && img.createdBy !== me.id) return fail(c, 403, 'forbidden', '사진을 올린 사람이나 관리자만 지울 수 있어요.')
  await db.delete(foodImage).where(eq(foodImage.id, img.id))
  if (img.storage === 'r2') await c.env.MEDIA.delete(img.location)
  const rest = await db.select({ id: foodImage.id }).from(foodImage).where(eq(foodImage.foodId, f.id)).orderBy(asc(foodImage.position))
  await renumber(
    db,
    f.id,
    rest.map((r) => r.id),
  )
  return c.body(null, 204)
})

/** 대표 사진으로 지정 (맨 앞으로) */
foods.post('/foods/:id/images/:imageId/primary', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user')
  const f = await loadFood(db, c.req.param('id'))
  if (!f) return fail(c, 404, 'food_not_found', '음식을 찾을 수 없어요.')
  if (!canEdit(me, f)) return fail(c, 403, 'forbidden', '등록한 사람이나 관리자만 바꿀 수 있어요.')
  const imageId = c.req.param('imageId')
  const all = await db.select({ id: foodImage.id }).from(foodImage).where(eq(foodImage.foodId, f.id)).orderBy(asc(foodImage.position))
  if (!all.some((i) => i.id === imageId)) return fail(c, 404, 'image_not_found', '사진을 찾을 수 없어요.')
  await renumber(db, f.id, [imageId, ...all.map((i) => i.id).filter((id) => id !== imageId)])
  return c.json({ ok: true })
})

/** 같은 이름의 음식이 있는지 (등록 전 중복 안내용) */
foods.get('/foods-similar', async (c) => {
  const q = c.req.query('q')?.trim()
  if (!q || q.length < 2) return c.json([])
  const db = getDb(c.env.DB)
  const words = q.split(/\s+/).filter((w) => w.length >= 2).slice(0, 4)
  if (!words.length) return c.json([])
  const rows = await db
    .select({ id: food.id, name: food.name, brand: food.brand, storeName: food.storeName, kind: food.kind })
    .from(food)
    .where(and(...words.map((w) => like(food.name, `%${w.replace(/[%_]/g, '')}%`))))
    .limit(5)
  return c.json(rows)
})

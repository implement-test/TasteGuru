import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Camera, ExternalLink, Pencil, Star, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/client/components/EmptyState'
import { FoodImg } from '@/client/components/food/FoodImage'
import { IntensityInput } from '@/client/components/food/IntensityInput'
import { KindBadge } from '@/client/components/food/KindBadge'
import { StarInput, Stars } from '@/client/components/food/Stars'
import { Button } from '@/client/components/ui/button'
import { Card, CardTitle } from '@/client/components/ui/card'
import { api, HttpError, queryKeys, uploadImage, useFood } from '@/client/lib/api'
import { cn } from '@/client/lib/cn'
import { shortDate, won } from '@/client/lib/format'
import { compressImage } from '@/client/lib/image'
import { MAX_IMAGES, MEMO_MAX, type AttributeStat, type FoodDetail, type RatingView, type TasteAttribute } from '@/shared/food'

function Gallery({ food }: { food: FoodDetail }) {
  const qc = useQueryClient()
  const [index, setIndex] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const images = food.images
  const current = images[Math.min(index, Math.max(images.length - 1, 0))]
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.food(food.id) })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) await uploadImage(food.id, await compressImage(f))
    },
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (imageId: string) => api<void>(`/api/foods/${food.id}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: () => setIndex(0),
    onSettled: refresh,
  })
  const makePrimary = useMutation({
    mutationFn: (imageId: string) => api(`/api/foods/${food.id}/images/${imageId}/primary`, { method: 'POST' }),
    onSuccess: () => setIndex(0),
    onSettled: refresh,
  })

  return (
    <div className="space-y-2">
      <FoodImg src={current?.src ?? null} alt={current ? `${food.name} 사진 ${index + 1}` : ''} className="aspect-square w-full rounded-2xl border-2 border-line shadow-retro sm:aspect-[4/3]" />
      <div className="flex flex-wrap items-center gap-2">
        {images.length > 1 &&
          images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`사진 ${i + 1} 보기`}
              aria-current={i === index}
              className={cn('size-14 overflow-hidden rounded-lg border-2', i === index ? 'border-line ring-2 ring-focus' : 'border-line/40')}
            >
              <FoodImg src={img.src} className="size-full" />
            </button>
          ))}
        {images.length < MAX_IMAGES && (
          <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
            <Camera size={16} aria-hidden /> {upload.isPending ? '올리는 중…' : '사진 추가'}
          </Button>
        )}
        {food.canEdit && current && index > 0 && (
          <Button size="sm" variant="ghost" onClick={() => makePrimary.mutate(current.id)}>
            대표 사진으로
          </Button>
        )}
        {food.canEdit && current && (
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => confirm('이 사진을 지울까요?') && remove.mutate(current.id)}>
            <Trash2 size={16} aria-hidden /> 사진 지우기
          </Button>
        )}
      </div>
      {(upload.isError || remove.isError) && (
        <p role="alert" className="text-sm text-danger">
          {(upload.error ?? remove.error) instanceof Error ? (upload.error ?? remove.error)!.message : '사진을 처리하지 못했어요.'}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - images.length)
          if (files.length) upload.mutate(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function TasteProfile({ attributes, stats }: { attributes: TasteAttribute[]; stats: AttributeStat[] }) {
  return (
    <ul className="space-y-2.5">
      {attributes.map((a) => {
        const s = stats.find((x) => x.attributeId === a.id)
        const avg = s?.avg ?? null
        return (
          <li key={a.id} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2">
            <span className="flex items-center gap-1.5 font-medium">
              <span aria-hidden>{a.emoji}</span>
              {a.name}
            </span>
            <span className="h-4 overflow-hidden rounded-full border-2 border-line bg-surface-2" aria-hidden>
              <span className="block h-full bg-primary" style={{ width: `${((avg ?? 0) / 5) * 100}%` }} />
            </span>
            <span className="text-right text-sm">
              {avg == null ? (
                <span className="text-muted">–</span>
              ) : (
                <>
                  <span className="font-semibold">{avg}</span> <span className="text-muted">({s?.count}명)</span>
                </>
              )}
              <span className="sr-only">{avg == null ? `${a.name} 평가 없음` : `${a.name} 강도 5 중 ${avg}, ${s?.count}명 평가`}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function RatingForm({ food, attributes, onDone }: { food: FoodDetail; attributes: TasteAttribute[]; onDone: () => void }) {
  const qc = useQueryClient()
  const mine = food.myRating
  const [overall, setOverall] = useState<number | null>(mine?.overall ?? null)
  const [scores, setScores] = useState<Record<string, number | null>>(() => Object.fromEntries(attributes.map((a) => [a.id, mine?.scores[a.id] ?? null])))
  const [memo, setMemo] = useState(mine?.memo ?? '')
  const save = useMutation({
    mutationFn: () => api(`/api/foods/${food.id}/rating`, { method: 'PUT', body: JSON.stringify({ overall, scores, memo }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.food(food.id) })
      qc.invalidateQueries({ queryKey: queryKeys.foods })
      onDone()
    },
  })
  const remove = useMutation({
    mutationFn: () => api<void>(`/api/foods/${food.id}/rating`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.food(food.id) })
      qc.invalidateQueries({ queryKey: queryKeys.foods })
      onDone()
    },
  })
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (overall) save.mutate()
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <StarInput value={overall} onChange={setOverall} />
      <div className="space-y-4">
        <p className="font-semibold">
          맛 강도 <span className="font-normal text-muted">(아는 항목만 골라도 돼요)</span>
        </p>
        {attributes.map((a) => (
          <IntensityInput key={a.id} attribute={a} value={scores[a.id] ?? null} onChange={(v) => setScores((s) => ({ ...s, [a.id]: v }))} />
        ))}
      </div>
      <div className="space-y-1">
        <label htmlFor="memo" className="block font-semibold">
          메모 <span className="font-normal text-muted">(그룹원 모두에게 보여요)</span>
        </label>
        <textarea
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={MEMO_MAX}
          rows={3}
          placeholder="예: 에어프라이어 180도 12분이 딱 좋음"
          className="w-full rounded-xl border-2 border-line bg-surface p-3 text-ink placeholder:text-muted"
        />
        <p className="text-right text-xs text-muted">
          {memo.length}/{MEMO_MAX}
        </p>
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {save.error instanceof HttpError ? save.error.message : '저장하지 못했어요.'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!overall || save.isPending}>
          {save.isPending ? '저장하는 중…' : mine ? '평가 수정' : '평가 저장'}
        </Button>
        {mine && (
          <>
            <Button variant="secondary" onClick={onDone}>
              취소
            </Button>
            <Button variant="ghost" className="ml-auto text-danger" onClick={() => confirm('내 평가를 지울까요?') && remove.mutate()}>
              평가 지우기
            </Button>
          </>
        )}
      </div>
      {!overall && <p className="text-sm text-muted">종합 점수를 고르면 저장할 수 있어요.</p>}
    </form>
  )
}

function RatingItem({ r, attributes, isMine }: { r: RatingView; attributes: TasteAttribute[]; isMine?: boolean }) {
  const given = attributes.filter((a) => r.scores[a.id] != null)
  return (
    <li className="flex gap-3 py-4">
      {r.image ? (
        <img src={r.image} alt="" width={40} height={40} className="size-10 rounded-full border-2 border-line" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-mint" aria-hidden>
          🙂
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-semibold">
            {r.nickname}
            {isMine && ' (나)'}
          </span>
          <Stars value={r.overall} size={14} />
          <span className="text-xs text-muted">{shortDate(r.updatedAt)}</span>
        </p>
        {given.length > 0 && (
          <p className="flex flex-wrap gap-1.5 text-sm">
            {given.map((a) => (
              <span key={a.id} className="rounded-full bg-surface-2 px-2 py-0.5">
                <span aria-hidden>{a.emoji}</span> {a.name} {r.scores[a.id]}
              </span>
            ))}
          </p>
        )}
        {r.memo && <p className="whitespace-pre-wrap break-words">{r.memo}</p>}
      </div>
    </li>
  )
}

export function FoodDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const { data, isPending, error } = useFood(id)
  const [editing, setEditing] = useState(params.get('rate') === '1')
  const ratingRef = useRef<HTMLDivElement>(null)
  const uploadFailed = (location.state as { uploadFailed?: number } | null)?.uploadFailed ?? 0

  useEffect(() => {
    if (params.get('rate') === '1' && data) {
      ratingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      params.delete('rate')
      setParams(params, { replace: true })
    }
  }, [data, params, setParams])

  const remove = useMutation({
    mutationFn: () => api<void>(`/api/foods/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.foods })
      qc.removeQueries({ queryKey: queryKeys.food(id) })
      navigate('/', { replace: true })
    },
  })

  if (isPending) return <p role="status">불러오는 중…</p>
  if (error || !data) {
    return (
      <EmptyState emoji="🍽️" title={error instanceof HttpError && error.status === 404 ? '음식을 찾을 수 없어요' : '불러오지 못했어요'}>
        <Link to="/">목록으로</Link>
      </EmptyState>
    )
  }

  const { food, attributes } = data
  const others = food.ratings.filter((r) => r.userId !== food.myRating?.userId)
  const showForm = editing || !food.myRating

  return (
    <article className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm">
        <ArrowLeft size={16} aria-hidden /> 목록
      </Link>

      {uploadFailed > 0 && (
        <p role="alert" className="rounded-xl border-2 border-line bg-peach p-3 text-sm">
          사진 {uploadFailed}장을 올리지 못했어요. 아래 ‘사진 추가’로 다시 올려 주세요.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Gallery food={food} />
        <div className="space-y-3">
          <KindBadge kind={food.kind} />
          <h1 className="text-2xl leading-tight">{food.name}</h1>
          {(food.brand || food.storeName) && <p className="text-lg text-muted">{food.brand ?? food.storeName}</p>}
          <dl className="space-y-1 text-sm">
            {food.price != null && (
              <div className="flex gap-2">
                <dt className="text-muted">가격</dt>
                <dd>{won(food.price)}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted">등록</dt>
              <dd>
                {food.createdBy?.nickname ?? '알 수 없음'} · {shortDate(food.createdAt)}
              </dd>
            </div>
          </dl>
          {food.sourceUrl && (
            <a href={food.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              {food.kind === 'delivery' ? '가게 페이지 열기' : '구매 페이지 열기'} <ExternalLink size={14} aria-hidden />
            </a>
          )}
          {food.canEdit && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/foods/${food.id}/edit`}>
                  <Pencil size={16} aria-hidden /> 정보 수정
                </Link>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={remove.isPending}
                onClick={() => confirm(`‘${food.name}’을(를) 지울까요? 모든 평가와 사진도 함께 지워져요.`) && remove.mutate()}
              >
                <Trash2 size={16} aria-hidden /> 삭제
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardTitle>그룹 평가</CardTitle>
        <div className="mb-5 flex items-center gap-3">
          <span className="font-pixel text-4xl font-bold">{food.avgOverall ?? '–'}</span>
          <div>
            <Stars value={food.avgOverall} size={20} />
            <p className="text-sm text-muted">{food.ratingCount ? `${food.ratingCount}명 평가` : '아직 평가가 없어요'}</p>
          </div>
        </div>
        <h3 className="mb-3 text-base">맛 프로필 (평균 강도)</h3>
        <TasteProfile attributes={attributes} stats={food.attributeStats} />
      </Card>

      <div ref={ratingRef} className="scroll-mt-20">
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Star size={20} aria-hidden /> 내 평가
          </CardTitle>
          {showForm ? (
            <RatingForm key={food.myRating?.updatedAt ?? 'new'} food={food} attributes={attributes} onDone={() => setEditing(false)} />
          ) : (
            <>
              <ul>
                <RatingItem r={food.myRating!} attributes={attributes} isMine />
              </ul>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                평가 수정
              </Button>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>그룹원 평가 {others.length ? `(${others.length})` : ''}</CardTitle>
        {others.length ? (
          <ul className="divide-y-2 divide-surface-2">
            {others.map((r) => (
              <RatingItem key={r.userId} r={r} attributes={attributes} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">아직 다른 사람의 평가가 없어요.</p>
        )}
      </Card>
    </article>
  )
}

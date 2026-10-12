import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Link2, PencilLine, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { emptyFields, FoodFields, toFoodBody, type FoodFieldValues } from '@/client/components/food/FoodFields'
import { FoodImg } from '@/client/components/food/FoodImage'
import { Button } from '@/client/components/ui/button'
import { Card } from '@/client/components/ui/card'
import { Input } from '@/client/components/ui/input'
import { Segmented } from '@/client/components/ui/segmented'
import { api, HttpError, queryKeys, uploadImage, useConfig } from '@/client/lib/api'
import { cn } from '@/client/lib/cn'
import { compressImage } from '@/client/lib/image'
import { FOOD_KIND_LABEL, MAX_IMAGES, validateFoodInput, type FoodKind, type ImportedProduct } from '@/shared/food'

type Mode = 'url' | 'manual' | 'search'

interface Photo {
  key: string
  /** 쇼핑몰 이미지 주소 또는 미리보기용 object URL */
  src: string
  file?: File
}

const KIND_OPTIONS = (Object.keys(FOOD_KIND_LABEL) as FoodKind[]).map((value) => ({ value, label: FOOD_KIND_LABEL[value] }))

function useSimilarFoods(name: string) {
  const [debounced, setDebounced] = useState(name)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(name.trim()), 400)
    return () => clearTimeout(t)
  }, [name])
  return useQuery({
    queryKey: ['foods-similar', debounced],
    queryFn: () => api<{ id: string; name: string; brand: string | null; storeName: string | null }[]>(`/api/foods-similar?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 2,
  })
}

function ModeTabs({ mode, onChange, kind, searchEnabled }: { mode: Mode; onChange: (m: Mode) => void; kind: FoodKind; searchEnabled: boolean }) {
  const tabs: { id: Mode; label: string; icon: typeof Link2; disabled?: boolean; note?: string }[] = [
    { id: 'url', label: '링크 붙여넣기', icon: Link2, disabled: kind === 'delivery', note: kind === 'delivery' ? '배달 메뉴는 직접 입력해 주세요' : undefined },
    { id: 'manual', label: '직접 입력', icon: PencilLine },
    { id: 'search', label: '상품 검색', icon: Search, disabled: !searchEnabled, note: searchEnabled ? undefined : '준비 중' },
  ]
  return (
    <div role="tablist" aria-label="입력 방법" className="grid grid-cols-3 gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={mode === t.id}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-line px-2 text-sm font-semibold disabled:opacity-50',
            mode === t.id ? 'bg-primary shadow-retro-sm' : 'bg-surface',
          )}
        >
          <t.icon size={20} aria-hidden />
          {t.label}
          {t.note && <span className="text-[0.7rem] font-normal text-muted">{t.note}</span>}
        </button>
      ))}
    </div>
  )
}

export function FoodNewPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: config } = useConfig()
  const [kind, setKind] = useState<FoodKind>('product')
  const [mode, setMode] = useState<Mode>('url')
  const [link, setLink] = useState('')
  const [imported, setImported] = useState<ImportedProduct | null>(null)
  const [fields, setFields] = useState<FoodFieldValues>(emptyFields)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const similar = useSimilarFoods(fields.name)

  // 화면을 떠날 때 미리보기용 object URL 해제
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(() => () => photosRef.current.forEach((p) => p.file && URL.revokeObjectURL(p.src)), [])

  const changeKind = (k: FoodKind) => {
    setKind(k)
    if (k === 'delivery' && mode === 'url') setMode('manual')
  }

  const importUrl = useMutation({
    mutationFn: (url: string) => api<ImportedProduct>('/api/import/url', { method: 'POST', body: JSON.stringify({ url }) }),
    onSuccess: (p) => {
      setImported(p)
      setFields({ name: p.name ?? '', brand: p.brand ?? '', storeName: '', price: p.price ? String(p.price) : '', sourceUrl: p.url })
      setPhotos((prev) => (p.image && !prev.some((x) => x.src === p.image) ? [{ key: p.image, src: p.image }, ...prev].slice(0, MAX_IMAGES) : prev))
    },
  })

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const room = MAX_IMAGES - photos.length
    const picked = Array.from(files).slice(0, room)
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ key: crypto.randomUUID(), src: URL.createObjectURL(file), file }))])
    if (files.length > room) setFormError(`사진은 ${MAX_IMAGES}장까지 넣을 수 있어요.`)
  }

  const removePhoto = (key: string) =>
    setPhotos((prev) => {
      const p = prev.find((x) => x.key === key)
      if (p?.file) URL.revokeObjectURL(p.src)
      return prev.filter((x) => x.key !== key)
    })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...toFoodBody(kind, fields),
        source: imported ? 'url' : 'manual',
        externalImages: photos.filter((p) => !p.file).map((p) => p.src),
      }
      const check = validateFoodInput(body)
      if (!check.ok) throw new Error(check.message)
      const { id } = await api<{ id: string }>('/api/foods', { method: 'POST', body: JSON.stringify(body) })
      let failed = 0
      for (const p of photos.filter((x) => x.file)) {
        try {
          await uploadImage(id, await compressImage(p.file!))
        } catch {
          failed++
        }
      }
      return { id, failed }
    },
    onSuccess: ({ id, failed }) => {
      qc.invalidateQueries({ queryKey: queryKeys.foods })
      navigate(`/foods/${id}?rate=1`, { state: { uploadFailed: failed } })
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : '저장하지 못했어요.'),
  })

  const onImport = (e: FormEvent) => {
    e.preventDefault()
    if (link.trim()) importUrl.mutate(link.trim())
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    save.mutate()
  }

  const showForm = mode === 'manual' || (mode === 'url' && (imported || importUrl.isError))

  return (
    <>
      <h1 className="mb-6 text-2xl">음식 추가</h1>
      <div className="space-y-5">
        <Card className="space-y-5">
          <Segmented legend="어떤 음식인가요?" value={kind} options={KIND_OPTIONS} onChange={changeKind} />
          <ModeTabs mode={mode} onChange={setMode} kind={kind} searchEnabled={!!config?.productSearch.enabled} />

          {mode === 'url' && (
            <form onSubmit={onImport} className="space-y-2">
              <label htmlFor="import-url" className="block font-semibold">
                상품 링크
              </label>
              <div className="flex gap-2">
                <Input
                  id="import-url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="쇼핑몰 상품 페이지 주소를 붙여넣어 주세요"
                  inputMode="url"
                  aria-describedby="import-help"
                />
                <Button type="submit" disabled={!link.trim() || importUrl.isPending}>
                  {importUrl.isPending ? '가져오는 중…' : '가져오기'}
                </Button>
              </div>
              <p id="import-help" className="text-sm text-muted" aria-live="polite">
                {importUrl.isError ? (
                  <span className="text-danger">{importUrl.error instanceof HttpError ? importUrl.error.message : '가져오지 못했어요. 직접 입력해 주세요.'}</span>
                ) : imported ? (
                  `${imported.siteName ?? '쇼핑몰'}에서 가져왔어요. 내용을 확인하고 고쳐 주세요.`
                ) : (
                  '컬리·11번가 등에서 이름·사진·가격을 자동으로 채워요. 쿠팡·네이버 스마트스토어는 직접 입력해 주세요.'
                )}
              </p>
            </form>
          )}

          {mode === 'search' && <p className="text-muted">상품 검색은 준비 중이에요.</p>}
        </Card>

        {showForm && (
          <form onSubmit={onSave} noValidate>
            <Card className="space-y-5">
              <FoodFields kind={kind} values={fields} onChange={setFields} />

              {!!similar.data?.length && (
                <div className="rounded-xl border-2 border-line bg-butter p-3 text-sm" role="note">
                  <p className="mb-1 font-semibold">이미 등록된 음식일 수 있어요</p>
                  <ul className="list-disc pl-5">
                    {similar.data.map((s) => (
                      <li key={s.id}>
                        <Link to={`/foods/${s.id}`}>
                          {s.name}
                          {s.brand || s.storeName ? ` · ${s.brand ?? s.storeName}` : ''}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <fieldset>
                <legend className="mb-2 font-semibold">
                  사진 <span className="font-normal text-muted">({photos.length}/{MAX_IMAGES}, 첫 번째가 대표)</span>
                </legend>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {photos.map((p, i) => (
                    <li key={p.key} className="relative">
                      <FoodImg src={p.src} alt={`사진 ${i + 1}`} className="aspect-square w-full rounded-xl border-2 border-line" />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.key)}
                        className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full border-2 border-line bg-surface"
                        aria-label={`사진 ${i + 1} 빼기`}
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </li>
                  ))}
                  {photos.length < MAX_IMAGES && (
                    <li>
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface-2 text-sm"
                      >
                        <Camera size={24} aria-hidden />
                        사진 추가
                      </button>
                    </li>
                  )}
                </ul>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </fieldset>

              {formError && (
                <p role="alert" className="rounded-xl border-2 border-line bg-peach p-3 text-sm">
                  {formError}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
                {save.isPending ? '저장하는 중…' : '저장하고 평가하기'}
              </Button>
            </Card>
          </form>
        )}
      </div>
    </>
  )
}

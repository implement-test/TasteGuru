// 업로드 전에 사진을 줄이고 WebP로 바꾼다 (장당 약 300KB 목표).
const MAX_SIDE = 1280

export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요.')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('이 사진 형식은 열 수 없어요. JPG나 PNG로 올려 주세요.')
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
  // WebP를 지원하지 않는 브라우저는 JPEG로
  if (blob && blob.type === 'image/webp') return blob
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!jpeg) throw new Error('사진을 처리하지 못했어요.')
  return jpeg
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <span className="animate-bounce text-4xl" aria-hidden>
        🍙
      </span>
      <span className="sr-only">불러오는 중</span>
    </div>
  )
}

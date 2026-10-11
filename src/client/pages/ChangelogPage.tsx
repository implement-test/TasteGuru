import changelogMd from '../../../CHANGELOG.md?raw'
import { Badge } from '@/client/components/ui/badge'
import { Card } from '@/client/components/ui/card'
import { parseChangelog, type ChangeKind } from '@/shared/changelog'

const releases = parseChangelog(changelogMd)

const TONE: Record<ChangeKind, 'mint' | 'lavender' | 'peach' | 'plain'> = {
  feature: 'mint',
  improvement: 'lavender',
  fix: 'peach',
  other: 'plain',
}

export function ChangelogPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl">업데이트 내역</h1>
      <p className="mb-6 text-muted">현재 버전 v{__APP_VERSION__}</p>
      <ol className="space-y-6">
        {releases.map((r) => (
          <li key={r.version}>
            <Card>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-xl">v{r.version}</h2>
                {r.date && (
                  <time dateTime={r.date} className="text-sm text-muted">
                    {new Date(r.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </time>
                )}
              </div>
              <div className="space-y-4">
                {r.sections.map((s) => (
                  <section key={s.title}>
                    <Badge tone={TONE[s.kind]} className="mb-2">
                      {s.title}
                    </Badge>
                    <ul className="list-disc space-y-1 pl-5">
                      {s.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </>
  )
}

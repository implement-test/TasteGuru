// CHANGELOG.md(Keep a Changelog 형식)를 화면용 데이터로 바꾼다.
export type ChangeKind = 'feature' | 'improvement' | 'fix' | 'other'

export interface ChangelogSection {
  title: string
  kind: ChangeKind
  items: string[]
}

export interface ChangelogRelease {
  version: string
  date: string | null
  sections: ChangelogSection[]
}

const KIND_BY_TITLE: Record<string, ChangeKind> = {
  '새 기능': 'feature',
  개선: 'improvement',
  수정: 'fix',
}

export function parseChangelog(md: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = []
  let release: ChangelogRelease | null = null
  let section: ChangelogSection | null = null

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd()
    const rel = line.match(/^##\s+\[?([^\]\s]+)\]?(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/)
    if (rel) {
      release = { version: rel[1], date: rel[2] ?? null, sections: [] }
      releases.push(release)
      section = null
      continue
    }
    const sec = line.match(/^###\s+(.+)/)
    if (sec && release) {
      const title = sec[1].trim()
      section = { title, kind: KIND_BY_TITLE[title] ?? 'other', items: [] }
      release.sections.push(section)
      continue
    }
    const item = line.match(/^\s*[-*]\s+(.+)/)
    if (item && release) {
      if (!section) {
        section = { title: '변경 사항', kind: 'other', items: [] }
        release.sections.push(section)
      }
      section.items.push(item[1].trim())
    }
  }
  return releases
}

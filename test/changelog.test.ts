import { describe, expect, it } from 'vitest'
import { parseChangelog } from '../src/shared/changelog'

describe('parseChangelog', () => {
  it('버전·날짜·섹션·항목을 읽는다', () => {
    const md = `# 업데이트 내역

## [0.2.0] - 2026-10-20

### 새 기능

- 음식 등록
- 평가하기

### 수정

- 로그인 오류

## [0.1.0] - 2026-10-11

- 첫 배포
`
    expect(parseChangelog(md)).toEqual([
      {
        version: '0.2.0',
        date: '2026-10-20',
        sections: [
          { title: '새 기능', kind: 'feature', items: ['음식 등록', '평가하기'] },
          { title: '수정', kind: 'fix', items: ['로그인 오류'] },
        ],
      },
      { version: '0.1.0', date: '2026-10-11', sections: [{ title: '변경 사항', kind: 'other', items: ['첫 배포'] }] },
    ])
  })
})

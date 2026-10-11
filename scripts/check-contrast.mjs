// 디자인 토큰 대비 검사 (WCAG AA: 글자 4.5:1, 테두리·포커스 3:1)
// src/client/styles.css의 :root(라이트)와 다크 토큰을 읽어 검사한다.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8')
const block = (marker) => {
  const i = css.indexOf(marker)
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}
const themes = { light: block('/* tokens:light */'), dark: block('/* tokens:dark */') }

// 시스템 다크 모드 블록이 수동 다크 블록과 같은지 확인 (두 곳을 함께 고쳐야 함)
const systemDark = block('@media (prefers-color-scheme: dark)')
const mismatch = Object.keys(themes.dark).filter((k) => systemDark[k] !== themes.dark[k])
if (mismatch.length) {
  console.error(`✗ 시스템 다크 모드 토큰이 data-theme=dark와 다름: ${mismatch.join(', ')}`)
  process.exit(1)
}

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const fills = ['bg', 'surface', 'surface-2', 'peach', 'mint', 'lavender', 'butter', 'pink', 'primary']
const checks = [
  ...fills.map((f) => ['ink', f, 4.5]),
  ...['bg', 'surface', 'surface-2'].map((f) => ['muted', f, 4.5]),
  ...['bg', 'surface'].map((f) => ['accent', f, 4.5]),
  ...['bg', 'surface'].map((f) => ['danger', f, 4.5]),
  ['line', 'bg', 3],
  ['line', 'surface', 3],
  ['focus', 'bg', 3],
  ['focus', 'surface', 3],
]

let failed = 0
for (const [name, t] of Object.entries(themes)) {
  for (const [fg, bg, min] of checks) {
    if (!t[fg] || !t[bg]) {
      console.log(`✗ ${name}: --${fg} 또는 --${bg} 없음`)
      failed++
      continue
    }
    const r = ratio(t[fg], t[bg])
    const ok = r >= min
    if (!ok) failed++
    console.log(`${ok ? '✓' : '✗'} ${name.padEnd(5)} ${fg.padEnd(7)} on ${bg.padEnd(9)} ${r.toFixed(2)} (≥${min})`)
  }
}
if (failed) {
  console.error(`\n${failed}개 실패`)
  process.exit(1)
}
console.log('\n모든 대비 검사 통과')

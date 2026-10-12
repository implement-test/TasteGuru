export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
export const shortDate = (ms: number) => new Date(ms).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

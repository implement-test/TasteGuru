import { Columns3, Home, PlusCircle, Settings, Shield, Star, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useMe } from '@/client/lib/api'
import { cn } from '@/client/lib/cn'
import { Logo } from './Logo'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/foods/new', label: '음식 추가', icon: PlusCircle },
  { to: '/compare', label: '묶음 비교', icon: Columns3 },
  { to: '/my-ratings', label: '내 평가', icon: Star },
  { to: '/settings', label: '설정', icon: Settings },
]

export function AppShell() {
  const { data: me } = useMe()
  const items = me?.role === 'admin' ? [...NAV.slice(0, 4), { to: '/admin', label: '관리', icon: Shield }, NAV[4]] : NAV

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-2">
        본문으로 건너뛰기
      </a>

      {/* PC·태블릿: 왼쪽 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r-2 border-line bg-surface-2 p-4 md:flex">
        <NavLink to="/" className="mb-6 no-underline" aria-label="TasteGuru 홈">
          <Logo />
        </NavLink>
        <nav aria-label="주 메뉴" className="flex flex-col gap-1.5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-3 rounded-xl border-2 px-3 font-medium text-ink no-underline',
                  isActive ? 'border-line bg-primary shadow-retro-sm' : 'border-transparent hover:bg-surface',
                )
              }
            >
              <item.icon size={20} aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/changelog" className="mt-auto text-sm text-muted">
          v{__APP_VERSION__} · 업데이트 내역
        </NavLink>
      </aside>

      {/* 모바일: 상단 바 */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-line bg-surface-2/95 px-4 py-3 backdrop-blur md:hidden">
        <NavLink to="/" className="no-underline" aria-label="TasteGuru 홈">
          <Logo className="text-lg" />
        </NavLink>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10">
        <Outlet />
      </main>

      {/* 모바일: 하단 탭바 */}
      <nav
        aria-label="주 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 grid border-t-2 border-line bg-surface-2/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium text-ink no-underline',
                isActive && 'font-bold',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-full border-2 px-3 py-0.5', isActive ? 'border-line bg-primary' : 'border-transparent')}>
                  <item.icon size={20} aria-hidden />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '@/client/lib/api'
import { FullPageSpinner } from './Spinner'

export function RequireAuth() {
  const { data: me, isPending, isError } = useMe()
  const location = useLocation()
  if (isPending) return <FullPageSpinner />
  if (isError) return <p className="p-6 text-danger">정보를 불러오지 못했어요. 새로고침해 주세요.</p>
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireAdmin() {
  const { data: me } = useMe()
  if (me?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

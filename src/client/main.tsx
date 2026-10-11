import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppShell } from './components/AppShell'
import { RequireAdmin, RequireAuth } from './components/RequireAuth'
import { AdminPage } from './pages/AdminPage'
import { ChangelogPage } from './pages/ChangelogPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { HomePage } from './pages/HomePage'
import { InvitePage } from './pages/InvitePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/invite/:token', element: <InvitePage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'foods/new', element: <ComingSoonPage title="음식 추가" emoji="🍳" phase="2단계(음식·평가)" /> },
          { path: 'compare', element: <ComingSoonPage title="묶음 비교" emoji="⚖️" phase="4단계(묶음 비교)" /> },
          { path: 'my-ratings', element: <ComingSoonPage title="내 평가" emoji="⭐" phase="3단계(태그·목록)" /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'changelog', element: <ChangelogPage /> },
          { element: <RequireAdmin />, children: [{ path: 'admin', element: <AdminPage /> }] },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

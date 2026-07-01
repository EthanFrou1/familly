import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext'
import { MembersProvider } from './store/MembersContext'
import { UiChromeProvider, useUiChrome } from './store/UiChromeContext'
import { useAuth } from './hooks/useAuth'
import BottomNav from './components/layout/BottomNav'
import OnboardingModal from './components/shared/OnboardingModal'
import Home from './pages/Home'
import Tree from './pages/Tree'
import Map from './pages/Map'
import Photos from './pages/Photos'
import Profile from './pages/Profile'
import Families from './pages/Families'
import Members from './pages/Members'
import Admin from './pages/Admin'
import Duplicates from './pages/Duplicates'
import Timeline from './pages/Timeline'
import GamesLobby from './pages/GamesLobby'
import MemoryGame from './pages/MemoryGame'
import MemoryGameRemote from './pages/MemoryGameRemote'
import Leaderboard from './pages/Leaderboard'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Privacy from './pages/Privacy'
import Legal from './pages/Legal'

function ProtectedLayout() {
  const { user, loading } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (user && localStorage.getItem(`onboarding_${user.id}`) === '1') {
      setShowOnboarding(true)
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <MembersProvider>
      <UiChromeProvider>
        <ProtectedLayoutContent />
      </UiChromeProvider>
      {showOnboarding && (
        <OnboardingModal
          user={user}
          onDone={() => {
            localStorage.removeItem(`onboarding_${user.id}`)
            setShowOnboarding(false)
          }}
        />
      )}
    </MembersProvider>
  )
}

function ProtectedLayoutContent() {
  const { hideChrome } = useUiChrome()

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tree" element={<Tree />} />
          <Route path="/map" element={<Map />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:id" element={<Profile />} />
          <Route path="/families" element={<Families />} />
          <Route path="/members" element={<Members />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/games" element={<GamesLobby />} />
          <Route path="/games/memory" element={<MemoryGame />} />
          <Route path="/games/memory/remote" element={<MemoryGameRemote />} />
          <Route path="/games/leaderboard" element={<Leaderboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/duplicates" element={<Duplicates />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hideChrome && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<Login />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

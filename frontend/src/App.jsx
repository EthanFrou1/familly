import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext'
import { MembersProvider } from './store/MembersContext'
import { UiChromeProvider, useUiChrome } from './store/UiChromeContext'
import { useAuth } from './hooks/useAuth'
import BottomNav from './components/layout/BottomNav'
import OnboardingModal from './components/shared/OnboardingModal'
import Home from './pages/Home'
import Login from './pages/Login'

// Chargées à la demande : ce ne sont pas les toutes premières pages vues après connexion,
// autant laisser le navigateur les récupérer au moment de la navigation plutôt que de
// tout regrouper dans un seul (gros) bundle initial.
const Tree = lazy(() => import('./pages/Tree'))
const Map = lazy(() => import('./pages/Map'))
const Photos = lazy(() => import('./pages/Photos'))
const Profile = lazy(() => import('./pages/Profile'))
const Families = lazy(() => import('./pages/Families'))
const Members = lazy(() => import('./pages/Members'))
const Admin = lazy(() => import('./pages/Admin'))
const Duplicates = lazy(() => import('./pages/Duplicates'))
const Timeline = lazy(() => import('./pages/Timeline'))
const GamesLobby = lazy(() => import('./pages/GamesLobby'))
const MemoryGame = lazy(() => import('./pages/MemoryGame'))
const MemoryGameRemote = lazy(() => import('./pages/MemoryGameRemote'))
const WhoIsItGame = lazy(() => import('./pages/WhoIsItGame'))
const WhoIsItGameRemote = lazy(() => import('./pages/WhoIsItGameRemote'))
const RelationshipGame = lazy(() => import('./pages/RelationshipGame'))
const RelationshipGameRemote = lazy(() => import('./pages/RelationshipGameRemote'))
const SuperlativeGameRemote = lazy(() => import('./pages/SuperlativeGameRemote'))
const WhoAmIGameRemote = lazy(() => import('./pages/WhoAmIGameRemote'))
const DailyMysteryGame = lazy(() => import('./pages/DailyMysteryGame'))
const FamilleEnOrSurvey = lazy(() => import('./pages/FamilleEnOrSurvey'))
const FamilleEnOrAdmin = lazy(() => import('./pages/FamilleEnOrAdmin'))
const FamilleEnOrGameRemote = lazy(() => import('./pages/FamilleEnOrGameRemote'))
const UndercoverGame = lazy(() => import('./pages/UndercoverGame'))
const UndercoverGameRemote = lazy(() => import('./pages/UndercoverGameRemote'))
const ForeheadGame = lazy(() => import('./pages/ForeheadGame'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const NotFound = lazy(() => import('./pages/NotFound'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Legal = lazy(() => import('./pages/Legal'))

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-white">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

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
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function handleMessage(event) {
      if (event.data?.type === 'navigate' && event.data.url) navigate(event.data.url)
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [navigate])

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
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
            <Route path="/games/quiwho" element={<WhoIsItGame />} />
            <Route path="/games/quiwho/remote" element={<WhoIsItGameRemote />} />
            <Route path="/games/relationship" element={<RelationshipGame />} />
            <Route path="/games/relationship/remote" element={<RelationshipGameRemote />} />
            <Route path="/games/superlative/remote" element={<SuperlativeGameRemote />} />
            <Route path="/games/whoami/remote" element={<WhoAmIGameRemote />} />
            <Route path="/games/daily-mystery" element={<DailyMysteryGame />} />
            <Route path="/games/famillenor/survey" element={<FamilleEnOrSurvey />} />
            <Route path="/games/famillenor/remote" element={<FamilleEnOrGameRemote />} />
            <Route path="/games/undercover" element={<UndercoverGame />} />
            <Route path="/games/undercover/remote" element={<UndercoverGameRemote />} />
            <Route path="/games/surlefront" element={<ForeheadGame />} />
            <Route path="/games/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/duplicates" element={<Duplicates />} />
            <Route path="/admin/famillenor" element={<FamilleEnOrAdmin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!hideChrome && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:token" element={<Login />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}

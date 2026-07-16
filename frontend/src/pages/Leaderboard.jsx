import { useNavigate } from 'react-router-dom'
import GameHeader from '../components/games/GameHeader'
import LeaderboardView from '../components/games/LeaderboardView'

export default function Leaderboard() {
  const navigate = useNavigate()

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <GameHeader title="Classements" onBack={() => navigate('/games')} />
      <p className="px-4 mt-2 text-xs font-semibold text-gray-400">
        Qui est le/la champion(ne) de la famille ? Classement global sur tous les jeux, ou filtre par jeu.
      </p>
      <div className="px-4 mt-5">
        <LeaderboardView />
      </div>
    </div>
  )
}

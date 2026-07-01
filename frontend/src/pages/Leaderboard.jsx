import { useNavigate } from 'react-router-dom'
import GameHeader from '../components/games/GameHeader'
import LeaderboardView from '../components/games/LeaderboardView'

export default function Leaderboard() {
  const navigate = useNavigate()

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <GameHeader title="Classements" onBack={() => navigate('/games')} />
      <div className="px-4 mt-5">
        <LeaderboardView />
      </div>
    </div>
  )
}

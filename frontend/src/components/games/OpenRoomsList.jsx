import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectHub, gameHub, onHubEvent } from '../../services/gameHub'
import Avatar from '../shared/Avatar'

export default function OpenRoomsList() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    connectHub()
      .then(() => gameHub.getOpenRooms())
      .then(list => { if (!cancelled) setRooms(list) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    const off = onHubEvent('RoomsChanged', setRooms)
    return () => { cancelled = true; off() }
  }, [])

  function handleJoin(code) {
    navigate('/games/memory/remote', { state: { autoJoinCode: code } })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-8 text-center">
        <p className="text-gray-400 text-sm">Aucune partie ouverte pour l'instant.</p>
        <p className="text-gray-400 text-xs mt-1">Crée-en une depuis l'onglet Jeux !</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rooms.map(room => {
        const full = room.playerCount >= room.maxPlayers
        return (
          <div key={room.code} className="rounded-2xl bg-white shadow-sm p-4 flex items-center gap-3">
            <div className="flex -space-x-2 shrink-0">
              {room.players.slice(0, 3).map((p, i) => (
                <Avatar key={i} src={p.profilePictureUrl} name={p.name} size="sm" className="ring-2 ring-white" />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {room.players[0]?.name}{room.players.length > 1 ? ` + ${room.players.length - 1}` : ''}
              </p>
              <p className="text-xs text-gray-400">{room.playerCount}/{room.maxPlayers} joueurs · Memory</p>
            </div>
            <button
              onClick={() => handleJoin(room.code)}
              disabled={full}
              className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white active:bg-primary-dark disabled:opacity-40"
            >
              {full ? 'Complet' : 'Rejoindre'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

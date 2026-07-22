import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../store/MembersContext'
import { matchesSearch, normalize } from '../utils/normalize'
import { gamesApi } from '../services/api'
import { PLAYER_COLORS } from '../utils/memoryGame'
import {
  assignRoles, buildSpeakingOrder, checkWinner, maxUndercoverCount, MIN_PLAYERS,
  ROLE_CIVILIAN, ROLE_UNDERCOVER, ROLE_MRWHITE,
} from '../utils/undercoverGame'
import GameModeScreen from '../components/games/GameModeScreen'
import GameHeader from '../components/games/GameHeader'
import Avatar from '../components/shared/Avatar'

const ROLE_LABELS = { [ROLE_CIVILIAN]: 'Civil', [ROLE_UNDERCOVER]: 'Undercover', [ROLE_MRWHITE]: 'Mr. White' }
const MAX_PLAYERS = 10

export default function UndercoverGame() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { members } = useMembers()

  const [step, setStep] = useState('mode')
  const [slots, setSlots] = useState(() => [
    { mode: 'member', search: `${user.firstName} ${user.lastName}`, memberId: user.memberId },
    { mode: 'guest', search: '', memberId: null },
    { mode: 'guest', search: '', memberId: null },
    { mode: 'guest', search: '', memberId: null },
  ])
  const [undercoverCount, setUndercoverCount] = useState(1)
  const [mrWhiteCount, setMrWhiteCount] = useState(0)

  const [players, setPlayers] = useState([])
  const [revealIndex, setRevealIndex] = useState(0)
  const [revealShown, setRevealShown] = useState(false)
  const [speakingOrder, setSpeakingOrder] = useState([])
  const [speakerIndex, setSpeakerIndex] = useState(0)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [lastElimination, setLastElimination] = useState(null)
  const [mrWhiteGuessInput, setMrWhiteGuessInput] = useState('')
  const [mrWhiteGuessResult, setMrWhiteGuessResult] = useState(null)
  const [winner, setWinner] = useState(null)
  const [soloWinnerUid, setSoloWinnerUid] = useState(null)
  const startTimeRef = useRef(null)

  const memberById = id => members.find(m => m.id === id)
  const alivePlayers = players.filter(p => !p.eliminated)

  function addSlot() {
    setSlots(prev => prev.length >= MAX_PLAYERS ? prev : [...prev, { mode: 'guest', search: '', memberId: null }])
  }
  function removeSlot() {
    setSlots(prev => prev.length <= MIN_PLAYERS ? prev : prev.slice(0, -1))
  }
  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  function handleStartSetup() {
    const roster = slots.map((slot, i) => {
      if (slot.mode === 'member' && slot.memberId) {
        const m = memberById(slot.memberId)
        return { uid: i, name: `${m.firstName} ${m.lastName}`, memberId: m.id, isGuest: false, colorIndex: i }
      }
      return { uid: i, name: slot.search.trim() || `Joueur ${i + 1}`, memberId: null, isGuest: true, colorIndex: i }
    })
    const withRoles = assignRoles(roster, undercoverCount, mrWhiteCount).map(p => ({ ...p, eliminated: false }))
    setPlayers(withRoles)
    setRevealIndex(0)
    setRevealShown(false)
    startTimeRef.current = Date.now()
    setStep('reveal')
  }

  function handleNextReveal() {
    if (revealIndex + 1 >= players.length) {
      setSpeakingOrder(buildSpeakingOrder(players))
      setSpeakerIndex(0)
      setStep('speaking')
    } else {
      setRevealIndex(i => i + 1)
      setRevealShown(false)
    }
  }

  function handleNextSpeaker() {
    if (speakerIndex + 1 >= speakingOrder.length) {
      setSelectedTarget(null)
      setStep('vote')
    } else {
      setSpeakerIndex(i => i + 1)
    }
  }

  function handleConfirmVote() {
    if (selectedTarget == null) return
    const target = players.find(p => p.uid === selectedTarget)
    const updated = players.map(p => p.uid === selectedTarget ? { ...p, eliminated: true } : p)
    setPlayers(updated)
    setLastElimination({ tie: false, player: target })
    setMrWhiteGuessResult(null)
    setMrWhiteGuessInput('')

    if (target.role !== ROLE_MRWHITE) {
      setWinner(checkWinner(updated.filter(p => !p.eliminated)))
    } else {
      setWinner(null)
    }
    setStep('eliminated')
  }

  function handleSkipVote() {
    setLastElimination({ tie: true, player: null })
    setMrWhiteGuessResult(null)
    setWinner(null)
    setStep('eliminated')
  }

  function handleSubmitMrWhiteGuess() {
    const civilianWord = players.find(p => p.role === ROLE_CIVILIAN)?.word ?? ''
    const correct = normalize(mrWhiteGuessInput) === normalize(civilianWord)
    setMrWhiteGuessResult({ correct, civilianWord })
    if (correct) {
      setWinner('mrwhite')
      setSoloWinnerUid(lastElimination.player.uid)
    } else {
      setWinner(checkWinner(players.filter(p => !p.eliminated)))
    }
  }

  function handleContinueFromEliminated() {
    if (winner) { setStep('results'); return }
    setSpeakingOrder(buildSpeakingOrder(players.filter(p => !p.eliminated)))
    setSpeakerIndex(0)
    setStep('speaking')
  }

  function handleExit() {
    navigate('/games')
  }

  if (step === 'mode') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Undercover" onBack={() => navigate('/games')} />
        <GameModeScreen onLocal={() => setStep('setup')} onRemote={() => navigate('/games/undercover/remote')} />
      </div>
    )
  }

  if (step === 'setup') {
    const maxUndercover = maxUndercoverCount(slots.length)
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Undercover" onBack={() => setStep('mode')} />
        <div className="px-4 mt-5 pb-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Joueurs ({slots.length})</h2>
              <div className="flex gap-1.5">
                <button onClick={removeSlot} disabled={slots.length <= MIN_PLAYERS} className="h-7 w-7 rounded-full bg-white shadow-sm text-gray-500 font-black disabled:opacity-30">−</button>
                <button onClick={addSlot} disabled={slots.length >= MAX_PLAYERS} className="h-7 w-7 rounded-full bg-white shadow-sm text-gray-500 font-black disabled:opacity-30">+</button>
              </div>
            </div>
            <div className="space-y-2.5">
              {slots.map((slot, i) => (
                <UndercoverPlayerSlot
                  key={i}
                  index={i}
                  isSelf={i === 0}
                  slot={slot}
                  member={slot.memberId ? memberById(slot.memberId) : null}
                  candidates={members.filter(m => !slots.some((s, idx) => idx !== i && s.memberId === m.id))}
                  onChange={patch => updateSlot(i, patch)}
                />
              ))}
            </div>
          </div>

          <CountPicker label="Nombre d'undercover" value={undercoverCount} min={1} max={maxUndercover} onChange={setUndercoverCount} />
          <CountPicker label="Nombre de Mr. White" value={mrWhiteCount} min={0} max={1} onChange={setMrWhiteCount} />

          <button
            onClick={handleStartSetup}
            className="w-full rounded-2xl bg-dark py-4 text-base font-black text-white shadow-lg shadow-dark/30 active:opacity-90"
          >
            C'est parti !
          </button>
        </div>
      </div>
    )
  }

  if (step === 'reveal') {
    const player = players[revealIndex]
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <GameHeader title="Undercover" subtitle={`${revealIndex + 1}/${players.length}`} onBack={() => setStep('setup')} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          {!revealShown ? (
            <>
              <p className="text-lg font-extrabold text-gray-800 mb-2">Passe le téléphone à</p>
              <p className="text-2xl font-black text-primary mb-8">{player.name}</p>
              <button
                onClick={() => setRevealShown(true)}
                className="w-full max-w-xs rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg active:bg-primary-dark"
              >
                Tap pour voir ton rôle 🤫
              </button>
            </>
          ) : (
            <>
              {player.role === ROLE_MRWHITE ? (
                <>
                  <p className="text-3xl mb-3">🎭</p>
                  <p className="text-lg font-extrabold text-gray-800 mb-1">Tu es Mr. White !</p>
                  <p className="text-sm text-gray-500 max-w-xs">Tu n'as aucun mot. Bluffe en donnant un indice crédible sans te faire démasquer.</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Ton mot secret</p>
                  <p className="text-3xl font-black text-gray-800 mb-1">{player.word}</p>
                  <p className="text-xs text-gray-400 mt-2">Ne le répète jamais à voix haute !</p>
                </>
              )}
              <button
                onClick={handleNextReveal}
                className="mt-8 w-full max-w-xs rounded-2xl bg-dark py-4 text-sm font-bold text-white shadow-lg active:opacity-90"
              >
                J'ai vu, cacher et passer
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (step === 'speaking') {
    const speaker = speakingOrder[speakerIndex]
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Tour d'indices" subtitle="À voix haute, sans dire le mot" onBack={handleExit} />
        <div className="px-4 mt-6 flex flex-col items-center">
          <Avatar member={memberById(speaker.memberId)} name={speaker.name} size="lg" className="mb-3" />
          <p className="text-sm text-gray-400 mb-1">C'est au tour de</p>
          <p className="text-xl font-black text-gray-800 mb-8">{speaker.name}</p>
          <button
            onClick={handleNextSpeaker}
            className="w-full max-w-xs rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg active:bg-primary-dark mb-8"
          >
            {speakerIndex + 1 >= speakingOrder.length ? 'Tout le monde est passé, voter' : 'Joueur suivant'}
          </button>
          <AliveRoster players={speakingOrder} memberById={memberById} highlightUid={speaker.uid} speakerIndex={speakerIndex} />
        </div>
      </div>
    )
  }

  if (step === 'vote') {
    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Vote" subtitle="Qui est démasqué comme suspect ?" onBack={handleExit} />
        <div className="px-4 mt-6">
          <div className="grid grid-cols-3 gap-3 mb-6">
            {alivePlayers.map(p => (
              <button
                key={p.uid}
                onClick={() => setSelectedTarget(p.uid)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all ${
                  selectedTarget === p.uid ? 'bg-primary/15 ring-2 ring-primary' : 'bg-white shadow-sm active:opacity-80'
                }`}
              >
                <Avatar member={memberById(p.memberId)} name={p.name} size="md" />
                <span className="text-xs font-semibold text-gray-700 truncate max-w-full">{p.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleConfirmVote}
            disabled={selectedTarget == null}
            className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg active:bg-primary-dark disabled:opacity-40 mb-3"
          >
            Confirmer l'élimination
          </button>
          <button
            onClick={handleSkipVote}
            className="w-full rounded-2xl bg-white shadow-sm py-3.5 text-sm font-semibold text-gray-500 active:bg-gray-50"
          >
            Égalité (personne n'est éliminé)
          </button>
        </div>
      </div>
    )
  }

  if (step === 'eliminated') {
    const isMrWhite = !lastElimination.tie && lastElimination.player.role === ROLE_MRWHITE
    const canContinue = lastElimination.tie || !isMrWhite || mrWhiteGuessResult !== null

    return (
      <div className="overflow-y-auto h-full bg-gray-50 pb-24">
        <GameHeader title="Résultat du vote" onBack={handleExit} />
        <div className="px-4 mt-6 flex flex-col items-center text-center">
          {lastElimination.tie ? (
            <>
              <p className="text-3xl mb-3">🤝</p>
              <p className="text-lg font-extrabold text-gray-800">Égalité, personne n'est éliminé</p>
            </>
          ) : (
            <>
              <Avatar member={memberById(lastElimination.player.memberId)} name={lastElimination.player.name} size="lg" className="mb-3" />
              <p className="text-lg font-extrabold text-gray-800">{lastElimination.player.name} était...</p>
              <p className="text-2xl font-black text-primary mt-1">{ROLE_LABELS[lastElimination.player.role]}</p>
              {lastElimination.player.word && <p className="text-sm text-gray-400 mt-1">Mot : {lastElimination.player.word}</p>}
            </>
          )}

          {isMrWhite && !mrWhiteGuessResult && (
            <div className="w-full max-w-xs mt-6">
              <p className="text-xs font-semibold text-gray-500 mb-2">Mr. White a une dernière chance : deviner le mot des civils pour gagner quand même !</p>
              <div className="flex items-center gap-2">
                <input
                  value={mrWhiteGuessInput}
                  onChange={e => setMrWhiteGuessInput(e.target.value)}
                  placeholder="Mot des civils..."
                  className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-primary"
                />
                <button onClick={handleSubmitMrWhiteGuess} className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white active:bg-primary-dark">
                  Tenter
                </button>
              </div>
            </div>
          )}

          {mrWhiteGuessResult && (
            <p className={`mt-4 text-sm font-bold ${mrWhiteGuessResult.correct ? 'text-green-600' : 'text-red-500'}`}>
              {mrWhiteGuessResult.correct ? `Bien joué, c'était "${mrWhiteGuessResult.civilianWord}" ! Mr. White gagne !` : `Raté, c'était "${mrWhiteGuessResult.civilianWord}".`}
            </p>
          )}

          {canContinue && (
            <button
              onClick={handleContinueFromEliminated}
              className="mt-8 w-full max-w-xs rounded-2xl bg-dark py-4 text-sm font-bold text-white shadow-lg active:opacity-90"
            >
              {winner ? 'Voir les résultats' : 'Manche suivante'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // step === 'results'
  return (
    <UndercoverResultsScreen
      players={players}
      winner={winner}
      soloWinnerUid={soloWinnerUid}
      durationSeconds={startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : null}
      memberById={memberById}
      onReplay={() => setStep('setup')}
      onExit={handleExit}
    />
  )
}

function CountPicker({ label, value, min, max, onChange }) {
  const options = []
  for (let n = min; n <= max; n++) options.push(n)
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">{label}</h2>
      <div className="flex gap-2.5">
        {options.map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 rounded-2xl py-3 text-sm font-black transition-colors ${
              value === n ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function UndercoverPlayerSlot({ index, isSelf, slot, member, candidates, onChange }) {
  const linked = isSelf || (slot.mode === 'member' && !!slot.memberId)
  const searching = !isSelf && slot.mode === 'member' && !slot.memberId
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length]

  const filtered = searching && slot.search.trim()
    ? candidates.filter(m => matchesSearch(`${m.firstName} ${m.lastName}`, slot.search))
    : []

  function toggleLink() {
    if (linked) onChange({ mode: 'guest', memberId: null })
    else if (searching) onChange({ mode: 'guest' })
    else onChange({ mode: 'member', memberId: null })
  }

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm py-2.5 pl-2.5 pr-3 border-l-4 ${linked ? color.border : 'border-gray-200'}`}>
        <Avatar member={member} name={slot.search} size="sm" className={linked ? `ring-2 ${color.ring}` : ''} />
        <div className="flex-1 min-w-0">
          {linked ? (
            <p className="font-bold text-sm text-gray-800 truncate">{slot.search}</p>
          ) : (
            <input
              value={slot.search}
              onChange={e => onChange({ search: e.target.value, memberId: null })}
              placeholder={`Joueur ${index + 1} — nom libre`}
              className="w-full bg-transparent text-sm font-semibold text-gray-800 focus:outline-none placeholder:font-medium placeholder:text-gray-400"
            />
          )}
          <p className={`text-[11px] font-bold ${linked ? color.text : 'text-gray-400'}`}>Joueur {index + 1}</p>
        </div>
        {isSelf ? (
          <span className="shrink-0 text-[11px] font-bold text-gray-400 bg-gray-100 rounded-full px-3 py-1.5">Vous</span>
        ) : linked ? (
          <button type="button" onClick={toggleLink} className="shrink-0 text-[11px] font-bold text-primary bg-primary/10 rounded-full px-3 py-1.5 active:bg-primary/20">
            Lié ✓
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleLink}
            className={`shrink-0 text-[11px] font-bold rounded-full px-3 py-1.5 ${searching ? 'bg-gray-200 text-gray-600' : 'bg-primary/10 text-primary'}`}
          >
            {searching ? 'Annuler' : 'Lier'}
          </button>
        )}
      </div>

      {searching && (
        slot.search.trim() ? (
          filtered.length > 0 ? (
            <ul className="ml-2 rounded-xl border border-gray-200 bg-white overflow-hidden max-h-40 overflow-y-auto">
              {filtered.map(m => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onChange({ memberId: m.id, search: `${m.firstName} ${m.lastName}` })}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-primary/10"
                  >
                    {m.firstName} {m.lastName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pl-3 text-xs text-gray-400">Aucun membre trouvé</p>
          )
        ) : (
          <p className="pl-3 text-xs text-gray-400">Tapez un nom pour rechercher un membre à lier</p>
        )
      )}

      {!searching && !linked && (
        <p className="pl-3 text-xs text-gray-400">Joueur invité, non comptabilisé dans les classements</p>
      )}
    </div>
  )
}

// `players` doit être dans l'ordre de parole (speakingOrder), pas juste la liste des vivants,
// pour que l'ordre affiché soit exploitable dès le début du tour.
function AliveRoster({ players, memberById, highlightUid, speakerIndex }) {
  return (
    <div className="w-full flex flex-wrap gap-2 justify-center">
      {players.map((p, i) => {
        const isCurrent = p.uid === highlightUid
        const alreadySpoke = speakerIndex != null && i < speakerIndex
        return (
          <div
            key={p.uid}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 ${
              isCurrent ? 'bg-primary text-white' : alreadySpoke ? 'bg-gray-100 text-gray-400' : 'bg-white shadow-sm'
            }`}
          >
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              isCurrent ? 'bg-white/25 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {i + 1}
            </span>
            <Avatar member={memberById(p.memberId)} name={p.name} size="xs" />
            <span className="text-xs font-semibold">{p.name.split(' ')[0]}</span>
          </div>
        )
      })}
    </div>
  )
}

function UndercoverResultsScreen({ players, winner, soloWinnerUid, durationSeconds, memberById, onReplay, onExit }) {
  const submitted = useRef(false)

  const winnerLabel = winner === 'mrwhite'
    ? `${players.find(p => p.uid === soloWinnerUid)?.name} (Mr. White)`
    : winner === 'civilians' ? 'Les civils' : 'Les undercover'

  useEffect(() => {
    if (submitted.current) return
    submitted.current = true
    const scored = players.map(p => {
      const score = winner === 'mrwhite'
        ? (p.uid === soloWinnerUid ? 1 : 0)
        : winner === 'civilians'
          ? (p.role === ROLE_CIVILIAN ? 1 : 0)
          : (p.role !== ROLE_CIVILIAN ? 1 : 0)
      return { name: p.name, score, memberId: p.memberId ?? null, isGuest: !!p.isGuest }
    })
    gamesApi.submitResult({
      gameType: 'undercover',
      pairsCount: 1,
      players: scored,
      winnerName: winnerLabel,
      durationSeconds,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="overflow-y-auto h-full bg-gray-50 pb-24">
      <div className="bg-dark px-5 pt-8 pb-9 text-center rounded-b-[32px]">
        <p className="text-3xl">🎉</p>
        <h2 className="text-xl font-black text-white mt-1.5">{winnerLabel} {winner === 'mrwhite' ? 'gagne' : 'gagnent'} !</h2>
      </div>

      <div className="px-4 mt-6 space-y-4">
        <div className="rounded-2xl bg-white shadow-sm divide-y divide-gray-50 overflow-hidden">
          {players.map(p => (
            <div key={p.uid} className="flex items-center gap-3 px-4 py-3">
              <Avatar member={memberById(p.memberId)} name={p.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                {p.word && <p className="text-xs text-gray-400">{p.word}</p>}
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">{ROLE_LABELS[p.role]}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5">
          <button onClick={onReplay} className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white active:bg-primary-dark">
            Rejouer
          </button>
          <button onClick={onExit} className="flex-1 rounded-2xl bg-white shadow-sm py-3.5 text-sm font-bold text-gray-600 active:bg-gray-50">
            Quitter
          </button>
        </div>
      </div>
    </div>
  )
}

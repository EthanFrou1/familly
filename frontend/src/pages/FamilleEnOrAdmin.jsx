import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { familleEnOrApi } from '../services/api'

export default function FamilleEnOrAdmin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'

  const [questions, setQuestions] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    familleEnOrApi.getQuestions()
      .then(({ data }) => setQuestions(data))
      .catch(() => setQuestions([]))
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  if (selectedKey) {
    return (
      <QuestionDetail
        questionKey={selectedKey}
        onBack={() => setSelectedKey(null)}
        onReadyChange={isReady => setQuestions(prev => prev.map(q => q.key === selectedKey ? { ...q, isReady } : q))}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-gray-50 animate-fade-in">
      <div className="bg-dark px-5 pt-10 pb-5 shrink-0">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-white/60 text-sm mb-3 active:opacity-70"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Administration
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">💰 Famille en Or — curation</h1>
        <p className="text-white/50 text-sm">Regroupe les réponses du sondage par question</p>
      </div>

      <div className="flex-1 px-4 py-3 space-y-2">
        {questions === null ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          questions.map(q => (
            <button
              key={q.key}
              onClick={() => setSelectedKey(q.key)}
              className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 shadow-sm text-left active:scale-[0.99] transition-transform"
            >
              <span className="text-sm font-semibold text-gray-800 pr-3">{q.prompt}</span>
              <span className={`shrink-0 text-[10px] font-bold rounded-full px-2.5 py-1 ${q.isReady ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                {q.isReady ? 'Prête' : 'Brouillon'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function QuestionDetail({ questionKey, onBack, onReadyChange }) {
  const [detail, setDetail] = useState(null)
  const [selectedAnswerIds, setSelectedAnswerIds] = useState([])
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const load = useCallback(() => {
    familleEnOrApi.getAdminQuestionDetail(questionKey)
      .then(({ data }) => setDetail(data))
      .catch(() => setDetail(null))
  }, [questionKey])

  useEffect(() => { load() }, [load])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function toggleAnswer(id) {
    setSelectedAnswerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleCreateGroup() {
    const label = newGroupLabel.trim()
    if (!label || selectedAnswerIds.length === 0 || busy) return
    setBusy(true)
    try {
      await familleEnOrApi.createGroup(questionKey, selectedAnswerIds, label)
      setSelectedAnswerIds([])
      setNewGroupLabel('')
      load()
    } catch {
      showToast('Erreur lors du regroupement.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAnswer(id) {
    if (busy) return
    setBusy(true)
    try {
      await familleEnOrApi.deleteAnswer(id)
      load()
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleReady() {
    if (busy) return
    setBusy(true)
    try {
      if (detail.isReady) await familleEnOrApi.markUnready(questionKey)
      else await familleEnOrApi.markReady(questionKey)
      onReadyChange(!detail.isReady)
      load()
    } catch {
      showToast('Erreur.')
    } finally {
      setBusy(false)
    }
  }

  if (!detail) {
    return (
      <div className="flex justify-center py-16 bg-gray-50 min-h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const ungrouped = detail.answers.filter(a => !a.groupId)

  return (
    <div className="flex flex-col min-h-full bg-gray-50 animate-fade-in">
      <div className="bg-dark px-5 pt-10 pb-5 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-white/60 text-sm mb-3 active:opacity-70">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Questions
        </button>
        <h1 className="text-lg font-bold text-white mb-2">{detail.prompt}</h1>
        <button
          onClick={handleToggleReady}
          disabled={busy}
          className={`text-xs font-bold rounded-full px-3 py-1.5 ${detail.isReady ? 'bg-amber-400 text-amber-900' : 'bg-white/15 text-white'}`}
        >
          {detail.isReady ? '🏆 Prête — repasser en brouillon' : 'Marquer prête à jouer'}
        </button>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {detail.groups.length > 0 && (
          <div>
            <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-2">Groupes</h2>
            <div className="space-y-2">
              {detail.groups.map(g => (
                <div key={g.id} className="rounded-2xl bg-white shadow-sm px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">{g.label}</span>
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">{g.points} pt{g.points > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs font-extrabold text-gray-400 uppercase tracking-wide mb-2">
            Réponses non groupées ({ungrouped.length})
          </h2>
          {ungrouped.length === 0 ? (
            <p className="text-sm text-gray-400">Tout est regroupé.</p>
          ) : (
            <div className="space-y-1.5">
              {ungrouped.map(a => (
                <label key={a.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-2.5 shadow-sm">
                  <input
                    type="checkbox"
                    checked={selectedAnswerIds.includes(a.id)}
                    onChange={() => toggleAnswer(a.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="flex-1 min-w-0 text-sm font-medium text-gray-700 truncate">
                    {a.rawText} <span className="text-gray-400 text-xs">— {a.memberName}</span>
                  </span>
                  <button onClick={() => handleDeleteAnswer(a.id)} className="shrink-0 text-gray-300 active:text-red-500 text-xs font-bold px-1">
                    ✕
                  </button>
                </label>
              ))}
            </div>
          )}

          {selectedAnswerIds.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={newGroupLabel}
                onChange={e => setNewGroupLabel(e.target.value)}
                placeholder="Libellé du groupe..."
                className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleCreateGroup}
                disabled={busy || !newGroupLabel.trim()}
                className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white active:bg-primary-dark disabled:opacity-40"
              >
                Regrouper ({selectedAnswerIds.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

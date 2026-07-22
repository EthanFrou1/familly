import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { familleEnOrApi } from '../services/api'

export default function FamilleEnOrSurvey() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [submittingKey, setSubmittingKey] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    familleEnOrApi.getQuestions()
      .then(({ data }) => setQuestions(data))
      .catch(() => setQuestions([]))
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleSubmit(key) {
    const text = (drafts[key] ?? '').trim()
    if (!text || submittingKey) return
    setSubmittingKey(key)
    try {
      await familleEnOrApi.submitAnswer(key, text)
      setQuestions(prev => prev.map(q => q.key === key ? { ...q, hasAnswered: true } : q))
      showToast('Réponse enregistrée !')
    } catch {
      showToast("Erreur, réessaie.")
    } finally {
      setSubmittingKey(null)
    }
  }

  const answeredCount = questions?.filter(q => q.hasAnswered).length ?? 0

  return (
    <div className="flex flex-col min-h-full bg-gray-50 animate-fade-in">
      <div className="bg-dark px-5 pt-10 pb-5 shrink-0">
        <button
          onClick={() => navigate('/games')}
          className="flex items-center gap-1.5 text-white/60 text-sm mb-3 active:opacity-70"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Jeux
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Sondage 💰 Famille en Or</h1>
        <p className="text-white/50 text-sm">
          {questions === null ? 'Chargement…' : `${answeredCount}/${questions.length} questions répondues`}
        </p>
      </div>

      <div className="flex-1 px-4 py-3 space-y-2.5">
        {questions === null ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          questions.map(q => (
            <QuestionCard
              key={q.key}
              question={q}
              draft={drafts[q.key] ?? ''}
              onDraftChange={text => setDrafts(prev => ({ ...prev, [q.key]: text }))}
              onSubmit={() => handleSubmit(q.key)}
              submitting={submittingKey === q.key}
            />
          ))
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

function QuestionCard({ question, draft, onDraftChange, onSubmit, submitting }) {
  const { prompt, hasAnswered, isReady } = question
  const locked = isReady

  return (
    <div className="rounded-2xl bg-white shadow-sm p-4">
      <p className="text-sm font-semibold text-gray-800">{prompt}</p>

      {locked ? (
        <p className="text-xs font-semibold text-amber-600 mt-2">🏆 Prête à être jouée</p>
      ) : hasAnswered ? (
        <p className="text-xs font-semibold text-green-600 mt-2">✅ Réponse enregistrée</p>
      ) : (
        <form onSubmit={e => { e.preventDefault(); onSubmit() }} className="mt-2.5 flex items-center gap-2">
          <input
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            disabled={submitting}
            placeholder="Ta réponse..."
            className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={submitting || !draft.trim()}
            className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white active:bg-primary-dark disabled:opacity-40"
          >
            OK
          </button>
        </form>
      )}
    </div>
  )
}

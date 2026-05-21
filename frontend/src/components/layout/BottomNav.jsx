import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMembers } from '../../store/MembersContext'
import { useState } from 'react'
import MemberFormModal from '../members/MemberFormModal'
import SuccessAddModal from '../members/SuccessAddModal'
import RelationSuggestionModal from '../members/RelationSuggestionModal'
import { membersApi } from '../../services/api'

export default function BottomNav() {
  const { user, logout } = useAuth()
  const { refresh } = useMembers()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'Admin'
  const [fabOpen, setFabOpen] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMember, setNewMember] = useState(null)
  const [relationSuggestions, setRelationSuggestions] = useState(null)

  async function handleAddMember(form) {
    const { data } = await membersApi.create(form)
    setShowAddMember(false)
    setFabOpen(false)
    setNewMember(data)
    refresh()
    const matches = members.filter(
      m => m.id !== data.id && m.lastName.trim().toLowerCase() === data.lastName.trim().toLowerCase()
    )
    if (matches.length > 0) setRelationSuggestions({ newMember: data, matches })
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const allActions = [
    {
      label: 'Les familles',
      icon: FamilyIcon,
      onClick: () => { setFabOpen(false); navigate('/families') }
    },
    {
      label: 'Voir la carte',
      icon: MapIcon,
      onClick: () => { setFabOpen(false); navigate('/map') }
    },
  ]

  const adminOnlyActions = [
    {
      label: 'Administration',
      icon: ShieldIcon,
      onClick: () => { setFabOpen(false); navigate('/admin') }
    },
    {
      label: 'Ajouter un membre',
      icon: AddPersonIcon,
      onClick: () => { setFabOpen(false); setShowAddMember(true) }
    },
  ]

  return (
    <>
      {/* Overlay + menu FAB */}
      {fabOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={() => setFabOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />

          {/* Menu dark */}
          <div
            className="relative mx-4 rounded-2xl overflow-hidden"
            style={{ background: '#2A1208', marginBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            {isAdmin && adminOnlyActions.map(({ label, icon: Icon }, i) => (
              <MenuItem key={label} icon={<Icon />} label={label}
                onClick={adminOnlyActions[i].onClick}
                border
              />
            ))}

            {allActions.map(({ label, icon: Icon }, i) => (
              <MenuItem key={label} icon={<Icon />} label={label}
                onClick={allActions[i].onClick}
                border={i < allActions.length - 1}
              />
            ))}

            {/* Divider */}
            <div className="h-px bg-white/10 mx-4" />

            <MenuItem
              icon={<LogoutIcon />}
              label="Déconnexion"
              onClick={handleLogout}
              danger
            />
          </div>
        </div>
      )}

      <nav className={`safe-bottom border-t border-gray-200 bg-white relative transition-all duration-200 ${fabOpen ? 'z-30' : 'z-50'}`}>
        <div className="flex items-end">
          <NavLink to="/" end
            className={({ isActive }) => tabCls(isActive)}>
            <HomeIcon className="h-6 w-6" /><span className="mt-0.5">Accueil</span>
          </NavLink>

          <NavLink to="/tree"
            className={({ isActive }) => tabCls(isActive)}>
            <TreeIcon className="h-6 w-6" /><span className="mt-0.5">Arbre</span>
          </NavLink>

          {/* FAB central */}
          <div className="flex flex-col items-center justify-end pb-2 px-3" style={{ minWidth: 72 }}>
            <button
              onClick={() => setFabOpen(o => !o)}
              className={`h-14 w-14 -mt-5 rounded-full text-white shadow-lg flex items-center justify-center active:scale-95 transition-all ${fabOpen ? 'bg-gray-700' : 'bg-primary'}`}
            >
              <svg className={`h-7 w-7 transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <span className="text-xs text-gray-400 mt-1">Action</span>
          </div>

          <NavLink to="/members"
            className={({ isActive }) => tabCls(isActive)}>
            <MembersIcon className="h-6 w-6" /><span className="mt-0.5">Membres</span>
          </NavLink>

          <NavLink to="/profile"
            className={({ isActive }) => tabCls(isActive)}>
            <ProfileIcon className="h-6 w-6" /><span className="mt-0.5">Profil</span>
          </NavLink>
        </div>
      </nav>

      <MemberFormModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSubmit={handleAddMember}
      />

      <SuccessAddModal
        member={newMember}
        onClose={() => setNewMember(null)}
      />

      {relationSuggestions && (
        <RelationSuggestionModal
          newMember={relationSuggestions.newMember}
          matches={relationSuggestions.matches}
          onClose={() => setRelationSuggestions(null)}
          onCreated={refresh}
        />
      )}
    </>
  )
}

function MenuItem({ icon, label, onClick, border = false, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 px-5 py-4 active:bg-white/5 transition-colors ${danger ? 'text-red-400' : 'text-white'}`}
    >
      <span className={`h-5 w-5 shrink-0 ${danger ? 'text-red-400' : 'text-gray-300'}`}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

const tabCls = (isActive) =>
  `flex flex-1 flex-col items-center justify-center py-2 min-h-[56px] text-xs transition-colors ${isActive ? 'text-primary' : 'text-gray-400'}`

function HomeIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
}
function TreeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="3.5" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12M6 8v3M18 8v3" />
      <circle cx="6" cy="13" r="1.5" />
      <circle cx="18" cy="13" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 14.5v3M18 14.5v3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h4M16 20h4" />
    </svg>
  )
}
function MapIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
}
function MembersIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function ProfileIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}
function FamilyIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-full w-full"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function AddPersonIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-full w-full"><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
}
function PhotoIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-full w-full"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
}
function ShieldIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-full w-full"><path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}
function LogoutIcon() {
  return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-full w-full"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
}

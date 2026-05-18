import { useNavigate } from 'react-router-dom'
import Avatar from '../shared/Avatar'

export default function MemberCard({ member }) {
  const navigate = useNavigate()
  const fullName = `${member.firstName} ${member.lastName}`
  const age = member.birthDate
    ? Math.floor((Date.now() - new Date(member.birthDate)) / (365.25 * 24 * 3600 * 1000))
    : null

  return (
    <button
      onClick={() => navigate(`/profile/${member.id}`)}
      className="flex items-center gap-3 w-full rounded-2xl bg-white p-3 shadow-sm active:scale-95 transition-transform min-h-touch text-left"
    >
      <Avatar src={member.profilePictureUrl} name={fullName} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{fullName}</p>
        <p className="text-sm text-gray-500 truncate">
          {age !== null ? `${age} ans` : ''}{age !== null && member.city ? ' · ' : ''}{member.city || ''}
        </p>
      </div>
    </button>
  )
}

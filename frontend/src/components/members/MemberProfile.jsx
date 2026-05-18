import Avatar from '../shared/Avatar'
import Badge from '../shared/Badge'

export default function MemberProfile({ member, relations = [] }) {
  if (!member) return null
  const fullName = `${member.firstName} ${member.lastName}`
  const age = member.birthDate
    ? Math.floor((Date.now() - new Date(member.birthDate)) / (365.25 * 24 * 3600 * 1000))
    : null

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex flex-col items-center gap-3">
        <Avatar src={member.profilePictureUrl} name={fullName} size="xl" />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
          {age !== null && <p className="text-gray-500">{age} ans</p>}
        </div>
        {!member.isAlive && <Badge label="Décédé(e)" variant="readonly" />}
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        {member.city && <InfoRow label="Ville" value={`${member.city}${member.country ? `, ${member.country}` : ''}`} />}
        {member.phone && <InfoRow label="Téléphone" value={member.phone} />}
        {member.email && <InfoRow label="Email" value={member.email} />}
        {member.bio && <InfoRow label="Bio" value={member.bio} />}
      </div>

      {relations.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Liens familiaux</h3>
          <div className="space-y-2">
            {relations.map((rel) => (
              <div key={rel.id} className="flex items-center justify-between">
                <span className="text-gray-900">{rel.relatedMemberName}</span>
                <Badge label={rel.typeLabel} variant="default" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  )
}

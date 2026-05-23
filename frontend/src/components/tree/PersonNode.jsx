import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import Avatar from '../shared/Avatar'

const H = { background: 'transparent', border: 'none', width: 1, height: 1 }

function PersonNode({ data }) {
  const { member, color, isCurrentUser } = data
  const fullName = `${member.firstName} ${member.lastName}`

  const age = member.birthDate
    ? Math.floor((Date.now() - new Date(member.birthDate)) / (365.25 * 24 * 3600 * 1000))
    : null

  const yearOnly = member.birthDate ? new Date(member.birthDate).getFullYear() : null

  return (
    <div
      style={{
        borderColor: color ? color.border : (member.familyId == null ? '#D97706' : '#E5E7EB'),
        width: 160,
      }}
      className={`rounded-xl border-2 shadow-sm cursor-pointer active:scale-95 transition-transform select-none overflow-hidden bg-white ${
        !member.isAlive ? 'opacity-60 grayscale' : ''
      }`}
    >
      <Handle id="top"       type="target" position={Position.Top} style={H} />
      <Handle id="topSource" type="source" position={Position.Top} style={{ ...H, left: '70%' }} />
      <Handle id="topTarget" type="target" position={Position.Top} style={{ ...H, left: '30%' }} />
      <Handle id="left"      type="target" position={Position.Left}   style={H} />
      <Handle id="right"     type="source" position={Position.Right}  style={H} />

      {/* Header with family name */}
      <div
        style={{ background: color ? color.border : (member.familyId == null ? '#D97706' : '#9CA3AF') }}
        className="px-2.5 py-1 flex items-center justify-between"
      >
        <span className="text-[10px] font-bold text-white truncate italic">
          {member.familyName ?? 'Pièce rapportée'}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {isCurrentUser && (
            <span className="text-[9px] font-bold text-white bg-white/25 rounded-full px-1.5 py-0.5">
              Vous
            </span>
          )}
          {!member.isAlive && (
            <span className="text-[10px] text-white/80">†</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <Avatar src={member.profilePictureUrl} name={fullName} size="xs" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-900 leading-tight truncate flex items-center gap-0.5">
            {member.firstName} {member.lastName}
            {member.gender === 'M' && <span className="text-blue-400 shrink-0">♂</span>}
            {member.gender === 'F' && <span className="text-pink-400 shrink-0">♀</span>}
          </p>
          {yearOnly && (
            <p className="text-[10px] text-gray-400 leading-tight">
              {member.isAlive ? (age !== null ? `${age} ans` : String(yearOnly)) : String(yearOnly)}
            </p>
          )}
        </div>
      </div>

      <Handle id="bottom"       type="source" position={Position.Bottom} style={H} />
      <Handle id="bottomTarget" type="target" position={Position.Bottom} style={H} />
    </div>
  )
}

export default memo(PersonNode)

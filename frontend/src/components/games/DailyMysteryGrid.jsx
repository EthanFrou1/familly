import Avatar from '../shared/Avatar'
import { ATTRIBUTE_COLUMNS } from '../../utils/dailyMystery'

const CELL_STYLES = {
  green: 'bg-green-500 text-white',
  yellow: 'bg-yellow-400 text-white',
  gray: 'bg-gray-200 text-gray-400',
}

const ARROWS = { up: '↑', down: '↓' }

export default function DailyMysteryGrid({ rows, showBranchColumn }) {
  const columns = ATTRIBUTE_COLUMNS.filter(c => c.key !== 'branch' || showBranchColumn)

  if (rows.length === 0) {
    return (
      <p className="text-xs font-semibold text-gray-400 text-center py-6">
        Fais ta première proposition pour voir apparaître les indices.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="min-w-max space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-32 shrink-0" />
          {columns.map(c => (
            <div key={c.key} className="w-11 shrink-0 text-center">
              <div className="text-base leading-none">{c.emoji}</div>
              <div className="text-[9px] font-semibold text-gray-400 leading-tight mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {rows.map(row => (
          <div key={row.memberId} className="flex items-center gap-2">
            <div className="w-32 shrink-0 flex items-center gap-2 min-w-0">
              <Avatar src={row.profilePictureUrl} name={`${row.firstName} ${row.lastName}`} size="sm" />
              <span className="text-xs font-bold text-gray-700 truncate">{row.firstName}</span>
            </div>
            {columns.map(c => {
              const cell = row[c.key]
              if (!cell) return <div key={c.key} className="w-11 shrink-0" />
              return (
                <div
                  key={c.key}
                  className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-sm font-black ${CELL_STYLES[cell.status] ?? CELL_STYLES.gray}`}
                >
                  {cell.direction ? ARROWS[cell.direction] : row.isCorrect ? '✓' : ''}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

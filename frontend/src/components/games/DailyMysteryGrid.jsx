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

  // Largeurs en fractions (flex-1) plutôt qu'en pixels fixes : la grille s'adapte
  // à la largeur de l'écran au lieu de forcer un scroll horizontal.
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <div className="w-16 shrink-0" />
        {columns.map(c => (
          <div key={c.key} className="flex-1 text-center text-base leading-none">{c.emoji}</div>
        ))}
      </div>

      {rows.map(row => (
        <div key={row.memberId} className="flex items-center gap-1">
          <div className="w-16 shrink-0 flex items-center gap-1 min-w-0">
            <Avatar src={row.profilePictureUrl} name={`${row.firstName} ${row.lastName}`} size="xs" />
            <span className="text-[10px] font-bold text-gray-700 truncate">{row.firstName}</span>
          </div>
          {columns.map(c => {
            const cell = row[c.key]
            if (!cell) return <div key={c.key} className="flex-1" />
            return (
              <div
                key={c.key}
                className={`flex-1 aspect-square rounded-lg flex flex-col items-center justify-center leading-none ${CELL_STYLES[cell.status] ?? CELL_STYLES.gray}`}
              >
                {c.key === 'birthYear' && cell.value ? (
                  <>
                    <span className="text-[10px] font-black">{cell.value}</span>
                    {cell.direction && <span className="text-[9px]">{ARROWS[cell.direction]}</span>}
                  </>
                ) : (
                  <span className="text-sm font-black">{cell.direction ? ARROWS[cell.direction] : row.isCorrect ? '✓' : ''}</span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

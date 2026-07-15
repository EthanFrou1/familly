import Avatar from '../shared/Avatar'
import { ATTRIBUTE_COLUMNS } from '../../utils/dailyMystery'

const CELL_STYLES = {
  green: 'bg-green-500 text-white border-green-600/30',
  yellow: 'bg-primary text-white border-primary-dark/40',
  gray: 'bg-stone-100 text-gray-400 border-stone-300',
}

const ARROWS = { up: '↑', down: '↓' }
const NAME_COL_WIDTH = 64

export default function DailyMysteryGrid({ rows, showBranchColumn }) {
  const columns = ATTRIBUTE_COLUMNS.filter(c => c.key !== 'branch' || showBranchColumn)
  const gridTemplateColumns = `${NAME_COL_WIDTH}px repeat(${columns.length}, 1fr)`

  if (rows.length === 0) {
    return (
      <p className="text-xs font-semibold text-gray-400 text-center py-6">
        Fais ta première proposition pour voir apparaître les indices.
      </p>
    )
  }

  return (
    <div className="max-h-[42vh] overflow-y-auto">
      <div
        className="sticky top-0 bg-surface z-10 pb-1.5"
        style={{ display: 'grid', gridTemplateColumns, gap: '4px' }}
      >
        <div />
        {columns.map(c => (
          <div key={c.key} className="text-center">
            <div className="text-base leading-none">{c.emoji}</div>
            <div className="text-[8px] font-semibold text-gray-400 leading-tight mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 pb-1">
        {rows.map(row => (
          <div
            key={row.memberId}
            className="items-center"
            style={{ display: 'grid', gridTemplateColumns, gap: '4px' }}
          >
            <div className="flex items-center gap-1 min-w-0">
              <Avatar src={row.profilePictureUrl} name={`${row.firstName} ${row.lastName}`} size="xs" />
              <span className="text-[10px] font-bold text-gray-700 truncate">{row.firstName}</span>
            </div>
            {columns.map(c => {
              const cell = row[c.key]
              if (!cell) return <div key={c.key} />
              const isBirthYear = c.key === 'birthYear'
              return (
                <div
                  key={c.key}
                  className={`h-9 rounded-lg border flex flex-col items-center justify-center leading-none ${
                    isBirthYear ? 'bg-stone-100 text-gray-600 border-stone-300' : CELL_STYLES[cell.status] ?? CELL_STYLES.gray
                  }`}
                >
                  {isBirthYear && cell.value ? (
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
    </div>
  )
}

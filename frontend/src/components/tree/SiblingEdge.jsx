import { EdgeLabelRenderer } from '@xyflow/react'

export function SpouseEdge({ id, sourceX, sourceY, targetX, targetY, style, data }) {
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const borderColor = data?.borderColor || '#F9A8D4'
  const textColor = data?.textColor || '#F472B6'

  return (
    <>
      <path id={id} d={`M ${sourceX} ${sourceY} L ${targetX} ${targetY}`} fill="none" style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
            pointerEvents: 'none',
          }}
          className="nodrag nopan"
        >
          <div style={{ background: '#fff', border: `1.5px solid ${borderColor}`, borderRadius: '9999px', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, boxShadow: '0 1px 4px 0 rgba(0,0,0,0.10)', color: textColor }}>
            {data?.icon}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const DROP = 18
const RADIUS = 6

export function SiblingEdge({ id, sourceX, sourceY, targetX, targetY, style }) {
  const y = Math.max(sourceY, targetY) + DROP
  const goRight = targetX > sourceX
  const dx = goRight ? RADIUS : -RADIUS

  const d = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${y - RADIUS}`,
    `Q ${sourceX} ${y} ${sourceX + dx} ${y}`,
    `L ${targetX - dx} ${y}`,
    `Q ${targetX} ${y} ${targetX} ${y - RADIUS}`,
    `L ${targetX} ${targetY}`,
  ].join(' ')

  return <path id={id} d={d} fill="none" style={style} />
}

// Top bracket — exits from top of card, rises a bit, goes horizontal, comes back down
const RISE = 16

export function SiblingArchEdge({ id, sourceX, sourceY, targetX, targetY, style }) {
  const topY = Math.min(sourceY, targetY) - RISE

  const d = [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${topY + RADIUS}`,
    `Q ${sourceX} ${topY} ${sourceX + RADIUS} ${topY}`,
    `L ${targetX - RADIUS} ${topY}`,
    `Q ${targetX} ${topY} ${targetX} ${topY + RADIUS}`,
    `L ${targetX} ${targetY}`,
  ].join(' ')

  return <path id={id} d={d} fill="none" style={style} />
}

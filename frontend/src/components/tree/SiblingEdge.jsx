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

import dagre from 'dagre'

const NODE_W = 160
const NODE_H = 70
const H_SEP = 50
const V_SEP = 80

export const FAMILY_PALETTE = [
  { bg: '#EDE9FE', border: '#534AB7', text: '#3730A3' },
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' },
  { bg: '#E0F2FE', border: '#0EA5E9', text: '#0C4A6E' },
  { bg: '#FFF7ED', border: '#F97316', text: '#9A3412' },
]

// Detect pairs of members who share a parent but have no explicit sibling relation
export function detectImplicitSiblings(members, relations) {
  const memberIds = new Set(members.map(m => m.id))
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  const parentToChildren = new Map()
  relations
    .filter(r => r.type === 'ParentChild' && memberIds.has(r.memberAId) && memberIds.has(r.memberBId))
    .forEach(r => {
      if (!parentToChildren.has(r.memberAId)) parentToChildren.set(r.memberAId, [])
      parentToChildren.get(r.memberAId).push(r.memberBId)
    })

  const existingSiblings = new Set()
  relations
    .filter(r => (r.type === 'Sibling' || r.type === 'HalfSibling') && memberIds.has(r.memberAId) && memberIds.has(r.memberBId))
    .forEach(r => {
      existingSiblings.add(`${r.memberAId}|${r.memberBId}`)
      existingSiblings.add(`${r.memberBId}|${r.memberAId}`)
    })

  const suggestions = []
  const seen = new Set()

  parentToChildren.forEach((children, parentId) => {
    if (children.length < 2) return
    const parent = memberMap[parentId]
    if (!parent) return

    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const a = children[i], b = children[j]
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        if (!existingSiblings.has(`${a}|${b}`) && !seen.has(key)) {
          seen.add(key)
          suggestions.push({ memberA: memberMap[a], memberB: memberMap[b], parent })
        }
      }
    }
  })

  return suggestions
}

export function buildFamilyColorMap(families) {
  const map = {}
  families.forEach((f, i) => { map[f.id] = FAMILY_PALETTE[i % FAMILY_PALETTE.length] })
  return map
}

export function buildTreeLayout(members, relations, colorMap) {
  if (!members.length) return { rfNodes: [], rfEdges: [] }

  const memberIds = new Set(members.map(m => m.id))
  const valid = r => memberIds.has(r.memberAId) && memberIds.has(r.memberBId)

  const pcRelations  = relations.filter(r => r.type === 'ParentChild'  && valid(r))
  const spRelations  = relations.filter(r => r.type === 'Spouse'        && valid(r))
  const sepRelations = relations.filter(r => r.type === 'Separated'     && valid(r))
  const sibRelations = relations.filter(r => r.type === 'Sibling'       && valid(r))
  const hsbRelations = relations.filter(r => r.type === 'HalfSibling'   && valid(r))

  // ── Build parent maps ──────────────────────────────────────────────────────
  const childToParents = new Map() // childId → Set<parentId>
  pcRelations.forEach(r => {
    if (!childToParents.has(r.memberBId)) childToParents.set(r.memberBId, new Set())
    childToParents.get(r.memberBId).add(r.memberAId)
  })

  // ── Sibling inference: give missing parents from sibling's known parents ───
  const inferredEdges = [] // { parentId, childId }
  ;[...sibRelations, ...hsbRelations].forEach(r => {
    const aParents = childToParents.get(r.memberAId) || new Set()
    const bParents = childToParents.get(r.memberBId) || new Set()

    if (aParents.size > 0 && bParents.size === 0) {
      aParents.forEach(parentId => {
        inferredEdges.push({ parentId, childId: r.memberBId })
        if (!childToParents.has(r.memberBId)) childToParents.set(r.memberBId, new Set())
        childToParents.get(r.memberBId).add(parentId)
      })
    } else if (bParents.size > 0 && aParents.size === 0) {
      bParents.forEach(parentId => {
        inferredEdges.push({ parentId, childId: r.memberAId })
        if (!childToParents.has(r.memberAId)) childToParents.set(r.memberAId, new Set())
        childToParents.get(r.memberAId).add(parentId)
      })
    }
  })

  // ── Dagre layout ───────────────────────────────────────────────────────────
  const g = new dagre.graphlib.Graph({ multigraph: false })
  g.setGraph({ rankdir: 'TB', nodesep: H_SEP, ranksep: V_SEP, marginx: 60, marginy: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  const sortedByAge = [...members].sort((a, b) => {
    if (!a.birthDate && !b.birthDate) return 0
    if (!a.birthDate) return 1
    if (!b.birthDate) return -1
    return new Date(a.birthDate) - new Date(b.birthDate)
  })
  sortedByAge.forEach(m => g.setNode(m.id, { width: NODE_W, height: NODE_H }))
  pcRelations.forEach(r => g.setEdge(r.memberAId, r.memberBId))
  inferredEdges.forEach(({ parentId, childId }) => {
    if (!g.hasEdge(parentId, childId)) g.setEdge(parentId, childId)
  })

  dagre.layout(g)

  // ── Reorder siblings: families grouped together, then oldest→left within each family ──
  // Dagre ignores node insertion order, so we post-process x positions.
  // Rule: keep siblings of the same family adjacent (using dagre's family avg-x as anchor),
  // then sort by birthDate within each family group.
  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
  const parentToChildIds = new Map()
  ;[
    ...pcRelations.map(r => ({ parentId: r.memberAId, childId: r.memberBId })),
    ...inferredEdges,
  ].forEach(({ parentId, childId }) => {
    if (!parentToChildIds.has(parentId)) parentToChildIds.set(parentId, new Set())
    parentToChildIds.get(parentId).add(childId)
  })

  const repositioned = new Set()
  parentToChildIds.forEach(childIdSet => {
    const childIds = [...childIdSet].filter(id => g.node(id) && !repositioned.has(id))
    if (childIds.length < 2) return

    // Compute each family's average x in this sibling group.
    // Pièce rapportée (no familyId) get a unique key so they act as a solo group.
    const famXSum = new Map(), famXCount = new Map()
    childIds.forEach(id => {
      const key = memberMap[id]?.familyId ?? `__solo_${id}`
      famXSum.set(key, (famXSum.get(key) ?? 0) + g.node(id).x)
      famXCount.set(key, (famXCount.get(key) ?? 0) + 1)
    })
    const famAvgX = key => (famXSum.get(key) ?? 0) / (famXCount.get(key) ?? 1)

    const sorted = [...childIds].sort((a, b) => {
      const ma = memberMap[a], mb = memberMap[b]
      const keyA = ma?.familyId ?? `__solo_${a}`
      const keyB = mb?.familyId ?? `__solo_${b}`

      // Primary: keep families grouped by their current x position in dagre
      const dFam = famAvgX(keyA) - famAvgX(keyB)
      if (Math.abs(dFam) > 1) return dFam

      // Secondary: within the same family, oldest first
      if (!ma?.birthDate && !mb?.birthDate) return 0
      if (!ma?.birthDate) return 1
      if (!mb?.birthDate) return -1
      return new Date(ma.birthDate) - new Date(mb.birthDate)
    })

    // Current x centres sorted ascending → these are the slots to fill
    const slots = childIds.map(id => g.node(id).x).sort((a, b) => a - b)

    sorted.forEach((id, i) => {
      g.node(id).x = slots[i]
      repositioned.add(id)
    })
  })
  // ──────────────────────────────────────────────────────────────────────────

  // Extract positions (dagre center → top-left)
  const positions = {}
  g.nodes().forEach(id => {
    const n = g.node(id)
    if (n) positions[id] = { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 }
  })

  // ── Fix isolated spouse nodes: insert next to partner, shifting all right nodes ──
  const dagreEdgeNodes = new Set()
  g.edges().forEach(e => { dagreEdgeNodes.add(e.v); dagreEdgeNodes.add(e.w) })

  spRelations.forEach(r => {
    const aIsolated = !dagreEdgeNodes.has(r.memberAId)
    const bIsolated = !dagreEdgeNodes.has(r.memberBId)

    let floatingId, anchorId
    if (aIsolated && !bIsolated) { floatingId = r.memberAId; anchorId = r.memberBId }
    else if (!aIsolated && bIsolated) { floatingId = r.memberBId; anchorId = r.memberAId }
    else return

    const anchor = positions[anchorId]
    if (!anchor) return

    const insertX = anchor.x + NODE_W + H_SEP
    const dx = NODE_W + H_SEP

    // Shift every node to the right of insertX, all rows, preserving internal spacing
    Object.entries(positions).forEach(([id, pos]) => {
      if (id !== floatingId && pos.x >= insertX - H_SEP / 2) {
        positions[id] = { ...pos, x: pos.x + dx }
      }
    })

    positions[floatingId] = { x: insertX, y: anchor.y }
  })

  // ── Y-align horizontal pairs (spouse + sibling) ───────────────────────────
  const alignY = (idA, idB) => {
    const posA = positions[idA]
    const posB = positions[idB]
    if (!posA || !posB) return
    const refY = Math.min(posA.y, posB.y)
    positions[idA] = { ...posA, y: refY }
    positions[idB] = { ...posB, y: refY }
  }
  spRelations.forEach(r => alignY(r.memberAId, r.memberBId))
  sibRelations.forEach(r => alignY(r.memberAId, r.memberBId))
  hsbRelations.forEach(r => alignY(r.memberAId, r.memberBId))

  // ── React Flow nodes ───────────────────────────────────────────────────────
  const rfNodes = members.map(m => ({
    id: m.id,
    type: 'person',
    position: positions[m.id] || { x: 0, y: 0 },
    data: { member: m, color: m.familyId ? (colorMap[m.familyId] || null) : null },
  }))

  // ── Helper: horizontal edge always goes left-node → right-node ────────────
  function horizEdge(id, idA, idB, extra) {
    const posA = positions[idA]
    const posB = positions[idB]
    const leftId  = (posA?.x ?? 0) <= (posB?.x ?? 0) ? idA : idB
    const rightId = leftId === idA ? idB : idA
    return { id, source: leftId, target: rightId, sourceHandle: 'right', targetHandle: 'left', type: 'straight', ...extra }
  }

  function archEdge(id, idA, idB, extra) {
    const posA = positions[idA]
    const posB = positions[idB]
    const leftId  = (posA?.x ?? 0) <= (posB?.x ?? 0) ? idA : idB
    const rightId = leftId === idA ? idB : idA
    return { id, source: leftId, target: rightId, sourceHandle: 'topSource', targetHandle: 'topTarget', type: 'siblingArch', ...extra }
  }

  // ── React Flow edges ───────────────────────────────────────────────────────
  const rfEdges = []

  // Parent → child (vertical)
  pcRelations.forEach(r => rfEdges.push({
    id: `pc-${r.id}`,
    source: r.memberAId,
    target: r.memberBId,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep',
    style: { stroke: '#9CA3AF', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#9CA3AF', width: 12, height: 12 },
  }))

  // Spouse (horizontal, pink)
  spRelations.forEach(r => rfEdges.push(horizEdge(`sp-${r.id}`, r.memberAId, r.memberBId, {
    style: { stroke: '#F472B6', strokeWidth: 2 },
    label: '♥',
    labelStyle: { fill: '#F472B6', fontSize: 11, fontWeight: 700 },
    labelBgStyle: { fill: 'transparent' },
  })))

  // Separated (horizontal, orange dashed)
  sepRelations.forEach(r => rfEdges.push(horizEdge(`sep-${r.id}`, r.memberAId, r.memberBId, {
    style: { stroke: '#FB923C', strokeWidth: 1.5, strokeDasharray: '6 4' },
    label: '÷',
    labelStyle: { fill: '#FB923C', fontSize: 13, fontWeight: 700 },
    labelBgStyle: { fill: 'transparent' },
  })))

  // Sibling edges — arc below nodes (bottom→bottom), adjacent pairs only to avoid arc overlap
  const siblingArc = (id, idA, idB, extra) => ({
    id,
    source: idA,
    target: idB,
    sourceHandle: 'bottom',
    targetHandle: 'bottomTarget',
    type: 'siblingBracket',
    ...extra,
  })

  const hasCommonVisibleParent = (idA, idB) => {
    const aParents = childToParents.get(idA) || new Set()
    const bParents = childToParents.get(idB) || new Set()
    return [...aParents].some(p => bParents.has(p) && memberIds.has(p))
  }

  // Check if a spouse node sits between idA and idB horizontally
  const spouseIds = new Set()
  spRelations.forEach(r => {
    spouseIds.add(`${r.memberAId}|${r.memberBId}`)
    spouseIds.add(`${r.memberBId}|${r.memberAId}`)
  })
  const hasSpouseBetween = (idA, idB) => {
    const xA = (positions[idA]?.x ?? 0) + NODE_W / 2
    const xB = (positions[idB]?.x ?? 0) + NODE_W / 2
    const lo = Math.min(xA, xB), hi = Math.max(xA, xB)
    return members.some(m => {
      const mx = (positions[m.id]?.x ?? 0) + NODE_W / 2
      return mx > lo && mx < hi && (spouseIds.has(`${m.id}|${idA}`) || spouseIds.has(`${m.id}|${idB}`))
    })
  }

  const drawAdjacentSiblings = (relations, idPrefix, style) => {
    if (!relations.length) return
    const adj = new Map()
    relations.forEach(r => {
      if (!adj.has(r.memberAId)) adj.set(r.memberAId, new Set())
      if (!adj.has(r.memberBId)) adj.set(r.memberBId, new Set())
      adj.get(r.memberAId).add(r.memberBId)
      adj.get(r.memberBId).add(r.memberAId)
    })
    const visited = new Set()
    relations.forEach(r => {
      for (const startId of [r.memberAId, r.memberBId]) {
        if (visited.has(startId)) continue
        const component = []
        const queue = [startId]
        while (queue.length) {
          const id = queue.shift()
          if (visited.has(id)) continue
          visited.add(id)
          component.push(id)
          adj.get(id)?.forEach(n => { if (!visited.has(n)) queue.push(n) })
        }
        component.sort((a, b) => (positions[a]?.x ?? 0) - (positions[b]?.x ?? 0))
        for (let i = 0; i < component.length - 1; i++) {
          const idA = component[i], idB = component[i + 1]
          if (hasCommonVisibleParent(idA, idB)) {
            if (!hasSpouseBetween(idA, idB))
              rfEdges.push(horizEdge(`${idPrefix}-${idA}-${idB}`, idA, idB, { style }))
            else
              rfEdges.push(archEdge(`${idPrefix}-${idA}-${idB}`, idA, idB, { style }))
          } else {
            rfEdges.push(siblingArc(`${idPrefix}-${idA}-${idB}`, idA, idB, { style }))
          }
        }
      }
    })
  }

  drawAdjacentSiblings(sibRelations, 'sib', { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: '6 3' })
  drawAdjacentSiblings(hsbRelations, 'hsb', { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: '2 5' })

  return { rfNodes, rfEdges }
}

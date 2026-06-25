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

  const pcRels  = relations.filter(r => r.type === 'ParentChild'  && valid(r))
  const spRels  = relations.filter(r => (r.type === 'Spouse' || r.type === 'Partner') && valid(r))
  const sepRels = relations.filter(r => r.type === 'Separated'    && valid(r))
  const sibRels = relations.filter(r => r.type === 'Sibling'      && valid(r))
  const hsbRels = relations.filter(r => r.type === 'HalfSibling'  && valid(r))

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
  const COUPLE_W  = 2 * NODE_W + H_SEP
  const MARGIN_X  = 60
  const MARGIN_Y  = 60

  const generationMap = {}

  // ── 1. Build parent / child maps ───────────────────────────────────────────
  const childToParents   = new Map() // childId → Set<parentId>
  const parentToChildren = new Map() // parentId → Set<childId>

  const addEdge = (parentId, childId) => {
    if (!childToParents.has(childId))   childToParents.set(childId, new Set())
    childToParents.get(childId).add(parentId)
    if (!parentToChildren.has(parentId)) parentToChildren.set(parentId, new Set())
    parentToChildren.get(parentId).add(childId)
  }

  pcRels.forEach(r => addEdge(r.memberAId, r.memberBId))

  // Infer parents from explicit sibling relations
  ;[...sibRels, ...hsbRels].forEach(r => {
    const aP = childToParents.get(r.memberAId) || new Set()
    const bP = childToParents.get(r.memberBId) || new Set()
    if (aP.size > 0 && bP.size === 0) aP.forEach(pid => addEdge(pid, r.memberBId))
    else if (bP.size > 0 && aP.size === 0) bP.forEach(pid => addEdge(pid, r.memberAId))
  })

  // ── 2. Build spouse map ────────────────────────────────────────────────────
  const spousesOf = new Map() // personId → personId[]
  ;[...spRels, ...sepRels].forEach(r => {
    if (!spousesOf.has(r.memberAId)) spousesOf.set(r.memberAId, [])
    if (!spousesOf.has(r.memberBId)) spousesOf.set(r.memberBId, [])
    if (!spousesOf.get(r.memberAId).includes(r.memberBId)) spousesOf.get(r.memberAId).push(r.memberBId)
    if (!spousesOf.get(r.memberBId).includes(r.memberAId)) spousesOf.get(r.memberBId).push(r.memberAId)
  })

  // ── 3. FamilySlot: core layout unit ───────────────────────────────────────
  // A slot = one couple (or single person) + their children's slots.
  // anchor = the biological child; spouse = their partner (may be null).
  // Children are sorted oldest → left before slot creation.

  const personToSlot  = new Map() // personId → the slot this person appears in
  const visitedPersons = new Set()

  const birthOf = id => memberMap[id]?.birthDate ? new Date(memberMap[id].birthDate) : null
  const cmpAge  = (a, b) => {
    const dA = birthOf(a), dB = birthOf(b)
    if (!dA && !dB) return 0
    if (!dA) return 1
    if (!dB) return -1
    return dA - dB
  }

  const makeSlot = (anchorId, generation) => {
    if (visitedPersons.has(anchorId)) return null
    visitedPersons.add(anchorId)
    generationMap[anchorId] = generation

    // Pick first unvisited spouse as co-anchor
    const spouse = (spousesOf.get(anchorId) || []).find(sid => !visitedPersons.has(sid)) ?? null
    if (spouse) { visitedPersons.add(spouse); generationMap[spouse] = generation }

    const adults = spouse ? [anchorId, spouse] : [anchorId]
    const slot   = {
      adults,
      childSlots:   [],
      subtreeWidth: 0,
      x: 0,
      y: MARGIN_Y + generation * (NODE_H + V_SEP),
    }
    adults.forEach(id => personToSlot.set(id, slot))

    // Collect all children of any adult in this slot, sorted oldest → left
    const childIds = new Set()
    adults.forEach(aid => (parentToChildren.get(aid) || new Set()).forEach(cid => childIds.add(cid)))

    ;[...childIds]
      .filter(cid => !visitedPersons.has(cid))
      .sort(cmpAge)
      .forEach(cid => {
        const cs = makeSlot(cid, generation + 1)
        if (cs) slot.childSlots.push(cs)
      })

    return slot
  }

  // ── 4. Find root anchors ───────────────────────────────────────────────────
  // Root = no parents visible in the tree.
  // In-law root = no parents AND spouse has parents → will be picked up inside makeSlot.

  const hasParents = id => (childToParents.get(id)?.size ?? 0) > 0
  const isInLaw    = id => !hasParents(id) && (spousesOf.get(id) || []).some(hasParents)

  const rootSeen = new Set()
  const rootAnchors = members
    .map(m => m.id)
    .filter(id => !hasParents(id) && !isInLaw(id))
    .sort(cmpAge) // oldest first → oldest sibling leftmost
    .filter(id => {
      if (rootSeen.has(id)) return false
      rootSeen.add(id)
      ;(spousesOf.get(id) || []).forEach(sid => rootSeen.add(sid))
      return true
    })

  const rootSlots = rootAnchors.map(id => makeSlot(id, 0)).filter(Boolean)

  // Catch any remaining unvisited members (fully disconnected nodes)
  members.forEach(m => {
    if (!visitedPersons.has(m.id)) {
      const s = makeSlot(m.id, 0)
      if (s) rootSlots.push(s)
    }
  })

  // ── 5. Bottom-up: compute subtree widths ───────────────────────────────────
  const calcWidth = slot => {
    const adultW = slot.adults.length >= 2 ? COUPLE_W : NODE_W
    if (!slot.childSlots.length) { slot.subtreeWidth = adultW; return adultW }
    slot.childSlots.forEach(calcWidth)
    const childrenW = slot.childSlots.reduce((s, cs) => s + cs.subtreeWidth, 0)
                    + Math.max(0, slot.childSlots.length - 1) * H_SEP
    slot.subtreeWidth = Math.max(adultW, childrenW)
    return slot.subtreeWidth
  }
  rootSlots.forEach(calcWidth)

  // ── 6. Top-down: assign (x, y) positions ──────────────────────────────────
  const positions = {}

  const assignPos = (slot, centerX) => {
    slot.x = centerX

    if (slot.adults.length === 1) {
      positions[slot.adults[0]] = { x: centerX - NODE_W / 2, y: slot.y }
    } else {
      // Older adult on the left
      const [a, b] = slot.adults
      const leftId  = cmpAge(a, b) <= 0 ? a : b
      const rightId = leftId === a ? b : a
      positions[leftId]  = { x: centerX - COUPLE_W / 2,                   y: slot.y }
      positions[rightId] = { x: centerX - COUPLE_W / 2 + NODE_W + H_SEP,  y: slot.y }
    }

    if (!slot.childSlots.length) return

    const childrenW = slot.childSlots.reduce((s, cs) => s + cs.subtreeWidth, 0)
                    + Math.max(0, slot.childSlots.length - 1) * H_SEP

    let cx = centerX - childrenW / 2
    slot.childSlots.forEach(cs => {
      assignPos(cs, cx + cs.subtreeWidth / 2)
      cx += cs.subtreeWidth + H_SEP
    })
  }

  let cx = MARGIN_X
  rootSlots.forEach(rs => {
    assignPos(rs, cx + rs.subtreeWidth / 2)
    cx += rs.subtreeWidth + H_SEP
  })

  // Fallback: any member still without a position (shouldn't happen)
  members.forEach(m => { if (!positions[m.id]) positions[m.id] = { x: 0, y: 0 } })

  // ── 7. React Flow nodes ────────────────────────────────────────────────────
  const rfNodes = members.map(m => ({
    id: m.id,
    type: 'person',
    position: positions[m.id],
    data: { member: m, color: m.familyId ? (colorMap[m.familyId] || null) : null },
  }))

  // ── 8. React Flow edges ────────────────────────────────────────────────────
  const horizEdge = (id, idA, idB, extra) => {
    const xA = positions[idA]?.x ?? 0, xB = positions[idB]?.x ?? 0
    const [l, r] = xA <= xB ? [idA, idB] : [idB, idA]
    return { id, source: l, target: r, sourceHandle: 'right', targetHandle: 'left', ...extra }
  }

  const archEdge = (id, idA, idB, extra) => {
    const xA = positions[idA]?.x ?? 0, xB = positions[idB]?.x ?? 0
    const [l, r] = xA <= xB ? [idA, idB] : [idB, idA]
    return { id, source: l, target: r, sourceHandle: 'topSource', targetHandle: 'topTarget', type: 'siblingArch', ...extra }
  }

  const rfEdges = []

  // Parent → child (vertical arrow)
  pcRels.forEach(r => rfEdges.push({
    id: `pc-${r.id}`,
    source: r.memberAId, target: r.memberBId,
    sourceHandle: 'bottom', targetHandle: 'top',
    type: 'smoothstep',
    style: { stroke: '#9CA3AF', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: '#9CA3AF', width: 12, height: 12 },
  }))

  // Spouse / Partner (horizontal, pink)
  spRels.forEach(r => rfEdges.push(horizEdge(`sp-${r.id}`, r.memberAId, r.memberBId, {
    type: 'spouse',
    style: { stroke: '#F472B6', strokeWidth: 2 },
    data: { icon: r.type === 'Spouse' ? '💍' : '♥' },
  })))

  // Separated (horizontal, orange dashed)
  sepRels.forEach(r => rfEdges.push(horizEdge(`sep-${r.id}`, r.memberAId, r.memberBId, {
    style: { stroke: '#FB923C', strokeWidth: 1.5, strokeDasharray: '6 4' },
    label: '💔', labelStyle: { fontSize: 13 }, labelBgStyle: { fill: 'transparent' },
  })))

  // Sibling edges — horizontal bracket between adjacent siblings
  const hasCommonParent = (a, b) => {
    const aP = childToParents.get(a) || new Set()
    const bP = childToParents.get(b) || new Set()
    return [...aP].some(p => bP.has(p) && memberIds.has(p))
  }

  const spousePairSet = new Set()
  ;[...spRels, ...sepRels].forEach(r => {
    spousePairSet.add(`${r.memberAId}|${r.memberBId}`)
    spousePairSet.add(`${r.memberBId}|${r.memberAId}`)
  })

  const spouseBetween = (a, b) => {
    const xA = (positions[a]?.x ?? 0) + NODE_W / 2
    const xB = (positions[b]?.x ?? 0) + NODE_W / 2
    const lo = Math.min(xA, xB), hi = Math.max(xA, xB)
    return members.some(m => {
      const mx = (positions[m.id]?.x ?? 0) + NODE_W / 2
      return mx > lo && mx < hi &&
        (spousePairSet.has(`${m.id}|${a}`) || spousePairSet.has(`${m.id}|${b}`))
    })
  }

  const drawSiblingEdges = (rels, prefix, style) => {
    if (!rels.length) return
    const adj = new Map()
    rels.forEach(r => {
      if (!adj.has(r.memberAId)) adj.set(r.memberAId, new Set())
      if (!adj.has(r.memberBId)) adj.set(r.memberBId, new Set())
      adj.get(r.memberAId).add(r.memberBId)
      adj.get(r.memberBId).add(r.memberAId)
    })
    const seen = new Set()
    rels.forEach(r => {
      for (const start of [r.memberAId, r.memberBId]) {
        if (seen.has(start)) continue
        const comp = []
        const q = [start]
        while (q.length) {
          const id = q.shift()
          if (seen.has(id)) continue
          seen.add(id); comp.push(id)
          adj.get(id)?.forEach(n => { if (!seen.has(n)) q.push(n) })
        }
        comp.sort((a, b) => (positions[a]?.x ?? 0) - (positions[b]?.x ?? 0))
        for (let i = 0; i < comp.length - 1; i++) {
          const [a, b] = [comp[i], comp[i + 1]]
          if (hasCommonParent(a, b)) {
            rfEdges.push(spouseBetween(a, b)
              ? archEdge(`${prefix}-${a}-${b}`, a, b, { style })
              : horizEdge(`${prefix}-${a}-${b}`, a, b, { style }))
          } else {
            rfEdges.push({
              id: `${prefix}-${a}-${b}`, source: a, target: b,
              sourceHandle: 'bottom', targetHandle: 'bottomTarget',
              type: 'siblingBracket', style,
            })
          }
        }
      }
    })
  }

  drawSiblingEdges(sibRels, 'sib', { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: '6 3' })
  drawSiblingEdges(hsbRels, 'hsb', { stroke: '#9CA3AF', strokeWidth: 1.5, strokeDasharray: '2 5' })

  return { rfNodes, rfEdges, generationMap }
}

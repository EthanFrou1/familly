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
  const TRIPLE_W  = 3 * NODE_W + 2 * H_SEP
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

  // ── 2. Build current-spouse / ex-spouse maps ──────────────────────────────
  const addPair = (map, aId, bId) => {
    if (!map.has(aId)) map.set(aId, [])
    if (!map.has(bId)) map.set(bId, [])
    if (!map.get(aId).includes(bId)) map.get(aId).push(bId)
    if (!map.get(bId).includes(aId)) map.get(bId).push(aId)
  }
  const currentSpousesOf = new Map() // Spouse / Partner → right side
  const exSpousesOf      = new Map() // Separated        → left side
  spRels.forEach(r => {
    // A deceased spouse is treated as an ex in layout so a widower who remarried
    // becomes a triple-slot anchor: [deceased | person | current]
    const aDeceased = memberMap[r.memberAId] && !memberMap[r.memberAId].isAlive
    const bDeceased = memberMap[r.memberBId] && !memberMap[r.memberBId].isAlive
    if (aDeceased || bDeceased) {
      addPair(exSpousesOf, r.memberAId, r.memberBId)
    } else {
      addPair(currentSpousesOf, r.memberAId, r.memberBId)
    }
  })
  sepRels.forEach(r => addPair(exSpousesOf,     r.memberAId, r.memberBId))
  // Union — used for isInLaw / rootSeen
  const spousesOf = new Map()
  ;[currentSpousesOf, exSpousesOf].forEach(src =>
    src.forEach((ids, id) => {
      if (!spousesOf.has(id)) spousesOf.set(id, [])
      ids.forEach(sid => { if (!spousesOf.get(id).includes(sid)) spousesOf.get(id).push(sid) })
    })
  )
  // People who have both a current and an ex spouse — must be the central anchor of a triple slot
  const hasExAndCurrent = id =>
    (currentSpousesOf.get(id)?.length > 0) && (exSpousesOf.get(id)?.length > 0)

  // ── 3. Triple-slot pre-computation ────────────────────────────────────────
  // A "triple-slot anchor" is someone who has BOTH a current partner AND an ex.
  // They must appear in the centre: [ex | anchor | current].
  // Their ex AND current are "reserved" — no other slot may claim them, even
  // if they have their own parents in the tree (the parent→child arrow will
  // simply be drawn as a long line to wherever they end up).

  const tripleSlotAnchors = new Set()
  const reservedForTriple = new Set() // ex-spouses + current spouses of anchors
  const memberToTripleAnchor = new Map() // reserved member → their anchor

  members.forEach(m => {
    if (hasExAndCurrent(m.id)) {
      tripleSlotAnchors.add(m.id)
      ;(currentSpousesOf.get(m.id) || []).forEach(sid => {
        reservedForTriple.add(sid)
        if (!memberToTripleAnchor.has(sid)) memberToTripleAnchor.set(sid, m.id)
      })
      ;(exSpousesOf.get(m.id) || []).forEach(sid => {
        reservedForTriple.add(sid)
        if (!memberToTripleAnchor.has(sid)) memberToTripleAnchor.set(sid, m.id)
      })
    }
  })

  // ── 4. FamilySlot: core layout unit ───────────────────────────────────────

  const personToSlot   = new Map()
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

    // If this person is reserved for a triple-slot (they are someone's current or ex spouse)
    // and their anchor hasn't been placed yet, delegate to the anchor so the full
    // [ex | anchor | current] slot is created at the correct generation.
    // This ensures e.g. Claire-Marie (child of Michel, partner of Franck) pulls Franck's
    // triple-slot down into Michel's subtree at the right generation.
    if (reservedForTriple.has(anchorId) && memberToTripleAnchor.has(anchorId)) {
      const anchor = memberToTripleAnchor.get(anchorId)
      if (!visitedPersons.has(anchor)) return makeSlot(anchor, generation)
      // Anchor already visited — this person was already claimed; skip
      return null
    }

    visitedPersons.add(anchorId)
    generationMap[anchorId] = generation

    let adults

    if (tripleSlotAnchors.has(anchorId)) {
      // ── Triple slot: [ex | anchor | current] ──────────────────────────────
      const currentSpouse = (currentSpousesOf.get(anchorId) || []).find(sid => !visitedPersons.has(sid)) ?? null
      if (currentSpouse) { visitedPersons.add(currentSpouse); generationMap[currentSpouse] = generation }

      const exSpouse = (exSpousesOf.get(anchorId) || []).find(sid => !visitedPersons.has(sid)) ?? null
      if (exSpouse) { visitedPersons.add(exSpouse); generationMap[exSpouse] = generation }

      // Fixed display order: ex on the left, anchor in the middle, current on the right
      adults = [exSpouse, anchorId, currentSpouse].filter(Boolean)
    } else {
      // ── Normal slot: single or couple ──────────────────────────────────────
      // Don't claim anyone who is reserved for a triple slot or is themselves
      // a triple-slot anchor (they will form their own slot when reached).
      const spouse = [...(currentSpousesOf.get(anchorId) || []), ...(exSpousesOf.get(anchorId) || [])]
        .find(sid => !visitedPersons.has(sid) && !reservedForTriple.has(sid) && !tripleSlotAnchors.has(sid)) ?? null
      if (spouse) { visitedPersons.add(spouse); generationMap[spouse] = generation }
      adults = spouse ? [anchorId, spouse] : [anchorId]
    }

    const slot = {
      adults,
      childSlots:   [],
      subtreeWidth: 0,
      x: 0,
      y: MARGIN_Y + generation * (NODE_H + V_SEP),
    }
    adults.forEach(id => personToSlot.set(id, slot))

    // Collect children
    const childIds = new Set()
    if (tripleSlotAnchors.has(anchorId)) {
      // For triple slot, only collect the anchor's own children to avoid
      // pulling in children of the ex/current from other relationships
      ;(parentToChildren.get(anchorId) || new Set()).forEach(cid => childIds.add(cid))
    } else {
      adults.forEach(aid => (parentToChildren.get(aid) || new Set()).forEach(cid => childIds.add(cid)))
    }

    ;[...childIds]
      // Allow reserved persons to be placed at their correct generation via their parents.
      // If they were already claimed by a triple-slot, visitedPersons prevents double-processing.
      .filter(cid => !visitedPersons.has(cid))
      .sort(cmpAge)
      .forEach(cid => {
        const cs = makeSlot(cid, generation + 1)
        if (cs) slot.childSlots.push(cs)
      })

    return slot
  }

  // ── 5. Find root anchors ───────────────────────────────────────────────────

  const hasParents = id => (childToParents.get(id)?.size ?? 0) > 0
  const isInLaw    = id => !hasParents(id) && (spousesOf.get(id) || []).some(hasParents)

  const rootSeen = new Set()
  const rootAnchors = members
    .map(m => m.id)
    // Reserved persons are placed by their triple-slot anchor, not as roots
    .filter(id => !hasParents(id) && !isInLaw(id) && !reservedForTriple.has(id))
    .sort(cmpAge) // oldest first → oldest sibling leftmost
    .filter(id => {
      if (rootSeen.has(id)) return false
      rootSeen.add(id)
      ;(spousesOf.get(id) || []).forEach(sid => rootSeen.add(sid))
      return true
    })

  const rootSlots = rootAnchors.map(id => makeSlot(id, 0)).filter(Boolean)

  // Catch any remaining unvisited members (disconnected or reserved but orphaned).
  // Process triple-slot anchors first so they can claim their reserved partners at the
  // correct generation before those reserved persons are processed independently.
  const fallbackOrder = [...members].sort((a, b) => {
    const scoreA = tripleSlotAnchors.has(a.id) ? 0 : (reservedForTriple.has(a.id) ? 2 : 1)
    const scoreB = tripleSlotAnchors.has(b.id) ? 0 : (reservedForTriple.has(b.id) ? 2 : 1)
    return scoreA - scoreB
  })
  fallbackOrder.forEach(m => {
    if (!visitedPersons.has(m.id)) {
      // Infer generation: from parents already placed, or from visited spouses (for in-laws / triple-slot anchors)
      const parents = [...(childToParents.get(m.id) || new Set())]
      const parentGens = parents.map(pid => generationMap[pid]).filter(g => g !== undefined)
      const allSpouses = spousesOf.get(m.id) || []
      const spouseGens = allSpouses.map(sid => generationMap[sid]).filter(g => g !== undefined)

      let gen = 0
      if (parentGens.length > 0) gen = Math.max(...parentGens) + 1
      else if (spouseGens.length > 0) gen = Math.max(...spouseGens)

      const s = makeSlot(m.id, gen)
      if (s) rootSlots.push(s)
    }
  })

  // ── 6. Bottom-up: compute subtree widths ───────────────────────────────────
  const calcWidth = slot => {
    const adultW = slot.adults.length >= 3 ? TRIPLE_W
                 : slot.adults.length >= 2 ? COUPLE_W
                 : NODE_W
    if (!slot.childSlots.length) { slot.subtreeWidth = adultW; return adultW }
    slot.childSlots.forEach(calcWidth)
    const childrenW = slot.childSlots.reduce((s, cs) => s + cs.subtreeWidth, 0)
                    + Math.max(0, slot.childSlots.length - 1) * H_SEP
    slot.subtreeWidth = Math.max(adultW, childrenW)
    return slot.subtreeWidth
  }
  rootSlots.forEach(calcWidth)

  // ── 7. Top-down: assign (x, y) positions ──────────────────────────────────
  const positions = {}

  const assignPos = (slot, centerX) => {
    slot.x = centerX

    if (slot.adults.length === 1) {
      positions[slot.adults[0]] = { x: centerX - NODE_W / 2, y: slot.y }
    } else if (slot.adults.length === 3) {
      // Fixed order: [ex, anchor, current] — anchor is always in the middle
      const [ex, anchor, current] = slot.adults
      positions[ex]      = { x: centerX - TRIPLE_W / 2,                      y: slot.y }
      positions[anchor]  = { x: centerX - TRIPLE_W / 2 + NODE_W + H_SEP,     y: slot.y }
      positions[current] = { x: centerX - TRIPLE_W / 2 + 2 * (NODE_W + H_SEP), y: slot.y }
    } else {
      // Couple: older adult on the left
      const [a, b] = slot.adults
      const leftId  = cmpAge(a, b) <= 0 ? a : b
      const rightId = leftId === a ? b : a
      positions[leftId]  = { x: centerX - COUPLE_W / 2,                  y: slot.y }
      positions[rightId] = { x: centerX - COUPLE_W / 2 + NODE_W + H_SEP, y: slot.y }
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
    type: 'spouse',
    style: { stroke: '#FB923C', strokeWidth: 1.5, strokeDasharray: '6 4' },
    data: { icon: '💔', borderColor: '#FB923C', textColor: '#FB923C' },
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

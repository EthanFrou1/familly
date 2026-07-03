// relationshipUtils.js
// Computes the family relationship label from one member's perspective to another.
// Relations: ParentChild (memberAId=parent, memberBId=child), Spouse, Sibling, HalfSibling, Separated

export function getRelationshipLabel(relations, members, fromMemberId, toMemberId) {
  if (!fromMemberId || !toMemberId) return null
  if (fromMemberId === toMemberId) return "C'est vous"

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
  const targetGender = memberMap[toMemberId]?.gender // 'M', 'F', or null/undefined

  // BFS: find shortest path
  const visited = new Set([fromMemberId])
  // Each queue item: { id, path: ['parent'|'child'|'spouse'|'sibling'|'halfSibling'|'separated'] }
  const queue = [{ id: fromMemberId, path: [] }]

  while (queue.length > 0) {
    const { id, path } = queue.shift()
    if (path.length >= 7) continue

    const adjacent = relations.filter(r => r.memberAId === id || r.memberBId === id)

    for (const rel of adjacent) {
      const isA = rel.memberAId === id
      const nextId = isA ? rel.memberBId : rel.memberAId

      if (visited.has(nextId)) continue

      let step
      if (rel.type === 'ParentChild') {
        // memberA is parent, memberB is child
        step = isA ? 'child' : 'parent'
      } else if (rel.type === 'Spouse') {
        step = 'spouse'
      } else if (rel.type === 'Sibling') {
        step = 'sibling'
      } else if (rel.type === 'HalfSibling') {
        step = 'halfSibling'
      } else if (rel.type === 'Separated') {
        step = 'separated'
      } else {
        continue
      }

      const newPath = [...path, step]

      if (nextId === toMemberId) {
        return translatePath(newPath, targetGender)
      }

      visited.add(nextId)
      queue.push({ id: nextId, path: newPath })
    }
  }

  // No path found — check same family as fallback
  const from = memberMap[fromMemberId]
  const to = memberMap[toMemberId]
  if (from?.familyId && to?.familyId && from.familyId === to.familyId) {
    return 'Membre de la même famille'
  }

  return 'Aucun lien familial connu'
}

function g(gender, male, female, neutral) {
  if (gender === 'M') return male
  if (gender === 'F') return female
  return neutral
}

function translatePath(path, targetGender) {
  const key = path.join('|')
  const gr = (m, f, n) => g(targetGender, m, f, n)

  switch (key) {
    // Direct
    case 'parent':       return gr('Votre père', 'Votre mère', 'Votre parent')
    case 'child':        return gr('Votre fils', 'Votre fille', 'Votre enfant')
    case 'spouse':       return gr('Votre époux', 'Votre épouse', 'Votre conjoint(e)')
    case 'separated':    return gr('Votre ex-époux', 'Votre ex-épouse', 'Votre ex-conjoint(e)')
    case 'sibling':      return gr('Votre frère', 'Votre sœur', 'Votre frère/sœur')
    case 'halfSibling':  return gr('Votre demi-frère', 'Votre demi-sœur', 'Votre demi-frère/sœur')

    // Grandparents
    case 'parent|parent': return gr('Votre grand-père', 'Votre grand-mère', 'Votre grand-parent')
    case 'child|child':   return gr('Votre petit-fils', 'Votre petite-fille', 'Votre petit-enfant')

    // Uncles, Aunts
    case 'parent|sibling':     return gr('Votre oncle', 'Votre tante', 'Votre oncle/tante')
    case 'parent|halfSibling': return gr('Votre demi-oncle', 'Votre demi-tante', 'Votre demi-oncle/tante')

    // Siblings via shared parent (BFS might find this path)
    case 'parent|child': return gr('Votre frère', 'Votre sœur', 'Votre frère/sœur')

    // Nephews / Nieces
    case 'sibling|child':     return gr('Votre neveu', 'Votre nièce', 'Votre neveu/nièce')
    case 'halfSibling|child': return gr('Votre neveu', 'Votre nièce', 'Votre neveu/nièce')

    // Great-grandparents
    case 'parent|parent|parent': return gr('Votre arrière-grand-père', 'Votre arrière-grand-mère', 'Votre arrière-grand-parent')
    case 'child|child|child':    return gr('Votre arrière-petit-fils', 'Votre arrière-petite-fille', 'Votre arrière-petit-enfant')

    // Great uncles/aunts
    case 'parent|parent|sibling':     return gr('Votre grand-oncle', 'Votre grand-tante', 'Votre grand-oncle/tante')
    case 'parent|parent|halfSibling': return gr('Votre grand-oncle', 'Votre grand-tante', 'Votre grand-oncle/tante')

    // Cousins (parent's sibling's child)
    case 'parent|sibling|child':     return gr('Votre cousin', 'Votre cousine', 'Votre cousin(e)')
    case 'parent|halfSibling|child': return gr('Votre cousin', 'Votre cousine', 'Votre cousin(e)')

    // In-laws
    case 'spouse|parent':    return gr('Votre beau-père', 'Votre belle-mère', 'Votre beau-parent')
    case 'parent|spouse':    return gr('Votre beau-père', 'Votre belle-mère', 'Votre beau-parent')
    case 'spouse|sibling':   return gr('Votre beau-frère', 'Votre belle-sœur', 'Votre beau-frère/sœur')
    case 'sibling|spouse':   return gr('Votre beau-frère', 'Votre belle-sœur', 'Votre beau-frère/sœur')
    case 'child|spouse':     return gr('Votre gendre', 'Votre belle-fille', 'Votre gendre/belle-fille')
    case 'spouse|child':     return gr('Votre beau-fils', 'Votre belle-fille', 'Votre beau-fils/fille')

    // Second cousins
    case 'parent|parent|sibling|child':
    case 'parent|parent|halfSibling|child':
      return gr('Votre cousin éloigné', 'Votre cousine éloignée', 'Votre cousin(e) éloigné(e)')

    case 'parent|sibling|child|child':
    case 'parent|halfSibling|child|child':
      return gr('Votre cousin éloigné', 'Votre cousine éloignée', 'Votre cousin(e) éloigné(e)')

    case 'parent|parent|child':
      return gr('Votre oncle', 'Votre tante', 'Votre oncle/tante')

    case 'parent|parent|child|child':
      return gr('Votre cousin(e)', 'Votre cousine', 'Votre cousin(e)')

    default:
      if (path.length <= 6) return 'Lien familial éloigné'
      return 'Membre de la famille'
  }
}

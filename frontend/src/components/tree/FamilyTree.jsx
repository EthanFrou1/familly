import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import PersonNode from './PersonNode'
import { SiblingEdge, SiblingArchEdge } from './SiblingEdge'
import { buildTreeLayout, buildFamilyColorMap } from './treeLayout'

const nodeTypes = { person: PersonNode }
const edgeTypes = { siblingBracket: SiblingEdge, siblingArch: SiblingArchEdge }

export default function FamilyTree({ members, relations, families, onNodeClick }) {
  const colorMap = useMemo(() => buildFamilyColorMap(families), [families])

  const { rfNodes: nodes, rfEdges: edges } = useMemo(
    () => buildTreeLayout(members, relations, colorMap),
    [members, relations, colorMap]
  )

  if (!members.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">Aucun membre à afficher.</p>
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => onNodeClick(node.data.member)}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
      minZoom={0.15}
      maxZoom={2.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll={false}
      zoomOnPinch
    >
      <Background color="#E5E7EB" gap={24} size={1} />
      <Controls
        showInteractive={false}
        position="bottom-right"
        style={{ bottom: '108px', right: '16px' }}
      />
      <MiniMap
        nodeColor={n => n.data?.color?.border || '#D1D5DB'}
        position="bottom-right"
        style={{ bottom: '20px', right: '16px', width: 120, height: 80 }}
        pannable
        zoomable
      />
    </ReactFlow>
  )
}

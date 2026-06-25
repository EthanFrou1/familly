import { useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  Panel,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import PersonNode from './PersonNode'
import { SiblingEdge, SiblingArchEdge, SpouseEdge } from './SiblingEdge'
import { buildTreeLayout, buildFamilyColorMap } from './treeLayout'

const nodeTypes = { person: PersonNode }
const edgeTypes = { siblingBracket: SiblingEdge, siblingArch: SiblingArchEdge, spouse: SpouseEdge }

function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  return (
    <Panel position="bottom-right" style={{ bottom: 16, right: 0 }}>
      <div className="flex flex-col bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100 text-lg font-bold"
          title="Zoom avant"
        >
          +
        </button>
        <div className="h-px bg-gray-100" />
        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="h-9 w-9 flex items-center justify-center text-gray-600 hover:bg-gray-50 active:bg-gray-100 text-lg font-bold"
          title="Zoom arrière"
        >
          −
        </button>
        <div className="h-px bg-gray-100" />
        <button
          onClick={() => fitView({ duration: 300, padding: 0.25 })}
          className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-50 active:bg-gray-100"
          title="Centrer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2" />
          </svg>
        </button>
      </div>
    </Panel>
  )
}

export default function FamilyTree({ members, relations, families, currentMemberId, onNodeClick, highlightGeneration, onGenerationMap }) {
  const colorMap = useMemo(() => buildFamilyColorMap(families), [families])

  const { rfNodes: rawNodes, rfEdges: edges, generationMap } = useMemo(
    () => buildTreeLayout(members, relations, colorMap),
    [members, relations, colorMap]
  )

  useEffect(() => {
    onGenerationMap?.(generationMap)
  }, [generationMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo(
    () => rawNodes.map(n => {
      const gen = generationMap[n.id] ?? 0
      const dimmed = highlightGeneration != null && gen !== highlightGeneration
      return {
        ...n,
        data: { ...n.data, isCurrentUser: n.data.member.id === currentMemberId },
        style: dimmed ? { opacity: 0.15, transition: 'opacity 0.2s' } : { transition: 'opacity 0.2s' },
      }
    }),
    [rawNodes, currentMemberId, generationMap, highlightGeneration]
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
      <MiniMap
        nodeColor={n => n.data?.color?.border || '#D1D5DB'}
        position="bottom-right"
        style={{ bottom: 16, right: 50, width: 110, height: 70 }}
        pannable
        zoomable
      />
      <ZoomControls />
    </ReactFlow>
  )
}

// =============================================================
// ModuleEditorCanvas.tsx — 블루프린트 메인 캔버스
// =============================================================

import { useCallback, useRef, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useModuleStore } from '../../store/useModuleStore'
import { BlueprintNode } from './BlueprintNode'
import { ModuleSidebar } from './ModuleSidebar'
import {
  GRAPH_TAB_LABELS,
  NODE_CATALOG,
  PIN_COLORS,
  type GraphTab,
  type PinDataType,
} from '../../types/blueprint'

// ─── nodeTypes (컴포넌트 외부에 정의하여 re-render 방지) ──────
const nodeTypes: NodeTypes = {
  blueprint: BlueprintNode,
}

// ─── 핀 메타 추출 헬퍼 ───────────────────────────────────────
function getPinMeta(handleId: string): { pinType: 'exec' | 'data'; dataType: PinDataType } | null {
  const parts = handleId.split('__')
  if (parts.length < 2) return null
  const pinId = parts[parts.length - 1]

  for (const nodeDef of NODE_CATALOG) {
    const pin = nodeDef.pins.find(p => p.id === pinId)
    if (pin) {
      return { pinType: pin.pinType, dataType: pin.dataType ?? 'exec' }
    }
  }
  return null
}

const TABS: GraphTab[] = [
  'command', 'view', 'view:show', 'view:hide',
  'view:onUpdate', 'view:onCleanup', 'boot',
]

interface ModuleEditorCanvasProps {
  content: string
  onChange: (val: string) => void
}

function ModuleEditorInner({ content, onChange }: ModuleEditorCanvasProps) {
  const {
    activeTab,
    setActiveTab,
    graphs,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    deleteSelectedNode,
    loadData,
  } = useModuleStore()

  const { screenToFlowPosition } = useReactFlow()

  const currentGraph = graphs[activeTab]
  const nodes = currentGraph.nodes
  const edges = currentGraph.edges

  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // ─── 파일 -> 스토어 단방향 동기화 (마운트 및 외부 로드 시) ──────
  useEffect(() => {
    if (!content) return
    try {
      const parsed = JSON.parse(content)
      if (parsed.graphs && parsed.activeTab) {
        const currentData = {
          activeTab: useModuleStore.getState().activeTab,
          graphs: useModuleStore.getState().graphs,
        }
        if (JSON.stringify(currentData) !== JSON.stringify(parsed)) {
          loadData(parsed)
        }
      }
    } catch (e) {
      // 파싱 실패 시 초기 빈 상태 유지
    }
  }, [content, loadData])

  // ─── 스토어 -> 파일 저장 동기화 ─────────────────────────────
  useEffect(() => {
    const serialized = JSON.stringify({ activeTab, graphs }, null, 2)
    if (serialized !== content) {
      onChange(serialized)
    }
  }, [activeTab, graphs, content, onChange])

  // ─── 연결 검증 ─────────────────────────────────────────────
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (!connection.sourceHandle || !connection.targetHandle) return false

    const sourceMeta = getPinMeta(connection.sourceHandle)
    const targetMeta = getPinMeta(connection.targetHandle)
    if (!sourceMeta || !targetMeta) return false

    if (sourceMeta.pinType !== targetMeta.pinType) return false

    if (sourceMeta.pinType === 'data') {
      if (sourceMeta.dataType !== 'any' && targetMeta.dataType !== 'any') {
        if (sourceMeta.dataType !== targetMeta.dataType) return false
      }
    }

    if (connection.source === connection.target) return false

    return true
  }, [])

  const handleConnect = useCallback((connection: Connection) => {
    const edgeStyle = {
      stroke: (() => {
        if (!connection.sourceHandle) return '#666'
        const meta = getPinMeta(connection.sourceHandle)
        if (!meta) return '#666'
        return PIN_COLORS[meta.dataType]
      })(),
      strokeWidth: 2,
    }
    onConnect(connection, edgeStyle)
  }, [onConnect])

  // ─── 키보드 단축키 (Delete키로 노드 삭제) ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        deleteSelectedNode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelectedNode])

  // ─── 드래그 앤 드롭 ────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const nodeType = e.dataTransfer.getData('application/blueprint-node')
    if (!nodeType) return

    const position = screenToFlowPosition({
      x: e.clientX,
      y: e.clientY
    })

    position.x -= 90
    position.y -= 20

    addNode(nodeType, position)
  }, [addNode, screenToFlowPosition])

  // ─── 노드 선택 ────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id)
  }, [setSelectedNodeId])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const defaultEdgeOptions = useMemo(() => ({
    style: { strokeWidth: 2 },
  }), [])

  return (
    <div className="flex h-full w-full bg-[#0d0d0d]">
      {/* Sidebar */}
      <ModuleSidebar onAddNode={addNode} />

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="flex bg-[#141414] border-b border-surface-800 shrink-0 overflow-x-auto custom-scrollbar">
          {TABS.map(tab => {
            const isActive = tab === activeTab
            const isViewSub = tab.startsWith('view:')

            return (
              <button
                key={tab}
                className={`px-3 py-1.5 text-[11px] font-medium border-r border-surface-800/50 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-surface-800 text-primary-400 border-b-2 border-b-primary-500'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/30 border-b-2 border-b-transparent'
                } ${isViewSub ? 'pl-5' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {isViewSub && <span className="text-surface-600 mr-1">└</span>}
                {GRAPH_TAB_LABELS[tab]}
              </button>
            )
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            snapToGrid
            snapGrid={[16, 16]}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode="Delete"
            style={{ background: '#0d0d0d' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#1a1a2e"
            />
            <Controls
              className="!bg-surface-900 !border-surface-700 !shadow-xl"
            />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(n) => {
                const nodeType = n.data?.nodeType as string
                const cat = NODE_CATALOG.find(c => c.type === nodeType)
                if (!cat) return '#333'
                const catColors: Record<string, string> = {
                  event: '#dc2626',
                  condition: '#16a34a',
                  action: '#2563eb',
                  data: '#ca8a04',
                }
                return catColors[cat.category] ?? '#333'
              }}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: '#0d0d0d' }}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

export function ModuleEditorCanvas(props: ModuleEditorCanvasProps) {
  return (
    <ReactFlowProvider>
      <ModuleEditorInner {...props} />
    </ReactFlowProvider>
  )
}

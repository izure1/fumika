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
import { ModuleInspector } from './ModuleInspector'
import {
  GRAPH_TAB_LABELS,
  NODE_CATALOG,
  PIN_COLORS,
  LEVIAR_STYLE_PROPERTIES,
  type GraphTab,
  type PinDataType,
} from '../../types/blueprint'

// ─── nodeTypes (컴포넌트 외부에 정의하여 re-render 방지) ──────
const nodeTypes: NodeTypes = {
  blueprint: BlueprintNode,
}

// ─── 핀 메타 추출 헬퍼 ───────────────────────────────────────
function getPinMeta(handleId: string): { pinType: 'exec' | 'data'; dataType: PinDataType } | null {
  const lastIndex = handleId.lastIndexOf('__')
  if (lastIndex === -1) return null
  const nodeId = handleId.substring(0, lastIndex)
  const pinId = handleId.substring(lastIndex + 2)

  if (pinId.startsWith('prop__')) {
    const key = pinId.substring(6)
    const spec = LEVIAR_STYLE_PROPERTIES.find(p => p.key === key)
    if (spec) {
      const typeMap: Record<string, PinDataType> = {
        number: 'number',
        boolean: 'boolean'
      }
      return { pinType: 'data', dataType: typeMap[spec.type] ?? 'string' }
    }
  }

  const store = useModuleStore.getState()
  const activeTab = store.activeTab
  const graph = store.graphs[activeTab]
  const node = graph?.nodes.find(n => n.id === nodeId)
  const nodeType = node?.data.nodeType as string | undefined

  if (nodeType) {
    if (nodeType === 'SetState' && node?.data) {
      const fields = (node.data.fields as string[]) || []
      if (fields.includes(pinId)) {
        return { pinType: 'data', dataType: 'any' }
      }
    }
    const nodeDef = NODE_CATALOG.find(n => n.type === nodeType)
    if (nodeDef) {
      const pin = nodeDef.pins.find(p => p.id === pinId)
      if (pin) {
        return { pinType: pin.pinType, dataType: pin.dataType ?? 'exec' }
      }
    }
  }

  for (const nodeDef of NODE_CATALOG) {
    const pin = nodeDef.pins.find(p => p.id === pinId)
    if (pin) {
      return { pinType: pin.pinType, dataType: pin.dataType ?? 'exec' }
    }
  }
  return null
}

const TABS: GraphTab[] = [
  'command', 'view', 'boot',
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
    definitions,
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
  const isMounted = useRef(false)
  const skipNextSave = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // ─── 파일 -> 스토어 단방향 동기화 (마운트 시 1회) ──────────────
  useEffect(() => {
    if (!content) {
      isMounted.current = true
      return
    }
    try {
      const parsed = JSON.parse(content)
      if (parsed.graphs && parsed.activeTab) {
        skipNextSave.current = true
        loadData(parsed)
      }
    } catch {
      // 파싱 실패 시 초기 빈 상태 유지
    }
    isMounted.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 언마운트 시 저장 중단 ─────────────────────────────────
  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  // ─── 스토어 -> 파일 저장 동기화 ─────────────────────────────
  useEffect(() => {
    if (!isMounted.current) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    const serialized = JSON.stringify({ activeTab, graphs, definitions }, null, 2)
    onChangeRef.current(serialized)
    // onChange를 ref로 안정화했으므로 deps에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, graphs, definitions])

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

            return (
              <button
                key={tab}
                className={`px-3 py-1.5 text-[11px] font-medium border-r border-surface-800/50 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-surface-800 text-primary-400 border-b-2 border-b-primary-500'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/30 border-b-2 border-b-transparent'
                }`}
                onClick={() => setActiveTab(tab)}
              >
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

      {/* Inspector */}
      <ModuleInspector />
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

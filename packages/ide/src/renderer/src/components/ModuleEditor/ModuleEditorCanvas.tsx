// =============================================================
// ModuleEditorCanvas.tsx — 블루프린트 메인 캔버스
// =============================================================

import { useCallback, useRef, useMemo, useEffect, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  BackgroundVariant,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type NodeTypes,
  type Connection,
  type Node,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useModuleStore, getPinMetaInStore } from '../../store/useModuleStore'
import { BlueprintNode } from './BlueprintNode'
import { ModuleSidebar } from './ModuleSidebar'
import { ModuleInspector } from './ModuleInspector'
import {
  GRAPH_TAB_LABELS,
  NODE_CATALOG,
  PIN_COLORS,
  type GraphTab,
  type PinDataType,
  type ModuleDefinitions,
} from '../../types/blueprint'

// ─── nodeTypes (컴포넌트 외부에 정의하여 re-render 방지) ──────
const nodeTypes: NodeTypes = {
  blueprint: BlueprintNode,
}

// ─── BlueprintEdge (커스텀 엣지 컴포넌트) ─────────────────────
export function BlueprintEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  })

  const isInvalid = data?.isInvalid as boolean | undefined

  return (
    <>
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} />
      {isInvalid && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#ef4444',
              color: 'white',
              width: 16,
              height: 16,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              border: '2px solid #0d0d0d',
              pointerEvents: 'all',
              cursor: 'pointer',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            }}
            title="Type Mismatch! This connection is invalid."
          >
            ✕
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = {
  blueprint: BlueprintEdge,
}

// ─── 시맨틱 그래프 추출 및 정규화 헬퍼 ────────────────────────
interface SemanticNode {
  id: string
  type: string | undefined
  position: { x: number; y: number }
  data: Record<string, unknown>
}

interface SemanticEdge {
  id: string
  source: string
  sourceHandle: string | null | undefined
  target: string
  targetHandle: string | null | undefined
  style: Record<string, unknown> | undefined
}

function getSemanticGraphs(graphs: Record<string, { nodes: Node[]; edges: Edge[] } | undefined>) {
  const clean: Record<string, { nodes: SemanticNode[]; edges: SemanticEdge[] }> = {}
  for (const tab of Object.keys(graphs)) {
    const graph = graphs[tab]
    if (!graph) continue

    const nodes: SemanticNode[] = (graph.nodes || []).map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position ? { x: Math.round(n.position.x), y: Math.round(n.position.y) } : { x: 0, y: 0 },
      data: (n.data || {}) as Record<string, unknown>,
    }))

    const edges: SemanticEdge[] = (graph.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle,
      style: e.style as Record<string, unknown> | undefined,
    }))

    clean[tab] = { nodes, edges }
  }
  return clean
}

function getSemanticDefinitions(definitions: ModuleDefinitions | undefined): ModuleDefinitions {
  if (!definitions) {
    return {
      moduleName: '',
      schemaDef: [],
      commandDef: [],
      hookDef: [],
    }
  }
  return {
    moduleName: definitions.moduleName || '',
    schemaDef: definitions.schemaDef || [],
    commandDef: definitions.commandDef || [],
    hookDef: definitions.hookDef || [],
  }
}

// ─── 핀 메타 추출 헬퍼 ───────────────────────────────────────
function getPinMeta(handleId: string): { pinType: 'exec' | 'data'; dataType: PinDataType } | null {
  const index = handleId.indexOf('__')
  if (index === -1) return null
  const nodeId = handleId.substring(0, index)
  const pinId = handleId.substring(index + 2)

  const store = useModuleStore.getState()
  const activeTab = store.activeTab
  const graph = store.graphs[activeTab]
  if (!graph) return null

  const meta = getPinMetaInStore(nodeId, pinId, graph.nodes, store.definitions)
  if (!meta) return null
  return {
    pinType: meta.pinType,
    dataType: meta.dataType as PinDataType,
  }
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
    selectedNodeId,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    loadData,
  } = useModuleStore()

  const { screenToFlowPosition } = useReactFlow()

  const [isLoaded, setIsLoaded] = useState(false)

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
      setIsLoaded(true)
      isMounted.current = true
      return
    }
    try {
      const parsed = JSON.parse(content)
      if (parsed.graphs && parsed.activeTab) {
        skipNextSave.current = true
        loadData(parsed)
      }
    } catch (e) {
      // 파싱 실패 시 초기 빈 상태 유지
    }
    setIsLoaded(true)
    isMounted.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── 언마운트 시 저장 중단 ─────────────────────────────────
  useEffect(() => {
    return () => {
      isMounted.current = false
      setIsLoaded(false)
    }
  }, [])

  // ─── 스토어 -> 파일 저장 동기화 ─────────────────────────────
  useEffect(() => {
    if (!isLoaded || !isMounted.current) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    // ─── 핵심 데이터(graphs, definitions)의 실질적 변경 여부 검증 ───
    try {
      if (content) {
        const parsedOrigin = JSON.parse(content)
        
        const semanticOriginGraphs = getSemanticGraphs(parsedOrigin.graphs || {})
        const semanticCurrentGraphs = getSemanticGraphs(graphs)
        
        const semanticOriginDefs = getSemanticDefinitions(parsedOrigin.definitions)
        const semanticCurrentDefs = getSemanticDefinitions(definitions)
        
        const isGraphsEqual = JSON.stringify(semanticOriginGraphs) === JSON.stringify(semanticCurrentGraphs)
        const isDefsEqual = JSON.stringify(semanticOriginDefs) === JSON.stringify(semanticCurrentDefs)
        
        // 핵심 데이터가 원본과 완전히 같고 단순히 활성 탭(activeTab)만 바뀐 경우, 
        // 탭에 불필요한 Dirty 마킹이 남지 않도록 저장을 생략함!
        if (isGraphsEqual && isDefsEqual) {
          return
        }
      }
    } catch {
      // 파싱 실패 시 안전하게 직렬화 저장 흐름 수행
    }

    const serialized = JSON.stringify({ activeTab, graphs, definitions }, null, 2)
    if (serialized === content) {
      return
    }
    onChangeRef.current(serialized)
  }, [activeTab, graphs, definitions, content])

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
    const currentEdges = useModuleStore.getState().graphs[activeTab]?.edges || []
    const toRemoveIds = new Set<string>()

    if (connection.sourceHandle) {
      const meta = getPinMeta(connection.sourceHandle)
      if (meta && meta.pinType === 'exec') {
        const existingEdges = currentEdges.filter(
          (e) => e.source === connection.source && e.sourceHandle === connection.sourceHandle
        )
        existingEdges.forEach((e) => toRemoveIds.add(e.id))
      }
    }

    if (connection.targetHandle) {
      const meta = getPinMeta(connection.targetHandle)
      if (!meta || meta.pinType === 'data') {
        const existingEdges = currentEdges.filter(
          (e) => e.target === connection.target && e.targetHandle === connection.targetHandle
        )
        existingEdges.forEach((e) => toRemoveIds.add(e.id))
      }
    }

    if (toRemoveIds.size > 0) {
      const nextEdges = currentEdges.filter((e) => !toRemoveIds.has(e.id))
      useModuleStore.setState({
        graphs: {
          ...graphs,
          [activeTab]: {
            ...graphs[activeTab],
            edges: nextEdges,
          },
        },
      })
    }

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
  }, [onConnect, activeTab, graphs])

  const handleNodesDelete = useCallback((deletedNodes: Node[]) => {
    if (deletedNodes.some(n => n.id === selectedNodeId)) {
      setSelectedNodeId(null)
    }
  }, [selectedNodeId, setSelectedNodeId])

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

  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0d0d0d] h-full w-full">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-surface-400 font-medium">블루프린트 데이터를 불러오는 중...</p>
      </div>
    )
  }

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
            edgeTypes={edgeTypes}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodesDelete={handleNodesDelete}
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

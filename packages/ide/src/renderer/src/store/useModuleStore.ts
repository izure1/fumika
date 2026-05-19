// =============================================================
// useModuleStore.ts — 블루프린트 모듈 에디터 상태 관리
// =============================================================

import { create } from 'zustand'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rxAddEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import {
  NODE_CATALOG,
  type GraphTab,
} from '../types/blueprint'

interface GraphState {
  nodes: Node[]
  edges: Edge[]
}

interface ModuleStoreState {
  // ── 현재 활성 탭 ───────────────────────────────────────────
  activeTab: GraphTab

  // ── 각 탭별 그래프 데이터 ───────────────────────────────────
  graphs: Record<GraphTab, GraphState>

  // ── 선택된 노드 ID ─────────────────────────────────────────
  selectedNodeId: string | null

  // ── 액션 ───────────────────────────────────────────────────
  setActiveTab: (tab: GraphTab) => void
  setSelectedNodeId: (id: string | null) => void

  // ── React Flow 변경 액션 ────────────────────────────────────
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection, edgeStyle: { stroke: string; strokeWidth: number }) => void
  addNode: (nodeType: string, position?: { x: number; y: number }) => void
  deleteSelectedNode: () => void

  // ── 파일 로드 ──────────────────────────────────────────────
  loadData: (data: { activeTab: GraphTab; graphs: Record<GraphTab, GraphState> }) => void
}

const createEmptyGraph = (): GraphState => ({ nodes: [], edges: [] })

const ALL_TABS: GraphTab[] = [
  'command', 'view', 'view:show', 'view:hide',
  'view:onUpdate', 'view:onCleanup', 'boot',
]

export const useModuleStore = create<ModuleStoreState>((set) => ({
  activeTab: 'command',

  graphs: Object.fromEntries(
    ALL_TABS.map(tab => [tab, createEmptyGraph()])
  ) as Record<GraphTab, GraphState>,

  selectedNodeId: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  onNodesChange: (changes) => set((s) => {
    const tab = s.activeTab
    const currentGraph = s.graphs[tab]
    return {
      graphs: {
        ...s.graphs,
        [tab]: {
          ...currentGraph,
          nodes: applyNodeChanges(changes, currentGraph.nodes),
        },
      },
    }
  }),

  onEdgesChange: (changes) => set((s) => {
    const tab = s.activeTab
    const currentGraph = s.graphs[tab]
    return {
      graphs: {
        ...s.graphs,
        [tab]: {
          ...currentGraph,
          edges: applyEdgeChanges(changes, currentGraph.edges),
        },
      },
    }
  }),

  onConnect: (connection, edgeStyle) => set((s) => {
    const tab = s.activeTab
    const currentGraph = s.graphs[tab]
    const newEdges = rxAddEdge(
      { ...connection, animated: false, style: edgeStyle },
      currentGraph.edges
    )
    return {
      graphs: {
        ...s.graphs,
        [tab]: {
          ...currentGraph,
          edges: newEdges,
        },
      },
    }
  }),

  addNode: (nodeType, position) => set((s) => {
    const tab = s.activeTab
    const currentGraph = s.graphs[tab]
    const catalog = NODE_CATALOG.find(n => n.type === nodeType)
    if (!catalog) return {}

    const id = `${nodeType}_${Date.now()}`
    const pos = position ?? { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 }

    const newNode: Node = {
      id,
      type: 'blueprint',
      position: pos,
      data: { nodeType, label: catalog.label },
    }

    return {
      graphs: {
        ...s.graphs,
        [tab]: {
          ...currentGraph,
          nodes: [...currentGraph.nodes, newNode],
        },
      },
    }
  }),

  deleteSelectedNode: () => set((s) => {
    if (!s.selectedNodeId) return {}
    const tab = s.activeTab
    const currentGraph = s.graphs[tab]
    
    const nextNodes = currentGraph.nodes.filter(n => n.id !== s.selectedNodeId)
    const nextEdges = currentGraph.edges.filter(
      e => e.source !== s.selectedNodeId && e.target !== s.selectedNodeId
    )

    return {
      selectedNodeId: null,
      graphs: {
        ...s.graphs,
        [tab]: {
          nodes: nextNodes,
          edges: nextEdges,
        },
      },
    }
  }),

  loadData: (data) => set({
    activeTab: data.activeTab,
    graphs: data.graphs,
    selectedNodeId: null,
  }),
}))

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
  type ModuleDefinitions,
  type PropertyDef,
  type HookSignatureDef,
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

  // ── 모듈 정의 (Schema / Cmd / Hook) ─────────────────────────
  definitions: ModuleDefinitions

  // ── 액션 ───────────────────────────────────────────────────
  setActiveTab: (tab: GraphTab) => void
  setSelectedNodeId: (id: string | null) => void

  // ── 모듈 정의 CRUD ──────────────────────────────────────────
  setModuleName: (name: string) => void
  addSchemaDef: (field: PropertyDef) => void
  updateSchemaDef: (index: number, field: PropertyDef) => void
  removeSchemaDef: (index: number) => void
  addCommandDef: (field: PropertyDef) => void
  updateCommandDef: (index: number, field: PropertyDef) => void
  removeCommandDef: (index: number) => void
  addHookDef: (hook: HookSignatureDef) => void
  updateHookDef: (index: number, hook: HookSignatureDef) => void
  removeHookDef: (index: number) => void

  // ── React Flow 변경 액션 ────────────────────────────────────
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection, edgeStyle: { stroke: string; strokeWidth: number }) => void
  addNode: (nodeType: string, position?: { x: number; y: number }) => void
  deleteSelectedNode: () => void

  // ── 파일 로드 ──────────────────────────────────────────────
  loadData: (data: { activeTab: GraphTab; graphs: Record<GraphTab, GraphState>; definitions?: ModuleDefinitions }) => void
}

const createEmptyGraph = (): GraphState => ({ nodes: [], edges: [] })

const ALL_TABS: GraphTab[] = [
  'command', 'view', 'boot',
]

const createEmptyDefinitions = (): ModuleDefinitions => ({
  moduleName: '',
  schemaDef: [],
  commandDef: [],
  hookDef: [],
})

export const useModuleStore = create<ModuleStoreState>((set) => ({
  activeTab: 'command',

  graphs: Object.fromEntries(
    ALL_TABS.map(tab => [tab, createEmptyGraph()])
  ) as Record<GraphTab, GraphState>,

  selectedNodeId: null,

  definitions: createEmptyDefinitions(),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  // ── 모듈 정의 CRUD ──────────────────────────────────────────
  setModuleName: (name) => set((s) => ({
    definitions: { ...s.definitions, moduleName: name },
  })),

  addSchemaDef: (field) => set((s) => ({
    definitions: { ...s.definitions, schemaDef: [...s.definitions.schemaDef, field] },
  })),
  updateSchemaDef: (index, field) => set((s) => ({
    definitions: {
      ...s.definitions,
      schemaDef: s.definitions.schemaDef.map((f, i) => i === index ? field : f),
    },
  })),
  removeSchemaDef: (index) => set((s) => ({
    definitions: {
      ...s.definitions,
      schemaDef: s.definitions.schemaDef.filter((_, i) => i !== index),
    },
  })),

  addCommandDef: (field) => set((s) => ({
    definitions: { ...s.definitions, commandDef: [...s.definitions.commandDef, field] },
  })),
  updateCommandDef: (index, field) => set((s) => ({
    definitions: {
      ...s.definitions,
      commandDef: s.definitions.commandDef.map((f, i) => i === index ? field : f),
    },
  })),
  removeCommandDef: (index) => set((s) => ({
    definitions: {
      ...s.definitions,
      commandDef: s.definitions.commandDef.filter((_, i) => i !== index),
    },
  })),

  addHookDef: (hook) => set((s) => ({
    definitions: { ...s.definitions, hookDef: [...s.definitions.hookDef, hook] },
  })),
  updateHookDef: (index, hook) => set((s) => ({
    definitions: {
      ...s.definitions,
      hookDef: s.definitions.hookDef.map((h, i) => i === index ? hook : h),
    },
  })),
  removeHookDef: (index) => set((s) => ({
    definitions: {
      ...s.definitions,
      hookDef: s.definitions.hookDef.filter((_, i) => i !== index),
    },
  })),

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
    definitions: data.definitions ?? createEmptyDefinitions(),
    selectedNodeId: null,
  }),
}))

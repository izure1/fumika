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
  LEVIAR_STYLE_PROPERTIES,
  PIN_COLORS,
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
  updateNodeData: (nodeId: string, keyOrData: string | Record<string, unknown>, value?: unknown) => void

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

function inferPinDataType(val: unknown): string {
  if (val === undefined || val === null || val === '') return 'any'
  if (Array.isArray(val)) return 'array'
  if (typeof val === 'number') return 'number'
  if (typeof val === 'boolean') return 'boolean'
  if (typeof val === 'object') return 'object'
  if (typeof val === 'string') {
    if (val.trim() === '') return 'any'
    return 'string'
  }
  return 'any'
}

export function getPinMetaInStore(
  nodeId: string,
  pinId: string,
  nodes: Node[],
  definitions: ModuleDefinitions
): { pinType: 'exec' | 'data'; dataType: string } | null {
  const node = nodes.find(n => n.id === nodeId)
  const nodeType = node?.data?.nodeType as string | undefined
  if (!nodeType) return null

  if (pinId.startsWith('prop__')) {
    const key = pinId.substring(6)

    // ── MakeFunction: 우측 패널에서 등록한 { name, type }[] arguments 에서 타입 조회
    if (nodeType === 'MakeFunction' && node?.data?.arguments) {
      type ArgDef = { name: string; type: string }
      const argDefs = node.data.arguments as ArgDef[]
      const argDef = argDefs.find(a => a.name === key)
      if (argDef) {
        return { pinType: 'data', dataType: argDef.type }
      }
      // arguments에 정의되어 있지 않은 prop__는 any로 허용
      return { pinType: 'data', dataType: 'any' }
    }

    // ── MakeStyle: LEVIAR_STYLE_PROPERTIES 기반 타입 조회
    if (nodeType === 'MakeStyle') {
      const spec = LEVIAR_STYLE_PROPERTIES.find(p => p.key === key)
      if (spec) {
        const typeMap: Record<string, string> = { number: 'number', boolean: 'boolean' }
        return { pinType: 'data', dataType: typeMap[spec.type] ?? 'string' }
      }
      return { pinType: 'data', dataType: 'any' }
    }

    // ── MakeAttribute / Execute / 기타 동적 prop__ 핀: any로 허용
    return { pinType: 'data', dataType: 'any' }
  }

  if (nodeType === 'Constant' && pinId === 'value' && node?.data) {
    const val = node.data.value !== undefined ? node.data.value : node.data.inlineValue
    const dataType = inferPinDataType(val)
    return { pinType: 'data', dataType }
  }

  if ((nodeType === 'SetValue' || nodeType === 'SetConst' || nodeType === 'SetGlobal') && pinId === 'value' && node?.data) {
    const val = node.data.value
    const dataType = inferPinDataType(val)
    return { pinType: 'data', dataType }
  }



  if (nodeType === 'SetState' && node?.data) {
    const fields = (node.data.fields as string[]) || []
    if (fields.includes(pinId)) {
      const val = node.data[pinId]
      let dataType = 'string'
      const def = definitions.schemaDef.find(d => d.name === pinId)
      if (def) {
        dataType = def.type
      } else {
        if (typeof val === 'number') {
          dataType = 'number'
        } else if (typeof val === 'boolean') {
          dataType = 'boolean'
        } else if (typeof val === 'object' && val !== null) {
          dataType = 'object'
        }
      }
      return { pinType: 'data', dataType }
    }
  }

  if (nodeType === 'GetState' && pinId === 'value' && node?.data) {
    const fieldName = node.data.fieldName as string | undefined
    if (fieldName) {
      const def = definitions.schemaDef.find(d => d.name === fieldName)
      if (def) {
        return { pinType: 'data', dataType: def.type }
      }
    }
  }

  if (nodeType === 'GetCmd' && pinId === 'value' && node?.data) {
    const fieldName = node.data.fieldName as string | undefined
    if (fieldName) {
      const def = definitions.commandDef.find(d => d.name === fieldName)
      if (def) {
        return { pinType: 'data', dataType: def.type }
      }
    }
  }

  const nodeDef = NODE_CATALOG.find(n => n.type === nodeType)
  if (nodeDef) {
    const pin = nodeDef.pins.find(p => p.id === pinId)
    if (pin) {
      return { pinType: pin.pinType, dataType: pin.dataType ?? 'exec' }
    }
  }

  return null
}

function validateEdges(nodes: Node[], edges: Edge[], definitions: ModuleDefinitions): Edge[] {
  return edges.map(edge => {
    if (!edge.sourceHandle || !edge.targetHandle) {
      return {
        ...edge,
        type: 'blueprint',
        data: { isInvalid: true },
        style: { stroke: '#ef4444', strokeWidth: 2.5, strokeDasharray: '5,5' }
      }
    }

    const srcIndex = edge.sourceHandle.indexOf('__')
    const tgtIndex = edge.targetHandle.indexOf('__')
    if (srcIndex === -1 || tgtIndex === -1) {
      return {
        ...edge,
        type: 'blueprint',
        data: { isInvalid: true },
        style: { stroke: '#ef4444', strokeWidth: 2.5, strokeDasharray: '5,5' }
      }
    }

    const srcNodeId = edge.sourceHandle.substring(0, srcIndex)
    const srcPinId = edge.sourceHandle.substring(srcIndex + 2)
    const tgtNodeId = edge.targetHandle.substring(0, tgtIndex)
    const tgtPinId = edge.targetHandle.substring(tgtIndex + 2)

    const srcMeta = getPinMetaInStore(srcNodeId, srcPinId, nodes, definitions)
    const tgtMeta = getPinMetaInStore(tgtNodeId, tgtPinId, nodes, definitions)

    let isInvalid = false
    if (!srcMeta || !tgtMeta) {
      isInvalid = true
    } else if (srcMeta.pinType !== tgtMeta.pinType) {
      isInvalid = true
    } else if (srcMeta.pinType === 'data') {
      if (srcMeta.dataType !== 'any' && tgtMeta.dataType !== 'any') {
        if (srcMeta.dataType !== tgtMeta.dataType) {
          isInvalid = true
        }
      }
    }

    if (isInvalid) {
      return {
        ...edge,
        type: 'blueprint',
        data: { isInvalid: true },
        style: { stroke: '#ef4444', strokeWidth: 2.5, strokeDasharray: '5,5' }
      }
    }

    const dataType = srcMeta?.dataType
    const originalStroke = dataType ? PIN_COLORS[dataType] : '#3b82f6'
    return {
      ...edge,
      type: 'blueprint',
      data: { isInvalid: false },
      style: { stroke: originalStroke, strokeWidth: 2 }
    }
  })
}

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
  updateSchemaDef: (index, field) => set((s) => {
    const nextDefs = {
      ...s.definitions,
      schemaDef: s.definitions.schemaDef.map((f, i) => i === index ? field : f),
    }
    const nextGraphs = { ...s.graphs }
    for (const tab of ALL_TABS) {
      nextGraphs[tab] = {
        ...s.graphs[tab],
        edges: validateEdges(s.graphs[tab].nodes, s.graphs[tab].edges, nextDefs)
      }
    }
    return {
      definitions: nextDefs,
      graphs: nextGraphs
    }
  }),
  removeSchemaDef: (index) => set((s) => {
    const nextDefs = {
      ...s.definitions,
      schemaDef: s.definitions.schemaDef.filter((_, i) => i !== index),
    }
    const nextGraphs = { ...s.graphs }
    for (const tab of ALL_TABS) {
      nextGraphs[tab] = {
        ...s.graphs[tab],
        edges: validateEdges(s.graphs[tab].nodes, s.graphs[tab].edges, nextDefs)
      }
    }
    return {
      definitions: nextDefs,
      graphs: nextGraphs
    }
  }),

  addCommandDef: (field) => set((s) => ({
    definitions: { ...s.definitions, commandDef: [...s.definitions.commandDef, field] },
  })),
  updateCommandDef: (index, field) => set((s) => {
    const nextDefs = {
      ...s.definitions,
      commandDef: s.definitions.commandDef.map((f, i) => i === index ? field : f),
    }
    const nextGraphs = { ...s.graphs }
    for (const tab of ALL_TABS) {
      nextGraphs[tab] = {
        ...s.graphs[tab],
        edges: validateEdges(s.graphs[tab].nodes, s.graphs[tab].edges, nextDefs)
      }
    }
    return {
      definitions: nextDefs,
      graphs: nextGraphs
    }
  }),
  removeCommandDef: (index) => set((s) => {
    const nextDefs = {
      ...s.definitions,
      commandDef: s.definitions.commandDef.filter((_, i) => i !== index),
    }
    const nextGraphs = { ...s.graphs }
    for (const tab of ALL_TABS) {
      nextGraphs[tab] = {
        ...s.graphs[tab],
        edges: validateEdges(s.graphs[tab].nodes, s.graphs[tab].edges, nextDefs)
      }
    }
    return {
      definitions: nextDefs,
      graphs: nextGraphs
    }
  }),

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
      { ...connection, type: 'blueprint', animated: false, style: edgeStyle, data: { isInvalid: false } },
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

    // ─── 탭 허용 여부 체크 ─────────────────────────────────────
    if (catalog.allowedTabs && !catalog.allowedTabs.includes(tab)) {
      return {}
    }

    // ─── 싱글톤 체크 (그래프에 이미 동일 타입의 노드가 존재하는지) ─
    if (catalog.singleton) {
      const exists = currentGraph.nodes.some(n => n.data?.nodeType === nodeType)
      if (exists) {
        return {}
      }
    }

    const id = `${nodeType}_${Date.now()}`
    const pos = position ?? { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 }

    let initialData: Record<string, unknown> = {}
    if (nodeType === 'CreateRectangle' || nodeType === 'CreateEllipse') {
      initialData = {}
    } else if (nodeType === 'CreateImage') {
      initialData = { image: '' }
    } else if (nodeType === 'CreateText') {
      initialData = { text: 'Hello' }
    } else if (nodeType === 'MakeStyle') {
      initialData = {
        styleKeys: ['width', 'height', 'background'],
        width: 100,
        height: 100,
        background: '#3498db'
      }
    } else if (nodeType === 'Log') {
      initialData = { logLevel: 'log', message: '' }
    } else if (nodeType === 'FadeIn' || nodeType === 'FadeOut') {
      initialData = { duration: 1000 }
    } else if (nodeType === 'Constant') {
      initialData = { value: '' }
    } else if (nodeType === 'Compare') {
      initialData = { operator: '==', a: '', b: '' }
    } else if (nodeType === 'MathOp') {
      initialData = { operator: '+', a: 0, b: 0 }
    } else if (nodeType === 'Return') {
      initialData = { value: true }
    } else if (nodeType === 'BindEvent') {
      initialData = { eventType: 'click', handlerId: '' }
    } else if (nodeType === 'SetState') {
      initialData = { fields: [] }
    } else if (nodeType === 'SetVariable') {
      initialData = { scope: 'global', name: '', value: '' }
    } else if (nodeType === 'MakePosition') {
      initialData = { x: 0, y: 0, z: 0 }
    } else if (nodeType === 'Branch') {
      initialData = { condition: false }
    } else if (nodeType === 'NovelLoadSave') {
      initialData = { value: '' }
    } else if (nodeType === 'NovelLoadEnv') {
      initialData = { value: '' }
    } else if (nodeType === 'ToString' || nodeType === 'ToBoolean' || nodeType === 'ToNumber') {
      initialData = { value: '' }
    }

    const newNode: Node = {
      id,
      type: 'blueprint',
      position: pos,
      data: { nodeType, label: catalog.label, ...initialData },
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

  updateNodeData: (nodeId, keyOrData, value) => set((s) => {
    const tab = s.activeTab
    const graph = s.graphs[tab]
    const updatedNodes = graph.nodes.map(n => {
      if (n.id !== nodeId) return n
      const newData = typeof keyOrData === 'string'
        ? { ...n.data, [keyOrData]: value }
        : { ...n.data, ...keyOrData }
      return { ...n, data: newData }
    })
    
    const nextEdges = validateEdges(updatedNodes, graph.edges, s.definitions)

    return {
      graphs: {
        ...s.graphs,
        [tab]: {
          nodes: updatedNodes,
          edges: nextEdges,
        }
      }
    }
  }),

  loadData: (data) => set({
    activeTab: data.activeTab,
    graphs: data.graphs,
    definitions: data.definitions ?? createEmptyDefinitions(),
    selectedNodeId: null,
  }),
}))

// =============================================================
// ModuleInspector.tsx — 선택된 노드의 속성 편집 패널
// =============================================================

import React, { useCallback, useMemo } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { NODE_CATALOG, NODE_CATEGORY_COLORS, type NodeCategory, type PinDataType, LEVIAR_STYLE_PROPERTIES, LEVIAR_ATTRIBUTE_PROPERTIES, PIN_COLORS } from '../../types/blueprint'

// ─── 노드별 편집 가능 필드 룩업 테이블 ──────────────────────────

interface InspectorField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'typed'
  options?: { value: string, label: string }[]
  placeholder?: string
}

const NODE_INSPECTOR_FIELDS: Record<string, InspectorField[]> = {
  Constant: [
    { key: 'value', label: 'Constant Value', type: 'typed', placeholder: 'value' },
  ],
  Branch: [
    { key: 'condition', label: 'Condition', type: 'boolean' },
  ],
  Compare: [
    { key: 'operator', label: 'Operator', type: 'select', options: [
      { value: '==', label: '==' },
      { value: '!=', label: '!=' },
      { value: '>', label: '>' },
      { value: '<', label: '<' },
      { value: '>=', label: '>=' },
      { value: '<=', label: '<=' },
    ]},
    { key: 'a', label: 'A (Left)', type: 'typed', placeholder: 'value A' },
    { key: 'b', label: 'B (Right)', type: 'typed', placeholder: 'value B' },
  ],
  MathOp: [
    { key: 'operator', label: 'Operator', type: 'select', options: [
      { value: '+', label: '+' },
      { value: '-', label: '-' },
      { value: '*', label: '×' },
      { value: '/', label: '÷' },
      { value: '%', label: '%' },
    ]},
    { key: 'a', label: 'Operand A', type: 'number' },
    { key: 'b', label: 'Operand B', type: 'number' },
  ],
  GetState: [
    { key: 'fieldName', label: 'Field', type: 'text', placeholder: 'state field name' },
  ],
  GetCmd: [
    { key: 'fieldName', label: 'Property', type: 'text', placeholder: 'cmd property name' },
  ],
  GetVariable: [
    { key: 'scope', label: 'Scope', type: 'select', options: [
      { value: 'global', label: 'Global' },
      { value: 'local', label: 'Local (_)' },
      { value: 'env', label: 'Env ($)' },
    ]},
    { key: 'varName', label: 'Name', type: 'text', placeholder: 'variable name' },
  ],
  SetVariable: [
    { key: 'scope', label: 'Scope', type: 'select', options: [
      { value: 'global', label: 'Global' },
      { value: 'local', label: 'Local (_)' },
      { value: 'env', label: 'Env ($)' },
    ]},
    { key: 'name', label: 'Variable Name', type: 'text', placeholder: 'name' },
    { key: 'value', label: 'Variable Value', type: 'typed', placeholder: 'value' },
  ],
  SetConst: [
    { key: 'name', label: 'Const Name', type: 'text', placeholder: 'const variable name' },
    { key: 'value', label: 'Const Value', type: 'typed', placeholder: 'value' },
  ],
  GetConst: [
    { key: 'name', label: 'Const Name', type: 'text', placeholder: 'const variable name' },
  ],
  SetGlobal: [
    { key: 'name', label: 'Global Name', type: 'text', placeholder: 'global variable name' },
    { key: 'value', label: 'Global Value', type: 'typed', placeholder: 'value' },
  ],
  GetGlobal: [
    { key: 'name', label: 'Global Name', type: 'text', placeholder: 'global variable name' },
  ],
  SetState: [],
  BindEvent: [
    { key: 'eventType', label: 'Event', type: 'select', options: [
      { value: 'click', label: 'click' },
      { value: 'dblclick', label: 'dblclick' },
      { value: 'contextmenu', label: 'contextmenu' },
      { value: 'mousedown', label: 'mousedown' },
      { value: 'mouseup', label: 'mouseup' },
      { value: 'mousemove', label: 'mousemove' },
      { value: 'mouseover', label: 'mouseover' },
      { value: 'mouseout', label: 'mouseout' },
      { value: 'cssmodified', label: 'cssmodified' },
      { value: 'attrmodified', label: 'attrmodified' },
      { value: 'datamodified', label: 'datamodified' },
      { value: 'positionmodified', label: 'positionmodified' },
      { value: 'rotationmodified', label: 'rotationmodified' },
      { value: 'scalemodified', label: 'scalemodified' },
      { value: 'pivotmodified', label: 'pivotmodified' },
      { value: 'play', label: 'play' },
      { value: 'pause', label: 'pause' },
      { value: 'ended', label: 'ended' },
      { value: 'repeat', label: 'repeat' }
    ]},
  ],
  Log: [
    { key: 'logLevel', label: 'Level', type: 'select', options: [
      { value: 'log', label: 'log' },
      { value: 'warn', label: 'warn' },
      { value: 'error', label: 'error' },
    ]},
    { key: 'message', label: 'Message', type: 'text', placeholder: 'log message...' },
  ],
  Return: [
    { key: 'value', label: 'Return Value', type: 'boolean' },
  ],
  Yield: [
    { key: 'value', label: 'Value', type: 'boolean' },
  ],
  MakePosition: [
    { key: 'x', label: 'X Coordinate', type: 'number' },
    { key: 'y', label: 'Y Coordinate', type: 'number' },
    { key: 'z', label: 'Z Coordinate', type: 'number' },
  ],
  CreateRectangle: [],
  CreateEllipse: [],
  SetStyle: [],
  SetAttribute: [],
  CreateText: [
    { key: 'text', label: 'Text Content', type: 'text', placeholder: 'Enter text...' },
  ],
  CreateImage: [
    { key: 'image', label: 'Image Path', type: 'text', placeholder: 'e.g. assets/bg.png' },
  ],
  FadeIn: [
    { key: 'duration', label: 'Duration (ms)', type: 'number' },
  ],
  FadeOut: [
    { key: 'duration', label: 'Duration (ms)', type: 'number' },
  ],
  AddChild: [],
  GetCamera: [],
  RemoveChild: [],
  RemoveObject: [
    { key: 'child', label: 'Child', type: 'boolean' },
    { key: 'follower', label: 'Follower', type: 'boolean' },
  ],
  RemoveFromParent: [],
  HasClass: [],
  AddClass: [],
  RemoveClass: [],
  ApplyForce: [],
  SetVelocity: [],
  SetAngularVelocity: [],
  ApplyTorque: [],
  Follow: [],
  Unfollow: [],
  Kick: [],
  NovelSave: [
    { key: 'slot', label: 'Slot', type: 'number', placeholder: '0' },
  ],
  NovelLoadSave: [
    { key: 'slot', label: 'Slot', type: 'number', placeholder: '0' },
  ],
  NovelSaveEnv: [],
  NovelLoadEnv: [],
  GetArgument: [
    { key: 'index', label: 'Arg Index (0-indexed)', type: 'number', placeholder: '0' }
  ]
}

// ─── 스마트 타입 기입 컴포넌트 (TypedInput) ───────────────────
interface TypedInputProps {
  label?: string
  value: unknown
  onChange: (newValue: unknown) => void
  forceType?: 'string' | 'number' | 'boolean' | 'json' | 'array' | 'null'
}

function TypedInput({ label, value, onChange, forceType }: TypedInputProps): React.JSX.Element {
  let currentType: 'string' | 'number' | 'boolean' | 'json' | 'array' | 'null' = 'string'
  if (forceType) {
    currentType = forceType
  } else {
    if (typeof value === 'number') {
      currentType = 'number'
    } else if (typeof value === 'boolean') {
      currentType = 'boolean'
    } else if (value === null) {
      currentType = 'null'
    } else if (Array.isArray(value)) {
      currentType = 'array'
    } else if (typeof value === 'object' && value !== null) {
      currentType = 'json'
    }
  }

  const handleTypeChange = (newType: 'string' | 'number' | 'boolean' | 'json' | 'array' | 'null') => {
    if (newType === currentType) return

    if (newType === 'string') {
      onChange(String(value ?? ''))
    } else if (newType === 'number') {
      const num = Number(value)
      onChange(isNaN(num) ? 0 : num)
    } else if (newType === 'boolean') {
      onChange(Boolean(value))
    } else if (newType === 'json') {
      onChange({})
    } else if (newType === 'array') {
      onChange([])
    } else if (newType === 'null') {
      onChange(null)
    }
  }

  // Coercion helper for checkboxes
  const getCoercedBoolean = (val: unknown): boolean => {
    if (typeof val === 'boolean') return val
    if (typeof val === 'number') return val !== 0
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase()
      return lower === 'true' || lower === '1'
    }
    return !!val
  }

  // Coercion helper for JSON
  const getCoercedJsonString = (val: unknown): string => {
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val, null, 2)
    }
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return val
      }
    }
    return JSON.stringify(val)
  }

  // Coercion helper for Array
  const getCoercedArrayString = (val: unknown): string => {
    if (Array.isArray(val)) {
      return JSON.stringify(val, null, 2)
    }
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return val
      }
    }
    return '[]'
  }

  // Coercion helper for numbers
  const getCoercedNumber = (val: unknown): number => {
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }

  return (
    <div className="space-y-1 mt-1 p-1.5 rounded bg-surface-900/35 border border-surface-800/60">
      <div className="flex items-center justify-between gap-1.5">
        {label ? (
          <span className="text-[9px] text-surface-500 uppercase tracking-wider font-bold truncate">
            {label}
          </span>
        ) : <div />}
        {forceType ? (
          <span className="text-[8px] bg-primary-950/40 border border-primary-900/50 text-primary-400 px-1.5 py-0.5 rounded font-bold font-mono uppercase tracking-wider">
            {forceType}
          </span>
        ) : (
          <select
            className="bg-surface-900 border border-surface-750 rounded px-1 py-0.5 text-[9px] text-primary-400 font-medium outline-none cursor-pointer"
            value={currentType}
            onChange={(e) => handleTypeChange(e.target.value as 'string' | 'number' | 'boolean' | 'json' | 'array' | 'null')}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="json">JSON (Object)</option>
            <option value="array">Array</option>
            <option value="null">Null</option>
          </select>
        )}
      </div>

      <div className="mt-1">
        {currentType === 'number' && (
          <input
            type="number"
            className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
            value={getCoercedNumber(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}

        {currentType === 'boolean' && (
          <label className="flex items-center gap-1.5 cursor-pointer py-0.5">
            <input
              type="checkbox"
              className="accent-primary-500 cursor-pointer"
              checked={getCoercedBoolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-[9px] text-surface-400 font-mono select-none">
              {getCoercedBoolean(value) ? 'true' : 'false'}
            </span>
          </label>
        )}

        {currentType === 'json' && (
          <textarea
            className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[9px] text-white font-mono outline-none focus:border-primary-500/50 min-h-[40px] resize-y custom-scrollbar"
            value={getCoercedJsonString(value)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                onChange(parsed)
              } catch {
                // 타이핑 중의 임시 파싱 오류는 무시하고 상태 유실 방지
              }
            }}
            placeholder="{}"
          />
        )}

        {currentType === 'array' && (
          <textarea
            className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[9px] text-white font-mono outline-none focus:border-primary-500/50 min-h-[40px] resize-y custom-scrollbar"
            value={getCoercedArrayString(value)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                if (Array.isArray(parsed)) {
                  onChange(parsed)
                }
              } catch {
                // 타이핑 중의 임시 파싱 오류는 무시하고 상태 유실 방지
              }
            }}
            placeholder="[]"
          />
        )}

        {currentType === 'null' && (
          <div className="w-full bg-surface-900/30 border border-surface-750/50 rounded px-1.5 py-0.5 text-[10px] text-surface-500 font-mono select-none">
            null
          </div>
        )}

        {currentType === 'string' && (
          <input
            type="text"
            className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white placeholder-surface-600 outline-none focus:border-primary-500/50 font-mono"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder="value"
          />
        )}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────

export function ModuleInspector() {
  const { selectedNodeId, graphs, activeTab, definitions } = useModuleStore()

  const currentGraph = graphs[activeTab]
  const edges = currentGraph?.edges ?? []
  const selectedNode = selectedNodeId
    ? currentGraph.nodes.find(n => n.id === selectedNodeId)
    : null

  const nodeType = selectedNode?.data?.nodeType as string | undefined
  const catalog = nodeType ? NODE_CATALOG.find(n => n.type === nodeType) : null
  
  let fields = nodeType ? NODE_INSPECTOR_FIELDS[nodeType] : null

  if (nodeType === 'MakeStyle' && selectedNode) {
    const styleKeys = (selectedNode.data?.styleKeys as string[]) ?? ['width', 'height', 'background']
    fields = styleKeys.map(key => {
      const spec = LEVIAR_STYLE_PROPERTIES.find(p => p.key === key)
      return {
        key,
        label: spec?.label ?? key,
        type: spec?.type ?? 'text',
        options: spec?.options,
        placeholder: spec?.placeholder
      }
    })
  }

  if (nodeType === 'MakeAttribute' && selectedNode) {
    const attrKeys = (selectedNode.data?.attrKeys as string[]) ?? ['name', 'className']
    fields = attrKeys.map(key => {
      const spec = LEVIAR_ATTRIBUTE_PROPERTIES.find(p => p.key === key)
      return {
        key,
        label: spec?.label ?? key,
        type: spec?.type ?? 'text',
        options: spec?.options,
        placeholder: spec?.placeholder
      }
    })
  }

  const connectedTargets = useMemo(() => {
    if (!selectedNodeId) return []
    return edges.filter(e => e.target === selectedNodeId).map(e => e.targetHandle)
  }, [edges, selectedNodeId])

  const storeUpdateNodeData = useModuleStore((s) => s.updateNodeData)

  const updateNodeData = useCallback((keyOrData: string | Record<string, unknown>, value?: unknown) => {
    if (!selectedNodeId) return
    storeUpdateNodeData(selectedNodeId, keyOrData, value)
  }, [selectedNodeId, storeUpdateNodeData])

  const removeStyleProperty = useCallback((key: string) => {
    if (!selectedNodeId || !selectedNode) return
    const currentKeys = (selectedNode.data?.styleKeys as string[]) ?? ['width', 'height', 'background']
    const nextKeys = currentKeys.filter(k => k !== key)

    const store = useModuleStore.getState()
    const tab = store.activeTab
    const graph = store.graphs[tab]

    const targetHandleId = `${selectedNodeId}__prop__${key}`
    const nextEdges = graph.edges.filter(e => e.targetHandle !== targetHandleId)

    const updatedNodes = graph.nodes.map(n => {
      if (n.id !== selectedNodeId) return n
      const nextData = { ...n.data }
      delete nextData[key]
      nextData.styleKeys = nextKeys
      return { ...n, data: nextData }
    })

    useModuleStore.setState({
      graphs: {
        ...store.graphs,
        [tab]: {
          ...graph,
          nodes: updatedNodes,
          edges: nextEdges,
        }
      }
    })
  }, [selectedNodeId, selectedNode])

  const addStyleProperty = useCallback((key: string) => {
    if (!key || !selectedNode) return
    const currentKeys = (selectedNode.data?.styleKeys as string[]) ?? ['width', 'height', 'background']
    if (currentKeys.includes(key)) return
    const nextKeys = [...currentKeys, key]

    const spec = LEVIAR_STYLE_PROPERTIES.find(p => p.key === key)
    const defaultValue = spec ? spec.defaultValue : ''

    updateNodeData({
      styleKeys: nextKeys,
      [key]: defaultValue,
    })
  }, [selectedNode, updateNodeData])

  const removeAttrProperty = useCallback((key: string) => {
    if (!selectedNodeId || !selectedNode) return
    const currentKeys = (selectedNode.data?.attrKeys as string[]) ?? ['name', 'className']
    const nextKeys = currentKeys.filter(k => k !== key)

    const store = useModuleStore.getState()
    const tab = store.activeTab
    const graph = store.graphs[tab]

    const targetHandleId = `${selectedNodeId}__prop__${key}`
    const nextEdges = graph.edges.filter(e => e.targetHandle !== targetHandleId)

    const updatedNodes = graph.nodes.map(n => {
      if (n.id !== selectedNodeId) return n
      const nextData = { ...n.data }
      delete nextData[key]
      nextData.attrKeys = nextKeys
      return { ...n, data: nextData }
    })

    useModuleStore.setState({
      graphs: {
        ...store.graphs,
        [tab]: {
          ...graph,
          nodes: updatedNodes,
          edges: nextEdges,
        }
      }
    })
  }, [selectedNodeId, selectedNode])

  const addAttrProperty = useCallback((key: string) => {
    if (!key || !selectedNode) return
    const currentKeys = (selectedNode.data?.attrKeys as string[]) ?? ['name', 'className']
    if (currentKeys.includes(key)) return
    const nextKeys = [...currentKeys, key]

    const spec = LEVIAR_ATTRIBUTE_PROPERTIES.find(p => p.key === key)
    const defaultValue = spec ? spec.defaultValue : ''

    updateNodeData({
      attrKeys: nextKeys,
      [key]: defaultValue,
    })
  }, [selectedNode, updateNodeData])

  const removeStateField = useCallback((field: string) => {
    if (!selectedNodeId || !selectedNode) return
    const currentFields = (selectedNode.data?.fields as string[]) ?? []
    const nextFields = currentFields.filter(f => f !== field)

    const store = useModuleStore.getState()
    const tab = store.activeTab
    const graph = store.graphs[tab]

    const targetHandleId = `${selectedNodeId}__${field}`
    const nextEdges = graph.edges.filter(e => e.targetHandle !== targetHandleId)

    const updatedNodes = graph.nodes.map(n => {
      if (n.id !== selectedNodeId) return n
      const nextData = { ...n.data }
      delete nextData[field]
      nextData.fields = nextFields
      return { ...n, data: nextData }
    })

    useModuleStore.setState({
      graphs: {
        ...store.graphs,
        [tab]: {
          ...graph,
          nodes: updatedNodes,
          edges: nextEdges,
        }
      }
    })
  }, [selectedNodeId, selectedNode])

  const addStateField = useCallback((field: string) => {
    if (!field || !selectedNode) return
    const currentFields = (selectedNode.data?.fields as string[]) ?? []
    if (currentFields.includes(field)) return
    const nextFields = [...currentFields, field]

    const schemaField = definitions?.schemaDef.find(d => d.name === field)
    let initialValue: unknown = ''
    if (schemaField) {
      const t = schemaField.type
      if (t === 'number') {
        initialValue = 0
      } else if (t === 'boolean') {
        initialValue = false
      } else if (t === 'object') {
        initialValue = {}
      } else if (t === 'array') {
        initialValue = []
      }
    }

    updateNodeData({
      fields: nextFields,
      [field]: initialValue
    })
  }, [selectedNode, updateNodeData, definitions])

  if (!selectedNode || !catalog) {
    return (
      <div className="w-52 bg-[#141414] border-l border-surface-800 flex flex-col items-center justify-center select-none">
        <span className="text-[10px] text-surface-600">Select a node</span>
      </div>
    )
  }

  const category = catalog.category as NodeCategory
  const colors = NODE_CATEGORY_COLORS[category]

  return (
    <div className="w-52 bg-[#141414] border-l border-surface-800 flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-surface-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm" style={{ background: colors.border }} />
          <span className="text-[11px] font-bold" style={{ color: colors.text }}>
            {catalog.label}
          </span>
        </div>
        <span className="text-[9px] text-surface-500 mt-0.5 block">
          {catalog.description}
        </span>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2.5">
        {/* Node ID */}
        <div>
          <label className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">ID</label>
          <div className="text-[10px] text-surface-400 mt-0.5 truncate font-mono">
            {selectedNode.id}
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">Position</label>
          <div className="text-[10px] text-surface-400 mt-0.5 font-mono">
            x: {Math.round(selectedNode.position.x)}, y: {Math.round(selectedNode.position.y)}
          </div>
        </div>

        {/* Editable Fields or MakeStyle Spec */}
        {nodeType === 'MakeStyle' ? (() => {
          const styleKeys = (selectedNode.data?.styleKeys as string[]) ?? ['width', 'height', 'background']
          const remainingProperties = LEVIAR_STYLE_PROPERTIES.filter(p => !styleKeys.includes(p.key))
          return (
            <div className="space-y-3">
              <div className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">Style Properties</div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {styleKeys.map(key => {
                  const spec = LEVIAR_STYLE_PROPERTIES.find(p => p.key === key)
                  if (!spec) return null
                  const targetHandleId = `${selectedNode.id}__prop__${key}`
                  const isBound = connectedTargets.includes(targetHandleId)

                  return (
                    <div key={key} className="p-1.5 rounded bg-[#1c1c1c] border border-surface-800/60 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-surface-300 font-mono truncate" title={spec.label}>
                          {spec.label}
                        </span>
                        <button
                          className="text-surface-500 hover:text-red-400 text-[10px] transition-colors p-0.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeStyleProperty(key)
                          }}
                          title="Remove property"
                        >
                          ✕
                        </button>
                      </div>
                      <div>
                        {isBound ? (
                          <div className="text-[9px] text-primary-400 font-medium italic flex items-center gap-1 py-0.5 select-none font-mono">
                            ⛓️ Bound to Node
                          </div>
                        ) : (
                          spec.type === 'number' ? (
                            <input
                              type="number"
                              className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                              value={selectedNode.data?.[key] !== undefined ? Number(selectedNode.data?.[key]) : Number(spec.defaultValue ?? 0)}
                              onChange={(e) => updateNodeData(key, Number(e.target.value))}
                            />
                          ) : spec.type === 'boolean' ? (
                            <label className="flex items-center gap-1.5 cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                className="accent-primary-500"
                                checked={selectedNode.data?.[key] !== undefined ? Boolean(selectedNode.data?.[key]) : Boolean(spec.defaultValue ?? false)}
                                onChange={(e) => updateNodeData(key, e.target.checked)}
                              />
                              <span className="text-[9px] text-surface-400 font-mono select-none">
                                {selectedNode.data?.[key] ? 'true' : 'false'}
                              </span>
                            </label>
                          ) : spec.type === 'select' ? (
                            <select
                              className="w-full bg-surface-900 border border-surface-750 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                              value={String(selectedNode.data?.[key] ?? spec.defaultValue ?? '')}
                              onChange={(e) => updateNodeData(key, e.target.value)}
                            >
                              {spec.options?.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-[#141414] text-white">{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white placeholder-surface-600 outline-none focus:border-primary-500/50 font-mono"
                              value={String(selectedNode.data?.[key] ?? '')}
                              onChange={(e) => updateNodeData(key, e.target.value)}
                              placeholder={spec.placeholder}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {remainingProperties.length > 0 && (
                <div className="pt-2 border-t border-surface-800 flex flex-col gap-1">
                  <span className="text-[9px] text-surface-500 font-bold uppercase tracking-wider select-none">Add Property</span>
                  <select
                    className="w-full bg-surface-900 border border-surface-750 rounded px-2 py-1 text-[10px] text-surface-300 outline-none focus:border-primary-500/50 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      addStyleProperty(e.target.value)
                      e.target.value = ""
                    }}
                  >
                    <option value="" disabled className="bg-[#141414] text-surface-500">-- Select Style Property --</option>
                    {remainingProperties.map(p => (
                      <option key={p.key} value={p.key} className="bg-[#141414] text-white">{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )
        })() : nodeType === 'MakeAttribute' ? (() => {
          const attrKeys = (selectedNode.data?.attrKeys as string[]) ?? ['name', 'className']
          const remainingProperties = LEVIAR_ATTRIBUTE_PROPERTIES.filter(p => !attrKeys.includes(p.key))
          return (
            <div className="space-y-3">
              <div className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">Attribute Properties</div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {attrKeys.map(key => {
                  const spec = LEVIAR_ATTRIBUTE_PROPERTIES.find(p => p.key === key)
                  if (!spec) return null
                  const targetHandleId = `${selectedNode.id}__prop__${key}`
                  const isBound = connectedTargets.includes(targetHandleId)

                  return (
                    <div key={key} className="p-1.5 rounded bg-[#1c1c1c] border border-surface-800/60 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-surface-300 font-mono truncate" title={spec.label}>
                          {spec.label}
                        </span>
                        <button
                          className="text-surface-500 hover:text-red-400 text-[10px] transition-colors p-0.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeAttrProperty(key)
                          }}
                          title="Remove property"
                        >
                          ✕
                        </button>
                      </div>
                      <div>
                        {isBound ? (
                          <div className="text-[9px] text-primary-400 font-medium italic flex items-center gap-1 py-0.5 select-none font-mono">
                            ⛓️ Bound to Node
                          </div>
                        ) : (
                          spec.type === 'number' ? (
                            <input
                              type="number"
                              className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                              value={selectedNode.data?.[key] !== undefined ? Number(selectedNode.data?.[key]) : Number(spec.defaultValue ?? 0)}
                              onChange={(e) => updateNodeData(key, Number(e.target.value))}
                            />
                          ) : spec.type === 'boolean' ? (
                            <label className="flex items-center gap-1.5 cursor-pointer py-0.5">
                              <input
                                type="checkbox"
                                className="accent-primary-500"
                                checked={selectedNode.data?.[key] !== undefined ? Boolean(selectedNode.data?.[key]) : Boolean(spec.defaultValue ?? false)}
                                onChange={(e) => updateNodeData(key, e.target.checked)}
                              />
                              <span className="text-[9px] text-surface-400 font-mono select-none">
                                {selectedNode.data?.[key] ? 'true' : 'false'}
                              </span>
                            </label>
                          ) : spec.type === 'select' ? (
                            <select
                              className="w-full bg-surface-900 border border-surface-750 rounded px-1 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                              value={String(selectedNode.data?.[key] ?? spec.defaultValue ?? '')}
                              onChange={(e) => updateNodeData(key, e.target.value)}
                            >
                              {spec.options?.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-[#141414] text-white">{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white placeholder-surface-600 outline-none focus:border-primary-500/50 font-mono"
                              value={String(selectedNode.data?.[key] ?? '')}
                              onChange={(e) => updateNodeData(key, e.target.value)}
                              placeholder={spec.placeholder}
                            />
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {remainingProperties.length > 0 && (
                <div className="pt-2 border-t border-surface-800 flex flex-col gap-1">
                  <span className="text-[9px] text-surface-500 font-bold uppercase tracking-wider select-none">Add Attribute</span>
                  <select
                    className="w-full bg-surface-900 border border-surface-750 rounded px-2 py-1 text-[10px] text-surface-300 outline-none focus:border-primary-500/50 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      addAttrProperty(e.target.value)
                      e.target.value = ""
                    }}
                  >
                    <option value="" disabled className="bg-[#141414] text-surface-500">-- Select Attribute Property --</option>
                    {remainingProperties.map(p => (
                      <option key={p.key} value={p.key} className="bg-[#141414] text-white">{p.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )
        })() : nodeType === 'MakeFunction' ? (() => {
          // ─── { name: string, type: PinDataType }[] 구조 ───
          type ArgDef = { name: string, type: PinDataType }
          const ARG_TYPE_OPTIONS: { value: PinDataType, label: string }[] = [
            { value: 'string',    label: 'string' },
            { value: 'number',    label: 'number' },
            { value: 'boolean',   label: 'boolean' },
            { value: 'object',    label: 'object' },
            { value: 'array',     label: 'array' },
            { value: 'function',  label: 'function' },
            { value: 'any',       label: 'any' },
          ]
          const args = (selectedNode.data?.arguments as ArgDef[]) ?? []
          return (
            <div className="space-y-3">
              <div className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">Function Arguments</div>
              <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                {args.map((arg, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded bg-[#1c1c1c] border border-surface-800/60">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: PIN_COLORS[arg.type] ?? PIN_COLORS['any'] }}
                    />
                    <span className="text-[10px] font-bold text-surface-300 font-mono flex-1 truncate">{arg.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/5 bg-black/30"
                      style={{ color: PIN_COLORS[arg.type] ?? PIN_COLORS['any'] }}>
                      {arg.type}
                    </span>
                    <button
                      className="text-surface-500 hover:text-red-400 text-[10px] transition-colors p-0.5 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateNodeData('arguments', args.filter((_, i) => i !== idx))
                      }}
                      title="Remove argument"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-surface-800 flex flex-col gap-1.5">
                <span className="text-[9px] text-surface-500 font-bold uppercase tracking-wider select-none">Add Argument</span>
                <form
                  className="flex flex-col gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const form = e.currentTarget
                    const nameInput = form.elements.namedItem('argName') as HTMLInputElement
                    const typeSelect = form.elements.namedItem('argType') as HTMLSelectElement
                    const nameVal = nameInput.value.trim()
                    const typeVal = typeSelect.value as PinDataType
                    if (nameVal && !args.some(a => a.name === nameVal)) {
                      updateNodeData('arguments', [...args, { name: nameVal, type: typeVal }])
                      nameInput.value = ''
                    }
                  }}
                >
                  <input
                    name="argName"
                    type="text"
                    placeholder="param name..."
                    className="w-full bg-surface-900 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                  />
                  <div className="flex gap-1">
                    <select
                      name="argType"
                      defaultValue="any"
                      className="flex-1 bg-surface-900 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-surface-300 outline-none focus:border-primary-500/50"
                    >
                      {ARG_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-[#141414]">{opt.label}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="bg-primary-950 border border-primary-900 hover:bg-primary-900/60 text-primary-400 text-[9px] font-bold px-2 py-0.5 rounded transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        })() : nodeType === 'Execute' ? (() => {
          const cmdKeys = (selectedNode.data?.cmdKeys as string[]) ?? []
          const isTypeBound = connectedTargets.includes(`${selectedNode.id}__type`)

          return (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">Type</label>
                {isTypeBound ? (
                  <div className="text-[10px] text-primary-400 font-medium italic flex items-center gap-1 py-1 select-none font-mono">
                    ⛓️ Bound to Node
                  </div>
                ) : (
                  <input
                    className="mt-0.5 w-full bg-surface-900/50 border border-surface-700 rounded px-2 py-1 text-[11px] text-white placeholder-surface-600 outline-none focus:border-primary-500/50 font-mono"
                    value={String(selectedNode.data?.type ?? '')}
                    placeholder="Command type..."
                    onChange={(e) => updateNodeData('type', e.target.value)}
                  />
                )}
              </div>

              <div className="pt-2 border-t border-surface-800">
                <span className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">Parameters</span>
                <div className="space-y-2 mt-1.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                  {cmdKeys.map(key => {
                    const targetHandleId = `${selectedNode.id}__prop__${key}`
                    const isBound = connectedTargets.includes(targetHandleId)

                    return (
                      <div key={key} className="p-1.5 rounded bg-[#1c1c1c] border border-surface-800/60 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-surface-300 font-mono truncate">{key}</span>
                          <button
                            className="text-surface-500 hover:text-red-400 text-[10px] transition-colors p-0.5"
                            onClick={(e) => {
                              e.stopPropagation()
                              const nextKeys = cmdKeys.filter(k => k !== key)
                              const store = useModuleStore.getState()
                              const tab = store.activeTab
                              const graph = store.graphs[tab]
                              const nextEdges = graph.edges.filter(edge => edge.targetHandle !== targetHandleId)
                              const updatedNodes = graph.nodes.map(n => {
                                if (n.id !== selectedNode.id) return n
                                const nextData = { ...n.data }
                                delete nextData[`prop__${key}`]
                                nextData.cmdKeys = nextKeys
                                return { ...n, data: nextData }
                              })
                              useModuleStore.setState({
                                graphs: {
                                  ...store.graphs,
                                  [tab]: { ...graph, nodes: updatedNodes, edges: nextEdges }
                                }
                              })
                            }}
                            title="Remove parameter"
                          >
                            ✕
                          </button>
                        </div>
                        <div>
                          {isBound ? (
                            <div className="text-[9px] text-primary-400 font-medium italic flex items-center gap-1 py-0.5 select-none font-mono">
                              ⛓️ Bound to Node
                            </div>
                          ) : (
                            <TypedInput
                              value={selectedNode.data?.[`prop__${key}`]}
                              onChange={(newVal) => updateNodeData(`prop__${key}`, newVal)}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-surface-800 flex flex-col gap-1.5">
                <span className="text-[9px] text-surface-500 font-bold uppercase tracking-wider select-none">Add Parameter</span>
                <form
                  className="flex gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const form = e.currentTarget
                    const input = form.elements.namedItem('newParam') as HTMLInputElement
                    const val = input.value.trim()
                    if (val && !cmdKeys.includes(val)) {
                      updateNodeData({
                        cmdKeys: [...cmdKeys, val],
                        [`prop__${val}`]: ''
                      })
                      input.value = ''
                    }
                  }}
                >
                  <input
                    name="newParam"
                    type="text"
                    placeholder="param name..."
                    className="flex-1 bg-surface-900 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                  />
                  <button
                    type="submit"
                    className="bg-primary-950 border border-primary-900 hover:bg-primary-900/60 text-primary-400 text-[9px] font-bold px-2 py-0.5 rounded transition-colors"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          )
        })() : nodeType === 'SetState' ? (() => {
          const stateFields = (selectedNode.data?.fields as string[]) ?? []
          return (
            <div className="space-y-3">
              <div className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">State Fields</div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {stateFields.map(field => {
                  const targetHandleId = `${selectedNode.id}__${field}`
                  const isBound = connectedTargets.includes(targetHandleId)

                  const schemaField = definitions?.schemaDef.find(d => d.name === field)
                  let forceType: 'string' | 'number' | 'boolean' | 'json' | undefined = undefined
                  if (schemaField) {
                    const t = schemaField.type
                    if (t === 'number') {
                      forceType = 'number'
                    } else if (t === 'boolean') {
                      forceType = 'boolean'
                    } else if (t === 'object' || t === 'array') {
                      forceType = 'json'
                    } else {
                      forceType = 'string'
                    }
                  }

                  return (
                    <div key={field} className="p-1.5 rounded bg-[#1c1c1c] border border-surface-800/60 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-surface-300 font-mono truncate" title={field}>
                          {field}
                        </span>
                        <button
                          className="text-surface-500 hover:text-red-400 text-[10px] transition-colors p-0.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeStateField(field)
                          }}
                          title="Remove field"
                        >
                          ✕
                        </button>
                      </div>
                      <div>
                        {isBound ? (
                          <div className="text-[9px] text-primary-400 font-medium italic flex items-center gap-1 py-0.5 select-none font-mono">
                            ⛓️ Bound to Node
                          </div>
                        ) : (
                          <TypedInput
                            value={selectedNode.data?.[field]}
                            onChange={(newVal) => updateNodeData(field, newVal)}
                            forceType={forceType}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add Field Input */}
              <div className="pt-2 border-t border-surface-800 flex flex-col gap-1.5">
                <span className="text-[9px] text-surface-500 font-bold uppercase tracking-wider select-none">Add State Field</span>
                <div className="flex gap-1">
                  {(() => {
                    const availableFields = definitions?.schemaDef.filter(d => !stateFields.includes(d.name)) || []
                    return (
                      <select
                        className="w-full bg-surface-900 border border-surface-750 rounded px-2 py-1 text-[10px] text-surface-300 outline-none focus:border-primary-500/50 cursor-pointer"
                        value=""
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) {
                            addStateField(val)
                          }
                          e.target.value = ""
                        }}
                      >
                        <option value="" disabled className="bg-[#141414] text-surface-500">
                          {availableFields.length === 0 ? '-- No state fields available --' : '-- Add State Field --'}
                        </option>
                        {availableFields.map(d => (
                          <option key={d.name} value={d.name} className="bg-[#141414] text-white">
                            {d.name} ({d.type})
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>
              </div>
            </div>
          )
        })() : (
          fields && fields.map(field => {
            const fieldHandleId = field.key === 'varName' && nodeType === 'GetVariable'
              ? `${selectedNode.id}__name`
              : `${selectedNode.id}__${field.key}`
            const isFieldBound = connectedTargets.includes(fieldHandleId)

            return (
              <div key={field.key}>
                <label className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">
                  {field.label}
                </label>

                {isFieldBound ? (
                  <div className="text-[10px] text-primary-400 font-medium italic flex items-center gap-1 py-1 select-none font-mono">
                    ⛓️ Bound to Node
                  </div>
                ) : (
                  <>
                    {nodeType === 'GetState' && field.key === 'fieldName' ? (
                      <select
                        className={`mt-0.5 w-full bg-[#141414] border rounded px-2 py-1 text-[11px] text-white outline-none focus:border-primary-500/50 ${
                          selectedNode.data?.[field.key] && !definitions?.schemaDef.some(d => d.name === selectedNode.data?.[field.key])
                            ? 'border-red-500/50 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                            : 'border-surface-700'
                        }`}
                        value={String(selectedNode.data?.[field.key] ?? '')}
                        onChange={(e) => updateNodeData(field.key, e.target.value)}
                      >
                        <option value="" disabled className="bg-[#141414] text-surface-500">-- Select State Field --</option>
                        {definitions?.schemaDef.map(d => (
                          <option key={d.name} value={d.name} className="bg-[#141414] text-white">
                            {d.name} ({d.type})
                          </option>
                        ))}
                        {!!selectedNode.data?.[field.key] && !definitions?.schemaDef.some(d => d.name === selectedNode.data?.[field.key]) && (
                          <option value={String(selectedNode.data?.[field.key])} className="bg-[#141414] text-red-400 font-bold">
                            {String(selectedNode.data?.[field.key])} (Missing)
                          </option>
                        )}
                      </select>
                    ) : nodeType === 'GetCmd' && field.key === 'fieldName' ? (
                      <select
                        className={`mt-0.5 w-full bg-[#141414] border rounded px-2 py-1 text-[11px] text-white outline-none focus:border-primary-500/50 ${
                          selectedNode.data?.[field.key] && !definitions?.commandDef.some(d => d.name === selectedNode.data?.[field.key])
                            ? 'border-red-500/50 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                            : 'border-surface-700'
                        }`}
                        value={String(selectedNode.data?.[field.key] ?? '')}
                        onChange={(e) => updateNodeData(field.key, e.target.value)}
                      >
                        <option value="" disabled className="bg-[#141414] text-surface-500">-- Select Command Prop --</option>
                        {definitions?.commandDef.map(d => (
                          <option key={d.name} value={d.name} className="bg-[#141414] text-white">
                            {d.name} ({d.type})
                          </option>
                        ))}
                        {!!selectedNode.data?.[field.key] && !definitions?.commandDef.some(d => d.name === selectedNode.data?.[field.key]) && (
                          <option value={String(selectedNode.data?.[field.key])} className="bg-[#141414] text-red-400 font-bold">
                            {String(selectedNode.data?.[field.key])} (Missing)
                          </option>
                        )}
                      </select>
                    ) : (
                      <>
                        {field.type === 'typed' && (
                          <TypedInput
                            value={selectedNode.data?.[field.key] !== undefined ? selectedNode.data?.[field.key] : selectedNode.data?.inlineValue}
                            onChange={(newVal) => updateNodeData(field.key, newVal)}
                          />
                        )}

                        {field.type === 'text' && (
                          <input
                            className="mt-0.5 w-full bg-surface-900/50 border border-surface-700 rounded px-2 py-1 text-[11px] text-white placeholder-surface-600 outline-none focus:border-primary-500/50"
                            value={String(selectedNode.data?.[field.key] ?? '')}
                            placeholder={field.placeholder}
                            onChange={(e) => updateNodeData(field.key, e.target.value)}
                          />
                        )}

                        {field.type === 'number' && (
                          <input
                            type="number"
                            className="mt-0.5 w-full bg-surface-900/50 border border-surface-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-primary-500/50"
                            value={Number(selectedNode.data?.[field.key] ?? 0)}
                            onChange={(e) => updateNodeData(field.key, Number(e.target.value))}
                          />
                        )}

                        {field.type === 'select' && field.options && (
                          <select
                            className="mt-0.5 w-full bg-surface-900 border border-surface-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-primary-500/50"
                            value={String(selectedNode.data?.[field.key] ?? field.options[0]?.value ?? '')}
                            onChange={(e) => updateNodeData(field.key, e.target.value)}
                          >
                            {field.options.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )}

                        {field.type === 'boolean' && (
                          <label className="flex items-center gap-1.5 mt-0.5 cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-primary-500"
                              checked={Boolean(selectedNode.data?.[field.key])}
                              onChange={(e) => updateNodeData(field.key, e.target.checked)}
                            />
                            <span className="text-[10px] text-surface-300">
                              {selectedNode.data?.[field.key] ? 'true' : 'false'}
                            </span>
                          </label>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}

        {!fields && nodeType !== 'MakeStyle' && (
          <div className="text-[10px] text-surface-600 italic">
            No editable properties
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================
// ModuleInspector.tsx — 선택된 노드의 속성 편집 패널
// =============================================================

import React, { useCallback, useMemo } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { NODE_CATALOG, NODE_CATEGORY_COLORS, type NodeCategory, LEVIAR_STYLE_PROPERTIES, LEVIAR_ATTRIBUTE_PROPERTIES } from '../../types/blueprint'

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
    { key: 'handlerId', label: 'Handler ID', type: 'text', placeholder: 'handler name' },
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
}

// ─── 스마트 타입 기입 컴포넌트 (TypedInput) ───────────────────
interface TypedInputProps {
  label?: string
  value: unknown
  onChange: (newValue: unknown) => void
}

function TypedInput({ label, value, onChange }: TypedInputProps): React.JSX.Element {
  let currentType: 'string' | 'number' | 'boolean' | 'json' = 'string'
  if (typeof value === 'number') {
    currentType = 'number'
  } else if (typeof value === 'boolean') {
    currentType = 'boolean'
  } else if (typeof value === 'object' && value !== null) {
    currentType = 'json'
  }

  const handleTypeChange = (newType: 'string' | 'number' | 'boolean' | 'json') => {
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
    }
  }

  return (
    <div className="space-y-1 mt-1 p-1.5 rounded bg-surface-900/35 border border-surface-800/60">
      <div className="flex items-center justify-between gap-1.5">
        {label ? (
          <span className="text-[9px] text-surface-500 uppercase tracking-wider font-bold truncate">
            {label}
          </span>
        ) : <div />}
        <select
          className="bg-surface-900 border border-surface-750 rounded px-1 py-0.5 text-[9px] text-primary-400 font-medium outline-none cursor-pointer"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as 'string' | 'number' | 'boolean' | 'json')}
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="json">JSON</option>
        </select>
      </div>

      <div className="mt-1">
        {currentType === 'number' && (
          <input
            type="number"
            className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
            value={value !== undefined ? Number(value) : 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        )}

        {currentType === 'boolean' && (
          <label className="flex items-center gap-1.5 cursor-pointer py-0.5">
            <input
              type="checkbox"
              className="accent-primary-500 cursor-pointer"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-[9px] text-surface-400 font-mono select-none">
              {value ? 'true' : 'false'}
            </span>
          </label>
        )}

        {currentType === 'json' && (
          <textarea
            className="w-full bg-surface-900/50 border border-surface-750 rounded px-1.5 py-0.5 text-[9px] text-white font-mono outline-none focus:border-primary-500/50 min-h-[40px] resize-y custom-scrollbar"
            value={JSON.stringify(value, null, 2)}
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
  const { selectedNodeId, graphs, activeTab } = useModuleStore()

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

    updateNodeData({
      fields: nextFields,
      [field]: '',
    })
  }, [selectedNode, updateNodeData])

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
        })() : nodeType === 'SetState' ? (() => {
          const stateFields = (selectedNode.data?.fields as string[]) ?? []
          return (
            <div className="space-y-3">
              <div className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">State Fields</div>
              <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {stateFields.map(field => {
                  const targetHandleId = `${selectedNode.id}__${field}`
                  const isBound = connectedTargets.includes(targetHandleId)

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
                  <input
                    id="new-state-field-input"
                    type="text"
                    className="flex-1 bg-surface-900 border border-surface-750 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-primary-500/50 font-mono"
                    placeholder="field name..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget
                        const val = input.value.trim()
                        if (val) {
                          addStateField(val)
                          input.value = ''
                        }
                      }
                    }}
                  />
                  <button
                    className="bg-primary-600 hover:bg-primary-500 text-white rounded px-2 py-0.5 text-[10px] font-bold transition-colors"
                    onClick={() => {
                      const input = document.getElementById('new-state-field-input') as HTMLInputElement | null
                      if (input) {
                        const val = input.value.trim()
                        if (val) {
                          addStateField(val)
                          input.value = ''
                        }
                      }
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })() : (
          fields && fields.map(field => {
            const fieldHandleId = `${selectedNode.id}__${field.key}`
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

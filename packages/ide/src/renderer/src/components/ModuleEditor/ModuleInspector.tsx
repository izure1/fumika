// =============================================================
// ModuleInspector.tsx — 선택된 노드의 속성 편집 패널
// =============================================================

import { useCallback } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import { NODE_CATALOG, NODE_CATEGORY_COLORS, type NodeCategory } from '../../types/blueprint'

// ─── 노드별 편집 가능 필드 룩업 테이블 ──────────────────────────

interface InspectorField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean'
  options?: { value: string, label: string }[]
  placeholder?: string
}

const NODE_INSPECTOR_FIELDS: Record<string, InspectorField[]> = {
  Constant: [
    { key: 'constantType', label: 'Type', type: 'select', options: [
      { value: 'string', label: 'String' },
      { value: 'number', label: 'Number' },
      { value: 'boolean', label: 'Boolean' },
    ]},
    { key: 'inlineValue', label: 'Value', type: 'text', placeholder: 'value' },
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
  ],
  MathOp: [
    { key: 'operator', label: 'Operator', type: 'select', options: [
      { value: '+', label: '+' },
      { value: '-', label: '-' },
      { value: '*', label: '×' },
      { value: '/', label: '÷' },
      { value: '%', label: '%' },
    ]},
  ],
  GetState: [
    { key: 'fieldName', label: 'Field', type: 'text', placeholder: 'state field name' },
  ],
  GetCmd: [
    { key: 'fieldName', label: 'Property', type: 'text', placeholder: 'cmd property name' },
  ],
  GetVariable: [
    { key: 'scope', label: 'Scope', type: 'select', options: [
      { value: 'global', label: 'Global ($)' },
      { value: 'local', label: 'Local (%)' },
      { value: 'env', label: 'Env (@)' },
    ]},
    { key: 'varName', label: 'Name', type: 'text', placeholder: 'variable name' },
  ],
  SetVariable: [
    { key: 'scope', label: 'Scope', type: 'select', options: [
      { value: 'global', label: 'Global ($)' },
      { value: 'local', label: 'Local (%)' },
      { value: 'env', label: 'Env (@)' },
    ]},
  ],
  SetState: [
    { key: 'fieldName', label: 'Field', type: 'text', placeholder: 'state field name' },
  ],
  BindEvent: [
    { key: 'eventType', label: 'Event', type: 'select', options: [
      { value: 'click', label: 'click' },
      { value: 'pointerdown', label: 'pointerdown' },
      { value: 'pointerup', label: 'pointerup' },
      { value: 'pointerenter', label: 'pointerenter' },
      { value: 'pointerleave', label: 'pointerleave' },
    ]},
    { key: 'handlerId', label: 'Handler ID', type: 'text', placeholder: 'handler name' },
  ],
  Log: [
    { key: 'logLevel', label: 'Level', type: 'select', options: [
      { value: 'log', label: 'log' },
      { value: 'warn', label: 'warn' },
      { value: 'error', label: 'error' },
    ]},
  ],
  Return: [
    { key: 'defaultValue', label: 'Default', type: 'select', options: [
      { value: 'true', label: 'true (완료)' },
      { value: 'false', label: 'false (대기)' },
    ]},
  ],
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────

export function ModuleInspector() {
  const { selectedNodeId, graphs, activeTab } = useModuleStore()

  const currentGraph = graphs[activeTab]
  const selectedNode = selectedNodeId
    ? currentGraph.nodes.find(n => n.id === selectedNodeId)
    : null

  const nodeType = selectedNode?.data?.nodeType as string | undefined
  const catalog = nodeType ? NODE_CATALOG.find(n => n.type === nodeType) : null
  const fields = nodeType ? NODE_INSPECTOR_FIELDS[nodeType] : null

  const updateNodeData = useCallback((key: string, value: unknown) => {
    if (!selectedNodeId) return
    const store = useModuleStore.getState()
    const tab = store.activeTab
    const graph = store.graphs[tab]
    const updatedNodes = graph.nodes.map(n => {
      if (n.id !== selectedNodeId) return n
      return { ...n, data: { ...n.data, [key]: value } }
    })

    useModuleStore.setState({
      graphs: {
        ...store.graphs,
        [tab]: { ...graph, nodes: updatedNodes },
      },
    })
  }, [selectedNodeId])

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
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
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

        {/* Editable Fields */}
        {fields && fields.map(field => (
          <div key={field.key}>
            <label className="text-[9px] text-surface-500 uppercase tracking-wider font-bold">
              {field.label}
            </label>

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
          </div>
        ))}

        {!fields && (
          <div className="text-[10px] text-surface-600 italic">
            No editable properties
          </div>
        )}
      </div>
    </div>
  )
}

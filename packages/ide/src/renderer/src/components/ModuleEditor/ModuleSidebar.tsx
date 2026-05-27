// =============================================================
// ModuleSidebar.tsx — 정의 편집 + 노드 팔레트 사이드바
// =============================================================

import { useState, useCallback } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import {
  NODE_CATALOG,
  NODE_CATEGORY_COLORS,
  type NodeCategory,
  PIN_COLORS,
} from '../../types/blueprint'
import { ModuleDefPanel } from './ModuleDefPanel'

const CATEGORY_ORDER: { key: NodeCategory, label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'flow', label: 'Flow Control' },
  { key: 'variable', label: 'Variables' },
  { key: 'utility', label: 'Utility' },
  { key: 'object', label: 'Object' },
  { key: 'style-class', label: 'Style & Attribute' },
  { key: 'motion', label: 'Motion' },
  { key: 'effect', label: 'Effect' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'novel', label: 'Novel' },
]

type SidebarTab = 'definitions' | 'nodes'

interface Props {
  onAddNode: (nodeType: string, position?: { x: number, y: number }) => void
}

export function ModuleSidebar({ onAddNode }: Props) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('definitions')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // Premium hover tooltip state
  const [hoveredNode, setHoveredNode] = useState<{
    node: typeof NODE_CATALOG[number]
    rect: DOMRect
    colors: typeof NODE_CATEGORY_COLORS[NodeCategory]
    isDisabled: boolean
    isTabNotAllowed?: boolean
    isSingletonExists?: boolean
  } | null>(null)

  const { activeTab, graphs } = useModuleStore()
  const currentGraph = graphs[activeTab]
  const currentNodes = currentGraph?.nodes || []

  const toggleCategory = useCallback((key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const filtered = search
    ? NODE_CATALOG.filter(n =>
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase())
    )
    : NODE_CATALOG

  const onDragStart = useCallback((e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/blueprint-node', nodeType)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleMouseEnter = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    node: typeof NODE_CATALOG[number],
    colors: typeof NODE_CATEGORY_COLORS[NodeCategory],
    isDisabled: boolean,
    isTabNotAllowed: boolean,
    isSingletonExists: boolean
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredNode({
      node,
      rect,
      colors,
      isDisabled,
      isTabNotAllowed,
      isSingletonExists,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null)
  }, [])

  return (
    <div className="w-56 bg-[#141414] border-r border-surface-800 flex flex-col overflow-hidden select-none">
      {/* Sidebar Tab Toggle */}
      <div className="flex shrink-0 border-b border-surface-800">
        <button
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            sidebarTab === 'definitions'
              ? 'text-primary-400 border-b-2 border-primary-500 bg-surface-800/30'
              : 'text-surface-500 hover:text-surface-300'
          }`}
          onClick={() => {
            setSidebarTab('definitions')
            setHoveredNode(null)
          }}
        >
          Definitions
        </button>
        <button
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            sidebarTab === 'nodes'
              ? 'text-primary-400 border-b-2 border-primary-500 bg-surface-800/30'
              : 'text-surface-500 hover:text-surface-300'
          }`}
          onClick={() => {
            setSidebarTab('nodes')
            setHoveredNode(null)
          }}
        >
          Nodes
        </button>
      </div>

      {/* Definitions Tab */}
      {sidebarTab === 'definitions' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <ModuleDefPanel />
        </div>
      )}

      {/* Nodes Tab */}
      {sidebarTab === 'nodes' && (
        <>
          {/* Search */}
          <div className="px-3 py-2 border-b border-surface-800 shrink-0">
            <input
              className="w-full bg-surface-900/50 border border-surface-700 rounded px-2 py-1 text-[11px] text-white placeholder-surface-500 outline-none focus:border-primary-500/50"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {CATEGORY_ORDER.map(cat => {
              const nodes = filtered.filter(n => n.category === cat.key)
              if (nodes.length === 0) return null
              const colors = NODE_CATEGORY_COLORS[cat.key]
              const isCollapsed = collapsed[cat.key]

              return (
                <div key={cat.key} className="border-b border-surface-800/50">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-800/30 transition-colors"
                    onClick={() => {
                      toggleCategory(cat.key)
                      setHoveredNode(null)
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: colors.border }}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left"
                      style={{ color: colors.text }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[9px] text-surface-500">
                      {isCollapsed ? '▸' : '▾'}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="pb-1">
                      {nodes.map(node => {
                        const isTabNotAllowed = !!(node.allowedTabs && !node.allowedTabs.includes(activeTab))
                        const isSingletonExists = !!(node.singleton && currentNodes.some(n => n.data?.nodeType === node.type))
                        const isDisabled = isTabNotAllowed || isSingletonExists

                        return (
                          <div
                            key={node.type}
                            className={`flex items-center gap-2 mx-1.5 px-2 py-1.5 rounded transition-colors ${
                              isDisabled
                                ? 'opacity-30 cursor-not-allowed select-none bg-surface-900/10'
                                : 'cursor-grab hover:bg-surface-800/50 active:cursor-grabbing'
                            }`}
                            draggable={!isDisabled}
                            onDragStart={(e) => {
                              if (isDisabled) {
                                e.preventDefault()
                                return
                              }
                              onDragStart(e, node.type)
                              handleMouseLeave()
                            }}
                            onClick={() => {
                              if (!isDisabled) {
                                onAddNode(node.type)
                              }
                            }}
                            onMouseEnter={(e) => handleMouseEnter(e, node, colors, isDisabled, isTabNotAllowed, isSingletonExists)}
                            onMouseLeave={handleMouseLeave}
                          >
                            <div
                              className="w-1 h-4 rounded-full shrink-0"
                              style={{ background: `${colors.border}80` }}
                            />
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="text-[11px] font-medium text-surface-200 truncate">
                                  {node.label}
                                </span>
                                {isTabNotAllowed && (
                                  <span className="text-[8px] text-red-400 bg-red-950/40 border border-red-900/50 rounded px-1 shrink-0 scale-90 origin-right">
                                    {node.allowedTabs?.join(', ')} only
                                  </span>
                                )}
                                {isSingletonExists && (
                                  <span className="text-[8px] text-amber-400 bg-amber-950/40 border border-amber-900/50 rounded px-1 shrink-0 scale-90 origin-right">
                                    exists
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Premium Hover Tooltip */}
      {hoveredNode && (
        <div
          className="fixed z-[9999] w-64 p-3 rounded-lg border backdrop-blur-md transition-all duration-150 ease-out pointer-events-none shadow-2xl shadow-black/80 flex flex-col gap-2"
          style={{
            left: `${hoveredNode.rect.right + 8}px`,
            top: `${Math.max(16, Math.min(window.innerHeight - 250 - 16, hoveredNode.rect.top))}px`,
            backgroundColor: 'rgba(20, 20, 23, 0.95)',
            borderColor: `${hoveredNode.colors.border}60`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-3 rounded-sm" style={{ background: hoveredNode.colors.border }} />
              <span className="text-[12px] font-bold truncate" style={{ color: hoveredNode.colors.text }}>
                {hoveredNode.node.label}
              </span>
            </div>
            <span className="text-[8px] uppercase tracking-wider font-bold text-surface-500 px-1 py-0.5 rounded bg-surface-900 border border-surface-800">
              {hoveredNode.node.category}
            </span>
          </div>

          {/* Warnings & Restrictions */}
          {(hoveredNode.isTabNotAllowed || hoveredNode.isSingletonExists) && (
            <div className="flex flex-col gap-1 p-1.5 rounded bg-red-950/20 border border-red-900/30 text-[9px]">
              {hoveredNode.isTabNotAllowed && (
                <div className="text-red-400 font-medium flex items-center gap-1">
                  ⚠️ [{hoveredNode.node.allowedTabs?.map(t => t.toUpperCase()).join(', ')}] 탭에서만 사용 가능합니다.
                </div>
              )}
              {hoveredNode.isSingletonExists && (
                <div className="text-amber-400 font-medium flex items-center gap-1">
                  ⚠️ 이 노드는 이미 배치되어 중복 생성이 제한됩니다.
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="text-[10px] leading-relaxed text-surface-300 whitespace-pre-wrap">
            {hoveredNode.node.description}
          </div>

          {/* Pins Spec */}
          {hoveredNode.node.pins && hoveredNode.node.pins.length > 0 && (
            <div className="flex flex-col gap-1 mt-1 border-t pt-2" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
              <div className="text-[8px] uppercase tracking-wider font-bold text-surface-500">Node Pins</div>
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                {/* Inputs */}
                <div className="flex flex-col gap-1 border-r pr-1" style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}>
                  <span className="text-[8px] text-surface-400 font-sans font-semibold">Inputs</span>
                  {hoveredNode.node.pins.filter(p => p.direction === 'input').length > 0 ? (
                    hoveredNode.node.pins.filter(p => p.direction === 'input').map(p => (
                      <div key={p.id} className="flex items-center gap-1 min-w-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: PIN_COLORS[p.dataType ?? (p.pinType === 'exec' ? 'exec' : 'any')] ?? PIN_COLORS['any'] }}
                        />
                        <span className="truncate text-surface-200" title={p.label}>{p.label}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[8px] text-surface-600 italic">None</span>
                  )}
                </div>

                {/* Outputs */}
                <div className="flex flex-col gap-1 pl-1">
                  <span className="text-[8px] text-surface-400 font-sans font-semibold">Outputs</span>
                  {hoveredNode.node.pins.filter(p => p.direction === 'output').length > 0 ? (
                    hoveredNode.node.pins.filter(p => p.direction === 'output').map(p => (
                      <div key={p.id} className="flex items-center gap-1 min-w-0">
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: PIN_COLORS[p.dataType ?? (p.pinType === 'exec' ? 'exec' : 'any')] ?? PIN_COLORS['any'] }}
                        />
                        <span className="truncate text-surface-200" title={p.label}>{p.label}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[8px] text-surface-600 italic">None</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

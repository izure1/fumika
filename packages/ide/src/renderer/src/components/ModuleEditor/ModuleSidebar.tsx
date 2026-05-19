// =============================================================
// ModuleSidebar.tsx — 정의 편집 + 노드 팔레트 사이드바
// =============================================================

import { useState, useCallback } from 'react'
import {
  NODE_CATALOG,
  NODE_CATEGORY_COLORS,
  type NodeCategory,
} from '../../types/blueprint'
import { ModuleDefPanel } from './ModuleDefPanel'

const CATEGORY_ORDER: { key: NodeCategory, label: string }[] = [
  { key: 'event', label: 'Event' },
  { key: 'condition', label: 'Condition' },
  { key: 'action', label: 'Action' },
  { key: 'data', label: 'Data' },
]

type SidebarTab = 'definitions' | 'nodes'

interface Props {
  onAddNode: (nodeType: string, position?: { x: number, y: number }) => void
}

export function ModuleSidebar({ onAddNode }: Props) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('definitions')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

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
          onClick={() => setSidebarTab('definitions')}
        >
          Definitions
        </button>
        <button
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            sidebarTab === 'nodes'
              ? 'text-primary-400 border-b-2 border-primary-500 bg-surface-800/30'
              : 'text-surface-500 hover:text-surface-300'
          }`}
          onClick={() => setSidebarTab('nodes')}
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
                    onClick={() => toggleCategory(cat.key)}
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
                      {nodes.map(node => (
                        <div
                          key={node.type}
                          className="flex items-center gap-2 mx-1.5 px-2 py-1 rounded cursor-grab hover:bg-surface-800/50 active:cursor-grabbing transition-colors"
                          draggable
                          onDragStart={(e) => onDragStart(e, node.type)}
                          onClick={() => onAddNode(node.type)}
                          title={node.description}
                        >
                          <div
                            className="w-1 h-4 rounded-full shrink-0"
                            style={{ background: `${colors.border}80` }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-medium text-surface-200 truncate">
                              {node.label}
                            </span>
                            <span className="text-[9px] text-surface-500 truncate">
                              {node.description}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

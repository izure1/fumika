import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  MarkerType,
  Position,
  Handle,
  useReactFlow,
  type NodeProps
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { useProjectStore } from '../../store/useProjectStore'

// ─── Types ───────────────────────────────────────────────────

interface FileNode {
  name: string
  isDirectory: boolean
  path: string
  children?: FileNode[]
}

type FlowItem =
  | { kind: 'label', name: string, line: number }
  | { kind: 'goto', target: string, line: number }
  | { kind: 'call', target: string, line: number }
  | { kind: 'next', target: string, line: number }
  | { kind: 'condition', id: number, expression?: string, ifBranch: FlowItem[], elseBranch: FlowItem[], line: number }

interface HandleInfo {
  id: string
  type: 'source' | 'target'
  kind: 'label' | 'goto' | 'call' | 'next' | 'condition-if' | 'condition-else' | 'entry'
  label: string
  depth: number
  line?: number
  expression?: string
}

interface RowItem {
  kind: FlowItem['kind'] | 'return'
  label: string
  handles: HandleInfo[]
  depth: number
  branchLabel?: string
  line?: number
  expression?: string
  returnTarget?: { callerId: string, callerRowIdx: number }
}

// ─── Style lookup tables ─────────────────────────────────────

const SUB_STYLES: Record<string, { bg: string, border: string, text: string }> = {
  label:     { bg: '#064e3b', border: '#10b981', text: '#6ee7b7' },
  goto:      { bg: '#27272a', border: '#71717a', text: '#a1a1aa' }, // gray (zinc)
  next:      { bg: '#2e1065', border: '#8b5cf6', text: '#c4b5fd' }, // violet
  call:      { bg: '#4c0519', border: '#f43f5e', text: '#fda4af' }, // rose
  condition: { bg: '#422006', border: '#eab308', text: '#fde047' }, // yellow
  return:    { bg: '#1e3a8a', border: '#3b82f6', text: '#93c5fd' }, // blue
}

const EXT_EDGE_STYLES: Record<string, { color: string, dash: string }> = {
  next: { color: '#8b5cf6', dash: 'none' }, // violet
  call: { color: '#f43f5e', dash: '5,5' },  // rose
  goto: { color: '#71717a', dash: 'none' }, // gray
}

// ─── Blueprint row constants ─────────────────────────────────

const ROW_STRIDE = 30  // 28px (h-7) + 2px (flex gap)
const HEADER_H = 44
const NODE_W = 320
const ROWS_PAD_TOP = 4 // py-1

const SUB_ICONS: Record<string, string> = {
  label: '⌗',
  goto: '⇥',
  next: '→',
  call: '↗',
  condition: '◇',
  return: '↵',
}

// ─── Custom Node: Scene Block (Blueprint) ────────────────────

function SceneBlockComponent({ data, id }: NodeProps) {
  const rows = (data.rows || []) as RowItem[]
  const handles = (data.handles || []) as HandleInfo[]
  const entryHandle = handles.find(h => h.kind === 'entry')
  const { setPendingLine, setActiveFile, setIsGraphOpen } = useProjectStore()
  const { setCenter, getNode, setNodes } = useReactFlow()
  const [localHighlightedRow, setLocalHighlightedRow] = useState<number | null>(null)
  const highlightedRow = (data.highlightedRowIndex as number | null | undefined) ?? localHighlightedRow
  const [hoveredGoto, setHoveredGoto] = useState<{ sourceRi: number, targetRi: number, color: string } | null>(null)
  const [hoveredParentLine, setHoveredParentLine] = useState<{ sourceRi: number, targetRi: number, color: string } | null>(null)
  const [hoveredCondition, setHoveredCondition] = useState<{ ri: number, expr: string, raw: string, color: string } | null>(null)

  const rowCount = data.error ? 2 : Math.max(1, rows.length)
  const totalHeight = HEADER_H + ROWS_PAD_TOP * 2 + rowCount * ROW_STRIDE

  return (
    <div
      className={`group relative backdrop-blur-md border rounded-lg shadow-xl transition-[border-color,box-shadow,background-color] duration-300 ${
        data.highlighted
          ? 'bg-surface-800 border-primary-500 shadow-lg shadow-primary-500/30 z-50'
          : data.error
            ? 'bg-surface-900/95 border-red-500/40 shadow-red-500/5 hover:border-red-500/70 hover:shadow-red-500/10 z-10'
            : 'bg-surface-900/95 border-surface-700/60 z-10'
      }`}
      style={{ width: NODE_W, height: totalHeight }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />

      {/* ── Header ── */}
      <div
        className="relative flex items-center gap-3 px-4 border-b border-surface-700/40 rounded-t-lg"
        style={{
          height: HEADER_H,
          background: data.error
            ? 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent)'
            : 'linear-gradient(135deg, rgba(139,92,246,0.08), transparent)'
        }}
      >
        {entryHandle && (
          <Handle
            type="target"
            position={Position.Left}
            id={entryHandle.id}
            className="!w-3 !h-3 !bg-surface-800 !border-2 !border-primary-500 rounded-full"
            style={{ top: HEADER_H / 2, left: -6 }}
          />
        )}
        <div className={`flex items-center justify-center w-7 h-7 rounded-md bg-surface-800/80 border shrink-0 ${
          data.error
            ? 'border-red-500/30 text-red-400'
            : 'border-surface-700/50 text-primary-400'
        }`}>
          {data.error ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${
            data.error ? 'text-red-500/70' : 'text-primary-500/70'
          }`}>Scene</span>
          <span className="text-xs font-bold text-surface-100 font-mono truncate" title={String(data.label || '')}>
            {String(data.label || '')}
          </span>
        </div>
      </div>

      {/* ── Flow rows ── */}
      <div className="py-1 relative flex flex-col gap-[2px]">
        {/* ── Internal Flow Overlay ── */}
        {(hoveredGoto || hoveredParentLine) && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-50 overflow-visible">
            <style>{`
              @keyframes flow-dash {
                from { stroke-dashoffset: 16; }
                to { stroke-dashoffset: 0; }
              }
            `}</style>
            
            {/* Goto line on the right */}
            {hoveredGoto && (
              <g>
                <path
                  d={`M ${NODE_W - 7} ${18 + hoveredGoto.sourceRi * 30} C ${NODE_W + 55} ${18 + hoveredGoto.sourceRi * 30}, ${NODE_W + 55} ${18 + hoveredGoto.targetRi * 30}, ${NODE_W - 7} ${18 + hoveredGoto.targetRi * 30}`}
                  fill="none"
                  stroke={hoveredGoto.color}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  style={{ animation: 'flow-dash 0.5s linear infinite' }}
                />
                <circle cx={NODE_W - 7} cy={18 + hoveredGoto.sourceRi * 30} r="3" fill={hoveredGoto.color} />
                <circle cx={NODE_W - 7} cy={18 + hoveredGoto.targetRi * 30} r="3" fill={hoveredGoto.color} />
              </g>
            )}

            {/* Parent hierarchy line on the left */}
            {hoveredParentLine && (
              <g>
                <path
                  d={`M 7 ${18 + hoveredParentLine.sourceRi * 30} C -55 ${18 + hoveredParentLine.sourceRi * 30}, -55 ${18 + hoveredParentLine.targetRi * 30}, 7 ${18 + hoveredParentLine.targetRi * 30}`}
                  fill="none"
                  stroke={hoveredParentLine.color}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  style={{ animation: 'flow-dash 0.5s linear infinite' }}
                />
                <circle cx={7} cy={18 + hoveredParentLine.sourceRi * 30} r="3" fill={hoveredParentLine.color} />
                <circle cx={7} cy={18 + hoveredParentLine.targetRi * 30} r="3" fill={hoveredParentLine.color} />
              </g>
            )}
          </svg>
        )}

        {/* ── Custom Condition Tooltip ── */}
        {hoveredCondition && (
          <div 
            className="absolute z-[100] left-full ml-4 max-w-[400px] w-max bg-surface-950/95 backdrop-blur-xl border rounded-lg shadow-2xl pointer-events-none"
            style={{ 
              top: 18 + hoveredCondition.ri * 30, 
              transform: 'translateY(-50%)',
              borderColor: `${hoveredCondition.color}80` 
            }}
          >
            <div 
              className="px-3 py-1.5 border-b flex items-center gap-2 rounded-t-lg"
              style={{ backgroundColor: `${hoveredCondition.color}15`, borderColor: `${hoveredCondition.color}30` }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: hoveredCondition.color }}>Condition Expression</span>
            </div>
            <div className="p-3">
              <pre className="text-[11px] font-mono text-surface-100 whitespace-pre-wrap leading-relaxed m-0">
                {hoveredCondition.expr}
              </pre>
            </div>
          </div>
        )}

        {rows.map((row, ri) => {
          const s = SUB_STYLES[row.kind] || SUB_STYLES.label
          const icon = SUB_ICONS[row.kind] || '•'

          return (
            <div
              key={ri}
              onClick={(e) => {
                e.stopPropagation()
                if (row.depth > 0) {
                  let parentIdx = -1
                  for (let i = ri - 1; i >= 0; i--) {
                    if (rows[i].depth === row.depth - 1 && rows[i].kind === 'condition') {
                      parentIdx = i
                      break
                    }
                  }
                  if (parentIdx !== -1) {
                    setLocalHighlightedRow(parentIdx)
                    setTimeout(() => setLocalHighlightedRow(null), 2000)
                    
                    const node = getNode(id)
                    if (node && node.position) {
                      const yOffset = HEADER_H + ROWS_PAD_TOP + parentIdx * ROW_STRIDE + 28 / 2
                      setCenter(node.position.x + NODE_W / 2, node.position.y + yOffset, { duration: 800, zoom: 1.2 })
                    }
                  }
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (row.line !== undefined) setPendingLine(row.line)
                if (data.fullPath) {
                  setActiveFile(String(data.fullPath))
                  setIsGraphOpen(false)
                }
              }}
              onMouseEnter={() => {
                if (row.kind === 'goto') {
                  const targetIdx = rows.findIndex(r => r.kind === 'label' && r.label === row.label)
                  if (targetIdx !== -1) setHoveredGoto({ sourceRi: ri, targetRi: targetIdx, color: s.border })
                }
                
                if (row.depth > 0) {
                  let parentIdx = -1
                  for (let i = ri - 1; i >= 0; i--) {
                    if (rows[i].depth === row.depth - 1 && rows[i].kind === 'condition') {
                      parentIdx = i
                      break
                    }
                  }
                  if (parentIdx !== -1) {
                    setHoveredParentLine({ sourceRi: parentIdx, targetRi: ri, color: SUB_STYLES.condition.border })
                  }
                }
              }}
              onMouseLeave={() => {
                setHoveredGoto(null)
                setHoveredParentLine(null)
              }}
              className="relative flex shrink-0 items-center h-7 px-3 mx-1 rounded cursor-pointer transition-all hover:brightness-125"
              style={{
                paddingLeft: 12 + row.depth * 14,
                background: `${s.bg}40`,
                border: highlightedRow === ri ? `1px solid ${s.border}` : '1px solid transparent',
                boxShadow: highlightedRow === ri ? `0 0 12px ${s.border}80, inset 0 0 8px ${s.border}40` : 'none',
                transform: highlightedRow === ri ? 'scale(1.02)' : 'scale(1)',
                zIndex: highlightedRow === ri ? 10 : 1,
              }}
            >
              {/* Row handles */}
              {row.handles.map((h) => (
                <Handle
                  key={h.id}
                  type={h.type}
                  position={Position.Right}
                  id={h.id}
                  className="!w-2 !h-2 !rounded-full !border-none"
                  style={{
                    background: s.border,
                    right: -4,
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
              ))}

              {/* Branch label (if/else) */}
              {row.branchLabel && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider mr-1.5 shrink-0"
                  style={{ color: row.branchLabel === 'if' ? '#10b981' : '#ef4444' }}
                >
                  {row.branchLabel}
                </span>
              )}

              {/* Icon */}
              <span
                className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 mr-1.5"
                style={{ color: s.border, background: `${s.border}20`, fontSize: '10px' }}
              >
                <span className="-translate-y-[0.5px] leading-none">{icon}</span>
              </span>

              {/* Kind tag */}
              <span className="text-[9px] font-bold uppercase tracking-wider shrink-0 mr-2" style={{ color: s.text }}>
                {row.kind === 'condition' ? 'cond' : row.kind}
              </span>

              {/* Label */}
              {row.label && (
                ['goto', 'call', 'next', 'return'].includes(row.kind) ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (row.kind === 'goto') {
                        const targetIdx = rows.findIndex(r => r.kind === 'label' && r.label === row.label)
                        if (targetIdx !== -1) {
                          setLocalHighlightedRow(targetIdx)
                          setTimeout(() => setLocalHighlightedRow(null), 2000)
                          
                          const node = getNode(id)
                          if (node && node.position) {
                            const yOffset = HEADER_H + ROWS_PAD_TOP + targetIdx * ROW_STRIDE + 28 / 2
                            setCenter(node.position.x + NODE_W / 2, node.position.y + yOffset, { duration: 800, zoom: 1.2 })
                          }
                        }
                      } else if (row.kind === 'return' && row.returnTarget) {
                        const { callerId, callerRowIdx } = row.returnTarget
                        const targetNode = getNode(callerId)
                        if (targetNode && targetNode.position) {
                          const yOffset = HEADER_H + ROWS_PAD_TOP + callerRowIdx * ROW_STRIDE + 28 / 2
                          setCenter(targetNode.position.x + NODE_W / 2, targetNode.position.y + yOffset, { duration: 800, zoom: 1.2 })
                          
                          setNodes(nds => nds.map(n => n.id === callerId ? { ...n, data: { ...n.data, highlightedRowIndex: callerRowIdx } } : n))
                          setTimeout(() => {
                            setNodes(nds => nds.map(n => n.id === callerId ? { ...n, data: { ...n.data, highlightedRowIndex: null } } : n))
                          }, 2000)
                        }
                      } else {
                        // call or next -> jump to scene node
                        const targetNodeId = row.label
                        const targetNode = getNode(targetNodeId)
                        if (targetNode && targetNode.position) {
                          setCenter(targetNode.position.x + NODE_W / 2, targetNode.position.y + HEADER_H, { duration: 800, zoom: 1.2 })
                          setNodes(nds => nds.map(n => n.id === targetNodeId ? { ...n, data: { ...n.data, highlighted: true } } : n))
                          setTimeout(() => {
                            setNodes(nds => nds.map(n => n.id === targetNodeId ? { ...n, data: { ...n.data, highlighted: false } } : n))
                          }, 2000)
                        }
                      }
                    }}
                    className="cursor-pointer ml-auto px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-all hover:brightness-125 hover:shadow-md active:scale-95 max-w-[160px] truncate"
                    style={{ color: '#fff', backgroundColor: `${s.border}50`, border: `1px solid ${s.border}90` }}
                    title={`Jump to ${row.label}`}
                  >
                    {row.label}
                  </button>
                ) : (
                  <span
                    className="text-[11px] font-medium truncate flex-1 text-right font-mono pointer-events-auto min-w-0"
                    style={{ color: '#cbd5e1' }}
                    title={row.kind === 'condition' ? undefined : row.label}
                    onMouseEnter={async (e) => {
                      if (row.kind === 'condition' && row.expression) {
                        // Elevate the entire node's z-index to ensure the tooltip is on top of everything
                        const nodeEl = e.currentTarget.closest('.react-flow__node') as HTMLElement
                        if (nodeEl) nodeEl.style.zIndex = '1000'

                        setHoveredCondition({ ri, expr: 'Formatting...', raw: row.expression, color: s.border })
                        try {
                          // Wrap the condition in a dummy statement to ensure prettier formats it properly
                          const dummyCode = `if (${row.expression}) {}`
                          const result = await window.api.fs.formatCode(dummyCode)
                          
                          if (result.success && result.content) {
                            // Extract the formatted condition back out
                            const match = result.content.match(/^if\s*\(([\s\S]*?)\)\s*\{/)
                            const formatted = match ? match[1].trim() : result.content.trim()
                            setHoveredCondition(prev => prev?.ri === ri ? { ri, expr: formatted, raw: row.expression!, color: s.border } : prev)
                          } else {
                            setHoveredCondition(prev => prev?.ri === ri ? { ri, expr: row.expression!, raw: row.expression!, color: s.border } : prev)
                          }
                        } catch (e) {
                          setHoveredCondition(prev => prev?.ri === ri ? { ri, expr: row.expression!, raw: row.expression!, color: s.border } : prev)
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (row.kind === 'condition') {
                        setHoveredCondition(null)
                        const nodeEl = e.currentTarget.closest('.react-flow__node') as HTMLElement
                        if (nodeEl) nodeEl.style.zIndex = ''
                      }
                    }}
                  >
                    {row.label}
                  </span>
                )
              )}
            </div>
          )
        })}
        {data.error ? (
          <div className="mx-1 px-3 py-2 bg-red-950/40 border border-red-900/40 rounded flex flex-col gap-1 text-[10px] text-red-300">
            <div className="flex items-center gap-1.5 font-bold text-red-400">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              평가 실패 (Evaluation Failed)
            </div>
            <div className="font-mono text-[9px] line-clamp-3 leading-normal break-all" title={String(data.error)}>
              {String(data.error)}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="h-7 flex items-center justify-center text-[10px] text-surface-500 italic">
            (empty)
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Custom Node: Missing Scene ──────────────────────────────

function MissingNodeComponent({ data }: NodeProps) {
  return (
    <div
      className={`group relative flex items-center min-w-[220px] px-4 py-3 backdrop-blur-md border rounded-md shadow-lg transition-[border-color,box-shadow] duration-300 hover:shadow-red-500/20 hover:border-red-500/50 ${
        data.highlighted
          ? 'bg-red-900/40 border-red-400 shadow-lg shadow-red-500/30 z-50'
          : 'bg-red-950/60 border-red-900/50 z-10'
      }`}
      style={{ width: 220, height: 65 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-md pointer-events-none" />
      <Handle
        type="target"
        position={Position.Left}
        id={`${String(data.sceneId || data.label || '')}__entry`}
        className="!w-3 !h-3 !bg-surface-800 !border-2 !border-red-500 rounded-full !-ml-1.5"
      />

      <div className="flex items-center gap-3 relative z-10 w-full">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-950/80 border border-red-900/50 text-red-400 shadow-inner shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider mb-0.5">Missing Scene</span>
          <span className="text-sm font-bold text-red-200 font-mono truncate w-full" title={String(data.label || '').replace(' (Missing)', '')}>
            {String(data.label || '').replace(' (Missing)', '')}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── nodeTypes (defined outside component to prevent re-renders) ─

const nodeTypes = {
  'scene-block': SceneBlockComponent,
  missing: MissingNodeComponent,
}

// ─── dagre layout (dynamic node sizes) ───────────────────────

function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))

  const isHorizontal = direction === 'LR'
  g.setGraph({ rankdir: direction, ranksep: 120, nodesep: 40, edgesep: 30 })

  for (const node of nodes) {
    if (node.type === 'missing') {
      g.setNode(node.id, { width: 220, height: 65 })
    } else {
      const rowCount = Math.max(1, ((node.data?.rows as RowItem[])?.length ?? 0))
      const h = HEADER_H + ROWS_PAD_TOP * 2 + rowCount * ROW_STRIDE
      g.setNode(node.id, { width: NODE_W, height: h })
    }
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map(node => {
    const pos = g.node(node.id)
    const w = node.type === 'missing' ? 220 : NODE_W
    const rowCount = Math.max(1, ((node.data?.rows as RowItem[])?.length ?? 0))
    const h = node.type === 'missing' ? 65 : HEADER_H + ROWS_PAD_TOP * 2 + rowCount * ROW_STRIDE
    
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: pos ? pos.x - w / 2 : 0,
        y: pos ? pos.y - h / 2 : 0,
      }
    }
  })

  return { nodes: layoutedNodes, edges }
}

// ─── Scene dynamic evaluation parser has been moved to main process ───

// ─── FlowItem → handles + rows + edges builder ───────────────

function buildHandlesAndEdges(
  sceneId: string,
  items: FlowItem[],
  depth: number = 0,
  branchLabel?: string,
): { rows: RowItem[], handles: HandleInfo[], edges: Edge[] } {
  const rows: RowItem[] = []
  const handles: HandleInfo[] = []
  const edges: Edge[] = []

  // Track handle ID counters to avoid duplicates
  const idCounters = new Map<string, number>()
  function uniqueHandleId(base: string): string {
    const count = idCounters.get(base) ?? 0
    idCounters.set(base, count + 1)
    return count === 0 ? base : `${base}__${count}`
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const rowHandles: HandleInfo[] = []
    let rowLabel = ''

    switch (item.kind) {
      case 'label': {
        rowLabel = item.name
        const hId = uniqueHandleId(`${sceneId}__label__${item.name}`)
        const h: HandleInfo = { id: hId, type: 'target', kind: 'label', label: item.name, depth, line: item.line }
        rowHandles.push(h)
        handles.push(h)
        break
      }
      case 'goto': {
        rowLabel = item.target
        const hId = uniqueHandleId(`${sceneId}__goto__${item.target}`)
        const h: HandleInfo = { id: hId, type: 'source', kind: 'goto', label: item.target, depth, line: item.line }
        rowHandles.push(h)
        handles.push(h)
        break
      }
      case 'call': {
        rowLabel = item.target
        const hId = uniqueHandleId(`${sceneId}__call__${item.target}`)
        const h: HandleInfo = { id: hId, type: 'source', kind: 'call', label: item.target, depth, line: item.line }
        rowHandles.push(h)
        handles.push(h)
        // Edge: call → target scene entry
        const s = EXT_EDGE_STYLES.call
        edges.push({
          id: `e-${hId}`,
          source: sceneId,
          sourceHandle: hId,
          target: item.target,
          targetHandle: `${item.target}__entry`,
          animated: true,
          style: { stroke: s.color, strokeWidth: 2, strokeDasharray: s.dash },
          markerEnd: { type: MarkerType.ArrowClosed, color: s.color },
        })
        break
      }
      case 'next': {
        rowLabel = item.target
        const hId = uniqueHandleId(`${sceneId}__next__${item.target}`)
        const h: HandleInfo = { id: hId, type: 'source', kind: 'next', label: item.target, depth, line: item.line }
        rowHandles.push(h)
        handles.push(h)
        // Edge: next → target scene entry
        const s = EXT_EDGE_STYLES.next
        edges.push({
          id: `e-${hId}`,
          source: sceneId,
          sourceHandle: hId,
          target: item.target,
          targetHandle: `${item.target}__entry`,
          animated: true,
          style: { stroke: s.color, strokeWidth: 2, strokeDasharray: s.dash },
          markerEnd: { type: MarkerType.ArrowClosed, color: s.color },
        })
        break
      }
      case 'condition': {
        rowLabel = item.expression ? item.expression : `#${item.id}`
        // condition header row (no handles on this row itself)
        rows.push({
          kind: 'condition',
          label: rowLabel,
          handles: [],
          depth,
          branchLabel: branchLabel,
          line: item.line,
          expression: item.expression,
        })

        // if branch
        if (item.ifBranch.length > 0) {
          const ifResult = buildHandlesAndEdges(sceneId, item.ifBranch, depth + 1, 'if')
          rows.push(...ifResult.rows)
          handles.push(...ifResult.handles)
          edges.push(...ifResult.edges)
        } else {
          // Empty if branch indicator
          const hId = uniqueHandleId(`${sceneId}__cond__${item.id}__if`)
          const h: HandleInfo = { id: hId, type: 'source', kind: 'condition-if', label: 'if (empty)', depth: depth + 1 }
          handles.push(h)
          rows.push({ kind: 'condition', label: '(empty)', handles: [h], depth: depth + 1, branchLabel: 'if' })
        }

        // else branch
        if (item.elseBranch.length > 0) {
          const elseResult = buildHandlesAndEdges(sceneId, item.elseBranch, depth + 1, 'else')
          rows.push(...elseResult.rows)
          handles.push(...elseResult.handles)
          edges.push(...elseResult.edges)
        } else {
          const hId = uniqueHandleId(`${sceneId}__cond__${item.id}__else`)
          const h: HandleInfo = { id: hId, type: 'source', kind: 'condition-else', label: 'else (empty)', depth: depth + 1 }
          handles.push(h)
          rows.push({ kind: 'condition', label: '(empty)', handles: [h], depth: depth + 1, branchLabel: 'else' })
        }

        continue // already pushed rows above
      }
    }

    rows.push({
      kind: item.kind,
      label: rowLabel,
      handles: rowHandles,
      depth,
      branchLabel: i === 0 ? branchLabel : undefined,
      line: item.line,
    })
  }

  return { rows, handles, edges }
}

// ─── Main Component ──────────────────────────────────────────

export function SceneGraphViewer() {
  const { projectPath, setActiveFile, setIsGraphOpen } = useProjectStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [isLoading, setIsLoading] = useState(true)
  const loadedPathRef = useRef<string | null>(null)

  const processFiles = useCallback(async () => {
    if (!projectPath || loadedPathRef.current === projectPath) return
    loadedPathRef.current = projectPath
    setIsLoading(true)

    const scenesPath = `${projectPath}/scenes`
    const allFiles: { fullPath: string, relPath: string, name: string }[] = []

    try {
      const res = await window.api.fs.readDir(scenesPath, true)
      if (res.success && res.files) {
        const collectFiles = (fileNodes: FileNode[]) => {
          for (const node of fileNodes) {
            if (node.isDirectory && node.children) {
              collectFiles(node.children)
            } else if (!node.isDirectory && node.name.endsWith('.ts')) {
              allFiles.push({
                fullPath: `${scenesPath}/${node.path}`,
                relPath: node.path,
                name: node.path.replace(/\\/g, '/').replace(/\.[^/.]+$/, '')
              })
            }
          }
        }
        collectFiles(res.files)
      }

      const allNodes: Node[] = []
      const allEdges: Edge[] = []

      const filePaths = allFiles.map(f => f.fullPath)
      const parseRes = await window.api.project.parseScenes(filePaths, projectPath || undefined)
      const sceneParsedMap = new Map<string, any>()
      if (parseRes.success && parseRes.scenes) {
        for (const s of parseRes.scenes) {
          sceneParsedMap.set(s.path, s.parsed)
        }
      }

      for (const file of allFiles) {
        const fileId = file.name
        const parsed = sceneParsedMap.get(file.fullPath) || { flowItems: [], externalConnections: [] }

        // Build handles + rows from flow items
        const { rows, handles, edges: itemEdges } = buildHandlesAndEdges(fileId, parsed.flowItems)

        // Add entry handle
        const entryHandle: HandleInfo = {
          id: `${fileId}__entry`,
          type: 'target',
          kind: 'entry',
          label: fileId,
          depth: 0,
        }
        const allHandles = [entryHandle, ...handles]

        // Scene block node
        allNodes.push({
          id: fileId,
          type: 'scene-block',
          data: { label: fileId, fullPath: file.fullPath, rows, handles: allHandles, error: parsed.error },
          position: { x: 0, y: 0 },
        })

        allEdges.push(...itemEdges)
      }

      // Collect all known scene IDs
      const knownIds = new Set(allNodes.map(n => n.id))

      // Build call graph to find subroutine terminal nodes
      const directCallers = new Map<string, Set<string>>()
      for (const node of allNodes) {
        const rows = (node.data?.rows as RowItem[]) || []
        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri]
          if (row.kind === 'call' && knownIds.has(row.label)) {
            if (!directCallers.has(row.label)) directCallers.set(row.label, new Set())
            directCallers.get(row.label)!.add(JSON.stringify({ callerId: node.id, callerRowIdx: ri }))
          }
        }
      }

      // Trace subroutine paths to find their terminal returns
      const terminalReturns = new Map<string, Set<string>>()
      for (const [subEntry, callers] of directCallers.entries()) {
        const visited = new Set<string>()
        const queue = [subEntry]
        
        while (queue.length > 0) {
          const curr = queue.shift()!
          if (visited.has(curr)) continue
          visited.add(curr)
          
          const currNode = allNodes.find(n => n.id === curr)
          if (!currNode) continue
          
          let hasNext = false
          const hs = (currNode.data?.handles as HandleInfo[]) || []
          for (const h of hs) {
            if (h.kind === 'next' && knownIds.has(h.label)) {
              hasNext = true
              queue.push(h.label)
            }
          }
          
          // If no outgoing 'next' edges, it's a terminal node for this subroutine
          if (!hasNext) {
            if (!terminalReturns.has(curr)) terminalReturns.set(curr, new Set())
            for (const caller of callers) {
              terminalReturns.get(curr)!.add(caller)
            }
          }
        }
      }

      // Append return rows to terminal nodes
      for (const [terminalNodeId, callers] of terminalReturns.entries()) {
        const node = allNodes.find(n => n.id === terminalNodeId)
        if (!node) continue
        
        const rows = node.data.rows as RowItem[]
        // Deduplicate callers and sort them for consistent rendering
        const sortedCallers = Array.from(callers).sort()
        for (const callerStr of sortedCallers) {
          const { callerId, callerRowIdx } = JSON.parse(callerStr)
          rows.push({
            kind: 'return',
            label: callerId,
            handles: [],
            depth: 0,
            returnTarget: { callerId, callerRowIdx }
          })
        }
      }

      // Build goto → label edges (within same or cross scene)
      const labelHandleMap = new Map<string, { sceneId: string, handleId: string }>()
      for (const node of allNodes) {
        if (node.type !== 'scene-block') continue
        const hs = (node.data?.handles as HandleInfo[]) || []
        for (const h of hs) {
          if (h.kind === 'label') {
            labelHandleMap.set(`${node.id}:${h.label}`, { sceneId: node.id, handleId: h.id })
          }
        }
      }

      for (const node of allNodes) {
        if (node.type !== 'scene-block') continue
        const hs = (node.data?.handles as HandleInfo[]) || []
        for (const h of hs) {
          if (h.kind === 'goto') {
            // Try same scene first, then cross-scene
            const target = labelHandleMap.get(`${node.id}:${h.label}`)
            if (target) {
              const isInternal = target.sceneId === node.id
              // Skip internal lines to avoid visual clutter. The text alone is sufficient.
              if (isInternal) continue
              
              const s = EXT_EDGE_STYLES.goto
              allEdges.push({
                id: `e-goto-${h.id}`,
                source: node.id,
                sourceHandle: h.id,
                target: target.sceneId,
                targetHandle: target.handleId,
                animated: true,
                style: { stroke: s.color, strokeWidth: 1.5, strokeDasharray: s.dash },
                markerEnd: { type: MarkerType.ArrowClosed, color: s.color },
              })
            }
          }
        }
      }

      // Add missing scene nodes for unresolved edge targets
      const edgeTargets = new Set(allEdges.map(e => e.target))
      for (const targetId of edgeTargets) {
        if (!knownIds.has(targetId)) {
          knownIds.add(targetId)
          allNodes.push({
            id: targetId,
            type: 'missing',
            data: { label: `${targetId} (Missing)`, sceneId: targetId },
            position: { x: 0, y: 0 },
          })
        }
      }

      // Layout
      const { nodes: laid, edges: laidE } = getLayoutedElements(allNodes, allEdges, 'LR')
      setNodes(laid)
      setEdges(laidE)
    } catch (e) {
      console.error('Failed to parse scenes for graph', e)
      loadedPathRef.current = null
    } finally {
      setIsLoading(false)
    }
  }, [projectPath, setNodes, setEdges])

  useEffect(() => {
    if (projectPath && loadedPathRef.current !== projectPath) {
      processFiles()
    }
  }, [projectPath, processFiles])

  // Double-click node → open in editor
  const onNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    const fullPath = node.data?.fullPath
    if (fullPath) {
      setActiveFile(String(fullPath))
      setIsGraphOpen(false)
    }
  }, [setActiveFile, setIsGraphOpen])

  const memoNodeTypes = useMemo(() => nodeTypes, [])

  return (
    <div className="absolute inset-0 bg-surface-950 flex flex-col z-40">
      <div className="h-14 border-b border-surface-800 bg-surface-900/90 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <h2 className="font-semibold text-surface-200">Scene Connection Graph</h2>
        </div>
        <button
          onClick={() => setIsGraphOpen(false)}
          className="flex items-center justify-center w-8 h-8 rounded-sm bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white transition-colors"
          title="닫기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-surface-400 text-sm">씬 파일을 분석하는 중...</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={memoNodeTypes}
            fitView
            className="bg-surface-950"
            colorMode="dark"
          >
            <Background color="#333" gap={16} />
            <Controls className="bg-surface-800 border-surface-700 fill-surface-300" />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'missing') return '#ef4444'
                return '#8b5cf6'
              }}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="bg-surface-900 border border-surface-800"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

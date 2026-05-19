// =============================================================
// BlueprintNode.tsx — 블루프린트 커스텀 노드 컴포넌트
// =============================================================

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  type PinDef,
  type NodeCategory,
  PIN_COLORS,
  NODE_CATEGORY_COLORS,
  NODE_CATALOG,
} from '../../types/blueprint'

// ─── 핀 핸들 컴포넌트 ────────────────────────────────────────

function PinHandle({ pin, nodeId }: { pin: PinDef, nodeId: string }) {
  const isInput = pin.direction === 'input'
  const isExec = pin.pinType === 'exec'
  const color = PIN_COLORS[pin.dataType ?? 'exec']

  const handleId = `${nodeId}__${pin.id}`

  return (
    <div
      className="relative flex items-center gap-1.5 py-0.5"
      style={{
        flexDirection: isInput ? 'row' : 'row-reverse',
        justifyContent: isInput ? 'flex-start' : 'flex-end',
      }}
    >
      <Handle
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        id={handleId}
        className="!border-none"
        style={{
          width: isExec ? 10 : 8,
          height: isExec ? 10 : 8,
          background: color,
          borderRadius: isExec ? 2 : '50%',
          transform: isExec ? 'rotate(45deg)' : undefined,
          [isInput ? 'left' : 'right']: -4,
          position: 'absolute',
          top: '50%',
          marginTop: isExec ? -5 : -4,
        }}
      />
      {pin.label !== '▶' && (
        <span
          className="text-[10px] font-medium select-none"
          style={{
            color: isExec ? '#ccc' : color,
            paddingLeft: isInput ? 8 : 0,
            paddingRight: isInput ? 0 : 8,
          }}
        >
          {pin.label}
        </span>
      )}
    </div>
  )
}

// ─── 메인 블루프린트 노드 ────────────────────────────────────

function BlueprintNodeInner({ id, data, selected }: NodeProps) {
  const nodeType = data.nodeType as string
  const catalog = NODE_CATALOG.find(n => n.type === nodeType)
  if (!catalog) return null

  const category = catalog.category as NodeCategory
  const colors = NODE_CATEGORY_COLORS[category]

  const inputPins = catalog.pins.filter(p => p.direction === 'input')
  const outputPins = catalog.pins.filter(p => p.direction === 'output')

  const maxRows = Math.max(inputPins.length, outputPins.length, 1)

  return (
    <div
      className="rounded-lg shadow-xl transition-shadow"
      style={{
        background: colors.bg,
        border: `1.5px solid ${selected ? '#fff' : colors.border}`,
        minWidth: 180,
        boxShadow: selected
          ? `0 0 16px ${colors.border}60`
          : `0 4px 12px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-t-lg"
        style={{ background: `${colors.header}cc` }}
      >
        <span
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: `${colors.text}aa` }}
        >
          {category}
        </span>
        <span
          className="text-[11px] font-bold"
          style={{ color: colors.text }}
        >
          {catalog.label}
        </span>
      </div>

      {/* Pins Area */}
      <div className="px-1 py-1.5">
        {Array.from({ length: maxRows }).map((_, i) => (
          <div key={i} className="flex justify-between items-center min-h-[20px]">
            <div className="flex-1">
              {inputPins[i] && <PinHandle pin={inputPins[i]} nodeId={id} />}
            </div>
            <div className="flex-1">
              {outputPins[i] && <PinHandle pin={outputPins[i]} nodeId={id} />}
            </div>
          </div>
        ))}
      </div>

      {/* Inspector inline data */}
      {data.inlineValue !== undefined && (
        <div className="px-3 pb-2">
          <input
            className="w-full bg-black/30 border border-white/10 rounded px-2 py-0.5 text-[10px] text-white outline-none focus:border-white/30"
            value={String(data.inlineValue ?? '')}
            onChange={() => {
              // noop — 실제 업데이트는 스토어를 통해 처리
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export const BlueprintNode = memo(BlueprintNodeInner)

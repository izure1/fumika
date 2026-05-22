import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useModuleStore } from '../../store/useModuleStore'
import {
  type PinDef,
  type PinDataType,
  type NodeCategory,
  PIN_COLORS,
  NODE_CATEGORY_COLORS,
  NODE_CATALOG,
} from '../../types/blueprint'

// ─── 핀 핸들 컴포넌트 ────────────────────────────────────────

function PinHandle({ pin, nodeId }: { pin: PinDef, nodeId: string }): React.JSX.Element {
  const isInput = pin.direction === 'input'
  const isExec = pin.pinType === 'exec'
  const color = PIN_COLORS[pin.dataType ?? 'exec']

  const handleId = `${nodeId}__${pin.id}`

  return (
    <div
      className="relative flex w-full items-center gap-1.5 py-0.5"
      style={{
        flexDirection: isInput ? 'row' : 'row-reverse',
        justifyContent: 'flex-start',
      }}
    >
      <Handle
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        id={handleId}
        className="!border-none"
        style={{
          width: 12,
          height: 12,
          background: 'transparent',
          [isInput ? 'left' : 'right']: 6,
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: isExec ? 11 : 7,
            height: isExec ? 10 : 7,
            background: color,
            borderRadius: isExec ? undefined : '50%',
            clipPath: isExec ? 'polygon(0% 0%, 60% 0%, 100% 50%, 60% 100%, 0% 100%)' : undefined,
          }}
        />
      </Handle>
      {pin.label !== '▶' && (
        <span
          className="text-[10px] font-medium select-none"
          style={{
            color: isExec ? '#ccc' : color,
            paddingLeft: isInput ? 24 : 0,
            paddingRight: isInput ? 0 : 24,
          }}
        >
          {pin.label}
        </span>
      )}
    </div>
  )
}

function inferPinDataType(val: unknown): PinDataType {
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

// ─── 메인 블루프린트 노드 ────────────────────────────────────

function BlueprintNodeInner({ id, data, selected }: NodeProps): React.JSX.Element | null {
  const nodeType = data.nodeType as string
  const nodes = useModuleStore((s) => s.graphs[s.activeTab]?.nodes ?? [])
  const edges = useModuleStore((s) => s.graphs[s.activeTab]?.edges ?? [])
  const definitions = useModuleStore((s) => s.definitions)

  const catalog = NODE_CATALOG.find(n => n.type === nodeType)
  if (!catalog) return null

  const category = catalog.category as NodeCategory
  const colors = NODE_CATEGORY_COLORS[category]

  const hasError = (() => {
    if (nodeType === 'GetState') {
      const field = data.fieldName as string
      return !field || !definitions?.schemaDef.some(d => d.name === field)
    }
    if (nodeType === 'SetState') {
      const fields = (data.fields as string[]) || []
      return fields.some(f => !definitions?.schemaDef.some(d => d.name === f))
    }
    if (nodeType === 'GetCmd') {
      const field = data.fieldName as string
      return !field || !definitions?.commandDef.some(d => d.name === field)
    }
    return false
  })()

  let inputPins = catalog.pins.filter(p => p.direction === 'input')

  if (nodeType === 'MakeStyle') {
    const styleKeys = (data.styleKeys as string[]) || []
    inputPins = styleKeys.map(key => ({
      id: `prop__${key}`,
      label: key,
      direction: 'input' as const,
      pinType: 'data' as const,
      dataType: 'any' as PinDataType
    }))
  } else if (nodeType === 'MakeAttribute') {
    const attrKeys = (data.attrKeys as string[]) || []
    inputPins = attrKeys.map(key => ({
      id: `prop__${key}`,
      label: key,
      direction: 'input' as const,
      pinType: 'data' as const,
      dataType: 'any' as PinDataType
    }))
  } else if (nodeType === 'Execute') {
    const cmdKeys = (data.cmdKeys as string[]) || []
    inputPins = [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      { id: 'type', label: 'Type', direction: 'input', pinType: 'data', dataType: 'string' },
      ...cmdKeys.map(key => ({
        id: `prop__${key}`,
        label: key,
        direction: 'input' as const,
        pinType: 'data' as const,
        dataType: 'any' as PinDataType
      }))
    ]
  }

  if (nodeType === 'SetState') {
    const fields = (data.fields as string[]) || []
    inputPins = [
      { id: 'exec-in', label: '▶', direction: 'input', pinType: 'exec' },
      ...fields.map(field => {
        const val = data[field]
        let dataType: PinDataType = 'string'
        const def = definitions?.schemaDef.find(d => d.name === field)
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
        return {
          id: field,
          label: field,
          direction: 'input' as const,
          pinType: 'data' as const,
          dataType
        }
      })
    ]
  }

  if (nodeType === 'SetValue' || nodeType === 'SetConst' || nodeType === 'SetGlobal') {
    const val = data.value
    const dataType = inferPinDataType(val)
    inputPins = inputPins.map(p => p.id === 'value' ? { ...p, dataType } : p)
  }

  let outputPins = catalog.pins.filter(p => p.direction === 'output')

  if (nodeType === 'GetState' && data.fieldName) {
    const fieldName = data.fieldName as string
    const def = definitions?.schemaDef.find(d => d.name === fieldName)
    if (def) {
      outputPins = outputPins.map(p => p.id === 'value' ? { ...p, dataType: def.type } : p)
    }
  } else if (nodeType === 'GetCmd' && data.fieldName) {
    const fieldName = data.fieldName as string
    const def = definitions?.commandDef.find(d => d.name === fieldName)
    if (def) {
      outputPins = outputPins.map(p => p.id === 'value' ? { ...p, dataType: def.type } : p)
    }
  } else if (nodeType === 'Constant') {
    const val = data.value !== undefined ? data.value : data.inlineValue
    const dataType = inferPinDataType(val)
    outputPins = outputPins.map(p => p.id === 'value' ? { ...p, dataType } : p)
  } else if (nodeType === 'MakeFunction') {
    // 우측 패널에서 등록한 { name, type }[] 매개변수를 동적 출력 핀으로 노출
    type ArgDef = { name: string, type: PinDataType }
    const argDefs = (data.arguments as ArgDef[]) ?? []
    const argOutputPins = argDefs.map(arg => ({
      id: `prop__${arg.name}`,
      label: arg.name,
      direction: 'output' as const,
      pinType: 'data' as const,
      dataType: arg.type
    }))
    // 기본 핀(callback exec, fn data) 뒤에 동적 핀을 이어서 보여줌
    outputPins = [...catalog.pins.filter(p => p.direction === 'output'), ...argOutputPins]
  }

  const maxRows = Math.max(inputPins.length, outputPins.length, 1)

  const hasDetails = [
    'Constant', 'Compare', 'MathOp', 'GetState', 'SetState', 'GetCmd', 'GetVariable', 'GetValue', 'GetConst', 'GetGlobal', 'SetVariable', 'BindEvent', 'Log', 'Return', 'Branch', 'Yield', 'NovelLoadSave', 'NovelLoadEnv', 'MakeFunction', 'SetTimer'
  ].includes(nodeType)

  // 값 포맷터 함수
  const formatPreviewValue = (val: unknown): string => {
    if (val === undefined || val === null) return 'Empty'
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val)
      } catch {
        return '[Object]'
      }
    }
    return String(val)
  }

  return (
    <div
      className="blueprint-node-premium rounded-lg"
      style={{
        background: colors.bg,
        border: `1.2px solid ${hasError ? '#ef4444' : (selected ? colors.border : 'rgba(255, 255, 255, 0.08)')}`,
        minWidth: 190,
        boxShadow: hasError
          ? `0 0 20px #ef444440, 0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)`
          : (selected
            ? `0 0 20px ${colors.border}40, 0 8px 24px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)`
            : `0 10px 30px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.03)`),
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-3 rounded-t-[7px] border-b border-white/[0.04]"
        style={{
          background: colors.header,
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: hasError ? '#ef4444' : colors.border }}
        />
        <span
          className="text-[11px] font-semibold tracking-tight text-white/95"
        >
          {catalog.label}
        </span>
        {hasError && (
          <span className="text-[8px] bg-red-950/60 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
            Error
          </span>
        )}
        <span
          className="ml-auto text-[8px] font-bold uppercase tracking-widest opacity-25"
          style={{ color: colors.text }}
        >
          {category}
        </span>
      </div>

      {/* Pins Area */}
      <div className="px-2.5 py-2.5 flex flex-col gap-1">
        {Array.from({ length: maxRows }).map((_, i) => (
          <div key={i} className="flex justify-between items-center min-h-[22px]">
            <div className="flex-1">
              {inputPins[i] && <PinHandle pin={inputPins[i]} nodeId={id} />}
            </div>
            <div className="flex-1">
              {outputPins[i] && <PinHandle pin={outputPins[i]} nodeId={id} />}
            </div>
          </div>
        ))}
      </div>

      {/* Node-specific Custom Details */}
      {hasDetails && (
        <div className="px-3.5 pb-3.5 border-t border-white/5 pt-2.5 flex flex-col gap-2">
          {nodeType === 'MakeFunction' && (() => {
            type ArgDef = { name: string, type: PinDataType }
            const args = (data.arguments as ArgDef[]) || []
            return (
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] text-surface-400 font-bold uppercase tracking-wider">Arguments</span>
                {args.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {args.map((arg, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: PIN_COLORS[arg.type] ?? PIN_COLORS['any'] }}
                        />
                        <span className="text-[9px] text-surface-300 font-mono">{arg.name}</span>
                        <span
                          className="text-[8px] font-mono ml-auto"
                          style={{ color: PIN_COLORS[arg.type] ?? PIN_COLORS['any'] }}
                        >
                          {arg.type}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-surface-500 font-mono italic">No arguments</span>
                )}
              </div>
            )
          })()}

          {nodeType === 'Constant' && (() => {
            const val = data.value !== undefined ? data.value : data.inlineValue
            let currentType = data.constantType || 'string'
            if (data.value !== undefined) {
              if (typeof val === 'number') currentType = 'number'
              else if (typeof val === 'boolean') currentType = 'boolean'
              else if (val === null) currentType = 'null'
              else if (Array.isArray(val)) currentType = 'array'
              else if (typeof val === 'object' && val !== null) currentType = 'json'
            }

            return (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-surface-400 font-bold uppercase tracking-wider">
                  {String(currentType)}
                </span>
                <div className="text-[10px] text-surface-300 font-mono bg-black/30 px-2 py-1 rounded-md border border-white/5 truncate select-none">
                  {formatPreviewValue(val)}
                </div>
              </div>
            )
          })()}

          {nodeType === 'Compare' && (() => {
            const isABound = edges.some(e => e.target === id && e.targetHandle === `${id}__a`)
            const isBBound = edges.some(e => e.target === id && e.targetHandle === `${id}__b`)
            const valA = data.a
            const valB = data.b

            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-center py-0.5">
                  <span className="px-3.5 py-1 rounded-md bg-black/60 border border-white/5 text-[10px] font-bold font-mono text-primary-400 shadow-inner">
                    {String(data.operator ?? '==')}
                  </span>
                </div>
                {!isABound && valA !== undefined && valA !== '' && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                    <span className="text-[8px] text-surface-500 font-bold font-mono uppercase">A:</span>
                    <span className="text-[9px] text-surface-300 font-mono truncate">{formatPreviewValue(valA)}</span>
                  </div>
                )}
                {!isBBound && valB !== undefined && valB !== '' && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                    <span className="text-[8px] text-surface-500 font-bold font-mono uppercase">B:</span>
                    <span className="text-[9px] text-surface-300 font-mono truncate">{formatPreviewValue(valB)}</span>
                  </div>
                )}
              </div>
            )
          })()}

          {nodeType === 'MathOp' && (
            <div className="flex justify-center py-0.5">
              <span className="px-3.5 py-1 rounded-md bg-black/60 border border-white/5 text-[10px] font-bold font-mono text-primary-400 shadow-inner">
                {String(data.operator ?? '+')}
              </span>
            </div>
          )}

          {nodeType === 'GetState' && !!data.fieldName && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-inner ${
              hasError ? 'bg-red-950/20 border-red-500/20' : 'bg-black/30 border-white/5'
            }`}>
              <span className={`text-[8px] font-bold font-mono ${hasError ? 'text-red-400' : 'text-yellow-500'}`}>state.</span>
              <span className={`text-[10px] font-mono truncate ${hasError ? 'text-red-300' : 'text-surface-300'}`}>{String(data.fieldName)}</span>
              {hasError && <span className="text-red-400 text-[10px] ml-auto">⚠️</span>}
            </div>
          )}

          {nodeType === 'SetState' && (() => {
            const fields = (data.fields as string[]) || []
            const unboundFields = fields.filter(f => !edges.some(e => e.target === id && e.targetHandle === `${id}__${f}`))
            if (unboundFields.length === 0) return null

            return (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5">
                <span className="text-[8px] text-surface-400 font-bold uppercase tracking-wider">Direct Values</span>
                {unboundFields.map(f => {
                  const val = data[f]
                  if (val === undefined || val === '') return null
                  const isFieldMissing = !definitions?.schemaDef.some(d => d.name === f)
                  return (
                    <div key={f} className={`flex items-center justify-between gap-1.5 px-2 py-0.5 rounded border ${
                      isFieldMissing ? 'bg-red-950/20 border-red-500/20' : 'bg-black/20 border-white/5'
                    }`}>
                      <span className={`text-[9px] font-bold font-mono truncate max-w-[80px] ${
                        isFieldMissing ? 'text-red-400' : 'text-yellow-500'
                      }`}>{f}:</span>
                      <span className={`text-[9px] font-mono truncate ${
                        isFieldMissing ? 'text-red-300' : 'text-surface-300'
                      }`}>{isFieldMissing ? 'Missing Field' : formatPreviewValue(val)}</span>
                      {isFieldMissing && <span className="text-red-400 text-[10px]">⚠️</span>}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {nodeType === 'GetCmd' && !!data.fieldName && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-inner ${
              hasError ? 'bg-red-950/20 border-red-500/20' : 'bg-black/30 border-white/5'
            }`}>
              <span className={`text-[8px] font-bold font-mono ${hasError ? 'text-red-400' : 'text-blue-500'}`}>cmd.</span>
              <span className={`text-[10px] font-mono truncate ${hasError ? 'text-red-300' : 'text-surface-300'}`}>{String(data.fieldName)}</span>
              {hasError && <span className="text-red-400 text-[10px] ml-auto">⚠️</span>}
            </div>
          )}

          {nodeType === 'GetVariable' && (() => {
            const isNameBound = edges.some(e => e.target === id && e.targetHandle === `${id}__name`)
            if (isNameBound) return null
            return (
              <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5 shadow-inner">
                {data.scope !== 'global' && (
                  <span className="text-[8px] text-emerald-500 font-bold font-mono">
                    {data.scope === 'env' ? '$' : '_'}
                  </span>
                )}
                <span className="text-[10px] text-surface-300 font-mono truncate">{String(data.varName ?? 'Empty')}</span>
              </div>
            )
          })()}

          {(nodeType === 'GetValue' || nodeType === 'GetConst' || nodeType === 'GetGlobal') && (() => {
            const isNameBound = edges.some(e => e.target === id && e.targetHandle === `${id}__name`)
            if (isNameBound) return null
            const nameVal = data.name
            return (
              <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5 shadow-inner">
                <span className="text-[8px] text-purple-400 font-bold font-mono">
                  {nodeType === 'GetGlobal' ? 'G' : (nodeType === 'GetValue' ? 'V' : 'L')}
                </span>
                <span className="text-[10px] text-surface-300 font-mono truncate">{String(nameVal ?? 'Empty')}</span>
              </div>
            )
          })()}

          {nodeType === 'SetVariable' && (() => {
            const isNameBound = edges.some(e => e.target === id && e.targetHandle === `${id}__name`)
            const isValBound = edges.some(e => e.target === id && e.targetHandle === `${id}__value`)
            const nameVal = data.name
            const valueVal = data.value

            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-center">
                  <span className="text-[8px] uppercase tracking-wider px-2 py-1 rounded-md border border-emerald-950/40 bg-emerald-950/30 text-emerald-400 font-bold font-mono">
                    scope: {data.scope === 'env' ? 'Env ($)' : data.scope === 'local' ? 'Local (_)' : 'Global'}
                  </span>
                </div>
                {!isNameBound && nameVal !== undefined && nameVal !== '' && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                    <span className="text-[8px] text-emerald-500 font-bold font-mono uppercase">Name:</span>
                    <span className="text-[9px] text-surface-300 font-mono truncate">{formatPreviewValue(nameVal)}</span>
                  </div>
                )}
                {!isValBound && valueVal !== undefined && valueVal !== '' && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                    <span className="text-[8px] text-emerald-500 font-bold font-mono uppercase">Value:</span>
                    <span className="text-[9px] text-surface-300 font-mono truncate">{formatPreviewValue(valueVal)}</span>
                  </div>
                )}
              </div>
            )
          })()}

          {nodeType === 'Return' && (() => {
            const isValueBound = edges.some(e => e.target === id && e.targetHandle === `${id}__value`)
            if (isValueBound) return null
            return (
              <div className="flex justify-center">
                <span className="text-[8px] uppercase tracking-wider px-2 py-1 rounded-md border border-red-950/40 bg-red-950/30 text-red-400 font-bold font-mono">
                  value: {String(data.value ?? 'true')}
                </span>
              </div>
            )
          })()}

          {nodeType === 'Branch' && (() => {
            const isConditionBound = edges.some(e => e.target === id && e.targetHandle === `${id}__condition`)
            if (isConditionBound) return null
            return (
              <div className="flex justify-center">
                <span className="text-[8px] uppercase tracking-wider px-2 py-1 rounded-md border border-emerald-950/40 bg-emerald-950/30 text-emerald-400 font-bold font-mono">
                  condition: {String(data.condition ?? 'false')}
                </span>
              </div>
            )
          })()}

          {nodeType === 'Yield' && (() => {
            const isValueBound = edges.some(e => e.target === id && e.targetHandle === `${id}__value`)
            if (isValueBound) return null
            return (
              <div className="flex justify-center">
                <span className="text-[8px] uppercase tracking-wider px-2 py-1 rounded-md border border-sky-950/40 bg-sky-950/30 text-sky-400 font-bold font-mono">
                  value: {String(data.value ?? 'false')}
                </span>
              </div>
            )
          })()}

          {nodeType === 'NovelLoadSave' && (() => {
            const isValueBound = edges.some(e => e.target === id && e.targetHandle === `${id}__value`)
            if (isValueBound) return null
            return (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-surface-400 font-bold uppercase tracking-wider">Save Data String</span>
                <div className="text-[10px] text-surface-300 font-mono bg-black/30 px-2 py-1 rounded-md border border-white/5 truncate select-none">
                  {formatPreviewValue(data.value)}
                </div>
              </div>
            )
          })()}

          {nodeType === 'NovelLoadEnv' && (() => {
            const isValueBound = edges.some(e => e.target === id && e.targetHandle === `${id}__value`)
            if (isValueBound) return null
            return (
              <div className="flex flex-col gap-1">
                <span className="text-[8px] text-surface-400 font-bold uppercase tracking-wider">Env Data String</span>
                <div className="text-[10px] text-surface-300 font-mono bg-black/30 px-2 py-1 rounded-md border border-white/5 truncate select-none">
                  {formatPreviewValue(data.value)}
                </div>
              </div>
            )
          })()}

          {nodeType === 'BindEvent' && !!data.eventType && (
            <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5 shadow-inner">
              <span className="text-[8px] text-purple-400 font-bold uppercase">Event</span>
              <span className="text-[10px] text-surface-300 font-mono truncate">{String(data.eventType)}</span>
            </div>
          )}

          {nodeType === 'Log' && (() => {
            const isMessageBound = edges.some(e => e.target === id && e.targetHandle === `${id}__message`)
            return (
              <div className="flex flex-col gap-1.5">
                {!!data.logLevel && (
                  <div className="flex justify-center">
                    <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md border font-bold ${
                      data.logLevel === 'error'
                        ? 'text-red-400 bg-red-950/30 border-red-950/40'
                        : data.logLevel === 'warn'
                          ? 'text-amber-400 bg-amber-950/30 border-amber-950/40'
                          : 'text-surface-400 bg-surface-900/30 border-surface-900'
                    }`}>
                      log level: {String(data.logLevel)}
                    </span>
                  </div>
                )}
                {!isMessageBound && !!data.message && (
                  <div className="text-[10px] text-surface-300 font-mono bg-black/30 px-2 py-1 rounded-md border border-white/5 truncate select-none">
                    {String(data.message)}
                  </div>
                )}
              </div>
            )
          })()}

          {nodeType === 'SetTimer' && (() => {
            const isMsBound = edges.some(e => e.target === id && e.targetHandle === `${id}__ms`)
            const isRespectSkipBound = edges.some(e => e.target === id && e.targetHandle === `${id}__respectSkip`)
            const msVal = data.ms
            const respectSkipVal = data.respectSkip

            return (
              <div className="flex flex-col gap-1.5">
                {!isMsBound && msVal !== undefined && msVal !== '' && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                    <span className="text-[8px] text-primary-400 font-bold font-mono uppercase">Delay:</span>
                    <span className="text-[9px] text-surface-300 font-mono truncate">{formatPreviewValue(msVal)} ms</span>
                  </div>
                )}
                {!isRespectSkipBound && respectSkipVal !== undefined && respectSkipVal !== '' && (
                  <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded border border-white/5">
                    <span className="text-[8px] text-primary-400 font-bold font-mono uppercase">Skip:</span>
                    <span className="text-[9px] text-surface-300 font-mono truncate">{String(respectSkipVal)}</span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export const BlueprintNode = memo(BlueprintNodeInner)

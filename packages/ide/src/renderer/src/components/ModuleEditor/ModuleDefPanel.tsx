// =============================================================
// ModuleDefPanel.tsx — Schema / Cmd / Hook 정의 편집 패널
// =============================================================

import { useState, useCallback } from 'react'
import { useModuleStore } from '../../store/useModuleStore'
import type { PropertyDef, FieldType, HookSignatureDef } from '../../types/blueprint'

// ─── 필드 타입 옵션 ──────────────────────────────────────────

const FIELD_TYPES: { value: FieldType, label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
]

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  string: '#2196F3',
  number: '#4CAF50',
  boolean: '#F44336',
  object: '#9E9E9E',
  array: '#FF9800',
}

// ─── 필드 행 컴포넌트 ────────────────────────────────────────

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: PropertyDef
  onChange: (f: PropertyDef) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 group hover:bg-surface-800/30 rounded">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: FIELD_TYPE_COLORS[field.type] }}
      />
      <input
        className="flex-1 min-w-0 bg-transparent text-[11px] text-surface-200 outline-none px-1"
        value={field.name}
        placeholder="name"
        onChange={(e) => onChange({ ...field, name: e.target.value })}
      />
      <select
        className="bg-surface-900 border border-surface-700 rounded text-[10px] text-surface-300 px-1 py-0 outline-none"
        value={field.type}
        onChange={(e) => onChange({ ...field, type: e.target.value as FieldType })}
      >
        {FIELD_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        className="w-14 bg-surface-900/50 border border-surface-700 rounded text-[10px] text-surface-400 px-1 outline-none"
        value={field.defaultValue != null ? String(field.defaultValue) : ''}
        placeholder="default"
        onChange={(e) => onChange({ ...field, defaultValue: e.target.value || undefined })}
      />
      <button
        className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400 transition-all text-[10px]"
        onClick={onRemove}
        title="삭제"
      >
        ✕
      </button>
    </div>
  )
}

// ─── 섹션 컴포넌트 ──────────────────────────────────────────

function DefSection({
  title,
  color,
  fields,
  onAdd,
  onUpdate,
  onRemove,
}: {
  title: string
  color: string
  fields: PropertyDef[]
  onAdd: () => void
  onUpdate: (index: number, field: PropertyDef) => void
  onRemove: (index: number) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="border-b border-surface-800/50">
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-800/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left text-surface-300">
          {title}
        </span>
        <span className="text-[9px] text-surface-500 mr-1">{fields.length}</span>
        <span className="text-[9px] text-surface-500">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div className="pb-1">
          {fields.map((field, i) => (
            <FieldRow
              key={i}
              field={field}
              onChange={(f) => onUpdate(i, f)}
              onRemove={() => onRemove(i)}
            />
          ))}

          <button
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[10px] text-surface-500 hover:text-primary-400 hover:bg-surface-800/20 transition-colors"
            onClick={onAdd}
          >
            <span>+</span>
            <span>Add Field</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── 훅 섹션 ────────────────────────────────────────────────

function HookSection({
  hooks,
  onAdd,
  onUpdate,
  onRemove,
}: {
  hooks: HookSignatureDef[]
  onAdd: () => void
  onUpdate: (index: number, hook: HookSignatureDef) => void
  onRemove: (index: number) => void
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="border-b border-surface-800/50">
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-800/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: '#e879f9' }} />
        <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left text-surface-300">
          Hook
        </span>
        <span className="text-[9px] text-surface-500 mr-1">{hooks.length}</span>
        <span className="text-[9px] text-surface-500">{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div className="pb-1">
          {hooks.map((hook, i) => (
            <div key={i} className="flex items-center gap-1 px-2 py-0.5 group hover:bg-surface-800/30 rounded">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#e879f9' }} />
              <input
                className="flex-1 min-w-0 bg-transparent text-[11px] text-surface-200 outline-none px-1"
                value={hook.key}
                placeholder="hook:key"
                onChange={(e) => onUpdate(i, { ...hook, key: e.target.value })}
              />
              <input
                className="w-16 bg-surface-900/50 border border-surface-700 rounded text-[10px] text-surface-400 px-1 outline-none"
                value={hook.returnType}
                placeholder="return"
                onChange={(e) => onUpdate(i, { ...hook, returnType: e.target.value })}
              />
              <button
                className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400 transition-all text-[10px]"
                onClick={() => onRemove(i)}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            className="w-full flex items-center gap-1.5 px-3 py-1 text-[10px] text-surface-500 hover:text-primary-400 hover:bg-surface-800/20 transition-colors"
            onClick={onAdd}
          >
            <span>+</span>
            <span>Add Hook</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── 메인 패널 ──────────────────────────────────────────────

export function ModuleDefPanel() {
  const {
    definitions,
    setModuleName,
    addSchemaDef, updateSchemaDef, removeSchemaDef,
    addCommandDef, updateCommandDef, removeCommandDef,
    addHookDef, updateHookDef, removeHookDef,
  } = useModuleStore()

  const createField = useCallback((): PropertyDef => ({
    name: '',
    type: 'string',
  }), [])

  const createHook = useCallback((): HookSignatureDef => ({
    key: '',
    paramTypes: [],
    returnType: 'void',
  }), [])

  return (
    <div className="flex flex-col overflow-hidden select-none">
      {/* Module Name */}
      <div className="px-3 py-2 border-b border-surface-800">
        <span className="text-[9px] font-bold text-surface-500 uppercase tracking-wider">Module</span>
        <input
          className="mt-1 w-full bg-surface-900/50 border border-surface-700 rounded px-2 py-1 text-[11px] text-white placeholder-surface-500 outline-none focus:border-primary-500/50"
          placeholder="module-name"
          value={definitions.moduleName}
          onChange={(e) => setModuleName(e.target.value)}
        />
      </div>

      {/* Schema (State) */}
      <DefSection
        title="Schema (State)"
        color="#4CAF50"
        fields={definitions.schemaDef}
        onAdd={() => addSchemaDef(createField())}
        onUpdate={updateSchemaDef}
        onRemove={removeSchemaDef}
      />

      {/* Command Props */}
      <DefSection
        title="Command Props"
        color="#2196F3"
        fields={definitions.commandDef}
        onAdd={() => addCommandDef(createField())}
        onUpdate={updateCommandDef}
        onRemove={removeCommandDef}
      />

      {/* Hook */}
      <HookSection
        hooks={definitions.hookDef}
        onAdd={() => addHookDef(createHook())}
        onUpdate={updateHookDef}
        onRemove={removeHookDef}
      />
    </div>
  )
}

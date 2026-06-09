import { useState, useEffect, useCallback } from 'react'
import { getShortcutContent } from '../../../../shared/templates'
import type { ShortcutParam, ShortcutPayloadEntry } from '../../../../shared/templates'
import { useProjectStore } from '../../store/useProjectStore'
import { CodeEditor } from './CodeEditor'

interface Props {
  content: string
  onChange: (value: string) => void
  filePath: string
}

// ─── 파서: TS 숏컷 코드 → GUI 상태 ─────────────────────────

interface ParsedShortcut {
  targetCommand: string
  params: ShortcutParam[]
  payload: ShortcutPayloadEntry[]
}

function parseShortcutCode(code: string): ParsedShortcut | null {
  try {
    const cmdMatch = code.match(/shortcut\(config\)\(\s*'([^']+)'/)
    if (!cmdMatch) return null
    const targetCommand = cmdMatch[1]

    const keysMatch = code.match(/,\s*\[([^\]]*)\]/)
    const keyNames: string[] = []
    if (keysMatch && keysMatch[1].trim()) {
      const raw = keysMatch[1]
      const keyRegex = /'([^']+)'/g
      let m: RegExpExecArray | null
      while ((m = keyRegex.exec(raw)) !== null) {
        keyNames.push(m[1])
      }
    }

    const factoryMatch = code.match(/,\s*\(([^)]*)\)\s*=>\s*\(\{/)
    const params: ShortcutParam[] = []
    if (factoryMatch) {
      const paramsStr = factoryMatch[1]
      const paramParts = paramsStr.split(',').map(s => s.trim()).filter(Boolean)
      paramParts.forEach((part) => {
        const eqIdx = part.indexOf('=')
        if (eqIdx !== -1) {
          const name = part.slice(0, eqIdx).trim()
          const defaultValue = part.slice(eqIdx + 1).trim()
          params.push({ name, defaultValue })
        } else {
          params.push({ name: part.trim() })
        }
      })
    }

    if (params.length === 0 && keyNames.length > 0) {
      keyNames.forEach(name => params.push({ name }))
    }

    const payloadMatch = code.match(/=>\s*\(\{([\s\S]*?)\}\)/)
    const payload: ShortcutPayloadEntry[] = []
    if (payloadMatch) {
      const bodyStr = payloadMatch[1]
      const lineRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(.+?),?\s*$/gm
      let lm: RegExpExecArray | null
      while ((lm = lineRegex.exec(bodyStr)) !== null) {
        payload.push({ key: lm[1], value: lm[2].replace(/,\s*$/, '') })
      }
    }

    return { targetCommand, params, payload }
  } catch {
    return null
  }
}

// ─── 컴포넌트 ───────────────────────────────────────────────

export function ShortcutFormEditor({ content, onChange, filePath }: Props) {
  const { projectPath } = useProjectStore()
  const [viewMode, setViewMode] = useState<'gui' | 'code'>('gui')
  const [parseError, setParseError] = useState<string | null>(null)
  const [targetCommand, setTargetCommand] = useState('')
  const [params, setParams] = useState<ShortcutParam[]>([])
  const [payload, setPayload] = useState<ShortcutPayloadEntry[]>([])

  // 동적으로 로드되는 커맨드 목록 및 필드
  const [builtinCommands, setBuiltinCommands] = useState<string[]>([])
  const [customCommands, setCustomCommands] = useState<string[]>([])
  const [commandFields, setCommandFields] = useState<Record<string, string[]>>({})

  const exportName = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.ts$/, '') || 'shortcut'

  // 초기 파싱 및 content 변경 감지
  useEffect(() => {
    if (viewMode === 'code') return // 코드 모드일 때는 파싱을 스킵하고 리렌더링만 (코드 에디터가 content를 제어)

    const parsed = parseShortcutCode(content)
    if (parsed) {
      setTargetCommand(parsed.targetCommand)
      setParams(parsed.params)
      setPayload(parsed.payload)
      setParseError(null)
    } else {
      setParseError('숏컷 코드를 파싱할 수 없습니다. 코드 모드를 사용해 주세요.')
      setViewMode('code')
    }
  }, [content, viewMode])

  // esbuild-register 기반 커맨드 목록 동적 로딩
  useEffect(() => {
    const loadCommands = async () => {
      if (!projectPath) return
      const res = await window.api.project.getAvailableCommands(projectPath)
      if (res.success) {
        setBuiltinCommands(res.builtin)
        setCustomCommands(res.custom)
      }
    }
    loadCommands()
  }, [projectPath])

  // 선택된 커맨드의 필드 동적 해석
  useEffect(() => {
    const loadFields = async () => {
      if (!projectPath || !targetCommand) return
      // 이미 캐시에 있으면 스킵
      if (commandFields[targetCommand]) return

      const res = await window.api.project.resolveCommandFields(projectPath, targetCommand)
      if (res.success && res.fields && res.fields.length > 0) {
        setCommandFields(prev => ({ ...prev, [targetCommand]: res.fields! }))
      }
    }
    loadFields()
  }, [projectPath, targetCommand])

  // 사용 가능한 필드 목록
  const availableFields = commandFields[targetCommand] || []

  // 변경 사항을 코드로 반영
  const emitChange = useCallback((
    cmd: string,
    ps: ShortcutParam[],
    pl: ShortcutPayloadEntry[]
  ) => {
    const code = getShortcutContent(exportName, cmd, ps, pl)
    onChange(code)
  }, [exportName, onChange])

  const handleTargetCommandChange = (val: string) => {
    setTargetCommand(val)
    emitChange(val, params, payload)
  }

  // ─── Params CRUD ──────────────────────────────────────

  const addParam = () => {
    const newParams = [...params, { name: '', defaultValue: '' }]
    setParams(newParams)
    emitChange(targetCommand, newParams, payload)
  }

  const updateParam = (idx: number, field: keyof ShortcutParam, val: string) => {
    const next = params.map((p, i) => i === idx ? { ...p, [field]: val } : p)
    setParams(next)
    emitChange(targetCommand, next, payload)
  }

  const removeParam = (idx: number) => {
    const next = params.filter((_, i) => i !== idx)
    setParams(next)
    emitChange(targetCommand, next, payload)
  }

  // ─── Payload CRUD ─────────────────────────────────────

  const addPayloadEntry = () => {
    const nextField = availableFields.find(f => !payload.some(e => e.key === f)) || ''
    const newPayload = [...payload, { key: nextField, value: nextField }]
    setPayload(newPayload)
    emitChange(targetCommand, params, newPayload)
  }

  const updatePayloadEntry = (idx: number, field: keyof ShortcutPayloadEntry, val: string) => {
    const next = payload.map((e, i) => i === idx ? { ...e, [field]: val } : e)
    setPayload(next)
    emitChange(targetCommand, params, next)
  }

  const handlePayloadKeyChange = (idx: number, keyVal: string) => {
    const next = payload.map((e, i) => i === idx ? { ...e, key: keyVal, value: keyVal } : e)
    setPayload(next)
    emitChange(targetCommand, params, next)
  }

  const removePayloadEntry = (idx: number) => {
    const next = payload.filter((_, i) => i !== idx)
    setPayload(next)
    emitChange(targetCommand, params, next)
  }

  // ─── 사용법 미리보기 ──────────────────────────────────

  if (viewMode === 'code') {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between z-10">
          <div className="text-sm font-medium text-surface-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {filePath.split(/[/\\]/).pop()} {parseError && <span className="text-red-400 ml-2 text-xs">({parseError})</span>}
          </div>
          <div className="flex bg-surface-900 rounded p-0.5">
            <button
              onClick={() => {
                const parsed = parseShortcutCode(content)
                if (parsed) {
                  setTargetCommand(parsed.targetCommand)
                  setParams(parsed.params)
                  setPayload(parsed.payload)
                  setParseError(null)
                  setViewMode('gui')
                } else {
                  alert('코드를 파싱할 수 없어 GUI 모드로 전환할 수 없습니다. 형식을 확인해 주세요.')
                }
              }}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors text-surface-400 hover:text-surface-200 hover:bg-surface-800`}
            >
              GUI
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors bg-primary-600 text-white shadow`}
            >
              CODE
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
          <CodeEditor
            code={content}
            onChange={(val) => onChange(val || '')}
            language="typescript"
            filePath={filePath}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header */}
      <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between z-10">
        <div className="text-sm font-medium text-surface-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {filePath.split(/[/\\]/).pop()}
        </div>
        <div className="flex bg-surface-900 rounded p-0.5">
          <button
            onClick={() => setViewMode('gui')}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors bg-primary-600 text-white shadow`}
          >
            GUI
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors text-surface-400 hover:text-surface-200 hover:bg-surface-800`}
          >
            CODE
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Left Panel: Settings ─────────────────── */}
        <div className="w-[420px] flex flex-col border-r border-surface-700 bg-surface-800/30 overflow-y-auto custom-scrollbar">
          {/* Target Command */}
          <div className="p-4 border-b border-surface-700/50">
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Target Command (대상 커맨드)</h3>
            <select
              value={targetCommand}
              onChange={(e) => handleTargetCommandChange(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
            >
              <option value="">-- 커맨드 선택 --</option>
              {builtinCommands.length > 0 && (
                <optgroup label="내장 명령어 (Built-in)">
                  {builtinCommands.map(cmd => (
                    <option key={cmd} value={cmd}>{cmd}</option>
                  ))}
                </optgroup>
              )}
              {customCommands.length > 0 && (
                <optgroup label="사용자 정의 모듈 (Custom)">
                  {customCommands.map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="mt-2 text-[10px] text-surface-500 leading-relaxed">
              숏컷이 호출할 대상 모듈 또는 빌트인 커맨드 이름입니다.
            </p>
          </div>

          {/* Parameters */}
          <div className="p-4 border-b border-surface-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Parameters (매개변수)</h3>
              <button
                onClick={addParam}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                추가
              </button>
            </div>
            {params.length === 0 && (
              <p className="text-[10px] text-surface-600 italic">매개변수가 없습니다. 추가 버튼을 눌러주세요.</p>
            )}
            <div className="space-y-2">
              {params.map((p, idx) => {
                const isCustom = p.name !== '' && !availableFields.includes(p.name)
                const selectValue = isCustom ? '__custom__' : p.name

                return (
                  <div key={idx} className="flex flex-col gap-2 p-2 bg-surface-900/30 rounded border border-surface-700/50 group">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-surface-600 w-4 shrink-0 text-right">{idx + 1}</span>

                      {/* Name Selector */}
                      <select
                        value={selectValue}
                        onChange={(e) => {
                          const val = e.target.value
                          updateParam(idx, 'name', val === '__custom__' ? '' : val)
                        }}
                        className="flex-1 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-white focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">-- 이름 선택 --</option>
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                        <option value="__custom__">직접 입력...</option>
                      </select>

                      {/* Default Value */}
                      <input
                        type="text"
                        value={p.defaultValue || ''}
                        onChange={(e) => updateParam(idx, 'defaultValue', e.target.value)}
                        className="w-24 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:border-primary-500 focus:outline-none font-mono"
                        placeholder="기본값"
                      />

                      {/* Delete Button */}
                      <button
                        onClick={() => removeParam(idx)}
                        className="w-6 h-6 flex items-center justify-center rounded text-surface-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    {/* Custom Name Input */}
                    {(selectValue === '__custom__' || p.name === '') && (
                      <div className="pl-6 pr-8">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updateParam(idx, 'name', e.target.value)}
                          className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-white focus:border-primary-500 focus:outline-none font-mono"
                          placeholder="직접 입력한 매개변수 이름"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Payload */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">Payload (반환 데이터)</h3>
              <button
                onClick={addPayloadEntry}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                추가
              </button>
            </div>
            {payload.length === 0 && (
              <p className="text-[10px] text-surface-600 italic">반환 데이터가 없습니다. 추가 버튼을 눌러주세요.</p>
            )}
            <div className="space-y-2">
              {payload.map((e, idx) => {
                const isCustomKey = e.key !== '' && !availableFields.includes(e.key)
                const selectKeyValue = isCustomKey ? '__custom__' : e.key

                return (
                  <div key={idx} className="flex flex-col gap-2 p-2 bg-surface-900/30 rounded border border-surface-700/50 group">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-surface-600 w-4 shrink-0 text-right">{idx + 1}</span>

                      {/* Key Select */}
                      <select
                        value={selectKeyValue}
                        onChange={(ev) => {
                          const val = ev.target.value
                          const nextKey = val === '__custom__' ? '' : val
                          handlePayloadKeyChange(idx, nextKey)
                        }}
                        className="w-28 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-white focus:border-primary-500 focus:outline-none"
                      >
                        <option value="">-- 키 선택 --</option>
                        {availableFields.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                        <option value="__custom__">직접 입력...</option>
                      </select>

                      <span className="text-surface-600 text-xs">:</span>

                      {/* Value Input (Direct Value Input Only) */}
                      <input
                        type="text"
                        value={e.value}
                        onChange={(ev) => updatePayloadEntry(idx, 'value', ev.target.value)}
                        className="flex-1 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:border-primary-500 focus:outline-none font-mono"
                        placeholder="값 식 입력"
                      />

                      {/* Delete Button */}
                      <button
                        onClick={() => removePayloadEntry(idx)}
                        className="w-6 h-6 flex items-center justify-center rounded text-surface-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>

                    {/* Custom Key Text Input */}
                    {(selectKeyValue === '__custom__' || e.key === '') && (
                      <div className="pl-6 pr-8">
                        <input
                          type="text"
                          value={e.key}
                          onChange={(ev) => {
                            const nextKey = ev.target.value
                            const next = payload.map((item, i) => i === idx ? { ...item, key: nextKey, value: nextKey } : item)
                            setPayload(next)
                            emitChange(targetCommand, params, next)
                          }}
                          className="w-full bg-surface-900 border border-surface-700 rounded px-2 py-1 text-xs text-white focus:border-primary-500 focus:outline-none font-mono"
                          placeholder="직접 입력한 키"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── Right Panel: Usage Guide & Preview ───── */}
        <div className="flex-1 bg-[#181818] p-8 overflow-y-auto custom-scrollbar">
          {/* Usage Guide */}
          <div className="max-w-lg mx-auto">
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Usage Guide (사용법)
            </h3>

            {/* 씬에서의 사용 코드 */}
            <div className="mb-6 bg-surface-900/80 rounded-xl border border-surface-700/50 overflow-hidden">
              <div className="px-4 py-2 border-b border-surface-700/30 flex items-center justify-between">
                <span className="text-[10px] text-surface-500 uppercase tracking-wider">씬(Scene) 내 호출 예시</span>
                <span className="text-[10px] text-primary-400 font-mono">TypeScript</span>
              </div>
              <div className="p-4 font-mono text-sm">
                <div className="text-surface-500">
                  <span className="text-purple-400">import</span> <span className="text-blue-300">Shortcuts</span> <span className="text-purple-400">from</span> <span className="text-amber-300">'@/declarations/shortcuts'</span>
                </div>
                <div className="mt-2 text-surface-300">
                  <span className="text-purple-400">const</span> {'{'} <span className="text-blue-300">{exportName}</span> {'}'} = <span className="text-blue-300">Shortcuts</span>
                </div>
              </div>
            </div>

            {/* 생성될 코드 미리보기 */}
            <div className="bg-surface-900/80 rounded-xl border border-surface-700/50 overflow-hidden">
              <div className="px-4 py-2 border-b border-surface-700/30 flex items-center justify-between">
                <span className="text-[10px] text-surface-500 uppercase tracking-wider">생성될 숏컷 코드</span>
                <span className="text-[10px] text-primary-400 font-mono">auto-generated</span>
              </div>
              <pre className="p-4 text-xs text-surface-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {getShortcutContent(exportName, targetCommand, params, payload)}
              </pre>
            </div>

            {/* 매개변수 참조 테이블 */}
            {params.length > 0 && (
              <div className="mt-6 bg-surface-900/80 rounded-xl border border-surface-700/50 overflow-hidden">
                <div className="px-4 py-2 border-b border-surface-700/30">
                  <span className="text-[10px] text-surface-500 uppercase tracking-wider">매개변수 참조</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-700/30">
                      <th className="text-left px-4 py-2 text-surface-500 font-medium">#</th>
                      <th className="text-left px-4 py-2 text-surface-500 font-medium">Name</th>
                      <th className="text-left px-4 py-2 text-surface-500 font-medium">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map((p, i) => (
                      <tr key={i} className="border-b border-surface-800/50 last:border-b-0">
                        <td className="px-4 py-2 text-surface-600">{i + 1}</td>
                        <td className="px-4 py-2 font-mono text-blue-300">{p.name || '—'}</td>
                        <td className="px-4 py-2 font-mono text-amber-300">{p.defaultValue || <span className="text-surface-600 italic">필수</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

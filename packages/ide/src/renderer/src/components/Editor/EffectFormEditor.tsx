import { useState, useEffect, useCallback, useRef } from 'react'
import { CodeEditor } from './CodeEditor'
import { useProjectStore } from '../../store/useProjectStore'
import { ConfirmDialogBox } from '../UI/ConfirmDialogBox'
import { FumikaPreview } from './FumikaPreview'

// IDE 내부 파싱용 타입
interface ParsedEffectDef {
  clip?: {
    impulse?: number
    lifespan?: number
    interval?: number
    size?: [number, number][]
    opacity?: [number, number][]
    loop?: boolean
    angularImpulse?: number
  }
  particle?: {
    attribute?: any
    style?: any
  }
}

interface Props {
  content: string
  onChange: (value: string) => void
  filePath: string
}

export function EffectFormEditor({ content, onChange, filePath }: Props) {
  const { projectPath } = useProjectStore()
  const [viewMode, setViewMode] = useState<'gui' | 'code'>('gui')
  
  const [parsedDef, setParsedDef] = useState<ParsedEffectDef | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  
  // 미리보기 전용 이미지 소스 (파일에 저장하지 않음)
  const [previewSrc, setPreviewSrc] = useState<string>('')
  const [previewBgSrc, setPreviewBgSrc] = useState<string>('') // background name (e.g. 'room')
  const [previewBgDef, setPreviewBgDef] = useState<{ src?: string, parallax?: boolean } | null>(null)
  const [backgroundList, setBackgroundList] = useState<string[]>([])
  
  const [previewIntensity, setPreviewIntensity] = useState<number>(10)
  const [previewMood, setPreviewMood] = useState<string>('none')
  const latestParsedDefRef = useRef<ParsedEffectDef | null>(null)
  latestParsedDefRef.current = parsedDef
  
  const [confirmState, setConfirmState] = useState<any>(null)

  // declarations/backgrounds.ts를 파싱하여 배경 키 목록 추출 (하위 폴더 포함)
  useEffect(() => {
    if (!projectPath) return

    window.api.fs.readFile(`${projectPath}/declarations/backgrounds.ts`).then(res => {
      if (res.success && res.content) {
        // `'folder/name': _var,` 또는 `'name': _var,` 패턴에서 키 추출
        const keys = [...res.content.matchAll(/^\s*'([^']+)'\s*:/gm)]
          .map(m => m[1])
        setBackgroundList(keys)
      }
    }).catch(() => {})
  }, [projectPath])

  // 배경 선택 시 해당 파일 파싱
  useEffect(() => {
    if (!projectPath || !previewBgSrc) {
      setPreviewBgDef(null)
      return
    }
    window.api.fs.readFile(`${projectPath}/backgrounds/${previewBgSrc}.ts`).then(res => {
      if (res.success && res.content) {
        let src = ''
        let parallax = false
        const srcMatch = res.content.match(/src(?:\s*:\s*keyof\s+typeof\s+[A-Za-z]+)?\s*=\s*['"]([^'"]+)['"]/)
        if (srcMatch && srcMatch[1]) src = srcMatch[1]
        
        const parallaxMatch = res.content.match(/parallax(?:\s*:\s*boolean)?\s*=\s*(true|false)/)
        if (parallaxMatch && parallaxMatch[1]) parallax = parallaxMatch[1] === 'true'
        
        if (src) setPreviewBgDef({ src, parallax })
      }
    }).catch(() => {})
  }, [projectPath, previewBgSrc])

  const handleBrowseImage = async () => {
    if (!projectPath) return
    const defaultPath = `${projectPath}/assets`.replace(/\\/g, '/')
    const paths = await window.api.dialog.openFile({
      defaultPath,
      filters: [{ name: 'Images', extensions: ['png', 'webp', 'jpg', 'jpeg'] }]
    })

    if (paths && paths.length > 0) {
      let selectedPath = paths[0].replace(/\\/g, '/')
      const projPath = projectPath.replace(/\\/g, '/')
      
      if (selectedPath.startsWith(projPath)) {
        selectedPath = selectedPath.substring(projPath.length + 1)
        
        if (selectedPath.startsWith('assets/')) {
          selectedPath = selectedPath.substring(7)
        }
        
        setPreviewSrc(selectedPath)
      } else {
        // 파티클 에셋은 1회용 미리보기이므로 복사하지 않고 외부 절대 경로를 그대로 사용합니다.
        setPreviewSrc(selectedPath)
      }
    }
  }



  // 파싱
  useEffect(() => {
    if (viewMode === 'code') return
    
    try {
      const match = content.match(/const\s+effectDef\s*(?::\s*EffectDef\s*)?=\s*({[\s\S]*})\s*export\s+default\s+effectDef/m)
      
      if (match && match[1]) {
        let objStr = match[1]
        
        const parsed = new Function(`return ${objStr}`)() as ParsedEffectDef
        
        if (!parsed.clip) parsed.clip = {}
        if (!parsed.particle) parsed.particle = {}
        if (!parsed.particle.attribute) parsed.particle.attribute = {}
        if (!parsed.particle.style) parsed.particle.style = {}
        
        // src가 파일 내에 있다면 지운다 (요구사항: src는 파일이 아니라 명령어 호출 시 결정됨)
        if (parsed.particle?.attribute?.src) {
          delete parsed.particle.attribute.src
        }

        setParsedDef(parsed)
        setParseError(null)
      } else {
        setParseError('이펙트 설정 형식을 파싱할 수 없습니다. 코드 모드를 사용해 주세요.')
        setViewMode('code')
      }
    } catch (e: any) {
      setParseError(`파싱 오류: ${e.message}`)
      setViewMode('code')
    }
  }, [content, viewMode])

  // 코드 생성
  const generateCode = useCallback((def: ParsedEffectDef) => {
    const formatValue = (val: any, indent = 0): string => {
      const space = ' '.repeat(indent)
      if (typeof val === 'string') return `'${val}'`
      if (typeof val === 'number') return `${val}`
      if (typeof val === 'boolean') return val ? 'true' : 'false'
      if (Array.isArray(val)) {
        if (val.length === 0) return '[]'
        // 배열 내용이 단순 원시값이면 한 줄로
        const isSimple = val.every(v => typeof v !== 'object' || Array.isArray(v))
        const formattedItems = val.map(v => formatValue(v, indent + 2))
        if (isSimple && formattedItems.join(', ').length < 60) {
          return `[${formattedItems.join(', ')}]`
        }
        return `[\n${formattedItems.map(item => `${space}  ${item}`).join(',\n')}\n${space}]`
      }
      if (typeof val === 'object' && val !== null) {
        const lines: string[] = []
        for (const [k, v] of Object.entries(val)) {
          if (v === undefined) continue
          const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `'${k}'`
          lines.push(`${space}  ${key}: ${formatValue(v, indent + 2)}`)
        }
        if (lines.length === 0) return '{}'
        if (indent === 0) {
          return `{\n${lines.join(',\n')}\n}`
        }
        return `{\n${lines.join(',\n')}\n${space}}`
      }
      return String(val)
    }

    const match = content.match(/(const\s+effectDef\s*(?::\s*EffectDef\s*)?=\s*)({[\s\S]*})(\s*export\s+default\s+effectDef)/m)
    if (match) {
      // src 제거 보장
      if (def.particle?.attribute?.src) delete def.particle.attribute.src
      
      const newCode = content.substring(0, match.index! + match[1].length) + 
             formatValue(def, 0) + 
             content.substring(match.index! + match[1].length + match[2].length)
      onChange(newCode)
    } else {
      const template = `import type { EffectDef } from 'fumika'

const effectDef: EffectDef = ${formatValue(def, 0)}

export default effectDef`
      onChange(template)
    }
  }, [content, onChange])

  const updateDef = useCallback((updater: (prev: ParsedEffectDef) => ParsedEffectDef) => {
    const prev = latestParsedDefRef.current
    if (!prev) return
    const next = updater({ ...prev })
    setParsedDef(next)
    generateCode(next)
  }, [generateCode])

  // 배열 편집 헬퍼
  const updateNumberTupleArray = (key: 'size' | 'opacity', index: number, tupleIndex: 0 | 1, value: string) => {
    updateDef(prev => {
      const arr = prev.clip?.[key] ? [...prev.clip[key]!] : []
      if (!arr[index]) arr[index] = [0, 0]
      arr[index][tupleIndex] = Number(value)
      
      if (!prev.clip) prev.clip = {}
      prev.clip[key] = arr
      return prev
    })
  }
  const addTupleToArray = (key: 'size' | 'opacity') => {
    updateDef(prev => {
      const arr = prev.clip?.[key] ? [...prev.clip[key]!] : []
      const last = arr[arr.length - 1] || [1, 1]
      arr.push([...last] as [number, number])
      
      if (!prev.clip) prev.clip = {}
      prev.clip[key] = arr
      return prev
    })
  }
  const removeTupleFromArray = (key: 'size' | 'opacity', index: number) => {
    updateDef(prev => {
      if (!prev.clip?.[key]) return prev
      const arr = [...prev.clip[key]!]
      arr.splice(index, 1)
      prev.clip[key] = arr
      return prev
    })
  }


  if (viewMode === 'code' || !parsedDef) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between z-10">
          <div className="text-sm font-medium text-surface-300">
            {filePath.split(/[/\\]/).pop()} {parseError && <span className="text-red-400 ml-2 text-xs">({parseError})</span>}
          </div>
          <div className="flex bg-surface-900 rounded p-0.5">
            <button
              onClick={() => setViewMode('gui')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${viewMode === 'gui' ? 'bg-primary-600 text-white shadow' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'}`}
            >
              GUI
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${viewMode === 'code' ? 'bg-primary-600 text-white shadow' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'}`}
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

  // 렌더링
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between z-10">
        <div className="text-sm font-medium text-surface-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          {filePath.split(/[/\\]/).pop()}
        </div>
        <div className="flex bg-surface-900 rounded p-0.5">
          <button
            onClick={() => setViewMode('gui')}
            className="px-3 py-1 text-xs font-medium rounded-sm transition-colors bg-primary-600 text-white shadow"
          >
            GUI
          </button>
          <button
            onClick={() => setViewMode('code')}
            className="px-3 py-1 text-xs font-medium rounded-sm transition-colors text-surface-400 hover:text-surface-200 hover:bg-surface-800"
          >
            CODE
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Settings */}
        <div className="w-96 flex flex-col border-r border-surface-700 bg-surface-800/30 overflow-y-auto">
          
          {/* Clip Settings */}
          <div className="p-4 border-b border-surface-700/50">
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4">Clip Settings (방출)</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1" title="방출 시 초기 속도">Impulse</label>
                  <input 
                    type="number" step="0.01"
                    value={parsedDef.clip?.impulse ?? 0}
                    onChange={(e) => updateDef(p => { if (!p.clip) p.clip = {}; p.clip.impulse = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1" title="초기 회전 속도">Angular Imp</label>
                  <input 
                    type="number" step="0.001"
                    value={parsedDef.clip?.angularImpulse ?? 0}
                    onChange={(e) => updateDef(p => { if (!p.clip) p.clip = {}; p.clip.angularImpulse = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1" title="방출 주기 (프레임 단위, 작을수록 자주 방출)">Interval</label>
                  <input 
                    type="number" 
                    value={parsedDef.clip?.interval ?? 100}
                    onChange={(e) => updateDef(p => { if (!p.clip) p.clip = {}; p.clip.interval = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1" title="생존 시간 (프레임 단위)">Lifespan</label>
                  <input 
                    type="number" 
                    value={parsedDef.clip?.lifespan ?? 1000}
                    onChange={(e) => updateDef(p => { if (!p.clip) p.clip = {}; p.clip.lifespan = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => updateDef(p => { if (!p.clip) p.clip = {}; p.clip.loop = !(p.clip.loop ?? true); return p })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${parsedDef.clip?.loop !== false ? 'bg-primary-500' : 'bg-surface-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${parsedDef.clip?.loop !== false ? 'translate-x-5' : ''}`} />
                </button>
                <label className="text-[10px] font-medium text-surface-400 uppercase">Loop Animation</label>
              </div>

              {/* Size Array */}
              <div className="pt-2 border-t border-surface-700/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] text-surface-500 uppercase">Size Variation (Min/Max)</label>
                  <button onClick={() => addTupleToArray('size')} className="text-primary-400 hover:text-primary-300 text-[10px]">+ Add</button>
                </div>
                <div className="space-y-2">
                  {(parsedDef.clip?.size || []).map((tuple, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-surface-900 p-1.5 rounded border border-surface-700">
                      <span className="text-[10px] text-surface-500 w-4 text-center">{idx + 1}</span>
                      <input 
                        type="number" step="0.1" value={tuple[0]} 
                        onChange={(e) => updateNumberTupleArray('size', idx, 0, e.target.value)}
                        className="flex-1 bg-surface-800 border-none rounded p-1 text-xs text-white w-0"
                      />
                      <span className="text-surface-600">-</span>
                      <input 
                        type="number" step="0.1" value={tuple[1]} 
                        onChange={(e) => updateNumberTupleArray('size', idx, 1, e.target.value)}
                        className="flex-1 bg-surface-800 border-none rounded p-1 text-xs text-white w-0"
                      />
                      <button onClick={() => removeTupleFromArray('size', idx)} className="text-red-400 hover:text-red-300 w-5 text-center">×</button>
                    </div>
                  ))}
                  {(!parsedDef.clip?.size || parsedDef.clip.size.length === 0) && (
                    <div className="text-[10px] text-surface-600 text-center py-2">No size variations (Fixed size)</div>
                  )}
                </div>
              </div>

              {/* Opacity Array */}
              <div className="pt-2 border-t border-surface-700/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] text-surface-500 uppercase">Opacity Variation (Min/Max)</label>
                  <button onClick={() => addTupleToArray('opacity')} className="text-primary-400 hover:text-primary-300 text-[10px]">+ Add</button>
                </div>
                <div className="space-y-2">
                  {(parsedDef.clip?.opacity || []).map((tuple, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-surface-900 p-1.5 rounded border border-surface-700">
                      <span className="text-[10px] text-surface-500 w-4 text-center">{idx + 1}</span>
                      <input 
                        type="number" step="0.1" value={tuple[0]} 
                        onChange={(e) => updateNumberTupleArray('opacity', idx, 0, e.target.value)}
                        className="flex-1 bg-surface-800 border-none rounded p-1 text-xs text-white w-0"
                      />
                      <span className="text-surface-600">-</span>
                      <input 
                        type="number" step="0.1" value={tuple[1]} 
                        onChange={(e) => updateNumberTupleArray('opacity', idx, 1, e.target.value)}
                        className="flex-1 bg-surface-800 border-none rounded p-1 text-xs text-white w-0"
                      />
                      <button onClick={() => removeTupleFromArray('opacity', idx)} className="text-red-400 hover:text-red-300 w-5 text-center">×</button>
                    </div>
                  ))}
                  {(!parsedDef.clip?.opacity || parsedDef.clip.opacity.length === 0) && (
                    <div className="text-[10px] text-surface-600 text-center py-2">No opacity variations (Fixed 1.0)</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Particle Settings */}
          <div className="p-4">
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4">Particle Settings (물리 & 속성)</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1">Gravity Scale</label>
                  <input 
                    type="number" step="0.001"
                    value={parsedDef.particle?.attribute?.gravityScale ?? 0.001}
                    onChange={(e) => updateDef(p => { if (!p.particle) p.particle = {}; if (!p.particle.attribute) p.particle.attribute = {}; p.particle.attribute.gravityScale = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1">Friction Air</label>
                  <input 
                    type="number" step="0.01"
                    value={parsedDef.particle?.attribute?.frictionAir ?? 0}
                    onChange={(e) => updateDef(p => { if (!p.particle) p.particle = {}; if (!p.particle.attribute) p.particle.attribute = {}; p.particle.attribute.frictionAir = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1">Width</label>
                  <input 
                    type="number" 
                    value={parsedDef.particle?.style?.width ?? 10}
                    onChange={(e) => updateDef(p => { if (!p.particle) p.particle = {}; if (!p.particle.style) p.particle.style = {}; p.particle.style.width = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1">Height</label>
                  <input 
                    type="number" 
                    value={parsedDef.particle?.style?.height ?? 10}
                    onChange={(e) => updateDef(p => { if (!p.particle) p.particle = {}; if (!p.particle.style) p.particle.style = {}; p.particle.style.height = Number(e.target.value); return p })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => updateDef(p => { if (!p.particle) p.particle = {}; if (!p.particle.attribute) p.particle.attribute = {}; p.particle.attribute.strictPhysics = !(p.particle.attribute.strictPhysics ?? false); return p })}
                  className={`w-10 h-5 rounded-full transition-colors relative ${parsedDef.particle?.attribute?.strictPhysics ? 'bg-primary-500' : 'bg-surface-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${parsedDef.particle?.attribute?.strictPhysics ? 'translate-x-5' : ''}`} />
                </button>
                <label className="text-[10px] font-medium text-surface-400 uppercase">Strict Physics</label>
              </div>

              <div>
                <label className="block text-[10px] text-surface-500 uppercase mb-1">Blend Mode</label>
                <select 
                  value={parsedDef.particle?.style?.blendMode ?? 'normal'}
                  onChange={(e) => updateDef(p => { if (!p.particle) p.particle = {}; if (!p.particle.style) p.particle.style = {}; p.particle.style.blendMode = e.target.value; return p })}
                  className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                >
                  <option value="normal">normal</option>
                  <option value="multiply">multiply</option>
                  <option value="screen">screen</option>
                  <option value="overlay">overlay</option>
                  <option value="lighter">lighter (Add)</option>
                  <option value="color-dodge">color-dodge</option>
                  <option value="hard-light">hard-light</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className="flex-1 bg-[#181818] relative flex flex-col p-8">
          <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 bg-surface-800/80 p-3 rounded-lg border border-surface-700/50 backdrop-blur-sm z-10">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4 text-xs text-surface-300">
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">Particle Src:</span>
                  <span className="truncate max-w-[200px]" title={previewSrc}>{previewSrc || <span className="text-amber-500 italic">선택되지 않음</span>}</span>
                </div>
                <div className="w-px h-4 bg-surface-700"></div>
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">Intensity:</span>
                  <input 
                    type="number" min="1" max="1000"
                    value={previewIntensity}
                    onChange={(e) => setPreviewIntensity(Number(e.target.value) || 1)}
                    className="w-16 bg-surface-900 border border-surface-700 rounded px-1.5 py-0.5 text-white outline-none"
                  />
                </div>
                <div className="w-px h-4 bg-surface-700"></div>
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">Background:</span>
                  <select
                    value={previewBgSrc}
                    onChange={(e) => setPreviewBgSrc(e.target.value)}
                    className="bg-surface-900 border border-surface-700 text-surface-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary-500 min-w-[120px] max-w-[150px]"
                  >
                    <option value="">없음 (검은색)</option>
                    {backgroundList.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                  {previewBgSrc && !previewBgDef && (
                    <span className="text-[10px] text-surface-500 animate-pulse ml-1">로딩 중...</span>
                  )}
                </div>
                <div className="w-px h-4 bg-surface-700"></div>
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">Mood:</span>
                  <select
                    value={previewMood}
                    onChange={(e) => setPreviewMood(e.target.value)}
                    className="bg-surface-900 border border-surface-700 text-surface-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary-500"
                  >
                    <option value="none">없음 (None)</option>
                    <option value="day">낮 (Day)</option>
                    <option value="night">밤 (Night)</option>
                    <option value="dawn">새벽 (Dawn)</option>
                    <option value="sunset">노을 (Sunset)</option>
                    <option value="foggy">안개 (Foggy)</option>
                    <option value="sepia">세피아 (Sepia)</option>
                    <option value="cold">차가움 (Cold)</option>
                    <option value="noir">느와르 (Noir)</option>
                    <option value="horror">공포 (Horror)</option>
                    <option value="flashback">회상 (Flashback)</option>
                    <option value="dream">꿈 (Dream)</option>
                    <option value="danger">위험 (Danger)</option>
                    <option value="spot">조명 (Spot)</option>
                    <option value="ambient">주변광 (Ambient)</option>
                    <option value="warm">따뜻함 (Warm)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleBrowseImage}
                  className="px-3 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs font-medium shadow"
                >
                  파티클 에셋 선택
                </button>
              </div>
            </div>
          </div>

          <div className={`w-full h-full border-2 border-dashed border-surface-700/50 rounded-xl flex items-center justify-center relative overflow-hidden ${!previewBgSrc ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAA8CUwMDIyMjIwMAA8xG+A+H1A8wEhoFhAxhRTAkMDIwMDAwAE3cK2x1d0JAAAAAASUVORK5CYII=')] bg-repeat" : "bg-black"} mt-24`}>
            {!previewSrc ? (
              <div className="text-center z-10 bg-surface-900/80 p-6 rounded-xl backdrop-blur-sm border border-surface-700/50">
                <svg className="w-16 h-16 text-surface-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-surface-300 font-medium">파티클 에셋 이미지를 선택하면 시뮬레이터가 작동합니다.</p>
                <p className="text-surface-500 text-sm mt-1">파일에는 저장되지 않으며, 인게임의 rate 및 src를 모의 테스트하는 용도입니다.</p>
              </div>
            ) : (
              <FumikaPreview
                assets={{
                  [previewSrc]: (previewSrc.includes(':') || previewSrc.startsWith('/'))
                    ? `local-resource:///${previewSrc.replace(/\\/g, '/')}`
                    : `local-resource:///${projectPath?.replace(/\\/g, '/')}/assets/${previewSrc}`,
                  ...(previewBgDef?.src ? {
                    ['preview_bg_asset']: (previewBgDef.src.includes(':') || previewBgDef.src.startsWith('/'))
                      ? `local-resource:///${previewBgDef.src.replace(/\\/g, '/')}`
                      : `local-resource:///${projectPath?.replace(/\\/g, '/')}/assets/${previewBgDef.src}`
                  } : {})
                }}
                scene={[
                  ...(previewBgSrc && previewBgDef ? [{
                    type: 'background',
                    name: 'preview_bg',
                    duration: 0,
                    fit: 'cover'
                  } as any] : []),
                  ...(previewMood !== 'none' ? [{
                    type: 'mood',
                    mood: previewMood,
                    duration: 0
                  } as any] : []),
                  {
                    type: 'effect',
                    action: 'add',
                    effect: 'dust',
                    src: previewSrc,
                    rate: previewIntensity,
                  }
                ]}
                configOverride={{
                  effects: { dust: parsedDef ?? {} },
                  ...(previewBgSrc && previewBgDef ? {
                    backgrounds: {
                      preview_bg: { src: 'preview_bg_asset', parallax: previewBgDef.parallax }
                    }
                  } : {})
                }}
              />
            )}
          </div>
        </div>
      </div>

      <ConfirmDialogBox
        isOpen={confirmState?.isOpen || false}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        type={confirmState?.type || 'info'}
        onConfirm={() => setConfirmState(null)}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}

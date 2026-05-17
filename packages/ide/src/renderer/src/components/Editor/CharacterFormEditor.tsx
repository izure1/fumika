import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { CodeEditor } from './CodeEditor'
import { useProjectStore } from '../../store/useProjectStore'
import { DialogBox } from '../UI/DialogBox'
import { ConfirmDialogBox } from '../UI/ConfirmDialogBox'

interface ParsedPoint { x: number; y: number }
interface ParsedBase {
  src: string
  width: number
  points: Record<string, ParsedPoint>
}
interface ParsedCharacter {
  name: string
  bases: Record<string, ParsedBase>
  emotions: Record<string, Record<string, string>>
}

interface Props {
  content: string
  onChange: (value: string) => void
  filePath: string
}

export function CharacterFormEditor({ content, onChange, filePath }: Props) {
  const { projectPath } = useProjectStore()
  const [viewMode, setViewMode] = useState<'gui' | 'code'>('gui')
  
  const [parsedChar, setParsedChar] = useState<ParsedCharacter | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  
  const [activeBase, setActiveBase] = useState<string>('')
  const [activeEmotion, setActiveEmotion] = useState<string>('')
  const [activePoint, setActivePoint] = useState<string | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const baseImgRef = useRef<HTMLImageElement | null>(null)
  const emotionImgsRef = useRef<Record<string, HTMLImageElement>>({})
  
  const [newEmotionPoint, setNewEmotionPoint] = useState<string>('')
  useEffect(() => {
    setNewEmotionPoint('')
  }, [activeEmotion])

  const allAvailablePoints = useMemo(() => {
    if (!parsedChar) return []
    const points = new Set<string>()
    Object.values(parsedChar.bases).forEach(base => {
      Object.keys(base.points || {}).forEach(pt => points.add(pt))
    })
    return Array.from(points)
  }, [parsedChar])

  type PromptAction = 'add_base' | 'add_point' | 'add_emotion'
  interface PromptData {
    isOpen: boolean
    action: PromptAction
    title: string
    placeholder?: string
  }
  const [promptData, setPromptData] = useState<PromptData | null>(null)

  interface ConfirmState {
    isOpen: boolean
    title: string
    message: string
    action: 'delete_base' | 'delete_emotion' | 'error'
    targetName: string
  }
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  
  const handleBrowseImage = async (onSelect: (src: string) => void) => {
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
        
        // 사용자의 요청: 'assets/'로 시작하면 이를 제거 (예: assets/characters/... -> characters/...)
        if (selectedPath.startsWith('assets/')) {
          selectedPath = selectedPath.substring(7)
        }
        
        onSelect(selectedPath)
      } else {
        const fileName = selectedPath.split('/').pop() || 'unnamed.png'
        const charBasename = filePath.replace(/\\/g, '/').split('/').pop()?.split('.')[0] || 'unnamed'
        const destPath = `${projPath}/assets/characters/${charBasename}/${fileName}`
        
        await window.api.fs.copyFile(selectedPath, destPath)
        
        const importedSrc = `characters/${charBasename}/${fileName}`
        onSelect(importedSrc)
      }
    }
  }
  
  // 파싱
  useEffect(() => {
    if (viewMode === 'code') return // 코드 모드일 때는 파싱을 스킵하고 리렌더링만 (코드 에디터가 content를 제어)
    
    try {
      const match = content.match(/defineCharacter\s*\([\s\S]*?\)\s*\(\s*({[\s\S]*})\s*\)/)
      if (match && match[1]) {
        let objStr = match[1]
        const lastBraceIndex = objStr.lastIndexOf('}')
        if (lastBraceIndex !== -1) {
          objStr = objStr.substring(0, lastBraceIndex + 1)
        }
        
        // 함수, eval 회피를 위해 안전한 평가 (단, 개발용 IDE이므로 Function 사용 허용)
        const parsed = new Function(`return ${objStr}`)() as ParsedCharacter
        
        // 기본 구조 보장
        if (!parsed.bases) parsed.bases = {}
        if (!parsed.emotions) parsed.emotions = {}
        if (!parsed.name) parsed.name = ''
        
        setParsedChar(parsed)
        setParseError(null)
        
        if (!activeBase && Object.keys(parsed.bases).length > 0) {
          setActiveBase(Object.keys(parsed.bases)[0])
        }
      } else {
        setParseError('캐릭터 설정 형식을 파싱할 수 없습니다. 코드 모드를 사용해 주세요.')
        setViewMode('code')
      }
    } catch (e: any) {
      setParseError(`파싱 오류: ${e.message}`)
      setViewMode('code')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, viewMode])

  // 코드 생성
  const generateCode = useCallback((char: ParsedCharacter) => {
    const formatValue = (val: any, indent = 0): string => {
      const space = ' '.repeat(indent)
      if (typeof val === 'string') return `'${val}'`
      if (typeof val === 'number') return `${val}`
      if (typeof val === 'object' && val !== null) {
        const lines: string[] = []
        for (const [k, v] of Object.entries(val)) {
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

    const match = content.match(/(defineCharacter\s*\([\s\S]*?\)\s*\(\s*)({[\s\S]*})(\s*\))/)
    if (match) {
      const newCode = content.substring(0, match.index! + match[1].length) + 
             formatValue(char, 0) + 
             content.substring(match.index! + match[1].length + match[2].length)
      onChange(newCode)
    } else {
      // Fallback
      const template = `import { defineCharacter } from 'fumika'
import assets from '@/declarations/assets'

export default defineCharacter(assets)(${formatValue(char, 0)})
`
      onChange(template)
    }
  }, [content, onChange])

  // 내부 상태 업데이트 및 코드 전송
  const updateChar = useCallback((updater: (prev: ParsedCharacter) => ParsedCharacter) => {
    setParsedChar(prev => {
      if (!prev) return prev
      const next = updater({ ...prev })
      generateCode(next)
      return next
    })
  }, [generateCode])

  // 이미지 로드
  useEffect(() => {
    if (!parsedChar || !activeBase || !parsedChar.bases[activeBase]) return
    
    const base = parsedChar.bases[activeBase]
    if (!base.src) return

    let isMounted = true
    const img = new Image()
    
    // 에디터의 값은 'characters/...' 지만 실제 파일은 'assets/characters/...' 에 있을 수 있음
    let srcPath = base.src
    if (!srcPath.startsWith('assets/')) {
      srcPath = `assets/${srcPath}`
    }

    let finalSrc = `local-resource:///${projectPath}/${srcPath}`

    img.src = finalSrc

    img.onload = () => {
      if (isMounted) {
        baseImgRef.current = img
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
      }
    }
    img.onerror = () => {
      console.warn('Failed to load base image:', img.src)
      if (isMounted) {
        baseImgRef.current = null
        setImageSize({ width: 0, height: 0 })
      }
    }

    return () => { isMounted = false }
  }, [parsedChar?.bases, activeBase, projectPath])

  // 이모션 이미지 로드
  useEffect(() => {
    if (!parsedChar || !activeEmotion || !parsedChar.emotions[activeEmotion]) {
      emotionImgsRef.current = {}
      return
    }

    const slots = parsedChar.emotions[activeEmotion]
    const newImgs: Record<string, HTMLImageElement> = {}
    let loadedCount = 0
    const totalCount = Object.keys(slots).length

    if (totalCount === 0) {
      emotionImgsRef.current = {}
      // trigger render
      setParsedChar(prev => prev ? { ...prev } : prev)
      return
    }

    Object.entries(slots).forEach(([slot, src]) => {
      const img = new Image()
      
      let srcPath = src
      if (!srcPath.startsWith('assets/')) {
        srcPath = `assets/${srcPath}`
      }

      const finalSrc = `local-resource:///${projectPath}/${srcPath}`
      
      img.src = finalSrc
      img.onload = () => {
        newImgs[slot] = img
        loadedCount++
        if (loadedCount === totalCount) {
          emotionImgsRef.current = newImgs
          // 렌더링 트리거
          setParsedChar(prev => prev ? { ...prev } : prev)
        }
      }
      img.onerror = () => {
        loadedCount++
        if (loadedCount === totalCount) {
          emotionImgsRef.current = newImgs
          setParsedChar(prev => prev ? { ...prev } : prev)
        }
      }
    })
  }, [parsedChar?.emotions, activeEmotion, projectPath])

  // 줌 및 팬 상태
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })

  // 캔버스 렌더링
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeBase) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // 항상 최신 상태를 사용하도록 ref 참조
    const parsed = latestParsedCharRef.current
    if (!parsed || !parsed.bases[activeBase]) return

    const base = parsed.bases[activeBase]
    
    // 캔버스 크기 조정 (디스플레이 크기에 맞춤)
    const displayWidth = canvas.parentElement?.clientWidth || 800
    const displayHeight = canvas.parentElement?.clientHeight || 600
    
    canvas.width = displayWidth
    canvas.height = displayHeight
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    if (!baseImgRef.current || imageSize.width === 0) {
      ctx.fillStyle = '#333'
      ctx.font = '14px sans-serif'
      ctx.fillText('이미지를 불러올 수 없거나 설정되지 않았습니다.', 20, 30)
      return
    }

    // 이미지 그리기 (중앙 정렬, 비율 유지 + 줌/팬 적용)
    const baseScale = Math.min(displayWidth / imageSize.width, displayHeight / imageSize.height) * 0.9
    const scale = baseScale * zoomRef.current
    const w = imageSize.width * scale
    const h = imageSize.height * scale
    const x = (displayWidth - w) / 2 + panRef.current.x
    const y = (displayHeight - h) / 2 + panRef.current.y

    ctx.drawImage(baseImgRef.current, x, y, w, h)

    // 이모션 오버레이 그리기
    if (activeEmotion && parsed.emotions[activeEmotion]) {
      Object.entries(parsed.emotions[activeEmotion]).forEach(([slot, src]) => {
        const img = emotionImgsRef.current[slot]
        const pt = base.points[slot]
        if (img && pt) {
          // pt.x, pt.y 는 0~1 좌표. 이미지 상의 위치
          const px = x + pt.x * w
          const py = y + pt.y * h
          // 오버레이 이미지 중앙을 pt에 맞춤 (가정)
          const ew = img.naturalWidth * scale
          const eh = img.naturalHeight * scale
          ctx.drawImage(img, px - ew/2, py - eh/2, ew, eh)
        }
      })
    }

    // 포인트 핸들 그리기
    Object.entries(base.points || {}).forEach(([ptName, pt]) => {
      const px = x + pt.x * w
      const py = y + pt.y * h
      
      const isHovered = activePoint === ptName
      
      ctx.beginPath()
      ctx.arc(px, py, isHovered ? 8 : 6, 0, 2 * Math.PI)
      ctx.fillStyle = isHovered ? '#10b981' : '#ef4444' // emerald-500 : red-500
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()

      // 레이블
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px sans-serif'
      ctx.fillText(ptName, px + 10, py + 4)
    })

  }, [activeBase, activeEmotion, imageSize, activePoint])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas, parsedChar])

  // 캔버스 드래그 처리를 위한 Ref
  const draggingPointRef = useRef<string | null>(null)
  const latestParsedCharRef = useRef<ParsedCharacter | null>(null)
  latestParsedCharRef.current = parsedChar
  const generateCodeRef = useRef(generateCode)
  generateCodeRef.current = generateCode
  const drawCanvasRef = useRef(drawCanvas)
  drawCanvasRef.current = drawCanvas

  // 캔버스 드래그 처리
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeBase) return

    let rafId: number

    let isPanning = false
    let lastPanPos = { x: 0, y: 0 }

    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }

    const getPointFromMouse = (mx: number, my: number): string | null => {
      const displayWidth = canvas.width
      const displayHeight = canvas.height
      if (imageSize.width === 0) return null
      
      const parsed = latestParsedCharRef.current
      if (!parsed || !parsed.bases[activeBase]) return null

      const baseScale = Math.min(displayWidth / imageSize.width, displayHeight / imageSize.height) * 0.9
      const scale = baseScale * zoomRef.current
      const w = imageSize.width * scale
      const h = imageSize.height * scale
      const ix = (displayWidth - w) / 2 + panRef.current.x
      const iy = (displayHeight - h) / 2 + panRef.current.y

      const base = parsed.bases[activeBase]
      for (const [ptName, pt] of Object.entries(base.points || {})) {
        const px = ix + pt.x * w
        const py = iy + pt.y * h
        const dist = Math.sqrt((mx - px)**2 + (my - py)**2)
        if (dist <= 10) return ptName
      }
      return null
    }

    const handleMouseDown = (e: MouseEvent) => {
      const { x, y } = getMousePos(e)
      
      // 마우스 가운데/우측 버튼은 화면 팬
      if (e.button === 1 || e.button === 2) {
        isPanning = true
        lastPanPos = { x, y }
        return
      }

      const pt = getPointFromMouse(x, y)
      if (pt) {
        draggingPointRef.current = pt
        setActivePoint(pt)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y } = getMousePos(e)
      
      if (isPanning) {
        const dx = x - lastPanPos.x
        const dy = y - lastPanPos.y
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy }
        lastPanPos = { x, y }
        drawCanvasRef.current()
        return
      }
      
      if (!draggingPointRef.current) {
        const pt = getPointFromMouse(x, y)
        setActivePoint(prev => prev !== pt ? pt : prev)
        return
      }

      const displayWidth = canvas.width
      const displayHeight = canvas.height
      const baseScale = Math.min(displayWidth / imageSize.width, displayHeight / imageSize.height) * 0.9
      const scale = baseScale * zoomRef.current
      const w = imageSize.width * scale
      const h = imageSize.height * scale
      const ix = (displayWidth - w) / 2 + panRef.current.x
      const iy = (displayHeight - h) / 2 + panRef.current.y

      // 역변환 (0~1 밖으로 나가지 않도록 제한)
      let nx = (x - ix) / w
      let ny = (y - iy) / h
      nx = Math.max(0, Math.min(1, nx))
      ny = Math.max(0, Math.min(1, ny))

      // 렌더링 최적화를 위해 RAF 사용 + 로컬 state 임시 업데이트
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const dragPt = draggingPointRef.current
        if (dragPt) {
          setParsedChar(prev => {
            if (!prev) return prev
            const next = { ...prev }
            if (next.bases[activeBase] && next.bases[activeBase].points[dragPt]) {
              next.bases[activeBase].points[dragPt] = { x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) }
            }
            return next
          })
        }
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1 || e.button === 2) {
        isPanning = false
        return
      }

      if (draggingPointRef.current) {
        // 드래그 종료 시 코드 생성 (디바운스/1회)
        if (latestParsedCharRef.current) {
          generateCodeRef.current(latestParsedCharRef.current)
        }
        draggingPointRef.current = null
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { x, y } = getMousePos(e as any)
      
      const oldZoom = zoomRef.current
      const zoomFactor = 1.1
      let newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor
      newZoom = Math.max(0.1, Math.min(10, newZoom))
      
      // 줌인/줌아웃 시 마우스 커서 위치를 기준으로 확대/축소
      const displayWidth = canvas.width
      const displayHeight = canvas.height
      const centerX = displayWidth / 2 + panRef.current.x
      const centerY = displayHeight / 2 + panRef.current.y
      
      const dx = x - centerX
      const dy = y - centerY
      
      const scaleChange = newZoom / oldZoom
      const newPanX = panRef.current.x - dx * (scaleChange - 1)
      const newPanY = panRef.current.y - dy * (scaleChange - 1)
      
      zoomRef.current = newZoom
      panRef.current = { x: newPanX, y: newPanY }
      drawCanvasRef.current()
    }

    const handleContextMenu = (e: MouseEvent) => e.preventDefault()

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [activeBase, imageSize])

  const handleAddBase = () => {
    setPromptData({ isOpen: true, action: 'add_base', title: '새 Base 이름 입력', placeholder: '예: walk' })
  }

  const handleDeleteBase = (name: string) => {
    setConfirmState({ isOpen: true, title: 'Base 삭제', message: `'${name}' Base를 삭제하시겠습니까?`, action: 'delete_base', targetName: name })
  }

  const handleAddPoint = () => {
    setPromptData({ isOpen: true, action: 'add_point', title: '새 Point 이름 입력', placeholder: '예: face' })
  }

  const handleDeletePoint = (name: string) => {
    if (!activeBase) return
    updateChar(prev => {
      delete prev.bases[activeBase].points[name]
      return prev
    })
  }

  const handleAddEmotion = () => {
    setPromptData({ isOpen: true, action: 'add_emotion', title: '새 Emotion 이름 입력', placeholder: '예: smile' })
  }

  const handleDeleteEmotion = (name: string) => {
    setConfirmState({ isOpen: true, title: 'Emotion 삭제', message: `'${name}' Emotion을 삭제하시겠습니까?`, action: 'delete_emotion', targetName: name })
  }

  const submitPrompt = (value: string) => {
    if (!value || !promptData || !parsedChar) {
      setPromptData(null)
      return
    }

    const name = value.trim()
    const { action } = promptData

    if (action === 'add_base') {
      if (parsedChar.bases[name]) {
        alert('이미 존재하는 Base입니다.')
      } else {
        updateChar(prev => {
          prev.bases[name] = { src: '', width: 560, points: {} }
          return prev
        })
        setActiveBase(name)
      }
    } else if (action === 'add_point') {
      if (activeBase && parsedChar.bases[activeBase].points[name]) {
        alert('이미 존재하는 Point입니다.')
      } else if (activeBase) {
        updateChar(prev => {
          prev.bases[activeBase].points[name] = { x: 0.5, y: 0.5 }
          return prev
        })
      }
    } else if (action === 'add_emotion') {
      if (parsedChar.emotions[name]) {
        alert('이미 존재하는 Emotion입니다.')
      } else {
        updateChar(prev => {
          prev.emotions[name] = {}
          return prev
        })
        setActiveEmotion(name)
      }
    }

    setPromptData(null)
  }

  const submitConfirm = () => {
    if (!confirmState || !parsedChar) {
      setConfirmState(null)
      return
    }

    const { action, targetName } = confirmState

    if (action === 'delete_base') {
      updateChar(prev => {
        delete prev.bases[targetName]
        return prev
      })
      if (activeBase === targetName) {
        setActiveBase(Object.keys(parsedChar?.bases || {})[0] || '')
      }
    } else if (action === 'delete_emotion') {
      updateChar(prev => {
        delete prev.emotions[targetName]
        return prev
      })
      if (activeEmotion === targetName) setActiveEmotion('')
    }

    setConfirmState(null)
  }


  if (viewMode === 'code' || !parsedChar) {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between">
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

  const currentBaseObj = parsedChar.bases[activeBase]

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between z-10">
        <div className="text-sm font-medium text-surface-300 flex items-center gap-2">
          <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          {parsedChar.name || 'Unnamed Character'}
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
        <div className="w-80 flex flex-col border-r border-surface-700 bg-surface-800/30 overflow-y-auto">
          {/* General Settings */}
          <div className="p-4 border-b border-surface-700/50 bg-surface-800/50">
            <label className="block text-[10px] text-surface-500 uppercase font-bold tracking-wider mb-1">Character Name</label>
            <input 
              type="text" 
              value={parsedChar.name}
              onChange={(e) => updateChar(prev => { prev.name = e.target.value; return prev })}
              className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
              placeholder="예: 후미카"
            />
          </div>

          {/* Base Tabs */}
          <div className="p-4 border-b border-surface-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Bases</span>
              <button onClick={handleAddBase} className="text-primary-400 hover:text-primary-300 text-xs flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(parsedChar.bases).map(baseKey => (
                <div key={baseKey} className={`flex items-center rounded text-xs overflow-hidden border ${activeBase === baseKey ? 'border-primary-500 bg-primary-500/10 text-primary-300' : 'border-surface-600 bg-surface-700/50 text-surface-300 hover:bg-surface-700'}`}>
                  <button 
                    className="px-2 py-1 select-none"
                    onClick={() => setActiveBase(baseKey)}
                  >
                    {baseKey}
                  </button>
                  <button 
                    className="px-1.5 py-1 hover:bg-red-500/20 hover:text-red-400 opacity-50 hover:opacity-100"
                    onClick={() => handleDeleteBase(baseKey)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            {currentBaseObj && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1">Image Source (src)</label>
                  <div className="flex gap-1">
                    <input 
                      type="text" 
                      value={currentBaseObj.src}
                      onChange={(e) => updateChar(prev => { prev.bases[activeBase].src = e.target.value; return prev })}
                      className="flex-1 min-w-0 bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                      placeholder="예: characters/fumika/base/idle.png"
                    />
                    <button
                      onClick={() => handleBrowseImage((src) => updateChar(prev => { prev.bases[activeBase].src = src; return prev }))}
                      className="px-2 bg-surface-700 hover:bg-surface-600 border border-surface-600 rounded text-surface-300 transition-colors flex items-center justify-center shrink-0"
                      title="탐색기에서 열기"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-surface-500 uppercase mb-1">Width</label>
                  <input 
                    type="number" 
                    value={currentBaseObj.width}
                    onChange={(e) => updateChar(prev => { prev.bases[activeBase].width = Number(e.target.value); return prev })}
                    className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Points */}
          {currentBaseObj && (
            <div className="p-4 border-b border-surface-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Points</span>
                <button onClick={handleAddPoint} className="text-primary-400 hover:text-primary-300 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  추가
                </button>
              </div>
              
              <div className="space-y-2">
                {Object.entries(currentBaseObj.points || {}).map(([ptName, pt]) => (
                  <div 
                    key={ptName} 
                    className={`flex items-center justify-between p-2 rounded border ${activePoint === ptName ? 'border-primary-500 bg-surface-900' : 'border-surface-700 bg-surface-800/50'}`}
                    onMouseEnter={() => setActivePoint(ptName)}
                    onMouseLeave={() => setActivePoint(null)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-medium text-surface-200 w-12 truncate" title={ptName}>{ptName}</span>
                    </div>
                    <div className="flex gap-1 items-center font-mono text-[10px] text-surface-400 bg-surface-900 px-1.5 py-0.5 rounded">
                      x:{pt.x.toFixed(3)} y:{pt.y.toFixed(3)}
                    </div>
                    <button 
                      onClick={() => handleDeletePoint(ptName)}
                      className="text-surface-500 hover:text-red-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
                {Object.keys(currentBaseObj.points || {}).length === 0 && (
                  <div className="text-xs text-surface-500 italic py-2">등록된 Point가 없습니다.</div>
                )}
              </div>
            </div>
          )}

          {/* Emotions */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-surface-400 uppercase tracking-wider">Emotions</span>
              <button onClick={handleAddEmotion} className="text-primary-400 hover:text-primary-300 text-xs flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                추가
              </button>
            </div>
            
            <div className="mb-3">
              <select 
                value={activeEmotion} 
                onChange={(e) => setActiveEmotion(e.target.value)}
                className="w-full bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
              >
                <option value="">-- 미리보기 선택 안함 --</option>
                {Object.keys(parsedChar.emotions).map(emo => (
                  <option key={emo} value={emo}>{emo}</option>
                ))}
              </select>
            </div>

            {activeEmotion && parsedChar.emotions[activeEmotion] && (
              <div className="space-y-3 bg-surface-900/50 p-3 rounded border border-surface-700/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-primary-300">{activeEmotion} 설정</span>
                  <button onClick={() => handleDeleteEmotion(activeEmotion)} className="text-surface-500 hover:text-red-400 text-[10px]">
                    삭제
                  </button>
                </div>
                
                {/* 현재 이모션에 연결된 포인트 목록 */}
                {Object.entries(parsedChar.emotions[activeEmotion]).map(([ptName, val]) => (
                  <div key={ptName}>
                    <label className="block text-[10px] text-surface-500 mb-1">Slot: {ptName}</label>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={val}
                        onChange={(e) => {
                          const src = e.target.value
                          updateChar(prev => {
                            prev.emotions[activeEmotion][ptName] = src
                            return prev
                          })
                        }}
                        className="flex-1 min-w-0 bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                        placeholder="이미지 src"
                      />
                      <button
                        onClick={() => handleBrowseImage((src) => updateChar(prev => { prev.emotions[activeEmotion][ptName] = src; return prev }))}
                        className="px-2 bg-surface-700 hover:bg-surface-600 border border-surface-600 rounded text-surface-300 transition-colors flex items-center justify-center shrink-0"
                        title="탐색기에서 열기"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      </button>
                      <button
                        onClick={() => updateChar(prev => {
                          delete prev.emotions[activeEmotion][ptName]
                          return prev
                        })}
                        className="px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded transition-colors flex items-center justify-center shrink-0"
                        title="포인트 연결 해제"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}

                {/* 포인트 연결 추가 */}
                <div className="pt-2 border-t border-surface-700/50 flex gap-1 mt-2">
                  <select
                    value={newEmotionPoint}
                    onChange={e => setNewEmotionPoint(e.target.value)}
                    className="flex-1 bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 outline-none"
                  >
                    <option value="">-- 추가할 포인트 선택 --</option>
                    {allAvailablePoints
                      .filter(p => parsedChar.emotions[activeEmotion][p] === undefined)
                      .map(p => <option key={p} value={p}>{p}</option>)
                    }
                  </select>
                  <button
                    onClick={() => {
                      if (newEmotionPoint) {
                        updateChar(prev => {
                          prev.emotions[activeEmotion][newEmotionPoint] = ''
                          return prev
                        })
                        setNewEmotionPoint('')
                      }
                    }}
                    disabled={!newEmotionPoint}
                    className="px-3 bg-primary-600 hover:bg-primary-500 disabled:bg-surface-700 disabled:text-surface-500 text-white rounded text-xs transition-colors shrink-0"
                  >
                    추가
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Canvas Preview */}
        <div className="flex-1 relative bg-surface-950 overflow-hidden flex items-center justify-center">
          <canvas 
            ref={canvasRef}
            className="cursor-crosshair absolute inset-0"
          />
          {(!currentBaseObj || !currentBaseObj.src) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-surface-950/80">
              <svg className="w-12 h-12 text-surface-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-surface-500 text-sm">Base 이미지가 없습니다.</p>
            </div>
          )}
          
          <div className="absolute top-4 right-4 bg-surface-900/80 backdrop-blur border border-surface-700 rounded p-2 text-[10px] text-surface-400 pointer-events-none shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div> Point 드래그하여 이동
            </div>
            <div>* 휠 스크롤: 줌 인/아웃</div>
            <div>* 마우스 휠 클릭/우클릭 드래그: 화면 이동</div>
          </div>
          <button 
            onClick={() => {
              zoomRef.current = 1
              panRef.current = { x: 0, y: 0 }
              drawCanvasRef.current()
            }}
            className="absolute bottom-4 right-4 bg-surface-800 hover:bg-surface-700 text-surface-300 text-[10px] px-3 py-1.5 rounded border border-surface-600 shadow transition-colors"
          >
            화면 리셋
          </button>
        </div>
      </div>

      <DialogBox
        isOpen={promptData?.isOpen || false}
        title={promptData?.title || ''}
        placeholder={promptData?.placeholder || ''}
        onConfirm={submitPrompt}
        onCancel={() => setPromptData(null)}
      />
      
      <ConfirmDialogBox
        isOpen={confirmState?.isOpen || false}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        type={confirmState?.action === 'error' ? 'danger' : 'warning'}
        showCancel={confirmState?.action !== 'error'}
        onConfirm={submitConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}

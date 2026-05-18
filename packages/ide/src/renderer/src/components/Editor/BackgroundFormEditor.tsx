import { useState, useEffect } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { getBackgroundContent } from '../../../../shared/templates'
import { FumikaPreview } from './FumikaPreview'
import { CodeEditor } from './CodeEditor'

interface Props {
  content: string
  onChange: (value: string) => void
  filePath: string
}

export function BackgroundFormEditor({ content, onChange, filePath }: Props) {
  const { projectPath } = useProjectStore()
  const [src, setSrc] = useState('')
  const [parallax, setParallax] = useState(false)
  const [fit, setFit] = useState<'cover' | 'contain' | 'inherit' | 'stretch'>('cover')
  const [previewAbsPath, setPreviewAbsPath] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'gui' | 'code'>('gui')
  const [previewMood, setPreviewMood] = useState<string>('none')
  const [projectSize, setProjectSize] = useState<{width: number, height: number} | null>(null)

  // novel.config.ts에서 width, height 읽어오기
  useEffect(() => {
    if (!projectPath) return
    window.api.fs.readFile(`${projectPath}/novel.config.ts`).then(res => {
      if (res.success && res.content) {
        const wMatch = res.content.match(/width\s*:\s*(\d+)/)
        const hMatch = res.content.match(/height\s*:\s*(\d+)/)
        if (wMatch && hMatch) {
          setProjectSize({ width: parseInt(wMatch[1], 10), height: parseInt(hMatch[1], 10) })
        }
      }
    }).catch(() => {})
  }, [projectPath])


  // 간단한 정규식으로 기존 값 추출 (AST 미사용 단순 파싱)
  useEffect(() => {
    if (viewMode === 'code') return
    try {
      const srcMatch = content.match(/src(?:\s*:\s*keyof\s+typeof\s+[A-Za-z]+)?\s*=\s*['"]([^'"]+)['"]/)
      if (srcMatch && srcMatch[1]) {
        const parsedSrc = srcMatch[1]
        setSrc(parsedSrc)

        // 키에 확장자가 포함되므로 직접 경로 구성
        if (!previewAbsPath && projectPath) {
          setPreviewAbsPath(`${projectPath.replace(/\\/g, '/')}/assets/${parsedSrc}`)
        }
      }

      const parallaxMatch = content.match(/parallax(?:\s*:\s*boolean)?\s*=\s*(true|false)/)
      if (parallaxMatch && parallaxMatch[1]) setParallax(parallaxMatch[1] === 'true')
    } catch (e) {
      // 파싱 실패 시 무시
    }
  }, [content, projectPath])

  // 값이 바뀔 때마다 템플릿 문자열 재생성하여 부모에게 전달
  const updateTemplate = (s: string, p: boolean) => {
    onChange(getBackgroundContent(s, p))
  }

  const handleBrowseImage = async () => {
    if (!projectPath) return
    const defaultPath = `${projectPath}/assets`.replace(/\\/g, '/')
    const paths = await window.api.dialog.openFile({
      defaultPath,
    filters: [{ name: 'Media', extensions: ['png', 'webp', 'jpg', 'jpeg', 'mp4', 'webm', 'mov'] }]
    })

    if (paths && paths.length > 0) {
      let selectedPath = paths[0].replace(/\\/g, '/')
      const projPath = projectPath.replace(/\\/g, '/')
      
      let finalSrc = ''
      
      if (selectedPath.startsWith(projPath)) {
        const relativePath = selectedPath.substring(projPath.length + 1)
        const withoutAssets = relativePath.startsWith('assets/') ? relativePath.substring(7) : relativePath
        finalSrc = withoutAssets
        setPreviewAbsPath(selectedPath)
      } else {
        const fileName = selectedPath.split('/').pop() || 'unnamed'
        const destPath = `${projPath}/assets/backgrounds/${fileName}`
        await window.api.fs.copyFile(selectedPath, destPath)
        finalSrc = `backgrounds/${fileName}`
        setPreviewAbsPath(destPath)
      }
      
      setSrc(finalSrc)
      updateTemplate(finalSrc, parallax)
    }
  }

  if (viewMode === 'code') {
    return (
      <div className="flex flex-col h-full bg-[#1e1e1e]">
        <div className="h-10 bg-surface-800 flex items-center px-4 shrink-0 border-b border-surface-700/50 justify-between z-10">
          <div className="text-sm font-medium text-surface-300">
            {filePath.split(/[/\\]/).pop()}
          </div>
          <div className="flex bg-surface-900 rounded p-0.5">
            <button
              onClick={() => setViewMode('gui')}
              className="px-3 py-1 text-xs font-medium rounded-sm transition-colors text-surface-400 hover:text-surface-200 hover:bg-surface-800"
            >
              GUI
            </button>
            <button
              onClick={() => setViewMode('code')}
              className="px-3 py-1 text-xs font-medium rounded-sm transition-colors bg-primary-600 text-white shadow"
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

  const previewIsVideo = previewAbsPath ? /\.(mp4|webm|mov)$/i.test(previewAbsPath) : false
  const previewUrl = previewAbsPath ? `local-resource:///${previewAbsPath}` : null

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
          <div className="p-4 border-b border-surface-700/50">
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-4">Background Settings (배경)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-surface-500 uppercase mb-1">이미지 경로 (src)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={src}
                    onChange={(e) => {
                      setSrc(e.target.value)
                      updateTemplate(e.target.value, parallax)
                    }}
                    className="flex-1 bg-surface-900 border border-surface-700 rounded p-1.5 text-xs text-white focus:border-primary-500 focus:outline-none"
                    placeholder="예: backgrounds/bg_room.png"
                  />
                  <button
                    onClick={handleBrowseImage}
                    className="px-3 bg-surface-700 hover:bg-surface-600 border border-surface-600 rounded text-surface-300 transition-colors flex items-center justify-center shrink-0"
                    title="탐색기에서 열기"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const newVal = !parallax
                      setParallax(newVal)
                      updateTemplate(src, newVal)
                    }}
                    className={`w-10 h-5 rounded-full transition-colors relative ${parallax ? 'bg-primary-500' : 'bg-surface-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${parallax ? 'translate-x-5' : ''}`} />
                  </button>
                  <label className="text-[10px] font-medium text-surface-400 uppercase">
                    패럴랙스 활성화
                  </label>
                </div>
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
                  <span className="text-surface-500">Asset:</span>
                  <span className="truncate max-w-[200px]" title={src}>{src || <span className="text-amber-500 italic">선택되지 않음</span>}</span>
                </div>
                <div className="w-px h-4 bg-surface-700"></div>
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">Fit:</span>
                  <select
                    value={fit}
                    onChange={(e) => {
                      setFit(e.target.value as any)
                    }}
                    className="bg-surface-900 border border-surface-700 text-surface-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary-500"
                  >
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                    <option value="stretch">Stretch</option>
                    <option value="inherit">Inherit</option>
                  </select>
                </div>
                <div className="w-px h-4 bg-surface-700"></div>
                <div className="flex items-center gap-2">
                  <span className="text-surface-500">Mood:</span>
                  <select
                    value={previewMood}
                    onChange={(e) => setPreviewMood(e.target.value)}
                    className="bg-surface-900 border border-surface-700 text-surface-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-primary-500"
                  >
                    <option value="none">없음</option>
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
            </div>
          </div>

          <div className="flex-1 mt-24 flex items-center justify-center min-h-0 w-full">
            <div 
              className="border-2 border-dashed border-surface-700/50 rounded-xl overflow-hidden flex items-center justify-center relative bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAA8CUwMDIyMjIwMAA8xG+A+H1A8wEhoFhAxhRTAkMDIwMDAwAE3cK2x1d0JAAAAAASUVORK5CYII=')] bg-repeat"
              style={projectSize ? {
                aspectRatio: `${projectSize.width} / ${projectSize.height}`,
                maxHeight: '100%',
                maxWidth: '100%',
                width: '100%'
              } : { width: '100%', height: '100%' }}
            >
              {!src ? (
              <div className="text-center z-10 bg-surface-900/80 p-6 rounded-xl backdrop-blur-sm border border-surface-700/50">
                <svg className="w-16 h-16 text-surface-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-surface-300 font-medium">배경 에셋 이미지를 선택하면 미리보기가 나타납니다.</p>
              </div>
            ) : !previewUrl ? (
              <div className="text-center z-10 bg-surface-900/80 p-6 rounded-xl backdrop-blur-sm border border-surface-700/50">
                <svg className="w-10 h-10 text-surface-600 mx-auto mb-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-surface-500 text-sm">파일 탐색 중...</p>
              </div>
            ) : (
              <div className="absolute inset-0">
                <FumikaPreview
                  assets={{
                    [src]: previewUrl,
                  }}
                  scene={[
                    {
                      type: 'background',
                      name: src,
                      duration: 0,
                      isVideo: previewIsVideo,
                      autoplay: true,
                      fit,
                    },
                    ...(previewMood !== 'none' ? [{
                      type: 'mood',
                      mood: previewMood,
                      duration: 0
                    } as any] : [])
                  ]}
                  configOverride={{
                    backgrounds: {
                      [src]: { src, parallax }
                    }
                  }}
                  width={projectSize?.width}
                  height={projectSize?.height}
                />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

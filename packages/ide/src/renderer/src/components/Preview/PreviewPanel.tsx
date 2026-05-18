import { useProjectStore } from '../../store/useProjectStore'
import { useState, useRef, useEffect, useCallback } from 'react'

interface ConsoleLog {
  level: number
  message: string
  sourceId: string
  line: number
}

function WebviewWithConsole({ url, onLog }: { url: string; onLog: (log: ConsoleLog) => void }) {
  const webviewRef = useRef<any>(null)

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleConsoleMessage = (e: any) => {
      onLog({ level: e.level, message: e.message, sourceId: e.sourceId, line: e.line })
    }

    webview.addEventListener('console-message', handleConsoleMessage)
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage)
    }
  }, [onLog])

  return (
    // @ts-ignore
    <webview
      ref={webviewRef}
      src={url}
      className="w-full h-full border-0 absolute inset-0 bg-white"
      title="Fumika Preview"
    />
  )
}

export function PreviewPanel() {
  const { projectPath, previewUrl, previewLoading, isPreviewOpen, setIsPreviewOpen, setPreviewUrl, setPreviewLoading } = useProjectStore()
  const [logs, setLogs] = useState<ConsoleLog[]>([])
  const [showConsole, setShowConsole] = useState(true)
  const [consoleHeight, setConsoleHeight] = useState(192)
  const [isResizing, setIsResizing] = useState(false)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const handleConsoleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startY = e.clientY
    const startHeight = consoleHeight
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(100, Math.min(600, startHeight + (startY - moveEvent.clientY)))
      setConsoleHeight(newHeight)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      setIsResizing(false)
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'row-resize'
  }, [consoleHeight])

  useEffect(() => {
    if (previewLoading) {
      setLogs([])
    }
  }, [previewLoading])

  useEffect(() => {
    // 자동 스크롤
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  if (!isPreviewOpen) return null

  const getLogColor = (level: number) => {
    switch (level) {
      case 2:
        return 'text-yellow-400'
      case 3:
        return 'text-red-400'
      case 0:
        return 'text-surface-500' // verbose
      case 1:
      default:
        return 'text-surface-300' // info
    }
  }

  const getLogPrefix = (level: number) => {
    switch (level) {
      case 2:
        return '[WARN]'
      case 3:
        return '[ERROR]'
      case 0:
        return '[DEBUG]'
      case 1:
      default:
        return '[INFO]'
    }
  }

  return (
    <div className="w-full flex-1 bg-surface-900/50 flex flex-col overflow-hidden relative border-t-0 border-b-0 border-r-0 border-l-0">
      {/* Header bar for preview */}
      <div className="h-10 bg-surface-800/80 border-b border-surface-700/50 flex items-center px-4 shrink-0 justify-between">
        <span className="text-xs font-semibold text-surface-300 flex items-center">
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Live Preview
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`text-xs px-2 py-1 rounded transition-colors ${showConsole ? 'bg-primary-500/20 text-primary-300' : 'text-surface-400 hover:bg-surface-700/50'}`}
          >
            Console
          </button>
          <button
            onClick={async () => {
              setIsPreviewOpen(false)
              if (previewUrl || previewLoading) {
                try {
                  setPreviewLoading(true)
                  await window.api.preview.stop()
                  setPreviewUrl(null)
                } catch (err) {
                  console.error('Failed to stop preview:', err)
                } finally {
                  setPreviewLoading(false)
                }
              }
            }}
            className="text-surface-400 hover:text-surface-200 hover:bg-surface-700/50 rounded p-1 transition-colors"
            title="Close Panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-black flex flex-col items-stretch overflow-hidden">
        {/* Preview Area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
          {!projectPath && (
            <span className="text-sm text-surface-500">프로젝트를 열어주세요</span>
          )}

          {previewLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/80 backdrop-blur-sm z-10">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-primary-300 font-medium animate-pulse">프리뷰 서버 시작 중...</p>
            </div>
          )}

          {!previewLoading && !previewUrl && projectPath && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/90 z-10 p-6 text-center">
              <svg className="w-10 h-10 text-surface-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-surface-400 font-medium mb-2">프리뷰가 중지되었습니다.</p>
              <p className="text-xs text-surface-500 max-w-sm">상단 툴바의 'Start Debug'를 눌러 시작하세요.</p>
            </div>
          )}

          {previewUrl && !previewLoading && (
            <WebviewWithConsole 
              url={previewUrl} 
              onLog={(log) => setLogs(prev => [...prev, log])} 
            />
          )}
        </div>

        {/* Console Area */}
        {showConsole && (
          <>
            <div 
              className="h-1 cursor-row-resize bg-surface-700/50 hover:bg-primary-500 active:bg-primary-500 z-10 transition-colors shrink-0"
              onMouseDown={handleConsoleResizeStart}
              title="콘솔 크기 조절"
            />
            <div 
              className="bg-surface-900 flex flex-col shrink-0"
              style={{ height: consoleHeight }}
            >
            <div className="flex items-center justify-between px-3 py-1 bg-surface-800/50 border-b border-surface-700/50">
              <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Browser Console</span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-surface-400 hover:text-surface-200 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed select-text">
              {logs.length === 0 ? (
                <div className="text-surface-600 italic h-full flex items-center justify-center">No messages</div>
              ) : (
                <>
                  {logs.map((log, i) => (
                    <div key={i} className={`mb-1 break-words ${getLogColor(log.level)}`}>
                      <span className="opacity-50 mr-2">{getLogPrefix(log.level)}</span>
                      <span className="whitespace-pre-wrap">{log.message}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-row-resize select-none" />
      )}
    </div>
  )
}

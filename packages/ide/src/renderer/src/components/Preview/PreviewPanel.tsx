import { useProjectStore } from '../../store/useProjectStore'
import { useOutputStore } from '../../store/useOutputStore'
import { useRef, useEffect } from 'react'

function WebviewWithConsole({ url }: { url: string }) {
  const webviewRef = useRef<any>(null)
  const { addLog } = useOutputStore()

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleConsoleMessage = (e: any) => {
      let prefix = '[INFO]'
      if (e.level === 0) prefix = '[DEBUG]'
      else if (e.level === 2) prefix = '[WARN]'
      else if (e.level === 3) prefix = '[ERROR]'
      
      addLog('Browser Console', `${prefix} ${e.message}`)
    }

    webview.addEventListener('console-message', handleConsoleMessage)
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage)
    }
  }, [addLog])

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

  if (!isPreviewOpen) return null

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
            <WebviewWithConsole url={previewUrl} />
          )}
        </div>
      </div>
    </div>
  )
}

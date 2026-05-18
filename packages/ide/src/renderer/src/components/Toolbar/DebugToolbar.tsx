import { useProjectStore } from '../../store/useProjectStore'
import { useToastStore } from '../../store/useToastStore'

export function DebugToolbar() {
  const {
    projectPath,
    activeFile,
    isPreviewOpen,
    previewUrl,
    previewLoading,
    setIsPreviewOpen,
    setPreviewUrl,
    setPreviewLoading,
    isGraphOpen,
    setIsGraphOpen,
    isTsChecking,
    setTsErrors,
    setIsTsChecking,
    isBuilding,
    setIsBuilding
  } = useProjectStore()

  const { addToast } = useToastStore()

  const isSceneActive = activeFile ? activeFile.includes('/scenes/') && activeFile.endsWith('.ts') : false

  const runTypeCheck = async () => {
    if (!projectPath || isTsChecking) return
    setIsTsChecking(true)
    try {
      const res = await window.api.project.checkTypes(projectPath)
      if (res.success && res.errorMap) {
        setTsErrors(res.errorMap)
        
        let errorCount = 0
        for (const errors of Object.values(res.errorMap)) {
          errorCount += errors.length
        }

        if (errorCount === 0) {
          addToast('타입 검증 완료: 발견된 오류가 없습니다.', 'success')
        } else {
          addToast(`타입 검증 완료: ${errorCount}개의 오류가 발견되었습니다.`, 'warning')
          console.group(`[TS Check] ${errorCount}개 오류 발견`)
          for (const [file, errors] of Object.entries(res.errorMap)) {
            console.group(`📄 ${file} (${errors.length}개)`)
            console.table(errors.map(e => ({ line: e.line, message: e.message })))
            console.groupEnd()
          }
          console.groupEnd()
        }
      } else {
        addToast('타입 검증 실패: ' + res.error, 'error')
      }
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setIsTsChecking(false)
    }
  }

  const runBuild = async () => {
    if (!projectPath || isBuilding) return
    setIsBuilding(true)
    try {
      addToast('프로젝트 빌드를 시작합니다. (터미널에서 빌드 진행)', 'info')
      const res = await window.api.project.build(projectPath)
      if (res.success) {
        addToast('빌드가 성공적으로 완료되었습니다!', 'success')
      } else {
        addToast('빌드 실패: ' + res.error, 'error')
      }
    } catch (err: any) {
      addToast(err.message, 'error')
    } finally {
      setIsBuilding(false)
    }
  }

  const startPreview = async () => {
    if (!projectPath) return
    if (!isSceneActive) return

    setPreviewLoading(true)
    try {
      let activeScene: string | undefined = undefined
      if (activeFile && projectPath) {
        const normalizedFile = activeFile.replace(/\\/g, '/')
        const normalizedProject = projectPath.replace(/\\/g, '/')
        const scenesPrefix = normalizedProject + '/scenes/'
        
        if (normalizedFile.startsWith(scenesPrefix)) {
          activeScene = normalizedFile.substring(scenesPrefix.length).replace(/\.[^/.]+$/, '')
        }
      }
      
      const res = await window.api.preview.start(projectPath, activeScene)
      if (res.success && res.url) {
        setPreviewUrl(res.url)
        if (!isPreviewOpen) setIsPreviewOpen(true)
      } else {
        alert(res.error || 'Failed to start preview')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const stopPreview = async () => {
    try {
      setPreviewLoading(true)
      await window.api.preview.stop()
      setPreviewUrl(null)
      setIsPreviewOpen(false)
    } catch (err: any) {
      console.error('Failed to stop preview:', err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const openInBrowser = async () => {
    if (previewUrl) {
      await window.api.shell.openExternal(previewUrl)
    }
  }

  if (!projectPath) return null

  return (
    <div className="flex items-center gap-2 ml-4">
      <button
        onClick={runTypeCheck}
        disabled={isTsChecking}
        className={`flex items-center justify-center rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
          isTsChecking
            ? 'bg-surface-800 text-surface-500 cursor-not-allowed opacity-50'
            : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
        }`}
      >
        {isTsChecking ? (
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1" />
        ) : (
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        Verify File
      </button>

      <button
        onClick={runBuild}
        disabled={isBuilding || isTsChecking}
        className={`flex items-center justify-center rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
          isBuilding || isTsChecking
            ? 'bg-surface-800 text-surface-500 cursor-not-allowed opacity-50'
            : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
        }`}
      >
        {isBuilding ? (
          <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-1" />
        ) : (
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        )}
        Build Project
      </button>

      <div className="w-px h-4 bg-surface-700 mx-1"></div>

      {previewUrl ? (
        <>
          <button
            onClick={stopPreview}
            disabled={previewLoading}
            className="flex items-center justify-center rounded bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
            Stop Debug
          </button>
          <button
            onClick={startPreview}
            disabled={previewLoading || !isSceneActive}
            className={`flex items-center justify-center rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              !isSceneActive ? 'bg-surface-800 text-surface-500 cursor-not-allowed opacity-50' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
            }`}
            title={!isSceneActive ? "에디터에서 씬 파일을 열어야 디버깅할 수 있습니다." : ""}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart
          </button>
          <button
            onClick={openInBrowser}
            className="flex items-center justify-center rounded bg-surface-800 px-3 py-1.5 text-xs font-semibold text-surface-300 transition-colors hover:bg-surface-700"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Browser
          </button>
        </>
      ) : (
        <button
          onClick={startPreview}
          disabled={previewLoading || !isSceneActive}
          className={`flex items-center justify-center rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
            !isSceneActive ? 'bg-surface-800 text-surface-500 cursor-not-allowed opacity-50' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
          }`}
          title={!isSceneActive ? "에디터에서 씬 파일을 열어야 디버깅할 수 있습니다." : ""}
        >
          {previewLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mr-1" />
          ) : (
            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
          Start Debug
        </button>
      )}

      <div className="w-px h-4 bg-surface-700 mx-1"></div>

      <button
        onClick={() => setIsGraphOpen(!isGraphOpen)}
        className={`flex items-center justify-center rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
          isGraphOpen
            ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
            : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
        }`}
      >
        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        {isGraphOpen ? 'Hide Graph' : 'Show Graph'}
      </button>

    </div>
  )
}

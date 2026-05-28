import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useProjectStore } from '../../store/useProjectStore'
import { WindowsBuildOptionsDialog, WindowsBuildOptions } from './WindowsBuildOptionsDialog'

export type BuildTarget = 'static' | 'library-js' | 'library-ts' | 'pwa' | 'windows'

type MainCategory = 'web' | 'windows' | 'android'

interface BuildDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (target: BuildTarget, options?: { resizable?: boolean, installer?: boolean, devTools?: boolean }) => void
}

export function BuildDialog({ isOpen, onClose, onConfirm }: BuildDialogProps) {
  const { projectPath } = useProjectStore()
  const [mainCategory, setMainCategory] = useState<MainCategory>('web')
  const [selectedTarget, setSelectedTarget] = useState<BuildTarget>('static')
  const [showIconMissing, setShowIconMissing] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [iconError, setIconError] = useState('')
  const [showWindowsOptions, setShowWindowsOptions] = useState(false)

  // ESC 키를 누르면 닫히도록 설정
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showIconMissing) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, showIconMissing])

  if (!isOpen) return null

  if (showIconMissing) {
    return createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-surface-800 border border-surface-700 p-6 rounded-md shadow-2xl w-full max-w-[520px] mx-4 animate-fade-scale flex flex-col">
          <h3 className="text-lg font-bold text-white mb-2">프로젝트 아이콘 필요</h3>
          <p className="text-sm text-surface-400 mb-4">
            빌드를 위해 프로젝트 아이콘(assets/icon.png)이 필수적으로 필요합니다. <br />
            512x512 해상도 이상의 이미지를 선택해주세요.
          </p>

          {iconError && (
            <div className="mb-4 text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">
              {iconError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-surface-700">
            <button
              onClick={() => {
                setShowIconMissing(false)
                setIconError('')
              }}
              className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white hover:bg-surface-700 rounded transition-colors"
            >
              취소
            </button>
            <button
              onClick={async () => {
                if (!projectPath) return
                setIconError('')
                setIsChecking(true)
                const res = await window.api.project.selectIcon(projectPath)
                setIsChecking(false)
                
                if (res.success) {
                  setShowIconMissing(false)
                  if (mainCategory === 'windows') {
                    setShowWindowsOptions(true)
                  } else {
                    onConfirm(selectedTarget)
                    onClose()
                  }
                } else if (res.error !== '선택이 취소되었습니다.') {
                  setIconError(res.error || '알 수 없는 오류가 발생했습니다.')
                }
              }}
              disabled={isChecking}
              className={`px-4 py-2 text-sm font-semibold rounded transition-colors flex items-center gap-2 ${
                isChecking
                  ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-500 text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              {isChecking ? '처리 중...' : '탐색기 열기'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-800 border border-surface-700 p-6 rounded-md shadow-2xl w-full max-w-[500px] mx-4 animate-fade-scale flex flex-col">
        <h3 className="text-lg font-bold text-white mb-2">Build Options</h3>
        <p className="text-sm text-surface-400 mb-4">
          프로젝트를 빌드할 플랫폼과 세부 형태를 선택하세요.
        </p>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-4">
          {(['web', 'windows', 'android'] as MainCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => {
                setMainCategory(category)
                if (category === 'windows') setSelectedTarget('windows')
                else if (category === 'web') setSelectedTarget('static')
              }}
              className={`flex-1 py-2 px-3 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2 border ${
                mainCategory === category
                  ? 'bg-primary-500/20 text-primary-400 border-primary-500/50'
                  : 'bg-surface-900 text-surface-400 border-surface-700 hover:bg-surface-700 hover:text-surface-300'
              }`}
            >
              {category === 'web' && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              )}
              {category === 'windows' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 3.841l8.528-1.18v8.435H2V3.841zm9.646-1.34L22 1.054v10.042h-10.354V2.501zm0 10.042H22v10.357l-10.354-1.503V12.543zM2 12.543h8.528v7.653L2 19.167v-6.624z" />
                </svg>
              )}
              {category === 'android' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997zm-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997zm11.4045-6.02l1.9973-3.4592a.4158.4158 0 00-.1521-.5676.4162.4162 0 00-.5676.1521l-2.0216 3.5013C15.5898 8.2435 13.8532 7.8488 12 7.8488c-1.8528 0-3.5894.3947-5.137.1004L4.841 4.4475a.416.416 0 00-.5673-.1521.4156.4156 0 00-.1521.5676l1.9969 3.4592C2.6865 10.2223.3225 13.5638.0772 17.514h23.845c-.2449-3.9502-2.6092-7.2917-6.0417-9.1926z" />
                </svg>
              )}
              <span className="capitalize">{category}</span>
            </button>
          ))}
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 min-h-[300px]">
          {mainCategory === 'web' && (
            <div className="flex flex-col gap-3">
              {/* Static Build Option */}
              <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'static' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="buildTarget"
                    value="static"
                    checked={selectedTarget === 'static'}
                    onChange={() => setSelectedTarget('static')}
                    className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-surface-200">Static Web Build</div>
                  <div className="text-xs text-surface-400 mt-1">
                    자체 웹 호스팅에 적합한 HTML/JS/CSS 기반의 완전한 독립형 정적 빌드입니다.
                  </div>
                </div>
              </label>

              {/* Library Build Option (JS Only) */}
              <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'library-js' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="buildTarget"
                    value="library-js"
                    checked={selectedTarget === 'library-js'}
                    onChange={() => setSelectedTarget('library-js')}
                    className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-surface-200">Library Build (JS Only)</div>
                  <div className="text-xs text-surface-400 mt-1">
                    타 웹 프레임워크에 삽입할 수 있는 가벼운 자바스크립트 모듈 번들만 빠르게 생성합니다.
                  </div>
                </div>
              </label>

              {/* Library Build Option (TypeScript) */}
              <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'library-ts' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="buildTarget"
                    value="library-ts"
                    checked={selectedTarget === 'library-ts'}
                    onChange={() => setSelectedTarget('library-ts')}
                    className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-surface-200">Library Build (with TypeScript .d.ts)</div>
                  <div className="text-xs text-surface-400 mt-1">
                    모듈 번들과 함께 완벽한 타입 추론을 위한 TypeScript 선언 파일을 추출합니다.
                  </div>
                </div>
              </label>

              {/* PWA Build Option */}
              <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'pwa' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="buildTarget"
                    value="pwa"
                    checked={selectedTarget === 'pwa'}
                    onChange={() => setSelectedTarget('pwa')}
                    className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-surface-200">Progressive Web App (PWA)</div>
                  <div className="text-xs text-surface-400 mt-1">
                    모바일 및 데스크톱에서 설치 가능한 웹 앱(PWA) 형태로 빌드합니다. 오프라인 캐싱이 지원됩니다.
                  </div>
                </div>
              </label>
            </div>
          )}

          {mainCategory === 'windows' && (
            <div className="flex flex-col gap-3">
              {/* Windows Build Option */}
              <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'windows' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="buildTarget"
                    value="windows"
                    checked={selectedTarget === 'windows'}
                    onChange={() => setSelectedTarget('windows')}
                    className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold text-surface-200">Windows (.exe) 빌드</div>
                  <div className="text-xs text-surface-400 mt-1">
                    Windows 환경에서 단독으로 실행 가능한 애플리케이션으로 패키징합니다. 
                    <br/>
                    빌드 옵션에서 포터블(무설치) 또는 설치 파일 포맷을 선택할 수 있습니다.
                  </div>
                </div>
              </label>
            </div>
          )}

          {mainCategory === 'android' && (
            <div className="flex flex-col items-center justify-center h-full text-surface-400 bg-surface-900/50 rounded border border-surface-800 border-dashed py-4">
              <svg className="w-12 h-12 mb-4 text-surface-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997zm-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997zm11.4045-6.02l1.9973-3.4592a.4158.4158 0 00-.1521-.5676.4162.4162 0 00-.5676.1521l-2.0216 3.5013C15.5898 8.2435 13.8532 7.8488 12 7.8488c-1.8528 0-3.5894.3947-5.137.1004L4.841 4.4475a.416.416 0 00-.5673-.1521.4156.4156 0 00-.1521.5676l1.9969 3.4592C2.6865 10.2223.3225 13.5638.0772 17.514h23.845c-.2449-3.9502-2.6092-7.2917-6.0417-9.1926z" />
              </svg>
              <div className="font-semibold text-surface-300">Android Build</div>
              <div className="text-sm mt-1 text-surface-500">추후 업데이트를 통해 지원될 예정입니다.</div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-surface-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white hover:bg-surface-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (mainCategory === 'web' || mainCategory === 'windows') {
                if (!projectPath) return
                setIsChecking(true)
                const res = await window.api.fs.checkExists(`${projectPath}/assets/icon.png`)
                setIsChecking(false)
                
                if (!res.exists) {
                  setShowIconMissing(true)
                } else {
                  if (mainCategory === 'windows') {
                    setShowWindowsOptions(true)
                  } else {
                    onConfirm(selectedTarget)
                    onClose()
                  }
                }
              }
            }}
            disabled={(mainCategory !== 'web' && mainCategory !== 'windows') || isChecking}
            className={`px-4 py-2 text-sm font-semibold rounded transition-colors flex items-center gap-2 ${
              (mainCategory === 'web' || mainCategory === 'windows') && !isChecking
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-surface-700 text-surface-500 cursor-not-allowed'
            }`}
          >
            {isChecking && (
              <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isChecking ? '확인 중...' : (mainCategory === 'windows' ? 'Next' : 'Start Build')}
          </button>
        </div>
      </div>

      <WindowsBuildOptionsDialog
        isOpen={showWindowsOptions}
        onClose={() => setShowWindowsOptions(false)}
        onConfirm={(options: WindowsBuildOptions) => {
          setShowWindowsOptions(false)
          onConfirm(selectedTarget, options)
          onClose()
        }}
      />
    </div>,
    document.body
  )
}

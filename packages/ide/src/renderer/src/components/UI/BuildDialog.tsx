import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type BuildTarget = 'static' | 'library-js' | 'library-ts' | 'pwa'

interface BuildDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (target: BuildTarget) => void
}

export function BuildDialog({ isOpen, onClose, onConfirm }: BuildDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<BuildTarget>('static')

  // ESC 키를 누르면 닫히도록 설정
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-800 border border-surface-700 p-6 rounded-md shadow-2xl w-full max-w-[500px] mx-4 animate-fade-scale">
        <h3 className="text-lg font-bold text-white mb-4">Build Options</h3>
        
        <div className="flex flex-col gap-4">
          <p className="text-sm text-surface-400">
            프로젝트를 어떤 형태로 빌드할지 선택하세요. <br />
            빌드 결과물은 자동으로 에셋과 분리되어 최적화됩니다.
          </p>

          <div className="flex flex-col gap-3">
            {/* Static Build Option */}
            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'static' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-800 hover:border-surface-600'}`}>
              <div className="mt-0.5">
                <input
                  type="radio"
                  name="buildTarget"
                  value="static"
                  checked={selectedTarget === 'static'}
                  onChange={() => setSelectedTarget('static')}
                  className="w-4 h-4 text-primary-500 bg-surface-900 border-surface-600"
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
            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'library-js' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-800 hover:border-surface-600'}`}>
              <div className="mt-0.5">
                <input
                  type="radio"
                  name="buildTarget"
                  value="library-js"
                  checked={selectedTarget === 'library-js'}
                  onChange={() => setSelectedTarget('library-js')}
                  className="w-4 h-4 text-primary-500 bg-surface-900 border-surface-600"
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
            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'library-ts' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-800 hover:border-surface-600'}`}>
              <div className="mt-0.5">
                <input
                  type="radio"
                  name="buildTarget"
                  value="library-ts"
                  checked={selectedTarget === 'library-ts'}
                  onChange={() => setSelectedTarget('library-ts')}
                  className="w-4 h-4 text-primary-500 bg-surface-900 border-surface-600"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-surface-200">Library Build (with TypeScript .d.ts)</div>
                <div className="text-xs text-surface-400 mt-1">
                  모듈 번들과 함께 완벽한 타입 추론을 위한 TypeScript 선언 파일을 추출합니다. (빌드 시간이 약간 더 소요됨)
                </div>
              </div>
            </label>

            {/* PWA Build Option */}
            <label className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${selectedTarget === 'pwa' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-800 hover:border-surface-600'}`}>
              <div className="mt-0.5">
                <input
                  type="radio"
                  name="buildTarget"
                  value="pwa"
                  checked={selectedTarget === 'pwa'}
                  onChange={() => setSelectedTarget('pwa')}
                  className="w-4 h-4 text-primary-500 bg-surface-900 border-surface-600"
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-surface-200">Progressive Web App (PWA)</div>
                <div className="text-xs text-surface-400 mt-1">
                  모바일 및 데스크톱에서 설치 가능한 웹 앱(PWA) 형태로 빌드합니다. 오프라인 캐싱이 지원됩니다.
                </div>
              </div>
            </label>

            {/* Disabled Options for Future */}
            <label className="flex items-start gap-3 p-3 rounded border border-surface-800 bg-surface-900 opacity-50 cursor-not-allowed">
              <div className="mt-0.5">
                <input type="radio" disabled className="w-4 h-4 bg-surface-800 border-surface-700" />
              </div>
              <div>
                <div className="text-sm font-semibold text-surface-500">IFrame / Headless</div>
                <div className="text-xs text-surface-600 mt-1">
                  Coming Soon. 추후 업데이트를 통해 지원될 예정입니다.
                </div>
              </div>
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white hover:bg-surface-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm(selectedTarget)
                onClose()
              }}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
            >
              Start Build
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

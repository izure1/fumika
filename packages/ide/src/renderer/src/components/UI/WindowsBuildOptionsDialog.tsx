import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface WindowsBuildOptions {
  resizable: boolean
  installer: boolean
}

interface WindowsBuildOptionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (options: WindowsBuildOptions) => void
}

export function WindowsBuildOptionsDialog({ isOpen, onClose, onConfirm }: WindowsBuildOptionsDialogProps) {
  const [isResizable, setIsResizable] = useState(false)
  const [buildType, setBuildType] = useState<'portable' | 'installer'>('portable')

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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-800 border border-surface-700 p-6 rounded-md shadow-2xl w-full max-w-[420px] mx-4 animate-fade-scale flex flex-col">
        <h3 className="text-lg font-bold text-white mb-2">Windows 빌드 옵션</h3>
        <p className="text-sm text-surface-400 mb-6">
          Windows 빌드에 적용될 세부 설정을 선택해주세요.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-surface-300">빌드 타입</span>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center gap-2 p-3 border rounded cursor-pointer transition-colors ${buildType === 'portable' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <input
                  type="radio"
                  name="buildType"
                  value="portable"
                  checked={buildType === 'portable'}
                  onChange={() => setBuildType('portable')}
                  className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-surface-200">무설치 (Portable)</span>
                  <span className="text-[10px] text-surface-400">하나의 실행 파일로 묶어 빌드합니다.</span>
                </div>
              </label>

              <label className={`flex-1 flex items-center gap-2 p-3 border rounded cursor-pointer transition-colors ${buildType === 'installer' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 bg-surface-900 hover:border-surface-600'}`}>
                <input
                  type="radio"
                  name="buildType"
                  value="installer"
                  checked={buildType === 'installer'}
                  onChange={() => setBuildType('installer')}
                  className="w-4 h-4 text-primary-500 bg-surface-800 border-surface-600"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-surface-200">설치 파일 (Installer)</span>
                  <span className="text-[10px] text-surface-400">설치가 가능한 셋업 파일을 만듭니다.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <span className="text-sm font-semibold text-surface-300">창 설정</span>
            <label className="flex items-center gap-2 p-3 border border-surface-700 bg-surface-900 rounded cursor-pointer hover:border-surface-600 transition-colors">
              <input
                type="checkbox"
                checked={isResizable}
                onChange={(e) => setIsResizable(e.target.checked)}
                className="w-4 h-4 rounded text-primary-500 bg-surface-800 border-surface-600 focus:ring-primary-500 focus:ring-offset-surface-900"
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-surface-200">창 크기 조절 허용 (Resizable)</span>
                <span className="text-[10px] text-surface-400">체크 시 플레이어가 창 크기를 임의로 조절할 수 있습니다. (비율 유지)</span>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2 pt-4 border-t border-surface-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-white hover:bg-surface-700 rounded transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => {
              onConfirm({
                resizable: isResizable,
                installer: buildType === 'installer'
              })
            }}
            className="px-4 py-2 text-sm font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Start Build
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

import React, { useRef } from 'react'

export interface AddonImportModalProps {
  isOpen: boolean
  onClose: () => void
  addonUrl: string
  setAddonUrl: (url: string) => void
  addonLoading: boolean
  onImportLocal: () => void
  onDownloadImport: () => void
}

export function AddonImportModal({
  isOpen,
  onClose,
  addonUrl,
  setAddonUrl,
  addonLoading,
  onImportLocal,
  onDownloadImport
}: AddonImportModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        ref={modalRef}
        className="bg-surface-900 border border-surface-700/60 rounded-xl shadow-2xl shadow-black/50 w-full max-w-md mx-4 animate-fade-scale overflow-hidden relative"
      >
        {/* Glow decorative effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none bg-primary-500"></div>

        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-800 flex justify-between items-center relative z-10">
          <div>
            <h3 className="text-base font-bold text-white">애드온 가져오기</h3>
            <p className="mt-1 text-xs text-surface-400 leading-relaxed">
              로컬 zip 파일 또는 외부 zip 다운로드 URL을 통해 프로젝트에 애드온을 추가합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6 relative z-10">
          {/* Method 1: Local ZIP */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-surface-300 block">방법 1. 로컬 압축 파일 (.zip)</span>
            <button
              onClick={onImportLocal}
              className="w-full py-4 rounded-lg border border-dashed border-surface-700 hover:border-primary-500 hover:bg-primary-600/5 transition-all text-xs text-surface-300 hover:text-primary-300 font-medium cursor-pointer flex flex-col items-center justify-center gap-1.5"
            >
              <span className="text-xl">📂</span>
              <span>애드온 ZIP 파일 선택하기</span>
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-surface-800"></div>
            <span className="flex-shrink mx-4 text-[10px] text-surface-500 uppercase font-mono">Or</span>
            <div className="flex-grow border-t border-surface-800"></div>
          </div>

          {/* Method 2: URL Download */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-surface-300 block">방법 2. 외부 URL 다운로드</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/addon.zip"
                value={addonUrl}
                onChange={(e) => setAddonUrl(e.target.value)}
                className="flex-1 bg-surface-950 border border-surface-700 text-xs text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
              />
              <button
                onClick={onDownloadImport}
                disabled={addonLoading || !addonUrl.trim()}
                className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
              >
                {addonLoading ? '다운로드 중...' : '다운로드'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

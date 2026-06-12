import React, { useRef } from 'react'

export interface ConflictResolverModalProps {
  isOpen: boolean
  conflicts: string[]
  checked: Set<string>
  setChecked: (checked: Set<string>) => void
  onConfirm: (mode: 'all' | 'none' | 'selected') => void
  onCancel: () => void
}

export function ConflictResolverModal({
  isOpen,
  conflicts,
  checked,
  setChecked,
  onConfirm,
  onCancel
}: ConflictResolverModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  const handleToggleFile = (file: string) => {
    const next = new Set(checked)
    if (next.has(file)) {
      next.delete(file)
    } else {
      next.add(file)
    }
    setChecked(next)
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        ref={modalRef}
        className="bg-surface-900 border border-surface-700/60 rounded-xl shadow-2xl shadow-black/50 w-full max-w-lg min-w-[320px] mx-4 max-h-[80vh] flex flex-col animate-fade-scale overflow-hidden relative"
      >
        {/* Glow decorative effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-15 pointer-events-none bg-amber-500"></div>

        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-800 relative z-10">
          <h3 className="text-base font-bold text-yellow-400 flex items-center gap-2">
            <span>⚠️</span> 파일 중복 충돌 감지
          </h3>
          <p className="mt-1 text-xs text-surface-400 leading-relaxed">
            프로젝트에 이미 존재하는 파일이 있습니다. 처리 방식을 선택하십시오.
          </p>
        </div>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar space-y-1 relative z-10">
          {conflicts.map((file) => {
            const isChecked = checked.has(file)
            return (
              <label
                key={file}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none ${
                  isChecked ? 'bg-primary-600/10 border border-primary-500/20' : 'hover:bg-surface-800 border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary-500 shrink-0"
                  checked={isChecked}
                  onChange={() => handleToggleFile(file)}
                />
                <span className="flex-1 min-w-0 block">
                  <span className="text-xs font-mono text-surface-200 truncate block">{file}</span>
                </span>
                <span className="shrink-0 text-[10px] text-yellow-500 font-medium">덮어쓰기 예정</span>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-surface-800 flex flex-col gap-3 relative z-10 bg-surface-900/95">
          <div className="flex justify-between items-center gap-2">
            <button
              onClick={() => onConfirm('none')}
              className="flex-1 py-2 text-xs rounded-lg border border-surface-700 text-surface-300 hover:bg-surface-800 transition-colors cursor-pointer font-medium"
            >
              기존 파일 유지 (건너뛰기)
            </button>
            <button
              onClick={() => onConfirm('all')}
              className="flex-1 py-2 text-xs rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/40 transition-colors cursor-pointer font-medium"
            >
              모두 덮어쓰기
            </button>
          </div>
          <div className="flex justify-end gap-2 border-t border-surface-800 pt-3">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 text-xs rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={() => onConfirm('selected')}
              className="px-4 py-2.5 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors font-semibold cursor-pointer"
            >
              선택한 파일만 덮어쓰기 ({checked.size}개)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

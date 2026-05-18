import { X, Code, ExternalLink, Cpu, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import packageJson from '../../../../../package.json'
import iconPng from '../../../../../resources/icon.png'
import licenseText from '../../../../../LICENSE?raw'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
  mode: 'info' | 'license'
}

export function HelpDialog({ isOpen, onClose, mode }: HelpDialogProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(licenseText)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity" style={{ WebkitAppRegion: 'no-drag' } as any}>
      <div className="w-[640px] rounded-xl border border-surface-700/50 bg-surface-900/95 shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-800/50 bg-surface-800/20 px-5 py-3">
          <h2 className="text-[13px] font-medium text-surface-200 tracking-wide">
            {mode === 'info' ? 'Fumika Engine 정보' : '소프트웨어 라이선스'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-surface-400 transition-colors hover:bg-surface-700 hover:text-white"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-0">
          {mode === 'info' && (
            <div className="flex p-8 gap-8 items-center bg-gradient-to-br from-surface-900 to-surface-800/80">
              {/* Left: Icon */}
              <div className="flex-shrink-0 flex items-center justify-center pl-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary-500 blur-2xl opacity-20 rounded-full"></div>
                  <img 
                    src={iconPng} 
                    alt="Fumika Engine Logo" 
                    className="w-32 h-32 object-contain drop-shadow-2xl relative z-10" 
                  />
                </div>
              </div>
              
              {/* Right: Info */}
              <div className="flex flex-col justify-center gap-1.5 flex-1 border-l border-surface-800 pl-8">
                <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-200">
                    Fumika
                  </span>
                  <span className="font-light text-surface-300">Engine</span>
                </h1>
                
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20 text-primary-400 text-[11px] font-mono font-bold tracking-wider">
                    v{packageJson.version}
                  </span>
                  <span className="text-xs text-surface-400 flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-800 border border-surface-700 font-mono font-medium">
                    <Cpu size={12} className="text-surface-500" /> x64
                  </span>
                </div>
                
                <p className="text-sm text-surface-300 mt-3 leading-relaxed font-medium">
                  {packageJson.description || '차세대 비주얼 노벨 제작 엔진'}
                </p>
                
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-surface-800/50 text-[12px] text-surface-400">
                  <div className="flex items-center gap-2">
                    <Code size={14} className="text-surface-500" />
                    <span>Developed by <span className="text-surface-200 font-medium">{packageJson.author}</span></span>
                  </div>
                  <a 
                    href={packageJson.homepage} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 w-fit hover:text-primary-400 transition-colors"
                  >
                    <ExternalLink size={14} className="text-surface-500" />
                    <span className="underline underline-offset-2 decoration-surface-700">{packageJson.homepage}</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {mode === 'license' && (
            <div className="p-6 bg-surface-900">
              <div className="h-[280px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-surface-700 scrollbar-track-transparent">
                <div className="text-surface-300 text-xs whitespace-pre-wrap font-mono leading-relaxed select-text p-4 bg-surface-950 rounded-lg border border-surface-800 shadow-inner">
                  {licenseText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 bg-surface-800/30 border-t border-surface-800/50 px-5 py-3">
          {mode === 'license' && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md bg-surface-700 px-4 py-1.5 text-[13px] font-medium text-surface-200 hover:bg-surface-600 hover:text-white transition-all shadow-sm active:scale-95"
              title={isCopied ? "복사 완료!" : "라이선스 전문 복사"}
            >
              {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span>{isCopied ? "복사됨" : "복사"}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-md bg-surface-700 px-6 py-1.5 text-[13px] font-medium text-surface-200 hover:bg-surface-600 hover:text-white transition-all shadow-sm active:scale-95"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

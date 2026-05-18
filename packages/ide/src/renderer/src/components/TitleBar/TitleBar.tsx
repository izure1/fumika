import { Minus, Square, X, Settings } from 'lucide-react'
import { useProjectStore } from '../../store/useProjectStore'
import { useOutputStore } from '../../store/useOutputStore'
import { useState, useRef, useEffect } from 'react'
import { HelpDialog } from '../UI/HelpDialog'

export function TitleBar() {
  const { projectPath, setIsSettingsOpen } = useProjectStore()
  const { isPanelOpen, togglePanel } = useOutputStore()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false)
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [helpDialogTab, setHelpDialogTab] = useState<'info' | 'license'>('info')

  const menuRef = useRef<HTMLDivElement>(null)
  const helpMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node)) {
        setIsHelpMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openHelpDialog = (tab: 'info' | 'license') => {
    setHelpDialogTab(tab)
    setIsHelpDialogOpen(true)
    setIsHelpMenuOpen(false)
  }
  
  // VS Code 스타일의 타이틀 표시. 프로젝트가 열려있으면 프로젝트 경로 표시.
  const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : ''
  const title = projectName ? `${projectName} - Fumika Engine` : 'Fumika Engine'

  return (
    <>
      <div 
        className="relative flex h-8 shrink-0 items-center justify-between bg-surface-900 border-b border-surface-800 select-none z-50"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center px-4 h-full">
          <div className="flex items-center gap-4 text-[13px] text-surface-400">
            <div className="flex items-center gap-2 font-semibold text-primary-400">
              <span className="text-[10px]">F</span>
            </div>
            <div className="relative" ref={menuRef} style={{ WebkitAppRegion: 'no-drag' } as any}>
              <button 
                className={`px-2 py-0.5 text-xs rounded transition-colors ${isMenuOpen ? 'bg-surface-800 text-surface-200' : 'hover:bg-surface-800 hover:text-surface-200'}`}
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen)
                  setIsHelpMenuOpen(false)
                }}
              >
                보기
              </button>
              {isMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-surface-800 border border-surface-700 rounded-md shadow-xl py-1 z-50">
                  <button 
                    className="w-full text-left px-4 py-1.5 text-xs hover:bg-primary-600 hover:text-white transition-colors flex items-center justify-between"
                    onClick={() => {
                      togglePanel()
                      setIsMenuOpen(false)
                    }}
                  >
                    <span>출력 패널</span>
                    {isPanelOpen && <span className="text-[9px] font-bold bg-primary-500/20 text-primary-300 px-1.5 py-0.5 rounded">ON</span>}
                  </button>
                </div>
              )}
            </div>
            <div className="relative" ref={helpMenuRef} style={{ WebkitAppRegion: 'no-drag' } as any}>
              <button 
                className={`px-2 py-0.5 text-xs rounded transition-colors ${isHelpMenuOpen ? 'bg-surface-800 text-surface-200' : 'hover:bg-surface-800 hover:text-surface-200'}`}
                onClick={() => {
                  setIsHelpMenuOpen(!isHelpMenuOpen)
                  setIsMenuOpen(false)
                }}
              >
                도움말
              </button>
              {isHelpMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-surface-800 border border-surface-700 rounded-md shadow-xl py-1 z-50">
                  <button 
                    className="w-full text-left px-4 py-1.5 text-xs hover:bg-primary-600 hover:text-white transition-colors"
                    onClick={() => openHelpDialog('license')}
                  >
                    라이선스
                  </button>
                  <button 
                    className="w-full text-left px-4 py-1.5 text-xs hover:bg-primary-600 hover:text-white transition-colors"
                    onClick={() => openHelpDialog('info')}
                  >
                    정보
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-surface-300">
          {title}
        </div>

        <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-full w-10 items-center justify-center text-surface-400 hover:bg-surface-700 hover:text-surface-100 transition-colors"
            title="설정"
          >
            <Settings size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => window.api.window.minimize()}
            className="flex h-full w-12 items-center justify-center text-surface-400 hover:bg-surface-700 hover:text-surface-100 transition-colors"
            title="최소화"
          >
            <Minus size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => projectPath && window.api.window.maximize()}
            disabled={!projectPath}
            className={`flex h-full w-12 items-center justify-center text-surface-400 transition-colors ${projectPath ? 'hover:bg-surface-700 hover:text-surface-100' : 'opacity-30 cursor-not-allowed'}`}
            title="최대화"
          >
            <Square size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => window.api.window.close()}
            className="flex h-full w-12 items-center justify-center text-surface-400 hover:bg-red-500 hover:text-white transition-colors"
            title="닫기"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <HelpDialog 
        isOpen={isHelpDialogOpen} 
        onClose={() => setIsHelpDialogOpen(false)} 
        mode={helpDialogTab}
      />
    </>
  )
}

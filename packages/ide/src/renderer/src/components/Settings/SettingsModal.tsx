import React, { useState, useEffect } from 'react'
import { X, Check, RefreshCw, Palette, Cpu, ArrowUpCircle } from 'lucide-react'
import { useProjectStore, ThemeColor, ThemeBg } from '../../store/useProjectStore'
import { useToastStore } from '../../store/useToastStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const THEMES: { id: ThemeColor; name: string; hex: string }[] = [
  { id: 'indigo', name: '인디고', hex: '#6366f1' },
  { id: 'rose', name: '로즈', hex: '#f43f5e' },
  { id: 'emerald', name: '에메랄드', hex: '#10b981' },
  { id: 'amber', name: '앰버', hex: '#f59e0b' },
  { id: 'sky', name: '스카이', hex: '#0ea5e9' },
  { id: 'violet', name: '바이올렛', hex: '#8b5cf6' }
]

const BG_THEMES: { id: ThemeBg; name: string; hex: string }[] = [
  { id: 'slate', name: '슬레이트', hex: '#0f172a' },
  { id: 'zinc', name: '징크', hex: '#18181b' },
  { id: 'neutral', name: '뉴트럴', hex: '#171717' },
  { id: 'stone', name: '스톤', hex: '#1c1917' },
  { id: 'gray', name: '그레이', hex: '#111827' }
]

type SettingsTab = 'theme' | 'editor' | 'update'

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    themeColor,
    setThemeColor,
    themeBg,
    setThemeBg,
    formatOnSave,
    setFormatOnSave,
    autoUpdate,
    setAutoUpdate
  } = useProjectStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>('theme')
  const [appVersion, setAppVersion] = useState<string>('')
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false)
  const { addToast } = useToastStore()

  useEffect(() => {
    if (window.api?.updater?.getAppVersion) {
      window.api.updater.getAppVersion().then(setAppVersion).catch(console.error)
    }
  }, [])

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate) return
    setIsCheckingUpdate(true)

    let cleanup: (() => void) | null = null

    const handleUpdateAvailable = () => {
      addToast('새로운 업데이트가 발견되어 다운로드를 시작합니다.', 'info')
      setIsCheckingUpdate(false)
      if (cleanup) cleanup()
    }

    const handleUpdateNotAvailable = () => {
      addToast('현재 최신 버전을 사용하고 있습니다.', 'success')
      setIsCheckingUpdate(false)
      if (cleanup) cleanup()
    }

    const handleUpdateError = (err: string) => {
      addToast(`업데이트 확인 실패: ${err}`, 'error')
      setIsCheckingUpdate(false)
      if (cleanup) cleanup()
    }

    if (window.api?.updater) {
      const unsubAvailable = window.api.updater.onUpdateAvailable(handleUpdateAvailable)
      const unsubNotAvailable = window.api.updater.onUpdateNotAvailable(handleUpdateNotAvailable)
      const unsubError = window.api.updater.onError(handleUpdateError)

      cleanup = () => {
        unsubAvailable()
        unsubNotAvailable()
        unsubError()
      }

      try {
        const res = await window.api.updater.checkForUpdates()
        if (!res.success) {
          addToast(`업데이트 확인 실패: ${res.error}`, 'error')
          setIsCheckingUpdate(false)
          cleanup()
        }
      } catch (e: any) {
        addToast(`업데이트 확인 중 오류 발생: ${e.message}`, 'error')
        setIsCheckingUpdate(false)
        cleanup()
      }
    } else {
      addToast('업데이트 API를 사용할 수 없습니다.', 'warning')
      setIsCheckingUpdate(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-[840px] h-[620px] flex flex-col rounded-lg border border-surface-800 bg-surface-900 shadow-2xl animate-fade-scale overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-surface-800 bg-surface-900 px-6 py-4 shrink-0">
          <h2 className="text-lg font-semibold text-surface-100">IDE 설정</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </header>

        {/* Modal Content - Left Sidebar & Right details */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-[180px] shrink-0 border-r border-surface-800 bg-surface-950/20 py-4 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-l-2 text-left cursor-pointer ${activeTab === 'theme'
                ? 'border-primary-500 bg-primary-500/5 text-primary-400'
                : 'border-transparent text-surface-400 hover:bg-surface-800/40 hover:text-surface-200'
                }`}
            >
              <Palette size={16} />
              <span>테마 설정</span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-l-2 text-left cursor-pointer ${activeTab === 'editor'
                ? 'border-primary-500 bg-primary-500/5 text-primary-400'
                : 'border-transparent text-surface-400 hover:bg-surface-800/40 hover:text-surface-200'
                }`}
            >
              <Cpu size={16} />
              <span>에디터 동작</span>
            </button>
            <button
              onClick={() => setActiveTab('update')}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all border-l-2 text-left cursor-pointer ${activeTab === 'update'
                ? 'border-primary-500 bg-primary-500/5 text-primary-400'
                : 'border-transparent text-surface-400 hover:bg-surface-800/40 hover:text-surface-200'
                }`}
            >
              <ArrowUpCircle size={16} />
              <span>업데이트</span>
            </button>
          </aside>

          {/* Right Details */}
          <main className="flex-1 overflow-y-auto p-6 bg-surface-900/40 flex flex-col justify-between">
            <div>
              {activeTab === 'theme' && (
                <div className="animate-fade-in">
                  <div className="mb-6">
                    <h3 className="mb-4 text-sm font-semibold text-surface-200">강조 색상 (Accent Color)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setThemeColor(theme.id)}
                          className={`flex items-center justify-between rounded-md border p-3 transition-all cursor-pointer ${themeColor === theme.id
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-4 w-4 rounded-full shadow-inner"
                              style={{ backgroundColor: theme.hex }}
                            />
                            <span className="text-sm font-medium text-surface-200">
                              {theme.name}
                            </span>
                          </div>
                          {themeColor === theme.id && (
                            <Check size={16} className="text-primary-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="mb-4 text-sm font-semibold text-surface-200">배경 색상 (Background Tone)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {BG_THEMES.map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setThemeBg(theme.id)}
                          className={`flex items-center justify-between rounded-md border p-3 transition-all cursor-pointer ${themeBg === theme.id
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-4 w-4 rounded-full shadow-inner border border-surface-600"
                              style={{ backgroundColor: theme.hex }}
                            />
                            <span className="text-sm font-medium text-surface-200">
                              {theme.name}
                            </span>
                          </div>
                          {themeBg === theme.id && (
                            <Check size={16} className="text-primary-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'editor' && (
                <div className="animate-fade-in">
                  <div className="mb-6">
                    <h3 className="mb-4 text-sm font-semibold text-surface-200">에디터 동작 (Editor Behavior)</h3>
                    <div className="flex items-center justify-between rounded-md border border-surface-700 bg-surface-800/50 p-4">
                      <div className="flex flex-col gap-1 pr-4">
                        <span className="text-sm font-medium text-surface-200">저장 시 자동 포맷팅</span>
                        <span className="text-xs text-surface-500">Ctrl+S로 저장할 때 코드를 자동으로 정렬합니다.</span>
                      </div>
                      <button
                        onClick={() => setFormatOnSave(!formatOnSave)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${formatOnSave ? 'bg-primary-500' : 'bg-surface-600'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formatOnSave ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'update' && (
                <div className="animate-fade-in">
                  <div className="mb-6">
                    <h3 className="mb-4 text-sm font-semibold text-surface-200">업데이트 설정 (Update Settings)</h3>
                    <div className="flex flex-col gap-4 rounded-md border border-surface-700 bg-surface-800/50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-surface-200">업데이트 모드</span>
                          <span className="text-xs text-surface-500">
                            자동으로 새 버전을 다운로드하거나 수동으로 진행합니다.
                          </span>
                        </div>
                        <div className="flex bg-surface-900 border border-surface-700 p-0.5 rounded-md shrink-0">
                          <button
                            onClick={() => setAutoUpdate(true)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer ${autoUpdate
                              ? 'bg-primary-500 text-white shadow-sm'
                              : 'text-surface-400 hover:text-surface-200'
                              }`}
                          >
                            자동 업데이트
                          </button>
                          <button
                            onClick={() => setAutoUpdate(false)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer ${!autoUpdate
                              ? 'bg-primary-500 text-white shadow-sm'
                              : 'text-surface-400 hover:text-surface-200'
                              }`}
                          >
                            업데이트 중단
                          </button>
                        </div>
                      </div>

                      <div className="h-px bg-surface-700/60" />

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs text-surface-400">현재 설치된 버전</span>
                          <span className="text-sm font-bold text-primary-400">v{appVersion || '0.0.1'}</span>
                        </div>
                        <button
                          onClick={handleCheckForUpdates}
                          disabled={isCheckingUpdate}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-surface-700 rounded-sm border border-surface-600 hover:bg-surface-600 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          {isCheckingUpdate ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />
                              검사 중...
                            </>
                          ) : (
                            <>
                              <RefreshCw size={12} />
                              현재 업데이트 확인
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <footer className="mt-8 border-t border-surface-800/60 pt-4 shrink-0">
              <p className="text-xs text-surface-500">
                설정은 자동으로 저장되며 IDE 전체 환경에 즉시 반영됩니다.
              </p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}

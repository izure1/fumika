import { useState, useCallback, useEffect, useRef } from 'react'
import { World } from 'leviar'
import { useProjectStore } from './store/useProjectStore'
import { useOutputStore } from './store/useOutputStore'
import { PreviewPanel } from './components/Preview/PreviewPanel'
import { ProjectSidebar } from './components/Sidebar/ProjectSidebar'
import { EditorArea } from './components/Editor/EditorArea'
import { SceneGraphViewer } from './components/Editor/SceneGraphViewer'
import { DebugToolbar } from './components/Toolbar/DebugToolbar'
import { NewProjectDialog, NewProjectOptions } from './components/UI/NewProjectDialog'
import { LoadingOverlay } from './components/UI/LoadingOverlay'
import { SettingsModal } from './components/Settings/SettingsModal'
import { TitleBar } from './components/TitleBar/TitleBar'
import { BottomPanel } from './components/UI/BottomPanel'
import welcomeFumika from './assets/welcome/char_fumika.png'
import welcomeBg from './assets/welcome/bg.png'
import welcomeSakura from './assets/welcome/particle_sakura.png'
import { ToastContainer } from './components/UI/Toast'

interface WelcomeSceneProps {
  onOpenProject: () => Promise<void>;
  onScaffoldProject: () => Promise<void>;
}

const WelcomeScene = (_props: WelcomeSceneProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const dpr = window.devicePixelRatio || 1
    const world = new World({
      canvas: canvasRef.current,
      width: window.innerWidth * dpr,
      height: window.innerHeight * dpr
    })
    const camera = world.createCamera()
    world.camera = camera

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const onMouseMove = (e: MouseEvent) => {
      // 캔버스 중앙을 0,0 으로 하는 마우스 오프셋 좌표
      targetX = (e.clientX - window.innerWidth / 2) * 0.1
      targetY = (e.clientY - window.innerHeight / 2) * 0.1
    }

    const initWorld = async () => {
      // 에셋을 먼저 비동기로 로드합니다.
      await world.loader.load({
        'character-fumika': welcomeFumika,
        'background': welcomeBg,
        'particle_sakura': welcomeSakura,
      })

      // 로딩된 에셋 키(charWelcome)를 사용하여 이미지를 생성합니다.
      world.createImage({
        attribute: { src: 'character-fumika' },
        style: {
          width: 750,
          boxShadowBlur: 0,
          boxShadowColor: '#ffcbcb',
          boxShadowOffsetX: -14,
          boxShadowOffsetY: 14,
        },
        transform: {
          position: { x: -300, y: -250, z: 25 },
        }
      })

      world.createImage({
        attribute: { src: 'background' },
        style: {
          width: 1024 * 5,
          height: 576 * 5,
        },
        transform: {
          position: { z: 350 }
        }
      })

      // 벚꽃 파티클 생성
      world.particleManager.create({
        name: 'sakura_clip',
        src: 'particle_sakura',
        impulse: 0.02,
        lifespan: 6000,
        interval: 300,
        size: [[0.5, 0.8], [0.3, 0.5]],
        opacity: [[0.0, 0.0], [0.5, 1.0], [0.5, 1.0], [0.0, 0.0]],
        loop: true,
        angularImpulse: 0.001,
        rate: 18,
        spawnX: 1024 * 1.5,
        spawnY: 576 * 1.5,
        spawnZ: 500,
      })

      const particle = world.createParticle({
        attribute: {
          gravityScale: 0.02,
          frictionAir: 0.01,
          src: 'sakura_clip',
        },
        style: {
          width: 20,
          height: 20,
        },
        transform: { position: { x: 0, y: 300, z: 100 } },
      })
      
      window.addEventListener('mousemove', onMouseMove)
      
      // 벚꽃 파티클 바람(X축 중력) 설정
      const minWind = -0.5
      const maxWind = 0.3
      const windOffset = (minWind + maxWind) / 2
      const windAmplitude = (maxWind - minWind) / 2

      world.on('update', (timestamp) => {
        // 부드러운 카메라 이동
        currentX += (targetX - currentX) * 0.05
        currentY += (targetY - currentY) * 0.05
        camera.transform.position.x = currentX
        camera.transform.position.y = currentY

        world.gravity.x = windOffset + Math.sin(timestamp * 0.001) * windAmplitude
      })
      
      particle.play()
      world.start()
    }

    initWorld()

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      world.stop()
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 opacity-80"
      width={1024}
      height={576}
    />
  )
}

function App() {
  const { projectPath, setProjectPath, globalLoading, setGlobalLoading, isPreviewOpen, themeColor, themeBg, isSettingsOpen, setIsSettingsOpen, initSettings, isGraphOpen } = useProjectStore()
  const [newProjectData, setNewProjectData] = useState<{ isOpen: boolean, parentDir: string } | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [previewWidth, setPreviewWidth] = useState(400)
  const [isResizing, setIsResizing] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  
  const { addLog } = useOutputStore()

  useEffect(() => {
    initSettings()
  }, [])

  useEffect(() => {
    if (window.api?.output?.onOutputLog) {
      const cleanup = window.api.output.onOutputLog(({ channel, message }) => {
        addLog(channel, message)
      })
      return cleanup
    }
    return () => {}
  }, [addLog])

  useEffect(() => {
    document.documentElement.dataset.theme = themeColor
    document.documentElement.dataset.bgTheme = themeBg
  }, [themeColor, themeBg])

  useEffect(() => {
    if (window.api?.window?.forceMaximize) {
      if (projectPath) {
        window.api.window.forceMaximize()
      } else {
        window.api.window.restoreWelcomeSize()
      }
    }
  }, [projectPath])

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(150, Math.min(600, startWidth + (moveEvent.clientX - startX)))
      setSidebarWidth(newWidth)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      setIsResizing(false)
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
  }, [sidebarWidth])

  const handlePreviewResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = previewWidth
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(1000, startWidth - (moveEvent.clientX - startX)))
      setPreviewWidth(newWidth)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      setIsResizing(false)
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
  }, [previewWidth])

  const handleOpenProject = async () => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const path = await window.api.dialog.openDirectory()
      if (path) {
        setGlobalLoading(true)
        const res = await window.api.project.load(path)
        if (res.success) {
          setProjectPath(path)
        } else {
          alert('Failed to load project: ' + res.error)
        }
        setGlobalLoading(false)
      }
    } finally {
      setIsActionPending(false)
    }
  }

  const handleScaffoldProject = async () => {
    if (isActionPending) return
    setIsActionPending(true)
    try {
      const parentDir = await window.api.dialog.openDirectory()
      if (parentDir) {
        setNewProjectData({ isOpen: true, parentDir })
      }
    } finally {
      setIsActionPending(false)
    }
  }

  const submitNewProject = async (options: NewProjectOptions) => {
    if (!newProjectData || !options.folderName) return
    
    // Windows root drive (e.g. D:\) 처리를 위해 끝에 있는 슬래시 제거
    const cleanParent = newProjectData.parentDir.replace(/[\\/]$/, '')
    const separator = newProjectData.parentDir.includes('\\') ? '\\' : '/'
    const targetDir = `${cleanParent}${separator}${options.folderName}`
    
    setGlobalLoading(true)
    const check = await window.api.fs.checkExists(targetDir)
    if (check.exists) {
      alert(`이미 해당 경로에 폴더가 존재합니다:\n${targetDir}`)
      setGlobalLoading(false)
      setNewProjectData(null)
      return
    }

    const res = await window.api.project.scaffold(targetDir, options)
    if (res.success) {
      await window.api.project.load(targetDir)
      setProjectPath(targetDir)
    } else {
      alert('Failed to scaffold project: ' + res.error)
    }
    setGlobalLoading(false)
    setNewProjectData(null)
  }

  if (!projectPath) {
    return (
      <div className="flex h-screen w-screen flex-col bg-surface-900 text-white overflow-hidden relative">
        <TitleBar />
        <WelcomeScene onOpenProject={handleOpenProject} onScaffoldProject={handleScaffoldProject} />
        <div className="flex-1 flex justify-end items-center relative z-10 pointer-events-none pr-[5vw]">
          <div className="pointer-events-auto w-[460px] p-10 relative">
            <div className="relative z-10">
              <div className="py-4 mb-8 -ml-10">
                <style>{`
                  @keyframes shimmer-text {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                  }
                  .animate-shimmer-text {
                    background-image: linear-gradient(to right, #ffcbcb, #ffb199, #fbc2eb, #a18cd1, #4ef8ff, #ffcbcb);
                    background-size: 200% auto;
                    animation: shimmer-text 6s linear infinite;
                  }
                `}</style>
                <h1 className="flex flex-col text-[8rem] leading-none font-black tracking-tighter origin-left -rotate-6 w-fit">
                  <span className="text-transparent bg-clip-text animate-shimmer-text">Fumika</span>
                  <span className="text-white text-[1.5rem] tracking-[0.2rem] self-end translate-x-8">Visualnovel Engine</span>
                </h1>
              </div>
              
              <div className="flex flex-col gap-5">
                <button
                  onClick={handleOpenProject}
                  disabled={globalLoading || isActionPending}
                  className="group relative flex items-center justify-between overflow-hidden rounded-md border border-[#ffcbcb]/30 bg-gradient-to-br from-[#ffcbcb]/20 to-[#ffcbcb]/5 backdrop-blur-[2px] px-6 py-5 font-semibold text-white shadow-[0_0_30px_-5px_rgba(255,203,203,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_-5px_rgba(255,203,203,0.4)] hover:border-[#ffcbcb]/50 hover:bg-[#ffcbcb]/10 active:scale-[0.98] cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-1000 group-hover:translate-x-full" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-black/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 shadow-inner">
                      <svg className="w-6 h-6 text-[#ffcbcb]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-bold tracking-tight text-transparent bg-clip-text animate-shimmer-text drop-shadow-sm">프로젝트 열기</div>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-[#ffcbcb]/80 transition-transform duration-300 group-hover:translate-x-2 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={handleScaffoldProject}
                  disabled={globalLoading || isActionPending}
                  className="group relative overflow-hidden flex items-center justify-between rounded-md border border-white/20 bg-white/10 backdrop-blur-[2px] px-6 py-5 font-semibold text-white transition-all duration-300 hover:bg-white/20 hover:border-white/30 hover:scale-[1.02] hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] active:scale-[0.98] cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-1000 group-hover:translate-x-full" />
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 shadow-inner border border-white/10">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-2xl font-bold tracking-tight text-transparent bg-clip-text animate-shimmer-text drop-shadow-sm">새 프로젝트</div>
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-white/60 transition-transform duration-300 group-hover:translate-x-2 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <NewProjectDialog
          isOpen={newProjectData?.isOpen || false}
          onConfirm={submitNewProject}
          onCancel={() => setNewProjectData(null)}
        />
        <LoadingOverlay />
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface-950 text-surface-300">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar width={sidebarWidth} />
        <div 
          className="w-1 cursor-col-resize bg-surface-800 hover:bg-primary-500 active:bg-primary-500 z-10 transition-colors shrink-0"
        onMouseDown={handleSidebarResizeStart}
        title="사이드바 크기 조절"
      />

      {/* Main Editor Area */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        <header className="flex h-14 shrink-0 items-center border-b border-surface-800 bg-surface-900/50 px-6 backdrop-blur-md z-10">
          <h3 className="text-sm font-medium">Editor</h3>
          <DebugToolbar />
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden rounded-none">
            <EditorArea />
            <BottomPanel />
          </div>
          {isPreviewOpen && (
            <>
              <div 
                className="w-2 cursor-col-resize rounded-none transition-colors hover:bg-primary-500 active:bg-primary-500 shrink-0 self-stretch" 
                onMouseDown={handlePreviewResizeStart}
                title="프리뷰 크기 조절"
              />
              <div className="flex flex-col shrink-0 h-full rounded-none overflow-hidden border-l border-surface-800 bg-surface-900/50 shadow-xl" style={{ width: previewWidth }}>
                <PreviewPanel />
              </div>
            </>
          )}

          {isGraphOpen && <SceneGraphViewer />}
        </div>
      </main>
      </div>

      {/* 리사이즈 중 iframe 등이 이벤트를 가로채는 것을 방지하는 전체 화면 보호 오버레이 */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <LoadingOverlay />
      <ToastContainer />
    </div>
  )
}

export default App


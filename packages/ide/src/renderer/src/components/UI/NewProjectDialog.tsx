import React, { useState, useEffect, useRef } from 'react'
import { Copy } from 'lucide-react'
import { useToastStore } from '../../store/useToastStore'
import EULA_TEXT from '../../../../../LICENSE?raw'

export interface NewProjectOptions {
  folderName: string
  gameName: string
  projectId: string
  processName: string
  width: number
  height: number
  version?: string
  author?: string
  description?: string
}

export interface NewProjectDialogProps {
  isOpen: boolean
  onConfirm: (options: NewProjectOptions) => void
  onCancel: () => void
}

export function NewProjectDialog({ isOpen, onConfirm, onCancel }: NewProjectDialogProps) {
  const { addToast } = useToastStore()
  const [step, setStep] = useState(1)
  const maxStep = 5

  const handleCopyLicense = async () => {
    try {
      await navigator.clipboard.writeText(EULA_TEXT)
      addToast('라이선스 약관이 클립보드에 복사되었습니다.', 'success')
    } catch (err) {
      addToast('클립보드 복사에 실패했습니다.', 'error')
    }
  }

  const [folderName, setFolderName] = useState('my-visual-novel')
  const [gameName, setGameName] = useState('My Visual Novel')
  const [projectId, setProjectId] = useState('com.mycompany.myvisualnovel')
  const [processName, setProcessName] = useState('my-visual-novel')
  const [version, setVersion] = useState('1.0.0')
  const [author, setAuthor] = useState('Fumika')
  const [description, setDescription] = useState('My Visual Novel Game')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [step, isOpen])

  if (!isOpen) return null

  const validateStep = (currentStep: number) => {
    const newErrors: Record<string, string> = {}
    
    if (currentStep === 2) {
      if (!folderName.trim()) newErrors.folderName = '폴더 이름을 입력해주세요.'
      else if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) newErrors.folderName = '폴더 이름은 영문, 숫자, 하이픈(-), 언더스코어(_)만 가능합니다.'
      
      if (!processName.trim()) newErrors.processName = '프로세스 이름을 입력해주세요.'
      else if (!/^[a-z0-9-]+$/.test(processName)) newErrors.processName = '프로세스 이름은 소문자, 숫자, 하이픈(-)만 가능합니다.'
    }

    if (currentStep === 3) {
      if (!gameName.trim()) newErrors.gameName = '게임 이름을 입력해주세요.'
      
      if (!projectId.trim()) newErrors.projectId = '프로젝트 ID를 입력해주세요.'
      else if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/.test(projectId)) {
        newErrors.projectId = '올바른 프로젝트 ID 형식이 아닙니다 (예: com.example.game)'
      }
    }

    if (currentStep === 4) {
      if (!version.trim()) newErrors.version = '버전을 입력해주세요.'
      else if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/.test(version)) {
        newErrors.version = '올바른 버전 형식이 아닙니다 (예: 1.0.0)'
      }
      if (!author.trim()) newErrors.author = '작성자(개발사)를 입력해주세요.'
    }

    if (currentStep === 5) {
      if (width <= 0) newErrors.width = '해상도는 1 이상이어야 합니다.'
      if (height <= 0) newErrors.height = '해상도는 1 이상이어야 합니다.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step) && step < maxStep) {
      setErrors({})
      setStep(step + 1)
    }
  }

  const handlePrev = () => {
    if (step > 1) {
      setErrors({})
      setStep(step - 1)
    }
  }

  const handleConfirm = () => {
    if (validateStep(step)) {
      onConfirm({
        folderName,
        gameName,
        projectId,
        processName,
        width,
        height,
        version,
        author,
        description
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      if (step < maxStep) {
        handleNext()
      } else {
        handleConfirm()
      }
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in text-sm px-4">
      <div className="bg-surface-800 border border-surface-700 p-6 rounded-sm shadow-xl w-full max-w-lg min-w-[320px] md:max-w-xl animate-fade-scale transition-all" onKeyDown={handleKeyDown}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">새 프로젝트 생성 (단계 {step}/{maxStep})</h3>
        </div>
        
        <div className="flex flex-col gap-4 mb-6 min-h-[140px]">
          {step === 1 && (
            <div className="flex flex-col gap-2 animate-fade-in text-surface-300">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-xs text-primary-400">Fumika IDE 최종 사용자 약관 (EULA)</span>
                <button
                  onClick={handleCopyLicense}
                  className="flex items-center gap-1 px-2 py-1 bg-surface-700 hover:bg-surface-600 rounded-sm text-[10px] text-surface-200 transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>복사</span>
                </button>
              </div>
              <div className="bg-surface-900 border border-surface-700 p-3 rounded-sm text-[10px] h-[100px] overflow-y-auto whitespace-pre-wrap font-mono text-surface-400 leading-relaxed">
                {EULA_TEXT}
              </div>
              <p className="text-xs text-surface-400 mt-1">새 프로젝트를 생성하시면 위의 라이선스 약관에 모두 동의하시는 것으로 간주됩니다.</p>
            </div>
          )}

          {step === 2 && (
            <>
              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">폴더 이름 (영문/숫자/하이픈)</span>
                <input
                  ref={inputRef}
                  className={`bg-surface-900 border ${errors.folderName ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                />
                {errors.folderName && <span className="text-red-400 text-[10px]">{errors.folderName}</span>}
              </label>

              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">프로세스 이름 (작업 관리자 표시용)</span>
                <input
                  className={`bg-surface-900 border ${errors.processName ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                  value={processName}
                  onChange={(e) => setProcessName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
                {errors.processName && <span className="text-red-400 text-[10px]">{errors.processName}</span>}
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">게임 이름 (실제 표기용)</span>
                <input
                  ref={inputRef}
                  className={`bg-surface-900 border ${errors.gameName ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                />
                {errors.gameName && <span className="text-red-400 text-[10px]">{errors.gameName}</span>}
              </label>

              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">프로젝트 ID (com.example.game)</span>
                <input
                  className={`bg-surface-900 border ${errors.projectId ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                />
                {errors.projectId && <span className="text-red-400 text-[10px]">{errors.projectId}</span>}
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">버전 (예: 1.0.0)</span>
                <input
                  ref={inputRef}
                  className={`bg-surface-900 border ${errors.version ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
                {errors.version && <span className="text-red-400 text-[10px]">{errors.version}</span>}
              </label>

              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">작성자 / 개발사</span>
                <input
                  className={`bg-surface-900 border ${errors.author ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
                {errors.author && <span className="text-red-400 text-[10px]">{errors.author}</span>}
              </label>

              <label className="flex flex-col gap-1 text-surface-300 animate-fade-in">
                <span className="font-semibold text-xs">게임 설명 (선택)</span>
                <input
                  className="bg-surface-900 border border-surface-600 text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            </>
          )}

          {step === 5 && (
            <>
              <div className="flex gap-2 animate-fade-in">
                <label className="flex flex-col gap-1 text-surface-300 flex-1">
                  <span className="font-semibold text-xs">가로 해상도</span>
                  <input
                    ref={inputRef}
                    type="number"
                    className={`bg-surface-900 border ${errors.width ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                  />
                  {errors.width && <span className="text-red-400 text-[10px]">{errors.width}</span>}
                </label>
                <label className="flex flex-col gap-1 text-surface-300 flex-1">
                  <span className="font-semibold text-xs">세로 해상도</span>
                  <input
                    type="number"
                    className={`bg-surface-900 border ${errors.height ? 'border-red-500' : 'border-surface-600'} text-white px-2 py-1.5 rounded-sm focus:outline-none focus:border-primary-500`}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                  />
                  {errors.height && <span className="text-red-400 text-[10px]">{errors.height}</span>}
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-between items-center">
          <button 
            className="px-4 py-2 text-sm bg-surface-700 hover:bg-surface-600 rounded-sm text-white transition-colors" 
            onClick={onCancel}
          >
            취소
          </button>
          
          <div className="flex gap-2">
            {step > 1 && (
              <button 
                className="px-4 py-2 text-sm border border-surface-600 hover:bg-surface-700 rounded-sm text-white transition-colors" 
                onClick={handlePrev}
              >
                이전
              </button>
            )}
            {step < maxStep ? (
              <button 
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 rounded-sm text-white transition-colors font-semibold" 
                onClick={handleNext}
              >
                다음
              </button>
            ) : (
              <button 
                className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-500 rounded-sm text-white transition-colors font-semibold" 
                onClick={handleConfirm}
              >
                완료
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { DialogBox } from '../UI/DialogBox'
import { ConfirmDialogBox } from '../UI/ConfirmDialogBox'
import { getFileTemplate } from '../../../../shared/templates'

const WATCH_FOLDERS = ['assets', 'scenes', 'characters', 'modules', 'backgrounds', 'effects', 'fallbacks', 'initials', 'hooks']

/**
 * 해당 폴더의 기존 이름 목록을 받아, 충돌 시 _1, _2, ... 형태의 고유 이름을 반환합니다.
 * 파일의 경우 확장자 없이 비교하고, 폴더는 그대로 비교합니다.
 */
const getBaseNameWithoutExt = (filename: string): string => {
  if (filename.endsWith('.fbp.json')) {
    return filename.slice(0, -9)
  }
  return filename.replace(/\.[^/.]+$/, '')
}

const resolveUniqueName = (baseName: string, existingNodes: FileNode[], isFolder: boolean): string => {
  const existingNames = new Set(
    existingNodes.map(n => isFolder ? n.name : getBaseNameWithoutExt(n.name))
  )
  if (!existingNames.has(baseName)) return baseName
  let counter = 1
  while (existingNames.has(`${baseName}_${counter}`)) {
    counter++
  }
  return `${baseName}_${counter}`
}

/**
 * 전체 경로에서 루트 장르(첫 번째 세그먼트)를 반환합니다.
 * 예) projectPath/scenes/start.ts → 'scenes'
 */
const getRootGenre = (fullPath: string, projectPath: string): string => {
  const rel = fullPath.startsWith(projectPath)
    ? fullPath.slice(projectPath.length).replace(/^[/\\]/, '')
    : fullPath
  return rel.split(/[/\\]/)[0]
}

const CONFIG_FILES = ['novel.config.ts', 'main.ts', 'package.json']

interface FileNode {
  name: string
  isDirectory: boolean
  path: string
  children?: FileNode[]
}

type PromptAction = 'create_file' | 'create_folder' | 'rename'
interface PromptData {
  isOpen: boolean
  action: PromptAction
  targetFolder: string
  targetNode?: FileNode
  defaultValue: string
  options?: { label: string; value: string }[]
  selectOptions?: { label: string; value: string }[]
  selectLabel?: string
}
export function ProjectSidebar({ width = 256 }: { width?: number }) {
  const { projectPath, activeFile, setActiveFile, setGlobalLoading, setProjectPath, tsErrors } = useProjectStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    scenes: true,
    assets: true,
    characters: true,
    modules: true,
    backgrounds: true,
    effects: true,
    fallbacks: true,
    initials: true,
    hooks: true,
  })
  const [folderFiles, setFolderFiles] = useState<Record<string, FileNode[]>>({})
  const [promptData, setPromptData] = useState<PromptData | null>(null)
  
  interface ConfirmState {
    isOpen: boolean
    title: string
    message: string
    type?: 'warning' | 'info' | 'danger'
    showCancel?: boolean
    onConfirm: () => void
  }
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  // ─── 의존성 업데이트 다이얼로그 상태 ──────────────────────────────
  interface FileSpecItem {
    relativePath: string
    label: string
    overwriteIfExists: boolean
  }
  interface UpdateDialogState {
    isOpen: boolean
    specs: FileSpecItem[]
    checked: Set<string>
  }
  const [updateDialog, setUpdateDialog] = useState<UpdateDialogState | null>(null)

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [lastSelected, setLastSelected] = useState<string | null>(null)

  const toggleFolder = (folderPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setExpanded((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }))
  }

  const getVisibleNodes = () => {
    const nodes: string[] = []
    CONFIG_FILES.forEach(file => nodes.push(`${projectPath}/${file}`))
    WATCH_FOLDERS.forEach(folder => {
      const rootPath = `${projectPath}/${folder}`
      nodes.push(rootPath)
      if (expanded[folder]) {
        const traverse = (children: FileNode[]) => {
          children.forEach(node => {
            const fullPath = `${projectPath}/${folder}/${node.path}`
            nodes.push(fullPath)
            if (node.isDirectory && expanded[fullPath] && node.children) {
              traverse(node.children)
            }
          })
        }
        traverse(folderFiles[folder] || [])
      }
    })
    return nodes
  }

  const handleNodeClick = (e: React.MouseEvent, targetPath: string, isDir: boolean, expandKey?: string) => {
    e.stopPropagation()
    if (!projectPath) return

    // 루트 장르 폴더 (scenes, assets 등)는 선택 불가 — 폴더 토글만 허용
    const rootFolderPaths = new Set(WATCH_FOLDERS.map(f => `${projectPath}/${f}`))
    if (rootFolderPaths.has(targetPath)) {
      if (expandKey) toggleFolder(expandKey)
      return
    }

    const targetGenre = getRootGenre(targetPath, projectPath)

    // 다른 장르가 섞인 기존 선택은 초기화 후 시작
    let newSelection = new Set(
      Array.from(selectedFiles).filter(p => getRootGenre(p, projectPath) === targetGenre)
    )

    if (e.shiftKey && lastSelected) {
      const visibleNodes = getVisibleNodes()
      const startIdx = visibleNodes.indexOf(lastSelected)
      const endIdx = visibleNodes.indexOf(targetPath)

      if (startIdx !== -1 && endIdx !== -1) {
        if (!e.ctrlKey && !e.metaKey) newSelection = new Set()
        const minIdx = Math.min(startIdx, endIdx)
        const maxIdx = Math.max(startIdx, endIdx)
        for (let i = minIdx; i <= maxIdx; i++) {
          const p = visibleNodes[i]
          // Shift 범위 선택: 동일 장르 + 루트 폴더 제외
          if (getRootGenre(p, projectPath) === targetGenre && !rootFolderPaths.has(p)) newSelection.add(p)
        }
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (newSelection.has(targetPath)) {
        newSelection.delete(targetPath)
      } else {
        newSelection.add(targetPath)
        setLastSelected(targetPath)
      }
    } else {
      newSelection = new Set([targetPath])
      setLastSelected(targetPath)
      if (!isDir) {
        if (activeFile !== targetPath) setActiveFile(targetPath)
      } else if (expandKey) {
        toggleFolder(expandKey)
      }
    }

    setSelectedFiles(newSelection)
  }

  const handleNodeDoubleClick = (e: React.MouseEvent, targetPath: string, isDir: boolean) => {
    e.stopPropagation()
    if (!isDir) {
      window.dispatchEvent(new CustomEvent('pin-tab', { detail: { path: targetPath } }))
    }
  }

  const handleDragStart = (e: React.DragEvent, targetPath: string) => {
    let dragFiles = Array.from(selectedFiles)
    if (!selectedFiles.has(targetPath)) {
      dragFiles = [targetPath]
      setSelectedFiles(new Set(dragFiles))
      setLastSelected(targetPath)
    }

    const configPaths = CONFIG_FILES.map(f => `${projectPath}/${f}`)
    dragFiles = dragFiles.filter(p => !configPaths.includes(p))

    const rootPaths = WATCH_FOLDERS.map(f => `${projectPath}/${f}`)
    dragFiles = dragFiles.filter(p => !rootPaths.includes(p))

    if (dragFiles.length === 0) {
      e.preventDefault()
      return
    }

    e.dataTransfer.setData('application/json', JSON.stringify({ paths: dragFiles }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, dropTargetPath: string, isDir: boolean) => {
    e.preventDefault()
    e.stopPropagation()

    if (!projectPath) return

    try {
      const dataStr = e.dataTransfer.getData('application/json')
      if (!dataStr) return
      const data = JSON.parse(dataStr)
      if (!data.paths || !Array.isArray(data.paths)) return

      let targetDir = dropTargetPath
      if (!isDir) {
        targetDir = dropTargetPath.substring(0, dropTargetPath.lastIndexOf('/'))
      }

      const targetRelPath = targetDir.replace(`${projectPath}/`, '')
      const targetRoot = targetRelPath.split('/')[0]

      for (const oldPath of data.paths) {
        const oldRelPath = oldPath.replace(`${projectPath}/`, '')
        const oldRoot = oldRelPath.split('/')[0]

        if (oldRoot !== targetRoot) continue

        const fileName = oldPath.split(/[/\\]/).pop()
        const newPath = `${targetDir}/${fileName}`

        if (oldPath !== newPath && oldPath !== targetDir && !newPath.startsWith(`${oldPath}/`)) {
           await window.api.fs.renameFile(oldPath, newPath)
           
           if (activeFile === oldPath) setActiveFile(newPath)
           
           window.dispatchEvent(new CustomEvent('file-renamed', { 
             detail: { oldPath, newPath, isDirectory: !oldPath.match(/\.[^/.]+$/) } 
           }))
        }
      }
      
      fetchFiles()
    } catch (err) {
      console.error('Drop error:', err)
    }
  }

  const fetchFiles = async () => {
    if (!projectPath) return
    const newFiles: Record<string, FileNode[]> = {}
    for (const folder of WATCH_FOLDERS) {
      try {
        const res = await window.api.fs.readDir(`${projectPath}/${folder}`, true)
        if (res.success && res.files) {
          const sortNodes = (nodes: FileNode[]) => {
            nodes.sort((a, b) => {
              if (a.isDirectory && !b.isDirectory) return -1
              if (!a.isDirectory && b.isDirectory) return 1
              return a.name.localeCompare(b.name)
            })
            nodes.forEach(n => n.children && sortNodes(n.children))
          }
          const filterHidden = (nodes: FileNode[], folderName: string): FileNode[] => {
            return nodes.filter(n => {
              if (n.name.startsWith('.')) return false
              if (folderName === 'modules' && n.name.endsWith('.ts')) {
                const baseName = n.name.slice(0, -3)
                const hasBlueprint = nodes.some(sibling => sibling.name === `${baseName}.fbp.json`)
                if (hasBlueprint) return false
              }
              return true
            }).map(n => ({
              ...n,
              children: n.children ? filterHidden(n.children, folderName) : undefined
            }))
          }
          const filtered = filterHidden(res.files, folder)
          sortNodes(filtered)
          newFiles[folder] = filtered
        } else {
          newFiles[folder] = []
        }
      } catch (e) {
        newFiles[folder] = []
      }
    }
    setFolderFiles(newFiles)
  }

  useEffect(() => {
    fetchFiles()
    const interval = setInterval(fetchFiles, 2000)
    return () => clearInterval(interval)
  }, [projectPath])

  // ==============================
  // 핸들러
  // ==============================

  const handleUpdateProject = async () => {
    if (!projectPath) return

    // 파일 스펙 목록을 먼저 조회해서 체크박스 다이얼로그 표시
    const res = await window.api.project.getFileSpecs()
    if (!res.success || !res.specs) return

    // 기본 체크: overwriteIfExists=true인 파일은 미리 체크
    const defaultChecked = new Set(
      res.specs.filter(s => s.overwriteIfExists).map(s => s.relativePath)
    )
    setUpdateDialog({ isOpen: true, specs: res.specs, checked: defaultChecked })
  }

  const handleUpdateConfirm = async () => {
    if (!projectPath || !updateDialog) return
    const overrideFiles = Array.from(updateDialog.checked)
    setUpdateDialog(null)
    setGlobalLoading(true)
    const res = await window.api.project.update(projectPath, overrideFiles)
    setGlobalLoading(false)
    setConfirmState({
      isOpen: true,
      title: res.success ? '업데이트 완료' : '업데이트 실패',
      message: res.success
        ? '프로젝트 의존성이 성공적으로 업데이트되었습니다!'
        : `업데이트 중 오류가 발생했습니다:\n${res.error}`,
      type: res.success ? 'info' : 'danger',
      showCancel: false,
      onConfirm: () => setConfirmState(null)
    })
  }

  const handleAddFile = async (e: React.MouseEvent, folderPath: string, isFolder: boolean = false) => {
    e.stopPropagation()
    if (!projectPath) return
    
    // assets 루트에 파일 추가하는 특별 처리
    if (folderPath.startsWith('assets') && !isFolder) {
      const paths = await window.api.dialog.openFile()
      if (paths && paths.length > 0) {
        for (const src of paths) {
          const fileName = src.split(/[/\\]/).pop()
          if (fileName) {
            const dest = `${projectPath}/${folderPath}/${fileName}`
            await window.api.fs.copyFile(src, dest)
          }
        }
        fetchFiles()
      }
      return
    }

    const rootType = folderPath.split(/[/\\]/)[0]
    
    let options: { label: string; value: string }[] | undefined
    let selectOptions: { label: string; value: string }[] | undefined
    let selectLabel: string | undefined
    if (rootType === 'effects' && !isFolder) {
      const effectTypes = ['dust', 'rain', 'snow', 'sakura', 'sparkle', 'fog', 'leaves', 'fireflies']
      options = effectTypes.map(t => ({ label: t, value: t }))
    } else if (rootType === 'modules' && !isFolder) {
      selectOptions = [
        { label: '블루프린트 (Visual Node)', value: 'blueprint' },
        { label: '코드 에디터 (TypeScript)', value: 'code' }
      ]
      selectLabel = '모듈 타입'
    }

    // 대상 폴더의 현재 파일 목록을 가져와 중복 이름 방지
    const targetRelPath = folderPath
    const rootFolder = targetRelPath.split(/[/\\]/)[0]
    const subPath = targetRelPath.split(/[/\\]/).slice(1).join('/')

    const findNodes = (nodes: FileNode[], parts: string[]): FileNode[] => {
      if (parts.length === 0 || parts[0] === '') return nodes
      const found = nodes.find(n => n.name === parts[0] && n.isDirectory)
      return found?.children ? findNodes(found.children, parts.slice(1)) : []
    }

    const rootNodes = folderFiles[rootFolder] || []
    const currentNodes = subPath ? findNodes(rootNodes, subPath.split('/')) : rootNodes

    const rawDefault = isFolder ? 'new_folder' : (options ? options[0].value : `new_${rootType.slice(0, -1)}`)
    const uniqueDefault = resolveUniqueName(rawDefault, currentNodes, isFolder)

    setPromptData({
      isOpen: true,
      action: isFolder ? 'create_folder' : 'create_file',
      targetFolder: folderPath,
      defaultValue: uniqueDefault,
      options,
      selectOptions,
      selectLabel
    })
  }

  const handleDelete = async (e: React.MouseEvent, folderPath: string, node: FileNode) => {
    e.stopPropagation()
    if (!projectPath) return

    const clickedFullPath = `${projectPath}/${folderPath}/${node.path}`

    // 보호 대상 경로 (삭제 불가): config 파일, 루트 감시 폴더
    const protectedPaths = new Set([
      ...CONFIG_FILES.map(f => `${projectPath}/${f}`),
      ...WATCH_FOLDERS.map(f => `${projectPath}/${f}`),
    ])

    const isMultiDelete = selectedFiles.has(clickedFullPath) && selectedFiles.size >= 2
    const targetPaths = isMultiDelete
      ? Array.from(selectedFiles).filter(p => !protectedPaths.has(p))
      : [clickedFullPath]

    if (targetPaths.length === 0) return

    const confirmMessage = isMultiDelete
      ? `선택된 ${targetPaths.length}개 항목을 모두 삭제하시겠습니까?\n삭제된 항목은 휴지통으로 이동합니다.`
      : `정말 '${node.name}'을(를) 삭제하시겠습니까?\n삭제된 항목은 휴지통으로 이동합니다.`

    setConfirmState({
      isOpen: true,
      title: '항목 삭제',
      message: confirmMessage,
      type: 'danger',
      onConfirm: async () => {
        setConfirmState(null)
        let hasError = false
        let errorMessage = ''
        
        for (const fullPath of targetPaths) {
          const isDirectory = !fullPath.match(/\.[^/.]+$/)
          if (isDirectory) {
            const res = await window.api.fs.deleteDir(fullPath)
            if (res.success) {
              window.dispatchEvent(new CustomEvent('dir-deleted', { detail: { path: fullPath } }))
            } else {
              hasError = true
              errorMessage = res.error || '알 수 없는 오류가 발생했습니다.'
              break
            }
          } else {
            const res = await window.api.fs.deleteFile(fullPath)
            if (res.success) {
              window.dispatchEvent(new CustomEvent('file-deleted', { detail: { path: fullPath } }))
              if (activeFile === fullPath) setActiveFile(null)
            } else {
              hasError = true
              errorMessage = res.error || '알 수 없는 오류가 발생했습니다.'
              break
            }
          }
        }
        
        if (hasError) {
          setConfirmState({
            isOpen: true,
            title: '삭제 실패',
            message: `항목을 휴지통으로 이동하는 데 실패했습니다:\n${errorMessage}`,
            type: 'danger',
            showCancel: false,
            onConfirm: () => setConfirmState(null)
          })
        }
        
        if (isMultiDelete && !hasError) setSelectedFiles(new Set())
        fetchFiles()
      }
    })
  }

  const handleRename = (e: React.MouseEvent, folderPath: string, node: FileNode) => {
    e.stopPropagation()
    const baseName = node.isDirectory ? node.name : node.name.replace(/\.[^/.]+$/, "")
    setPromptData({
      isOpen: true,
      action: 'rename',
      targetFolder: folderPath,
      targetNode: node,
      defaultValue: baseName
    })
  }

  const submitPrompt = async (inputValue: string, selectValue?: string) => {
    if (!inputValue || !promptData || !projectPath) return
    const { action, targetFolder, targetNode } = promptData
    setPromptData(null)

    const safeName = inputValue.replace(/[^a-zA-Z0-9_-]/g, '_')
    const rootType = targetFolder.split(/[/\\]/)[0]

    const findNodes = (nodes: FileNode[], parts: string[]): FileNode[] => {
      if (parts.length === 0 || parts[0] === '') return nodes
      const found = nodes.find(n => n.name === parts[0] && n.isDirectory)
      return found?.children ? findNodes(found.children, parts.slice(1)) : []
    }

    if (action === 'create_folder') {
      const targetRelPath = targetFolder
      const rootFolder = targetRelPath.split(/[/\\]/)[0]
      const subPath = targetRelPath.split(/[/\\]/).slice(1).join('/')
      const rootNodes = folderFiles[rootFolder] || []
      const currentNodes = subPath ? findNodes(rootNodes, subPath.split('/')) : rootNodes

      const isDuplicate = currentNodes.some(n => n.name === safeName)
      if (isDuplicate) {
        setConfirmState({
          isOpen: true,
          title: '생성 실패',
          message: `'${safeName}' 폴더가 이미 존재합니다.`,
          type: 'warning',
          showCancel: false,
          onConfirm: () => setConfirmState(null)
        })
        return
      }

      await window.api.fs.mkdir(`${projectPath}/${targetFolder}/${safeName}`)
    } else if (action === 'create_file') {
      const targetRelPath = targetFolder
      const rootFolder = targetRelPath.split(/[/\\]/)[0]
      const subPath = targetRelPath.split(/[/\\]/).slice(1).join('/')
      const rootNodes = folderFiles[rootFolder] || []
      const currentNodes = subPath ? findNodes(rootNodes, subPath.split('/')) : rootNodes

      const isDuplicate = currentNodes.some(n => {
        if (n.isDirectory) return n.name === safeName
        return getBaseNameWithoutExt(n.name) === safeName
      })

      if (isDuplicate) {
        setConfirmState({
          isOpen: true,
          title: '생성 실패',
          message: `'${safeName}'은(는) 이미 존재하는 이름이거나 중복되는 모듈 이름입니다. 다른 이름을 사용해주세요.`,
          type: 'warning',
          showCancel: false,
          onConfirm: () => setConfirmState(null)
        })
        return
      }

      const isBlueprint = rootType === 'modules' ? (selectValue === 'blueprint') : false
      const ext = isBlueprint ? '.fbp.json' : '.ts'
      const filePath = `${projectPath}/${targetFolder}/${safeName}${ext}`
      const relativeDots = Array(targetFolder.split(/[/\\]/).length).fill('..').join('/')

      let content = ''
      if (isBlueprint) {
        content = JSON.stringify({
          activeTab: 'command',
          graphs: {
            command: { nodes: [], edges: [] },
            view: { nodes: [], edges: [] },
            boot: { nodes: [], edges: [] }
          },
          definitions: {
            moduleName: safeName,
            schemaDef: [],
            commandDef: [],
            hookDef: []
          }
        }, null, 2)
      } else {
        const template = getFileTemplate(rootType, safeName, relativeDots)
        const formatRes = await window.api.fs.formatCode(template)
        content = formatRes.success && formatRes.content ? formatRes.content : template
      }

      await window.api.fs.writeFile(filePath, content)
      setActiveFile(filePath)
      
      const fullDir = `${projectPath}/${targetFolder}`
      setExpanded(prev => ({ ...prev, [fullDir]: true, [targetFolder]: true }))
    } else if (action === 'rename' && targetNode) {
      const oldPath = `${projectPath}/${targetFolder}/${targetNode.path}`
      const ext = targetNode.isDirectory
        ? ''
        : targetNode.name.endsWith('.fbp.json')
          ? '.fbp.json'
          : targetNode.name.match(/\.[^/.]+$/)?.[0] || '.ts'
      const newName = `${safeName}${ext}`
      const dirPath = oldPath.substring(0, oldPath.lastIndexOf('/'))
      const newPath = `${dirPath}/${newName}`
      
      const targetRelPath = targetFolder
      const rootFolder = targetRelPath.split(/[/\\]/)[0]
      const subPath = targetRelPath.split(/[/\\]/).slice(1).join('/')
      const rootNodes = folderFiles[rootFolder] || []
      const currentNodes = subPath ? findNodes(rootNodes, subPath.split('/')) : rootNodes

      const isDuplicate = currentNodes.some(n => {
        if (n.path === targetNode.path) return false
        if (n.isDirectory) return n.name === safeName
        return getBaseNameWithoutExt(n.name) === safeName
      })

      if (isDuplicate) {
        setConfirmState({
          isOpen: true,
          title: '이름 변경 실패',
          message: `'${safeName}'은(는) 이미 존재하는 이름이거나 중복되는 모듈 이름입니다. 다른 이름을 사용해주세요.`,
          type: 'warning',
          showCancel: false,
          onConfirm: () => setConfirmState(null)
        })
        return
      }

      await window.api.fs.renameFile(oldPath, newPath)
      window.dispatchEvent(new CustomEvent('file-renamed', { detail: { oldPath, newPath, isDirectory: targetNode.isDirectory } }))
      if (activeFile === oldPath) setActiveFile(newPath)
    }
    
    fetchFiles()
  }

  // ==============================
  // 렌더링
  // ==============================

  const getErrorCount = (nodePath: string): number => {
    if (!projectPath) return 0
    
    const normNode = nodePath.replace(/\\/g, '/')
    const normProj = projectPath.replace(/\\/g, '/')
    
    let relPath = normNode
    if (normNode.toLowerCase().startsWith(normProj.toLowerCase())) {
      relPath = normNode.slice(normProj.length).replace(/^[/\\]/, '')
    }

    let count = 0
    const lowerRelPath = relPath.toLowerCase()
    for (const [key, errors] of Object.entries(tsErrors)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey === lowerRelPath || lowerKey.startsWith(lowerRelPath + '/')) {
        count += errors.length
      }
    }
    return count
  }

  const renderTree = (nodes: FileNode[], folderPath: string) => {
    return (
      <ul className="pl-3 mt-1 space-y-0.5 border-l border-surface-700/50 ml-2">
        {nodes.length === 0 && (
          <li className="text-xs text-surface-600 italic px-2 py-1 select-none">Empty</li>
        )}
        {nodes.map(node => {
          const isDir = node.isDirectory
          const fullPath = `${projectPath}/${folderPath}/${node.path}`
          const isExpanded = expanded[fullPath]
          const isSelected = selectedFiles.has(fullPath)
          const isActive = !isDir && activeFile === fullPath
          const errorCount = getErrorCount(fullPath)
          
          const normNode = fullPath.replace(/\\/g, '/')
          const normProj = projectPath!.replace(/\\/g, '/')
          const nodeRelPath = normNode.toLowerCase().startsWith(normProj.toLowerCase()) 
            ? normNode.slice(normProj.length).replace(/^[/\\]/, '') 
            : normNode

          const matchingKey = Object.keys(tsErrors).find(k => k.toLowerCase() === nodeRelPath.toLowerCase())
          const errorTooltip = !isDir && errorCount > 0 && matchingKey
            ? tsErrors[matchingKey]?.map(e => `[Line ${e.line}] ${e.message}`).join('\n')
            : ''

          return (
            <li key={node.path}>
              <div 
                draggable
                onDragStart={(e) => handleDragStart(e, fullPath)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, fullPath, isDir)}
                className={`group relative flex items-center justify-between cursor-pointer rounded px-2 py-1.5 text-xs transition-colors select-none ${
                  isSelected 
                    ? 'bg-primary-600/40 text-primary-200 font-medium' 
                    : isActive 
                      ? 'bg-primary-600/20 text-primary-300 font-medium' 
                      : errorCount > 0
                        ? 'text-red-400 hover:bg-surface-800'
                        : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                }`}
                onClick={(e) => handleNodeClick(e, fullPath, isDir, fullPath)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, fullPath, isDir)}
                title={errorTooltip || node.name}
              >
                <div className="flex items-center truncate max-w-[140px]">
                  {isDir && (
                    <span className="mr-1 opacity-70 w-3 inline-block text-center text-[10px]">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  )}
                  {!isDir && <span className="mr-1 opacity-40 w-3 inline-block text-center text-[10px]">•</span>}
                  <span className="truncate">{node.name}</span>
                </div>
                
                {errorCount > 0 && (
                  <div className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold shrink-0">
                    {errorCount > 99 ? '99+' : errorCount}
                  </div>
                )}
                
                <div className="absolute -right-2 -top-1.5 flex items-center opacity-0 group-hover:opacity-100 transition-all transform group-hover:scale-105 bg-surface-800 shadow-xl border border-surface-700/80 rounded-md z-50 px-1 py-1 gap-1">
                  {isDir && folderPath !== 'effects' && (
                    <>
                      <button onClick={(e) => handleAddFile(e, `${folderPath}/${node.path}`, false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-700 hover:text-primary-400 transition-colors" title="새 파일">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <button onClick={(e) => handleAddFile(e, `${folderPath}/${node.path}`, true)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-700 hover:text-primary-400 transition-colors" title="새 폴더">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                      </button>
                    </>
                  )}
                  {folderPath !== 'effects' && (
                    <>
                      <button onClick={(e) => handleRename(e, folderPath, node)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-700 hover:text-yellow-400 transition-colors" title="이름 변경">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={(e) => handleDelete(e, folderPath, node)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-700 hover:text-red-400 transition-colors" title="삭제">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {isDir && isExpanded && node.children && renderTree(node.children, folderPath)}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <aside className="border-r border-surface-800 bg-surface-900 flex flex-col shrink-0" style={{ width }}>
      <div className="border-b border-surface-800 p-4 shrink-0 flex justify-between items-center">
        <div className="overflow-hidden mr-2">
          <h2 
            className="font-bold text-surface-100 truncate cursor-pointer hover:underline"
            onClick={() => projectPath && window.api.shell.openPath(projectPath)}
            title="클릭하여 폴더 열기"
          >
            {projectPath ? projectPath.split(/[/\\]/).pop() : 'Project Explorer'}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button 
            onClick={handleUpdateProject}
            className="w-7 h-7 flex items-center justify-center rounded bg-primary-600/20 text-primary-400 hover:bg-primary-600/40 transition-colors"
            title="의존성 복구 및 최신 엔진 업데이트 (npm install)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button 
            onClick={() => {
              setProjectPath('');
              setActiveFile(null);
            }}
            className="w-7 h-7 flex items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
            title="프로젝트 닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="text-sm">
          {/* Configurations */}
          <div className="mb-4">
            <div className="flex items-center py-1 text-surface-400 select-none">
              <span className="font-semibold uppercase text-xs tracking-wider">Configurations</span>
            </div>
            <ul className="pl-2 mt-1 space-y-0.5">
              {CONFIG_FILES.map((file) => {
                const filePath = `${projectPath}/${file}`
                const isSelected = selectedFiles.has(filePath)
                const isActive = activeFile === filePath
                const errorCount = getErrorCount(filePath)
                const errorTooltip = errorCount > 0 
                  ? tsErrors[file]?.map(e => `[Line ${e.line}] ${e.message}`).join('\n')
                  : ''
                return (
                  <li 
                    key={file} 
                    className={`flex items-center justify-between cursor-pointer rounded px-2 py-1.5 text-xs truncate transition-colors select-none ${
                      isSelected 
                        ? 'bg-primary-600/40 text-primary-200 font-medium' 
                        : isActive 
                          ? 'bg-primary-600/20 text-primary-300 font-medium' 
                          : errorCount > 0
                            ? 'text-red-400 hover:bg-surface-800'
                            : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                    }`}
                    onClick={(e) => handleNodeClick(e, filePath, false)}
                    onDoubleClick={(e) => handleNodeDoubleClick(e, filePath, false)}
                    title={errorTooltip || file}
                  >
                    <div className="flex items-center truncate">
                      <span className="mr-1 opacity-40 w-3 inline-block text-center text-[10px]">•</span>
                      <span className="truncate">{file}</span>
                    </div>
                    {errorCount > 0 && (
                      <div className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold shrink-0">
                        {errorCount > 99 ? '99+' : errorCount}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Folders */}
          {WATCH_FOLDERS.map((folder) => {
            const rootPath = `${projectPath}/${folder}`
            const isSelected = selectedFiles.has(rootPath)
            const errorCount = getErrorCount(rootPath)
            return (
            <div key={folder} className="mb-2">
              <div 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, rootPath, true)}
                className={`relative flex items-center justify-between cursor-pointer py-1.5 select-none transition-colors group rounded px-2 ${
                  isSelected 
                    ? 'bg-primary-600/40 text-primary-200' 
                    : errorCount > 0
                      ? 'text-red-400 hover:bg-surface-800'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                }`}
                onClick={(e) => handleNodeClick(e, rootPath, true, folder)}
              >
                <div className="flex items-center">
                  <span className="mr-1 opacity-70 w-3 inline-block text-center text-[10px]">
                    {expanded[folder] ? '▾' : '▸'}
                  </span>
                  <span className="font-semibold capitalize">{folder}</span>
                </div>
                {errorCount > 0 && (
                  <div className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold shrink-0">
                    {errorCount > 99 ? '99+' : errorCount}
                  </div>
                )}
                <div className="absolute -right-2 -top-1.5 flex items-center opacity-0 group-hover:opacity-100 transition-all transform group-hover:scale-105 bg-surface-800 shadow-xl border border-surface-700/80 rounded-md z-50 px-1 py-1 gap-1">
                  {folder !== 'effects' && (
                    <>
                      <button 
                        onClick={(e) => handleAddFile(e, folder, false)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-700 hover:text-primary-400 transition-colors"
                        title={`새 ${folder} 리소스 추가`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <button 
                        onClick={(e) => handleAddFile(e, folder, true)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-700 hover:text-primary-400 transition-colors"
                        title={`새 폴더 추가`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {expanded[folder] && renderTree(folderFiles[folder] || [], folder)}
            </div>
            )
          })}
        </div>
      </div>

      <DialogBox
        isOpen={promptData?.isOpen || false}
        title={
          promptData?.action === 'create_folder' ? "새 폴더 이름 입력" :
          promptData?.action === 'rename' ? "이름 변경" : (promptData?.options ? "이펙트 선택" : "새 파일 이름 입력")
        }
        defaultValue={promptData?.defaultValue}
        options={promptData?.options}
        selectOptions={promptData?.selectOptions}
        selectLabel={promptData?.selectLabel}
        onConfirm={submitPrompt}
        onCancel={() => setPromptData(null)}
      />
      
      <ConfirmDialogBox
        isOpen={confirmState?.isOpen || false}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        type={confirmState?.type || 'info'}
        showCancel={confirmState?.showCancel !== false}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      {/* 의존성 업데이트 — 파일 덮어쓰기 선택 다이얼로그 */}
      {updateDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 border border-surface-700 rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-surface-700">
              <h3 className="text-base font-semibold text-surface-100">프로젝트 업데이트</h3>
              <p className="mt-1 text-xs text-surface-400 leading-relaxed">
                최신 엔진 의존성을 설치하고 누락된 파일을 복구합니다.<br />
                <span className="text-yellow-400">이미 존재하는 파일</span>은 기본적으로 건드리지 않습니다.
                덮어쓸 파일을 직접 선택하세요.
              </p>
            </div>

            {/* 파일 목록 */}
            <div className="flex-1 overflow-y-auto px-6 py-3 custom-scrollbar space-y-1">
              {updateDialog.specs.map(spec => {
                const isAlwaysOn = spec.overwriteIfExists
                const isChecked = isAlwaysOn || updateDialog.checked.has(spec.relativePath)
                return (
                  <label
                    key={spec.relativePath}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors select-none ${
                      isAlwaysOn
                        ? 'cursor-not-allowed opacity-60 bg-primary-600/10'
                        : isChecked
                          ? 'bg-primary-600/20 cursor-pointer'
                          : 'hover:bg-surface-800 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-primary-500 shrink-0"
                      checked={isChecked}
                      disabled={isAlwaysOn}
                      onChange={() => {
                        if (isAlwaysOn) return
                        setUpdateDialog(prev => {
                          if (!prev) return prev
                          const next = new Set(prev.checked)
                          if (next.has(spec.relativePath)) next.delete(spec.relativePath)
                          else next.add(spec.relativePath)
                          return { ...prev, checked: next }
                        })
                      }}
                    />
                    <span className="flex-1 min-w-0 block">
                      <span className="text-xs font-mono text-surface-200 truncate">{spec.label}</span>
                    </span>
                    {isAlwaysOn && (
                      <span className="shrink-0 text-[10px] text-primary-400">자동 갱신 대상</span>
                    )}
                    {isChecked && !isAlwaysOn && (
                      <span className="shrink-0 text-[10px] text-yellow-400 font-medium">덮어씀</span>
                    )}
                  </label>
                )
              })}
            </div>

            {/* 푸터 */}
            <div className="px-6 py-4 border-t border-surface-700 flex items-center justify-between gap-3">
              <p className="text-[11px] text-surface-500">
                {updateDialog.checked.size}개 파일 갱신 예정 · 네트워크에 따라 수십 초 소요
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setUpdateDialog(null)}
                  className="px-4 py-2 text-xs rounded-lg bg-surface-700 text-surface-300 hover:bg-surface-600 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleUpdateConfirm}
                  className="px-4 py-2 text-xs rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors font-medium"
                >
                  업데이트 시작
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

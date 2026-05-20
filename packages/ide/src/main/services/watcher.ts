import { watch, FSWatcher } from 'chokidar'
import path from 'path'
import { promises as fs } from 'fs'
import type { BrowserWindow } from 'electron'
import { WATCHER_DECL, getDeclarationTemplate } from '../../shared/templates'
import { compileBlueprint } from './compiler'

const WATCH_FOLDERS = [
  'assets',
  'scenes',
  'characters',
  'modules',
  'backgrounds',
  'effects',
  'fallbacks',
  'initials',
  'hooks',
]

export class ProjectWatcher {
  private watcher: FSWatcher | null = null
  private cacheWatcher: FSWatcher | null = null
  private projectPath: string = ''
  private win: BrowserWindow | null = null
  private debounceMap: Map<string, NodeJS.Timeout> = new Map()

  // TS 파일 내용 캐시 (IPC 왕복 없이 메모리에서 즉시 제공)
  private fileCache: Map<string, string> = new Map()
  private cacheReady = false
  private cacheReadyResolve: (() => void) | null = null
  private cacheReadyPromise: Promise<void> | null = null

  /**
   * 프로젝트 디렉토리 감시를 시작합니다.
   */
  public async start(projectPath: string, win?: BrowserWindow) {
    this.stop()
    this.projectPath = projectPath
    this.win = win ?? null

    // declarations/blueprintRuntime.ts 자동 생성 처리
    const runtimeDeclPath = path.join(projectPath, 'declarations', 'blueprintRuntime.ts')
    try {
      await fs.mkdir(path.dirname(runtimeDeclPath), { recursive: true })
      await fs.writeFile(runtimeDeclPath, BLUEPRINT_RUNTIME_CODE, 'utf-8')
      console.log(`[IDE] Generated blueprintRuntime.ts at ${runtimeDeclPath}`)
    } catch (e) {
      console.error('[IDE] Failed to generate blueprintRuntime.ts:', e)
    }

    // ── 1. 기존 watcher: WATCH_FOLDERS 선언 파일 자동 생성 ──
    const watchPaths = WATCH_FOLDERS.map((folder) => path.join(projectPath, folder))

    this.watcher = watch(watchPaths, {
      ignored: /(^|[\\\/])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
    })

    this.watcher
      .on('add', (filePath) => {
        handleBlueprintChange(filePath).then(() => {
          this.handleFileChange(filePath)
        })
      })
      .on('change', (filePath) => {
        handleBlueprintChange(filePath).then(() => {
          this.handleFileChange(filePath)
        })
      })
      .on('unlink', (filePath) => {
        handleBlueprintDelete(filePath).then(() => {
          this.handleFileChange(filePath)
          this.notifyFileDeleted(filePath)
        })
      })
      .on('unlinkDir', (dirPath) => {
        this.notifyDirDeleted(dirPath)
      })

    // ── 2. 캐시 watcher: 모든 .ts 파일 내용을 메모리에 유지 ──
    this.cacheReadyPromise = new Promise((resolve) => {
      this.cacheReadyResolve = resolve
    })

    this.cacheWatcher = watch(projectPath, {
      ignored: [/(^|[\\\/])\../, /node_modules/, /([\\\/])dist([\\\/]|$)/],
      persistent: true,
      ignoreInitial: false,
    })

    this.cacheWatcher
      .on('add', (filePath) => this.cacheFile(filePath))
      .on('change', (filePath) => this.cacheFile(filePath))
      .on('unlink', (filePath) => this.uncacheFile(filePath))
      .on('ready', () => {
        this.cacheReady = true
        this.cacheReadyResolve?.()
        console.log(`[IDE] File cache ready: ${this.fileCache.size} files`)
      })
  }

  /**
   * 프로젝트 디렉토리 감시를 중지합니다.
   */
  public stop() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.cacheWatcher) {
      this.cacheWatcher.close()
      this.cacheWatcher = null
    }
    for (const timeout of this.debounceMap.values()) {
      clearTimeout(timeout)
    }
    this.debounceMap.clear()
    this.fileCache.clear()
    this.cacheReady = false
    this.cacheReadyPromise = null
    this.cacheReadyResolve = null
    this.win = null
  }

  /**
   * 캐시된 모든 TS 파일 내용을 반환합니다.
   * 초기 스캔이 완료될 때까지 대기합니다.
   */
  public async getCachedFiles(): Promise<{ path: string; content: string }[]> {
    if (this.cacheReadyPromise) {
      await this.cacheReadyPromise
    }
    const result: { path: string; content: string }[] = []
    for (const [filePath, content] of this.fileCache) {
      result.push({ path: filePath, content })
    }
    return result
  }

  private async cacheFile(filePath: string) {
    if (!filePath.endsWith('.ts')) return
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this.fileCache.set(filePath.replace(/\\/g, '/'), content)
      // 초기 스캔 중에는 개별 알림 불필요 (getCachedFiles로 일괄 제공)
      if (this.cacheReady) {
        this.notifyFileChanged(filePath, content)
      }
    } catch { /* 파일 읽기 실패 무시 (삭제 중일 수 있음) */ }
  }

  private uncacheFile(filePath: string) {
    if (!filePath.endsWith('.ts')) return
    this.fileCache.delete(filePath.replace(/\\/g, '/'))
  }

  private handleFileChange(filePath: string) {
    try {
      const relativePath = path.relative(this.projectPath, filePath)
      const folder = relativePath.split(path.sep)[0]

      if (WATCH_FOLDERS.includes(folder)) {
        if (this.debounceMap.has(folder)) {
          clearTimeout(this.debounceMap.get(folder)!)
        }
        this.debounceMap.set(
          folder,
          setTimeout(() => {
            this.debounceMap.delete(folder)
            this.generateDeclaration(folder).catch((e) => {
              console.error(`[IDE] Failed to generate declaration for ${folder}:`, e)
            })
          }, 300)
        )
      }
    } catch (e) {
      console.error('File change handling error:', e)
    }
  }

  private async generateDeclaration(folder: string) {
    const folderPath = path.join(this.projectPath, folder)
    const declPath = path.join(this.projectPath, 'declarations', `${folder}.ts`)

    try {
      try {
        await fs.access(folderPath)
      } catch {
        return
      }

      const files = await getFilesRecursively(folderPath)

      // ── WATCHER_DECL에 정의된 폴더: 헤더/푸터 기반 생성 ─────────
      if (folder in WATCHER_DECL) {
        const content = await this.buildDeclContent(folder, files)
        await fs.mkdir(path.dirname(declPath), { recursive: true })
        await fs.writeFile(declPath, content, 'utf-8')
        console.log(`[IDE] Generated declaration: ${declPath}`)
        this.notifyFileChanged(declPath, content)

        // assets 생성 시 audios.ts도 함께 갱신
        if (folder === 'assets') {
          const audioContent = buildAudioDecl(files)
          const audioDeclPath = path.join(this.projectPath, 'declarations', 'audios.ts')
          await fs.writeFile(audioDeclPath, audioContent, 'utf-8')
          console.log(`[IDE] Generated declaration: ${audioDeclPath}`)
          this.notifyFileChanged(audioDeclPath, audioContent)
        }
        return
      }

      // ── 그 외 폴더 (scenes, characters): 기본 export 객체 ───────
      const content2 = buildDefaultDecl(folder, files)
      await fs.mkdir(path.dirname(declPath), { recursive: true })
      await fs.writeFile(declPath, content2, 'utf-8')
      console.log(`[IDE] Generated declaration: ${declPath}`)
      this.notifyFileChanged(declPath, content2)

      // scenes 생성 시 sceneKeys.ts도 함께 갱신
      if (folder === 'scenes') {
        const keysContent = buildSceneKeysDecl(files)
        const keysPath = path.join(this.projectPath, 'declarations', 'sceneKeys.ts')
        await fs.writeFile(keysPath, keysContent, 'utf-8')
        console.log(`[IDE] Generated declaration: ${keysPath}`)
        this.notifyFileChanged(keysPath, keysContent)
      }
    } catch (e) {
      console.error(`[IDE] Failed to generate declaration for ${folder}:`, e)
    }
  }

  private async buildDeclContent(
    folder: string,
    files: FileEntry[]
  ): Promise<string> {
    const decl = WATCHER_DECL[folder]!
    const tsFiles = files.filter((f) => f.name.endsWith('.ts'))

    if (folder === 'assets') {
      return buildAssetDecl(files)
    }

    if (folder === 'modules') {
      return buildModulesDecl(tsFiles)
    }

    if (folder === 'fallbacks') {
      return buildFallbacksDecl(tsFiles)
    }

    // backgrounds, effects: importStyle에 따라 import 방식 결정
    if (folder === 'backgrounds' || folder === 'effects') {
      const useDefault = decl.importStyle === 'default'
      const imports = tsFiles
        .map((f) => {
          const importName = toImportName(f.rel)
          const relPathNoExt = removeExt(f.rel)
          return useDefault
            ? `import ${importName} from '@/${folder}/${relPathNoExt}'`
            : `import * as ${importName} from '@/${folder}/${relPathNoExt}'`
        })
        .join('\n')

      const entries = tsFiles
        .map((f) => {
          const importName = toImportName(f.rel)
          const key = removeExt(f.rel).replace(/\\/g, '/')
          return `  '${key}': ${importName},`
        })
        .join('\n')

      const importBlock = imports ? `${imports}\n\n` : ''
      return `${importBlock}${decl.header}${entries ? `\n${entries}\n` : ''}${decl.footer}`
    }

    // audios (WATCHER_DECL에 있지만 buildAudioDecl로 처리 — 여기 도달 안 함)
    return getDeclarationTemplate(folder)
  }

  private notifyFileChanged(filePath: string, content: string): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('fs:fileChanged', { path: filePath.replace(/\\/g, '/') , content })
    }
  }

  private notifyFileDeleted(filePath: string): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('fs:fileDeleted', { path: filePath.replace(/\\/g, '/') })
    }
  }

  private notifyDirDeleted(dirPath: string): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('fs:dirDeleted', { path: dirPath.replace(/\\/g, '/') })
    }
  }
}

// ─── 순수 함수 헬퍼 ──────────────────────────────────────────

interface FileEntry {
  name: string
  path: string
  rel: string
}

async function getFilesRecursively(
  dir: string,
  relativeRoot: string = ''
): Promise<FileEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  let result: FileEntry[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const relativeEntryPath = relativeRoot
      ? `${relativeRoot}/${entry.name}`
      : entry.name
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      result = result.concat(await getFilesRecursively(fullPath, relativeEntryPath))
    } else {
      result.push({ name: entry.name, path: fullPath, rel: relativeEntryPath })
    }
  }
  return result
}

/** `ch1/intro.ts` → `_ch1_intro` */
function toImportName(rel: string): string {
  return '_' + removeExt(rel).replace(/[^a-zA-Z0-9_]/g, '_')
}

/** `ch1/intro.ts` → `ch1/intro` */
function removeExt(rel: string): string {
  const parsed = path.parse(rel)
  return parsed.dir ? `${parsed.dir}/${parsed.name}` : parsed.name
}

// ─── 폴더별 선언 생성 함수 ────────────────────────────────────

function buildAssetDecl(files: FileEntry[]): string {
  const decl = WATCHER_DECL['assets']!
  const audioExt = /\.(mp3|wav|ogg|m4a|aac)$/i
  const entries = files
    .filter((f) => !f.name.endsWith('.ts') && !audioExt.test(f.name))
    .map((f) => {
      const relFwd = f.rel.replace(/\\/g, '/')
      return `  '${relFwd}': './assets/${relFwd}',`
    })
    .join('\n')

  return `${decl.header}${entries ? `\n${entries}\n` : ''}${decl.footer}`
}

function buildAudioDecl(files: FileEntry[]): string {
  const decl = WATCHER_DECL['audios']!
  const audioExt = /\.(mp3|wav|ogg|m4a|aac)$/i
  const entries = files
    .filter((f) => audioExt.test(f.name))
    .map((f) => {
      const relFwd = f.rel.replace(/\\/g, '/')
      return `  '${relFwd}': './assets/${relFwd}',`
    })
    .join('\n')

  return `${decl.header}${entries ? `\n${entries}\n` : ''}${decl.footer}`
}

function buildModulesDecl(tsFiles: FileEntry[]): string {
  const decl = WATCHER_DECL['modules']!

  if (tsFiles.length === 0) {
    return `${decl.header}\nexport default defineCustomModules({\n\n${decl.footer}`
  }

  const imports = tsFiles
    .map((f) => {
      const importName = toImportName(f.rel)
      const relPathNoExt = removeExt(f.rel)
      return `import ${importName} from '@/modules/${relPathNoExt}'`
    })
    .join('\n')

  const entries = tsFiles
    .map((f) => {
      const importName = toImportName(f.rel)
      const key = removeExt(f.rel).replace(/\\/g, '/')
      return `  '${key}': ${importName},`
    })
    .join('\n')

  return `${decl.header}${imports}\n\nexport default defineCustomModules({\n${entries}\n${decl.footer}`
}

function buildFallbacksDecl(tsFiles: FileEntry[]): string {
  const decl = WATCHER_DECL['fallbacks']!

  const imports = tsFiles
    .map((f) => {
      const importName = toImportName(f.rel)
      const relPathNoExt = removeExt(f.rel)
      return `import ${importName} from '@/fallbacks/${relPathNoExt}'`
    })
    .join('\n')

  const entries = tsFiles
    .map((f) => `  ${toImportName(f.rel)},`)
    .join('\n')

  const importBlock = imports ? `${imports}\n\n` : ''
  return `${importBlock}${decl.header}${entries ? `\n${entries}\n` : ''}${decl.footer}`
}

function buildDefaultDecl(folder: string, files: FileEntry[]): string {
  const tsFiles = files.filter((f) => f.name.endsWith('.ts'))

  const imports = tsFiles
    .map((f) => {
      const importName = toImportName(f.rel)
      const relPathNoExt = removeExt(f.rel)
      return `import ${importName} from '@/${folder}/${relPathNoExt}'`
    })
    .join('\n')

  const entries = tsFiles
    .map((f) => {
      const key = removeExt(f.rel).replace(/\\/g, '/')
      return `  '${key}': ${toImportName(f.rel)},`
    })
    .join('\n')

  const importBlock = imports ? `${imports}\n\n` : ''
  
  return `${importBlock}export default {\n${entries}\n} as const\n`
}

function buildSceneKeysDecl(files: FileEntry[]): string {
  const tsFiles = files.filter((f) => f.name.endsWith('.ts'))
  const keys = tsFiles
    .map((f) => `  '${removeExt(f.rel).replace(/\\/g, '/')}'`)
    .join(',\n')
  return `export default [\n${keys}\n] as const\n`
}

async function handleBlueprintChange(filePath: string): Promise<void> {
  if (!filePath.endsWith('.fbp.json')) return
  const tsPath = filePath.replace(/\.fbp\.json$/, '.ts')
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const compiled = compileBlueprint(content)
    await fs.writeFile(tsPath, compiled, 'utf-8')
    console.log(`[IDE] Compiled blueprint: ${filePath} -> ${tsPath}`)
  } catch (err) {
    console.error(`[IDE] Failed to compile blueprint ${filePath}:`, err)
  }
}

async function handleBlueprintDelete(filePath: string): Promise<void> {
  if (!filePath.endsWith('.fbp.json')) return
  const tsPath = filePath.replace(/\.fbp\.json$/, '.ts')
  try {
    await fs.unlink(tsPath)
    console.log(`[IDE] Deleted compiled blueprint helper: ${tsPath}`)
  } catch (err) {
    // 이미 지워졌거나 없으면 무시
  }
}

const BLUEPRINT_RUNTIME_CODE = `// =============================================================
// declarations/blueprintRuntime.ts — 블루프린트 런타임 해석기 공용 유틸
// =============================================================

export interface BlueprintNode {
  id: string
  data?: {
    nodeType: string
    fieldName?: string
    varName?: string
    varType?: string
    operator?: string
    eventType?: string
    value?: any
    [key: string]: any
  }
}

export interface BlueprintEdge {
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface BlueprintGraph {
  nodes: BlueprintNode[]
  edges: BlueprintEdge[]
}

export interface BlueprintRuntimeContext {
  cmd?: any
  ctx: any
  state: any
  setState: (updates: any) => void
  outputs: Map<string, any>
}

/**
 * 런타임 상에서 저장된 블루프린트 그래프의 노드 연결 상태를 기반으로 흐름을 해석하고 연산을 실행합니다.
 */
export function runBlueprintFlow(
  tabName: string,
  graphs: Record<string, BlueprintGraph>,
  entryNodeType: string,
  runtimeContext: BlueprintRuntimeContext
): Generator<any, any, any> | undefined {
  const graph = graphs[tabName]
  if (!graph || !graph.nodes) return

  // 진입 엔트리 노드 탐색
  const entryNode = graph.nodes.find((n) => n.data?.nodeType === entryNodeType)
  if (!entryNode) return

  const { ctx, state, setState, outputs } = runtimeContext

  // 데이터 핀 의존성 역방향 재귀 연산
  function evaluatePin(handleId: string): any {
    if (outputs.has(handleId)) {
      return outputs.get(handleId)
    }

    // handleId 예: "node_id__pin_id"
    const index = handleId.indexOf('__')
    if (index === -1) return undefined
    const nodeId = handleId.substring(0, index)
    const pinId = handleId.substring(index + 2)

    // 해당 입력 핀에 연결된 소스 엣지 조회
    const incomingEdge = (graph.edges || []).find(
      (e) => e.target === nodeId && e.targetHandle === handleId
    )

    if (incomingEdge && incomingEdge.sourceHandle) {
      // 소스 노드 연산 평가
      return evaluateNodePin(incomingEdge.source, incomingEdge.sourceHandle)
    }

    // 연결선이 없는 경우 노드 자체의 리터럴 데이터 반환
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (node && node.data && pinId in node.data) {
      return node.data[pinId]
    }

    return undefined
  }

  function evaluateNodePin(nodeId: string, handleId: string): any {
    if (outputs.has(handleId)) {
      return outputs.get(handleId)
    }

    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) return undefined

    const nodeType = node.data?.nodeType

    let val: any = undefined

    // 노드 타입별 연산 분기
    if (nodeType === 'GetState') {
      const field = node.data?.fieldName
      if (field) val = state[field]
    } else if (nodeType === 'GetCmd') {
      const field = node.data?.fieldName
      if (field && runtimeContext.cmd) val = runtimeContext.cmd[field]
    } else if (nodeType === 'GetVariable') {
      const name = node.data?.varName
      const type = node.data?.varType || 'local'
      if (ctx.variables && name) {
        val = ctx.variables.get(name, type)
      }
    } else if (nodeType === 'GetCamera') {
      val = ctx.world?.camera
    } else if (nodeType === 'Constant') {
      val = node.data?.value
    } else if (nodeType === 'Compare') {
      const op = node.data?.operator || '=='
      const a = evaluatePin(nodeId + '__a')
      const b = evaluatePin(nodeId + '__b')
      if (op === '==') val = (a == b)
      else if (op === '!=') val = (a != b)
      else if (op === '<') val = (a < b)
      else if (op === '>') val = (a > b)
      else if (op === '<=') val = (a <= b)
      else if (op === '>=') val = (a >= b)
    } else if (nodeType === 'MathOp') {
      const op = node.data?.operator || '+'
      const a = Number(evaluatePin(nodeId + '__a') || 0)
      const b = Number(evaluatePin(nodeId + '__b') || 0)
      if (op === '+') val = a + b
      else if (op === '-') val = a - b
      else if (op === '*') val = a * b
      else if (op === '/') val = b === 0 ? 0 : a / b
    } else if (nodeType === 'MakePosition') {
      const x = Number(evaluatePin(nodeId + '__x') || 0)
      const y = Number(evaluatePin(nodeId + '__y') || 0)
      const z = Number(evaluatePin(nodeId + '__z') || 0)
      val = { x, y, z }
    } else if (nodeType === 'CreateRectangle') {
      const style = evaluatePin(nodeId + '__style') || {}
      const position = evaluatePin(nodeId + '__position')
      if (ctx.world) {
        val = ctx.world.createRectangle({
          style,
          transform: position ? { position } : undefined
        })
      }
    } else if (nodeType === 'CreateEllipse') {
      const style = evaluatePin(nodeId + '__style') || {}
      const position = evaluatePin(nodeId + '__position')
      if (ctx.world) {
        val = ctx.world.createEllipse({
          style,
          transform: position ? { position } : undefined
        })
      }
    } else if (nodeType === 'CreateText') {
      const text = evaluatePin(nodeId + '__text') || ''
      const style = evaluatePin(nodeId + '__style') || {}
      const position = evaluatePin(nodeId + '__position')
      if (ctx.world) {
        val = ctx.world.createText({
          text,
          style,
          transform: position ? { position } : undefined
        })
      }
    } else if (nodeType === 'CreateImage') {
      const image = evaluatePin(nodeId + '__image') || ''
      const style = evaluatePin(nodeId + '__style') || {}
      const position = evaluatePin(nodeId + '__position')
      if (ctx.world) {
        val = ctx.world.createImage({
          src: image,
          style,
          transform: position ? { position } : undefined
        })
      }
    }

    outputs.set(handleId, val)
    return val
  }

  // 실행 흐름 제어 제너레이터 함수
  function* executeNode(currentNodeId: string): Generator<any, any, any> {
    const node = graph.nodes.find((n) => n.id === currentNodeId)
    if (!node) return

    const nodeType = node.data?.nodeType

    let nextPinId = 'exec-out'

    if (nodeType === 'SetState') {
      const field = node.data?.fieldName
      const val = evaluatePin(currentNodeId + '__value')
      if (field) {
        setState({ [field]: val })
      }
    } else if (nodeType === 'SetVariable') {
      const name = evaluatePin(currentNodeId + '__name')
      const val = evaluatePin(currentNodeId + '__value')
      const type = node.data?.varType || 'local'
      if (ctx.variables && name) {
        ctx.variables.set(name, val, type)
      }
    } else if (nodeType === 'AddChild') {
      const parent = evaluatePin(currentNodeId + '__parent')
      const child = evaluatePin(currentNodeId + '__child')
      if (parent && typeof parent.addChild === 'function' && child) {
        parent.addChild(child)
      }
    } else if (nodeType === 'FadeIn') {
      const obj = evaluatePin(currentNodeId + '__object')
      const dur = Number(evaluatePin(currentNodeId + '__duration') ?? 1000)
      if (obj && typeof obj.fadeIn === 'function') {
        obj.fadeIn(dur)
      }
    } else if (nodeType === 'FadeOut') {
      const obj = evaluatePin(currentNodeId + '__object')
      const dur = Number(evaluatePin(currentNodeId + '__duration') ?? 1000)
      if (obj && typeof obj.fadeOut === 'function') {
        obj.fadeOut(dur)
      }
    } else if (nodeType === 'RemoveObject') {
      const obj = evaluatePin(currentNodeId + '__object')
      if (obj && typeof obj.remove === 'function') {
        obj.remove()
      }
    } else if (nodeType === 'BindEvent') {
      const obj = evaluatePin(currentNodeId + '__object')
      const eventType = node.data?.eventType
      if (obj && eventType && typeof obj.on === 'function') {
        obj.on(eventType, () => {
          // 필요 시 트리거 기능 바인딩
        })
      }
    } else if (nodeType === 'Branch') {
      const cond = evaluatePin(currentNodeId + '__condition')
      nextPinId = cond ? 'true' : 'false'
    } else if (nodeType === 'Yield') {
      yield { action: 'wait' }
    } else if (nodeType === 'Log') {
      const message = evaluatePin(currentNodeId + '__message')
      console.log(message)
    } else if (nodeType === 'Return') {
      const val = evaluatePin(currentNodeId + '__value')
      return val ?? true
    }

    // 다음 연결된 노드로 실행 이동
    const outgoingEdge = (graph.edges || []).find(
      (e) => e.source === currentNodeId && e.sourceHandle === (currentNodeId + '__' + nextPinId)
    )
    if (outgoingEdge) {
      yield* executeNode(outgoingEdge.target)
    }
  }

  // 엔트리 노드의 다음 연결된 노드부터 순차 탐색 실행
  const firstEdge = (graph.edges || []).find(
    (e) => e.source === entryNode.id && e.sourceHandle === (entryNode.id + '__exec-out')
  )
  if (firstEdge) {
    return executeNode(firstEdge.target)
  }
}
`

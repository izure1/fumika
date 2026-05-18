import { watch, FSWatcher } from 'chokidar'
import path from 'path'
import { promises as fs } from 'fs'
import type { BrowserWindow } from 'electron'
import { WATCHER_DECL, getDeclarationTemplate } from '../../shared/templates'

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

    // ── 1. 기존 watcher: WATCH_FOLDERS 선언 파일 자동 생성 ──
    const watchPaths = WATCH_FOLDERS.map((folder) => path.join(projectPath, folder))

    this.watcher = watch(watchPaths, {
      ignored: /(^|[\\\/])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
    })

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => {
        this.handleFileChange(filePath)
        this.notifyFileDeleted(filePath)
      })
      .on('unlinkDir', (dirPath) => {
        this.notifyDirDeleted(dirPath)
      })
    // 'change'는 export 구조가 바뀌지 않으면 선언 재생성 불필요

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

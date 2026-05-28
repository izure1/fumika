import { promises as fs } from 'fs'
import path from 'path'
import { execFile, spawn } from 'child_process'
import prettier from 'prettier'
import { getNovelConfigContent, MAIN_TS_CONTENT, getIndexHtmlContent, EFFECT_TYPES, getInitialEffectContent, getViteConfigContent, getElectronMainContent, getAppPackageJsonContent, getElectronBuilderConfigContent, RUNTIME_CONTENT, SAVE_MANAGER_CONTENT, BLUEPRINT_RUNTIME_CODE } from '../../shared/templates'

async function runCommandLive(
  cmd: string,
  args: string[],
  options: { cwd: string, env?: any },
  onLog?: (msg: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach((line: string) => {
        const msg = line.trim()
        if (msg) {
          if (onLog) onLog(msg)
          else console.log(msg)
        }
      })
    })

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach((line: string) => {
        const msg = line.trim()
        if (msg) {
          if (onLog) onLog(msg)
          else console.warn(msg)
        }
      })
    })

    child.on('error', (err) => {
      reject(err)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with exit code ${code}`))
    })
  })
}

const DEFAULT_FOLDERS = [
  'assets',
  'scenes',
  'characters',
  'modules',
  'declarations',
  'backgrounds',
  'effects',
  'fallbacks',
  'initials',
  'hooks',
  'helpers'
]

export interface ProjectOptions {
  gameName: string
  projectId: string
  processName: string
  width: number
  height: number
  version?: string
  author?: string
  description?: string
}

export async function ensureEffectsFiles(targetDir: string) {
  const effectsDir = path.join(targetDir, 'effects')
  try {
    await fs.access(effectsDir)
  } catch {
    await fs.mkdir(effectsDir, { recursive: true })
  }

  for (const effectType of EFFECT_TYPES) {
    const filePath = path.join(effectsDir, `${effectType}.ts`)
    try {
      await fs.access(filePath)
    } catch {
      let content = getInitialEffectContent(effectType)
      try {
        content = await prettier.format(content, {
          parser: 'typescript',
          semi: false,
          singleQuote: true,
          trailingComma: 'none'
        })
      } catch (e) {
        console.warn('[IDE] Failed to format effect file:', e)
      }
      await fs.writeFile(filePath, content, 'utf-8')
    }
  }
}


export async function ensureProjectDependencies(targetDir: string, options?: Partial<ProjectOptions>, forceUpdate = false): Promise<void> {
  const packageJsonPath = path.join(targetDir, 'package.json')
  let needsInstall = false

  try {
    await fs.access(packageJsonPath)
    try {
      await fs.access(path.join(targetDir, 'node_modules', 'fumika'))
    } catch {
      needsInstall = true
    }
  } catch {
    needsInstall = true
    const pkg = {
      name: options?.processName || path.basename(targetDir).replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() || 'fumika-project',
      productName: options?.gameName || 'My Visual Novel',
      appId: options?.projectId || 'com.example.game',
      description: options?.description || '',
      author: options?.author || 'Fumika',
      private: true,
      version: options?.version || '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build'
      }
    }
    await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8')
  }

  const tsconfigPath = path.join(targetDir, 'tsconfig.json')
  try {
    await fs.access(tsconfigPath)
  } catch {
    const tsconfig = {
      compilerOptions: {
        target: 'ESNext',
        useDefineForClassFields: true,
        module: 'ESNext',
        lib: ['ESNext', 'DOM'],
        moduleResolution: 'bundler',
        paths: {
          '@/*': ['./*']
        },
        strict: true,
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
        noEmit: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitReturns: true
      },
      include: ['**/*.ts']
    }
    await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf-8')
  }

  if (needsInstall || forceUpdate) {
    console.log('[IDE] Installing fumika, document-dataply and vite from npm to', targetDir)
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

    await new Promise<void>((resolve, reject) => {
      execFile(npmCmd, ['install', 'fumika', 'document-dataply'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
        if (err) {
          console.error('[IDE] npm install fumika and document-dataply failed:', stderr)
          reject(err)
        } else {
          execFile(npmCmd, ['install', '--save-dev', 'vite', 'typescript@6', 'vite-plugin-pwa', '@types/node'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
            if (err) {
              console.error('[IDE] npm install vite failed:', stderr)
              reject(err)
            } else {
              console.log('[IDE] Dependencies installed from npm')
              resolve()
            }
          })
        }
      })
    })
  }
}

// ─── 프로젝트 파일 룩업 테이블 ────────────────────────────────────
// overwriteIfExists: true  → 파일이 이미 있어도 항상 최신 템플릿으로 덮어씀
// overwriteIfExists: false → 파일이 이미 있으면 건드리지 않음 (사용자 수정 보호)
// UI에서 overrideFiles 목록을 넘기면 해당 relativePath는 강제 덮어씀

interface ProjectFileContext {
  width: number
  height: number
  gameName: string
}

export interface ProjectFileSpec {
  /** 프로젝트 루트 기준 상대 경로 (키로도 사용) */
  relativePath: string
  /** UI에 표시될 사람이 읽기 쉬운 이름 */
  label: string
  /** 파일 내용 생성 함수 */
  getContent: (ctx: ProjectFileContext) => string
  /** true면 파일이 이미 있어도 최신 템플릿으로 덮어씀 (기본값) */
  overwriteIfExists: boolean
}

const PROJECT_FILE_SPECS: ProjectFileSpec[] = [
  // ─── config & core ────────────────────────────────────
  {
    relativePath: 'novel.config.ts',
    label: 'novel.config.ts',
    getContent: (ctx) => getNovelConfigContent(ctx.width, ctx.height),
    overwriteIfExists: false,
  },
  {
    relativePath: 'main.ts',
    label: 'main.ts',
    getContent: () => MAIN_TS_CONTENT,
    overwriteIfExists: false,
  },
  {
    relativePath: 'index.html',
    label: 'index.html',
    getContent: (ctx) => getIndexHtmlContent(ctx.gameName),
    overwriteIfExists: false,
  },
  {
    relativePath: 'vite.config.ts',
    label: 'vite.config.ts',
    getContent: () => getViteConfigContent(),
    overwriteIfExists: false,
  },

  // ─── helpers ──────────────────────────────────────────
  // helpers 파일은 사용자가 직접 수정할 수 있으므로 기본적으로 덮어쓰지 않음
  // blueprintRuntime.ts는 IDE가 자동 생성하는 코드이므로 항상 최신으로 갱신
  {
    relativePath: 'helpers/Runtime.ts',
    label: 'helpers/Runtime.ts',
    getContent: () => RUNTIME_CONTENT,
    overwriteIfExists: true,
  },
  {
    relativePath: 'helpers/SaveManager.ts',
    label: 'helpers/SaveManager.ts',
    getContent: () => SAVE_MANAGER_CONTENT,
    overwriteIfExists: true,
  },
  {
    relativePath: 'helpers/blueprintRuntime.ts',
    label: 'helpers/blueprintRuntime.ts',
    getContent: () => BLUEPRINT_RUNTIME_CODE,
    overwriteIfExists: true,
  },
]

/**
 * UI에서 파일 목록을 조회할 수 있도록 spec의 직렬화 가능한 부분만 반환합니다.
 */
export function getProjectFileSpecs(): Array<{ relativePath: string; label: string; overwriteIfExists: boolean }> {
  return PROJECT_FILE_SPECS.map(({ relativePath, label, overwriteIfExists }) => ({
    relativePath,
    label,
    overwriteIfExists,
  }))
}

export async function ensureProjectStructure(
  targetDir: string,
  options?: Partial<ProjectOptions>,
  overrideFiles: string[] = []
): Promise<void> {
  for (const folder of DEFAULT_FOLDERS) {
    await fs.mkdir(path.join(targetDir, folder), { recursive: true })
  }

  await ensureEffectsFiles(targetDir)

  const ctx: ProjectFileContext = {
    width: options?.width ?? 1920,
    height: options?.height ?? 1080,
    gameName: options?.gameName ?? 'My Novel Project',
  }

  const overrideSet = new Set(overrideFiles)

  for (const spec of PROJECT_FILE_SPECS) {
    const filePath = path.join(targetDir, spec.relativePath)
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    const shouldOverwrite = spec.overwriteIfExists || overrideSet.has(spec.relativePath)

    if (shouldOverwrite) {
      await fs.writeFile(filePath, spec.getContent(ctx), 'utf-8')
    } else {
      try {
        await fs.access(filePath)
      } catch {
        await fs.writeFile(filePath, spec.getContent(ctx), 'utf-8')
      }
    }
  }
}

export async function updateProject(targetDir: string, overrideFiles: string[] = []): Promise<void> {
  await ensureProjectStructure(targetDir, undefined, overrideFiles)
  await ensureProjectDependencies(targetDir, undefined, true)
}

/**
 * 스캐폴딩: 대상 디렉토리에 빈 프로젝트 구조를 생성합니다.
 */
export async function scaffoldProject(targetDir: string, options: ProjectOptions): Promise<void> {
  await ensureProjectStructure(targetDir, options)
  await ensureProjectDependencies(targetDir, options)
}

async function copyProjectAssets(targetDir: string, outDir: string) {
  // TS 소스 코드(backgrounds, effects 등)는 Vite가 번들링하므로 제외하고,
  // 순수 미디어 파일들이 담긴 assets 폴더만 복사합니다.
  const assetFolders = ['assets']
  for (const folder of assetFolders) {
    const src = path.join(targetDir, folder)
    const dest = path.join(targetDir, outDir, folder)
    try {
      await fs.access(src)
      await fs.cp(src, dest, { recursive: true })
    } catch {
      // Folder might not exist, just ignore
    }
  }
}

/**
 * 프로젝트 빌드 (Vite 정적 웹 빌드 및 플랫폼별 패키징)
 */
export async function buildProject(targetDir: string, options?: { target: string, resizable?: boolean, installer?: boolean, devTools?: boolean }, onLog?: (msg: string) => void): Promise<string> {
  const log = (msg: string) => {
    console.log(msg)
    if (onLog) onLog(msg)
  }

  const isPwa = options?.target === 'pwa'
  const isWindows = options?.target === 'windows'
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

  // targetDir의 package.json에서 빌드 정보 추출 (Windows 앱, PWA 공통 사용)
  let appName = 'fumika-game'
  let appProductName = 'FumikaGame'
  let appId = 'com.fumika.game'
  let appVersion = '1.0.0'
  let appAuthor = 'Fumika'
  let appDescription = 'Fumika Visual Novel'
  try {
    const projectPkgContent = await fs.readFile(path.join(targetDir, 'package.json'), 'utf-8')
    const projectPkg = JSON.parse(projectPkgContent)
    if (projectPkg.name) appName = projectPkg.name
    if (projectPkg.productName) appProductName = projectPkg.productName
    if (projectPkg.appId) appId = projectPkg.appId
    if (projectPkg.version) appVersion = projectPkg.version
    if (projectPkg.author) appAuthor = projectPkg.author
    if (projectPkg.description) appDescription = projectPkg.description
  } catch (e) {
    log(`[IDE] Warning: Could not read package.json for app info: ${e}`)
  }

  if (isPwa) {
    log('[IDE] Ensuring vite-plugin-pwa is installed for PWA build...')
    try {
      await runCommandLive(npmCmd, ['install', '--save-dev', 'vite-plugin-pwa'], { cwd: targetDir }, onLog)
    } catch (e: any) {
      log(`[IDE] npm install vite-plugin-pwa failed: ${e.message}`)
      throw e
    }
  }

  // 항상 최신 템플릿으로 vite.config.ts를 덮어씁니다. (구버전 충돌 방지)
  const viteConfigPath = path.join(targetDir, 'vite.config.ts')
  await fs.writeFile(viteConfigPath, getViteConfigContent({
    pwa: isPwa,
    appName: appProductName,
    shortName: appProductName,
    description: appDescription,
  }), 'utf-8')

  // package.json의 최신 메타데이터로 index.html을 항상 덮어씁니다.
  // (프로젝트 생성 이후 메타데이터가 변경되어도 빌드 시 반영됨)
  const indexHtmlPath = path.join(targetDir, 'index.html')
  await fs.writeFile(indexHtmlPath, getIndexHtmlContent({
    gameName: appProductName,
    description: appDescription,
    author: appAuthor,
  }), 'utf-8')

  // 하위 호환성을 위해 package.json에 build 스크립트가 없다면 추가
  const packageJsonPath = path.join(targetDir, 'package.json')
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    if (!pkg.scripts?.build) {
      pkg.scripts = pkg.scripts || {}
      pkg.scripts.build = 'vite build'
      await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf-8')
    }
  } catch (e) {
    console.warn('[IDE] Failed to verify package.json for build script:', e)
  }

  return new Promise<string>((resolve, reject) => {
    const env = { ...process.env }
    let isLibraryTs = false

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    env.BUILD_TIME = timestamp
    const outDir = `dist/${timestamp}`

    if (options?.target) {
      if (options.target === 'library-ts' || options.target === 'library-js') {
        env.BUILD_TARGET = 'library'
      } else {
        env.BUILD_TARGET = options.target
      }

      if (options.target === 'library-ts') {
        isLibraryTs = true
      }
    }

    log(`[IDE] Starting Vite build (Target: ${env.BUILD_TARGET})...`)

    runCommandLive(npmCmd, ['run', 'build'], { cwd: targetDir, env }, onLog).then(async () => {
      log('[IDE] Vite build success')

      if (isLibraryTs) {
        try {
          log('[IDE] Starting TSC declaration generation...')
          const tsconfigBuildPath = path.join(targetDir, 'tsconfig.build.json')
          const tsconfigBuildContent = JSON.stringify({
            extends: "./tsconfig.json",
            compilerOptions: {
              noEmit: false,
              declaration: true,
              emitDeclarationOnly: true,
              noEmitOnError: false,
              outDir: `./${outDir}/types`
            },
            include: ["**/*.ts"]
          }, null, 2)
          await fs.writeFile(tsconfigBuildPath, tsconfigBuildContent, 'utf-8')

          const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
          try {
            await runCommandLive(npxCmd, ['tsc', '-p', 'tsconfig.build.json'], { cwd: targetDir, env }, onLog)
            log('[IDE] TS Declarations generated successfully')
          } catch (tscErr: any) {
            log(`[IDE] TSC build finished with warnings/errors: ${tscErr.message}`)
          }

          try {
            await fs.unlink(tsconfigBuildPath) // cleanup
          } catch (e) {
            log(`[IDE] Failed to cleanup tsconfig.build.json: ${e}`)
          }

          await copyProjectAssets(targetDir, outDir)
          resolve(outDir)
        } catch (e) {
          reject(e)
        }
      } else if (isWindows) {
        try {
          await copyProjectAssets(targetDir, outDir)
          log('[IDE] Starting Windows Packaging...')

          let width = 1920
          let height = 1080
          try {
            const configContent = await fs.readFile(path.join(targetDir, 'novel.config.ts'), 'utf-8')
            const widthMatch = configContent.match(/width:\s*(\d+)/)
            if (widthMatch) width = parseInt(widthMatch[1])

            const heightMatch = configContent.match(/height:\s*(\d+)/)
            if (heightMatch) height = parseInt(heightMatch[1])
          } catch (e) {
            log(`[IDE] Failed to parse novel.config.ts for build: ${e}`)
          }

          const distPath = path.join(targetDir, outDir)
          // 앱 런타임 구동용 package.json
          await fs.writeFile(path.join(distPath, 'package.json'), getAppPackageJsonContent(appName, appProductName, appVersion, appAuthor, appDescription), 'utf-8')

          // electron 버전 추출
          let electronVersion = '28.2.0'
          try {
            const pkgContent = await fs.readFile(path.join(targetDir, 'node_modules', 'electron', 'package.json'), 'utf-8')
            electronVersion = JSON.parse(pkgContent).version
          } catch (e) {
            log(`[IDE] Warning: Could not detect electron version, fallback to ${electronVersion}`)
          }

          const outWindowsDir = `dist/${timestamp}_windows`

          // 패키징 전용 빌드 설정 파일 (루트에 임시 생성)
          const builderConfigPath = path.join(targetDir, 'electron-builder.json')
          await fs.writeFile(builderConfigPath, getElectronBuilderConfigContent(electronVersion, outDir, outWindowsDir, !!options?.installer, appId, appProductName, appAuthor), 'utf-8')

          const mainJsContent = getElectronMainContent(width, height, !!options?.resizable, !!options?.devTools)
          await fs.writeFile(path.join(distPath, 'main.js'), mainJsContent, 'utf-8')

          log('[IDE] Ensuring electron and electron-builder are installed...')
          try {
            await runCommandLive(npmCmd, ['install', '--save-dev', 'electron', 'electron-builder'], { cwd: targetDir }, onLog)
          } catch (installErr: any) {
            log(`[IDE] Failed to install electron/builder: ${installErr.message}`)
            throw installErr
          }

          log('[IDE] Running electron-builder...')
          const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
          try {
            const packagerArgs = [
              'electron-builder',
              '--config',
              'electron-builder.json',
              '--win'
            ]
            await runCommandLive(npxCmd, packagerArgs, { cwd: targetDir }, onLog)
            try {
              await fs.unlink(builderConfigPath)
            } catch (e) { }

            // 빌드 결과물 정리 로직
            const fullOutWindowsDir = path.join(targetDir, outWindowsDir)

            // 무설치판(dir)일 경우 win-unpacked 폴더 자체를 appName으로 rename
            // (파일을 개별 이동하면 app.asar 같은 특수 파일에서 EBUSY/Invalid package 에러 발생)
            if (!options?.installer) {
              const unpackedDir = path.join(fullOutWindowsDir, 'win-unpacked')
              const renamedDir = path.join(fullOutWindowsDir, appName)
              // watcher/antivirus가 파일 핸들을 잠시 잡을 수 있으므로 재시도
              const maxRetries = 5
              const retryDelayMs = 800
              let renamed = false
              for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                  await fs.rename(unpackedDir, renamedDir)
                  renamed = true
                  break
                } catch (e: any) {
                  if (attempt < maxRetries && (e.code === 'EPERM' || e.code === 'EBUSY')) {
                    log(`[IDE] rename 시도 ${attempt}/${maxRetries} 실패 (${e.code}), ${retryDelayMs}ms 후 재시도...`)
                    await new Promise((r) => setTimeout(r, retryDelayMs))
                  } else {
                    log(`[IDE] Warning: Failed to rename win-unpacked folder: ${e}`)
                    break
                  }
                }
              }
              if (renamed) {
                log(`[IDE] win-unpacked → ${appName} 폴더 이름 변경 완료`)
              }
            }

            // 디버그용 yml 찌꺼기 파일 및 .icon-ico 폴더 삭제
            try {
              const filesInOut = await fs.readdir(fullOutWindowsDir)
              for (const file of filesInOut) {
                if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                  await fs.unlink(path.join(fullOutWindowsDir, file)).catch(() => { })
                }
                if (file === '.icon-ico') {
                  await fs.rm(path.join(fullOutWindowsDir, file), { recursive: true, force: true }).catch(() => { })
                }
              }
            } catch (e) { }

          } catch (packErr: any) {
            try {
              await fs.unlink(builderConfigPath)
            } catch (e) { }
            log(`[IDE] electron-builder failed: ${packErr.message}`)
            throw packErr
          }

          resolve(outWindowsDir)
        } catch (err) {
          reject(err)
        }
      } else {
        await copyProjectAssets(targetDir, outDir)
        resolve(outDir)
      }
    }).catch(err => {
      log(`[IDE] Build failed: ${err.message}`)
      reject(err)
    })
  })
}

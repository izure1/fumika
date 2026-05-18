import { promises as fs } from 'fs'
import path from 'path'
import { execFile, spawn } from 'child_process'
import prettier from 'prettier'
import licenseContent from '../../../LICENSE?raw'
import { getNovelConfigContent, MAIN_TS_CONTENT, getIndexHtmlContent, getDeclarationTemplate, EFFECT_TYPES, getInitialEffectContent, getViteConfigContent, getElectronMainContent, getAppPackageJsonContent, getElectronBuilderConfigContent } from '../../shared/templates'

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
  'hooks'
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
    console.log('[IDE] Installing fumika and vite from npm to', targetDir)
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

    await new Promise<void>((resolve, reject) => {
      execFile(npmCmd, ['install', 'fumika'], { cwd: targetDir, shell: true }, (err, _stdout, stderr) => {
        if (err) {
          console.error('[IDE] npm install fumika failed:', stderr)
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

export async function ensureProjectStructure(targetDir: string, options?: Partial<ProjectOptions>): Promise<void> {
  for (const folder of DEFAULT_FOLDERS) {
    const dirPath = path.join(targetDir, folder)
    await fs.mkdir(dirPath, { recursive: true })
  }

  const declareFiles = ['assets', 'scenes', 'sceneKeys', 'characters', 'modules', 'backgrounds', 'effects', 'fallbacks', 'audios']
  for (const file of declareFiles) {
    const filePath = path.join(targetDir, 'declarations', `${file}.ts`)
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, getDeclarationTemplate(file as any), 'utf-8')
    }
  }

  const typesDeclPath = path.join(targetDir, 'declarations', 'types.d.ts')
  try {
    await fs.access(typesDeclPath)
  } catch {
    await fs.writeFile(typesDeclPath, getDeclarationTemplate('types'), 'utf-8')
  }

  await ensureEffectsFiles(targetDir)

  // 기본 설정 파일 및 코어 파일 생성
  const width = options?.width ?? 1920
  const height = options?.height ?? 1080
  const gameName = options?.gameName ?? 'My Novel Project'

  const configPath = path.join(targetDir, 'novel.config.ts')
  const mainPath = path.join(targetDir, 'main.ts')

  try {
    await fs.access(configPath)
  } catch {
    await fs.writeFile(configPath, getNovelConfigContent(width, height), 'utf-8')
  }

  try {
    await fs.access(mainPath)
  } catch {
    await fs.writeFile(mainPath, MAIN_TS_CONTENT, 'utf-8')
  }

  const indexPath = path.join(targetDir, 'index.html')
  try {
    await fs.access(indexPath)
  } catch {
    await fs.writeFile(indexPath, getIndexHtmlContent(gameName), 'utf-8')
  }

  const licensePath = path.join(targetDir, 'LICENSE')
  try {
    await fs.access(licensePath)
  } catch {
    await fs.writeFile(licensePath, licenseContent, 'utf-8')
  }

  const viteConfigPath = path.join(targetDir, 'vite.config.ts')
  try {
    await fs.access(viteConfigPath)
  } catch {
    await fs.writeFile(viteConfigPath, getViteConfigContent(), 'utf-8')
  }
}

export async function updateProject(targetDir: string): Promise<void> {
  await ensureProjectStructure(targetDir)
  // Force update by passing true
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
export async function buildProject(targetDir: string, options?: { target: string, resizable?: boolean, installer?: boolean }, onLog?: (msg: string) => void): Promise<string> {
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
  await fs.writeFile(viteConfigPath, getViteConfigContent({ pwa: isPwa, appName: appProductName, shortName: appProductName }), 'utf-8')

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
          await fs.writeFile(builderConfigPath, getElectronBuilderConfigContent(electronVersion, outDir, outWindowsDir, !!options?.installer, appId, appProductName), 'utf-8')

          const mainJsContent = getElectronMainContent(width, height, !!options?.resizable)
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

            // 무설치판(dir)일 경우 win-unpacked의 모든 파일을 바깥으로 꺼내고 폴더 삭제
            if (!options?.installer) {
              const unpackedDir = path.join(fullOutWindowsDir, 'win-unpacked')
              try {
                const files = await fs.readdir(unpackedDir)
                for (const file of files) {
                  await fs.rename(path.join(unpackedDir, file), path.join(fullOutWindowsDir, file))
                }
                await fs.rm(unpackedDir, { recursive: true, force: true })
              } catch (e) {
                log(`[IDE] Warning: Failed to cleanup win-unpacked folder: ${e}`)
              }
            }

            // 디버그용 yml 찌꺼기 파일 삭제
            try {
              const filesInOut = await fs.readdir(fullOutWindowsDir)
              for (const file of filesInOut) {
                if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                  await fs.unlink(path.join(fullOutWindowsDir, file)).catch(() => { })
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
